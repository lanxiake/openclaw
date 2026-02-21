/**
 * 配置合并器
 *
 * 将数据库配置覆盖到文件配置上，生成最终的 OpenClawConfig。
 * 原则：数据库有值则覆盖文件对应字段，数据库无值则保留文件值。
 * 所有操作均遵循不可变模式——不修改任何输入对象。
 */

import type { GatewayBindMode } from "../config/types.gateway.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { GatewayConfig as DbGatewayConfig } from "../db/schema/gateway-configs.js";
import type { ModelProvider } from "../db/schema/model-configs.js";
import type { AgentDefaultConfig } from "../db/schema/model-configs.js";
import type { AuthProfile, AuthProfileOrderRecord } from "../db/schema/auth-profiles.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 从数据库加载的各配置表数据 */
export interface DatabaseConfigs {
  /** gateway_configs 表的有效配置（system 或 tenant） */
  gatewayConfig: DbGatewayConfig | null;
  /** model_providers 表的有效提供商列表 */
  modelProviders: ModelProvider[];
  /** agent_configs 表的有效配置 */
  agentConfig: AgentDefaultConfig | null;
  /** system_configs 表的 KV 配置（key → value） */
  systemConfigs: Record<string, unknown>;
  /** auth_profiles 表的有效 profile 列表 */
  authProfiles: AuthProfile[];
  /** auth_profile_order 表的有效排序列表 */
  authProfileOrders: AuthProfileOrderRecord[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * 判断是否为普通对象（非 null、非数组）
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * 深度合并两个对象，source 中的值优先
 *
 * - 两者都是 PlainObject → 递归合并
 * - 其他情况 → source 胜出
 */
function deepMerge(target: unknown, source: unknown): unknown {
  if (isPlainObject(target) && isPlainObject(source)) {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      result[key] = key in result ? deepMerge(result[key], source[key]) : source[key];
    }
    return result;
  }
  return source;
}

// ---------------------------------------------------------------------------
// Gateway 配置合并
// ---------------------------------------------------------------------------

/**
 * 将数据库 gateway_configs 行合并到文件配置的 gateway 段
 */
function mergeGatewayConfig(fileConfig: OpenClawConfig, dbGw: DbGatewayConfig): OpenClawConfig {
  const fileGw = fileConfig.gateway ?? {};

  // 1. 标量字段合并（数据库非 null 则覆盖）
  const gateway: OpenClawConfig["gateway"] = {
    ...fileGw,
    mode: dbGw.gatewayMode as "local" | "remote",
    port: dbGw.gatewayPort ?? fileGw.port,
    bind: (dbGw.gatewayBind as GatewayBindMode) ?? fileGw.bind,
    auth: {
      ...fileGw.auth,
      mode: dbGw.authMode as "token" | "password" | "none",
      ...(dbGw.authToken != null ? { token: dbGw.authToken } : {}),
      ...(dbGw.authPassword != null ? { password: dbGw.authPassword } : {}),
      allowTailscale: dbGw.authAllowTailscale ?? fileGw.auth?.allowTailscale,
    },
    controlUi: {
      ...fileGw.controlUi,
      enabled: dbGw.controlUiEnabled ?? fileGw.controlUi?.enabled,
      allowInsecureAuth: dbGw.controlUiAllowInsecureAuth ?? fileGw.controlUi?.allowInsecureAuth,
    },
    tailscale: {
      ...fileGw.tailscale,
      mode: (dbGw.tailscaleMode as "off" | "serve" | "funnel") ?? fileGw.tailscale?.mode,
      resetOnExit: dbGw.tailscaleResetOnExit ?? fileGw.tailscale?.resetOnExit,
    },
  };

  // 2. extraConfig JSONB 深度合并到 gateway 子段
  if (isPlainObject(dbGw.extraConfig)) {
    const extra = dbGw.extraConfig as Record<string, unknown>;
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null) {
        const existing = (gateway as Record<string, unknown>)[key];
        (gateway as Record<string, unknown>)[key] = isPlainObject(existing)
          ? deepMerge(existing, value)
          : value;
      }
    }
  }

  return { ...fileConfig, gateway };
}

// ---------------------------------------------------------------------------
// Model Providers 合并
// ---------------------------------------------------------------------------

/**
 * 将数据库 model_providers 行列表合并到文件配置的 models.providers 段
 *
 * 策略：按 providerKey 合并，数据库存在则覆盖文件的同名 provider
 *
 * 注意：数据库中 models 字段存储为字符串数组 ["model-id-1", "model-id-2"]，
 * 但 OpenClawConfig 期望 ModelDefinitionConfig[]（对象数组）。
 * 此函数负责将字符串数组转换为最小化的 ModelDefinitionConfig 格式。
 */
function mergeModelProviders(
  fileConfig: OpenClawConfig,
  dbProviders: ModelProvider[],
): OpenClawConfig {
  const fileModels = fileConfig.models ?? {};
  const fileProviders = fileModels.providers ?? {};

  // 先克隆文件的 providers
  const merged: Record<string, unknown> = { ...fileProviders };

  // 数据库 provider 覆盖
  for (const dbProv of dbProviders) {
    // DB 中 models 可能是字符串数组或对象数组，统一转换为 ModelDefinitionConfig[] 格式
    const rawModels = dbProv.models;
    const normalizedModels = normalizeDbModels(rawModels);

    merged[dbProv.providerKey] = {
      baseUrl: dbProv.baseUrl,
      apiKey: dbProv.apiKey,
      api: dbProv.apiType,
      models: normalizedModels,
    };
  }

  return {
    ...fileConfig,
    models: {
      ...fileModels,
      providers: merged as OpenClawConfig["models"] extends { providers?: infer P } ? P : never,
    },
  };
}

/**
 * 将数据库中的 models 字段标准化为 ModelDefinitionConfig[] 格式
 *
 * 数据库存储格式可能是：
 * - 字符串数组: ["claude-opus-4-6", "claude-sonnet-4-5"]
 * - 对象数组: [{ id: "claude-opus-4-6", ... }]
 * - 其他格式: 返回空数组
 *
 * 对于字符串数组，自动生成最小化的 ModelDefinitionConfig 对象。
 */
function normalizeDbModels(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) {
          return null;
        }
        // 字符串模型 ID → 最小化 ModelDefinitionConfig
        return {
          id: trimmed,
          name: trimmed,
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 200000,
          maxTokens: 16000,
        };
      }
      if (isPlainObject(item) && typeof (item as Record<string, unknown>).id === "string") {
        // 已经是对象格式，直接使用
        return item;
      }
      return null;
    })
    .filter((item): item is Record<string, unknown> => item != null);
}

// ---------------------------------------------------------------------------
// Agent 默认配置合并
// ---------------------------------------------------------------------------

/**
 * 将数据库 agent_configs 行合并到文件配置的 agents.defaults 段
 *
 * 策略：数据库非 null 字段覆盖文件值
 */
function mergeAgentConfig(fileConfig: OpenClawConfig, dbAgent: AgentDefaultConfig): OpenClawConfig {
  const fileAgents = fileConfig.agents ?? {};
  const fileDefaults = (fileAgents.defaults ?? {}) as Record<string, unknown>;
  let merged: Record<string, unknown> = { ...fileDefaults };

  // 映射数据库列到 agents.defaults 字段
  const fieldMap: Array<[string, string, unknown]> = [
    ["model", "primaryModel", dbAgent.primaryModel],
    ["workspace", "workspacePath", dbAgent.workspacePath],
    ["compactionMode", "compactionMode", dbAgent.compactionMode],
    ["maxConcurrent", "maxConcurrent", dbAgent.maxConcurrent],
    ["subagentsMaxConcurrent", "subagentsMaxConcurrent", dbAgent.subagentsMaxConcurrent],
  ];

  for (const [configKey, _dbKey, value] of fieldMap) {
    if (value != null) {
      merged[configKey] = value;
    }
  }

  // extraConfig 深度合并
  if (isPlainObject(dbAgent.extraConfig)) {
    merged = deepMerge(merged, dbAgent.extraConfig) as Record<string, unknown>;
  }

  return {
    ...fileConfig,
    agents: {
      ...fileAgents,
      defaults: merged,
    } as OpenClawConfig["agents"],
  };
}

// ---------------------------------------------------------------------------
// System Configs KV 合并
// ---------------------------------------------------------------------------

/**
 * 将 system_configs KV 对合并到文件配置的对应段
 *
 * 策略：每个 key 对应 OpenClawConfig 的一个顶层段，进行深度合并
 */
function mergeSystemConfigs(
  fileConfig: OpenClawConfig,
  systemConfigs: Record<string, unknown>,
): OpenClawConfig {
  if (Object.keys(systemConfigs).length === 0) {
    return fileConfig;
  }

  let merged = { ...fileConfig };

  for (const [key, value] of Object.entries(systemConfigs)) {
    if (value === undefined || value === null) {
      continue;
    }

    const existing = (merged as Record<string, unknown>)[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      (merged as Record<string, unknown>)[key] = deepMerge(existing, value);
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Auth Profiles 合并
// ---------------------------------------------------------------------------

/**
 * 将数据库 auth_profiles + auth_profile_order 合并到文件配置的 auth 段
 *
 * 策略：
 * - auth.profiles: 按 profileId 合并，数据库存在则覆盖文件的同名 profile
 * - auth.order: 按 agentKey 合并，数据库存在则覆盖文件的同名排序
 * - auth.cooldowns: 从 auth_profiles 的 cooldownConfig 合并（仅取第一个非空值作为全局冷却配置）
 */
function mergeAuthProfiles(
  fileConfig: OpenClawConfig,
  dbProfiles: AuthProfile[],
  dbOrders: AuthProfileOrderRecord[],
): OpenClawConfig {
  if (dbProfiles.length === 0 && dbOrders.length === 0) {
    return fileConfig;
  }

  const fileAuth = fileConfig.auth ?? {};
  const fileProfiles = fileAuth.profiles ?? {};
  const fileOrder = fileAuth.order ?? {};

  // 1. 合并 profiles：数据库记录转换为 AuthProfileConfig 格式
  const mergedProfiles: Record<string, { provider: string; mode: string; email?: string }> = {
    ...fileProfiles,
  };

  for (const dbProfile of dbProfiles) {
    if (!dbProfile.enabled) {
      continue;
    }

    mergedProfiles[dbProfile.profileId] = {
      provider: dbProfile.provider,
      mode: dbProfile.credentialMode as "api_key" | "oauth" | "token",
      ...(dbProfile.email != null ? { email: dbProfile.email } : {}),
    };
  }

  // 2. 合并 order：数据库排序覆盖文件排序
  const mergedOrder: Record<string, string[]> = { ...fileOrder };

  for (const dbOrder of dbOrders) {
    const profileIds = dbOrder.profileIds;
    if (Array.isArray(profileIds) && profileIds.length > 0) {
      mergedOrder[dbOrder.agentKey] = profileIds as string[];
    }
  }

  // 3. 合并 cooldowns：取数据库 profile 中第一个非空的 cooldownConfig
  let mergedCooldowns = fileAuth.cooldowns;
  for (const dbProfile of dbProfiles) {
    if (isPlainObject(dbProfile.cooldownConfig)) {
      mergedCooldowns = {
        ...mergedCooldowns,
        ...(dbProfile.cooldownConfig as Record<string, unknown>),
      } as typeof mergedCooldowns;
      break;
    }
  }

  return {
    ...fileConfig,
    auth: {
      ...fileAuth,
      profiles: mergedProfiles as typeof fileAuth.profiles,
      order: mergedOrder as typeof fileAuth.order,
      ...(mergedCooldowns ? { cooldowns: mergedCooldowns } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 合并文件配置和数据库配置
 *
 * 优先级：数据库 > 文件
 * 合并粒度：字段级深度合并（非整段替换）
 *
 * @param fileConfig - 从 openclaw.json 加载的配置
 * @param dbConfigs  - 从数据库加载的配置集合
 * @returns 合并后的 OpenClawConfig（新对象，不修改输入）
 */
export function mergeFileAndDbConfigs(
  fileConfig: OpenClawConfig,
  dbConfigs: DatabaseConfigs,
): OpenClawConfig {
  let merged = { ...fileConfig };

  // 1. 合并 gateway 配置
  if (dbConfigs.gatewayConfig) {
    merged = mergeGatewayConfig(merged, dbConfigs.gatewayConfig);
  }

  // 2. 合并 model providers
  if (dbConfigs.modelProviders.length > 0) {
    merged = mergeModelProviders(merged, dbConfigs.modelProviders);
  }

  // 3. 合并 agent 默认配置
  if (dbConfigs.agentConfig) {
    merged = mergeAgentConfig(merged, dbConfigs.agentConfig);
  }

  // 4. 合并 system_configs KV
  merged = mergeSystemConfigs(merged, dbConfigs.systemConfigs);

  // 5. 合并 auth profiles + order
  merged = mergeAuthProfiles(merged, dbConfigs.authProfiles, dbConfigs.authProfileOrders);

  return merged;
}

// ---------------------------------------------------------------------------
// 配置来源分析
// ---------------------------------------------------------------------------

/** 配置来源标识 */
export type ConfigSource = "file" | "db-system" | "db-tenant";

/** 各配置段的来源映射 */
export type ConfigSourcesMap = Record<string, ConfigSource>;

/**
 * 根据 configType 字段判断数据库来源级别
 *
 * @param configType - 数据库记录的 configType 值
 * @returns "db-system" 或 "db-tenant"
 */
function resolveDbSource(configType: string | null | undefined): ConfigSource {
  return configType === "tenant" ? "db-tenant" : "db-system";
}

/**
 * 分析配置各段的来源信息
 *
 * 根据 DatabaseConfigs 中各表是否有数据、以及 configType 字段判断来源。
 * 没有数据库记录的段标记为 "file"。
 *
 * 返回的 key 对应配置段路径：
 * - gateway: Gateway 基础配置
 * - models.providers: 模型提供商
 * - agents.defaults: Agent 默认参数
 * - auth.profiles: 认证 Profile
 * - auth.order: 认证 Profile 排序
 * - system.<key>: System Configs KV 段
 *
 * @param _fileConfig - 文件配置（用于未来扩展判断 file 段是否存在）
 * @param dbConfigs   - 数据库配置集合
 * @returns 每个配置段的来源标注
 */
export function buildConfigSources(
  _fileConfig: OpenClawConfig,
  dbConfigs: DatabaseConfigs,
): ConfigSourcesMap {
  const sources: ConfigSourcesMap = {};

  // 1. Gateway 配置来源
  sources.gateway = dbConfigs.gatewayConfig
    ? resolveDbSource(dbConfigs.gatewayConfig.configType)
    : "file";

  // 2. Model Providers 来源
  if (dbConfigs.modelProviders.length > 0) {
    // 如果存在任何 tenant 记录，标记为 db-tenant；否则 db-system
    const hasTenant = dbConfigs.modelProviders.some((p) => p.configType === "tenant");
    sources["models.providers"] = hasTenant ? "db-tenant" : "db-system";
  } else {
    sources["models.providers"] = "file";
  }

  // 3. Agent 默认配置来源
  sources["agents.defaults"] = dbConfigs.agentConfig
    ? resolveDbSource(dbConfigs.agentConfig.configType)
    : "file";

  // 4. Auth Profiles 来源
  if (dbConfigs.authProfiles.length > 0) {
    const hasTenant = dbConfigs.authProfiles.some((p) => p.configType === "tenant");
    sources["auth.profiles"] = hasTenant ? "db-tenant" : "db-system";
  } else {
    sources["auth.profiles"] = "file";
  }

  // 5. Auth Profile Order 来源
  if (dbConfigs.authProfileOrders.length > 0) {
    const hasTenant = dbConfigs.authProfileOrders.some((o) => o.configType === "tenant");
    sources["auth.order"] = hasTenant ? "db-tenant" : "db-system";
  } else {
    sources["auth.order"] = "file";
  }

  // 6. System Configs KV 来源（每个 key 独立标注）
  for (const key of Object.keys(dbConfigs.systemConfigs)) {
    sources[`system.${key}`] = "db-system";
  }

  return sources;
}
