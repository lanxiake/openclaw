/**
 * Gateway 配置加载器
 *
 * 支持多种配置源:
 * 1. 数据库配置 (优先级最高)
 * 2. 环境变量
 * 3. 默认配置
 */

import { eq, inArray } from "drizzle-orm";

import { getLogger } from "../logging/logger.js";
import { getDatabase } from "../db/connection.js";
import { generateId } from "../db/utils/id.js";
import { GatewayConfigRepository } from "../db/repositories/gateway-configs.js";
import {
  ModelProviderRepository,
  AgentDefaultConfigRepository,
} from "../db/repositories/model-configs.js";
import {
  AuthProfileRepository,
  AuthProfileOrderRepository,
} from "../db/repositories/auth-profile-configs.js";
import { systemConfigs } from "../db/schema/system-config.js";
import type { DatabaseConfigs } from "./config-merger.js";

const logger = getLogger();

/**
 * Gateway 配置接口
 */
export interface GatewayConfig {
  mode: "local" | "remote";
  port: number;
  bind: "loopback" | "tailnet" | "0.0.0.0" | "::";
  auth: {
    mode: "none" | "token" | "password";
    token?: string;
    password?: string;
    allowTailscale?: boolean;
  };
  controlUi: {
    enabled: boolean;
    allowInsecureAuth: boolean;
  };
  tailscale: {
    mode: "off" | "serve";
    resetOnExit: boolean;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GatewayConfig = {
  mode: "local",
  port: 18789,
  bind: "loopback",
  auth: {
    mode: "none", // 开发环境默认无需认证
    allowTailscale: false,
  },
  controlUi: {
    enabled: true,
    allowInsecureAuth: true, // 开发环境允许
  },
  tailscale: {
    mode: "off",
    resetOnExit: false,
  },
};

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(): Partial<GatewayConfig> {
  const config: Partial<GatewayConfig> = {};

  // Gateway 模式
  if (process.env.GATEWAY_MODE) {
    config.mode = process.env.GATEWAY_MODE as "local" | "remote";
  }

  // Gateway 端口
  if (process.env.GATEWAY_PORT) {
    config.port = parseInt(process.env.GATEWAY_PORT, 10);
  }

  // Gateway 绑定地址
  if (process.env.GATEWAY_BIND) {
    config.bind = process.env.GATEWAY_BIND as any;
  }

  // 认证配置
  if (process.env.GATEWAY_AUTH_MODE) {
    config.auth = {
      mode: process.env.GATEWAY_AUTH_MODE as "none" | "token" | "password",
      token: process.env.GATEWAY_AUTH_TOKEN,
      password: process.env.GATEWAY_AUTH_PASSWORD,
    };
  }

  return config;
}

/**
 * 从数据库加载配置
 */
async function loadConfigFromDatabase(userId?: string): Promise<GatewayConfig | null> {
  try {
    const db = getDatabase();
    const repo = new GatewayConfigRepository(db);

    // 获取有效配置 (租户配置优先)
    const dbConfig = await repo.getEffectiveConfig(userId);

    if (!dbConfig) {
      return null;
    }

    // 转换数据库配置为 Gateway 配置格式
    return {
      mode: (dbConfig.gatewayMode as "local" | "remote") || "local",
      port: dbConfig.gatewayPort || 18789,
      bind: (dbConfig.gatewayBind as any) || "loopback",
      auth: {
        mode: (dbConfig.authMode as "none" | "token" | "password") || "none",
        token: dbConfig.authToken || undefined,
        password: dbConfig.authPassword || undefined,
        allowTailscale: dbConfig.authAllowTailscale || false,
      },
      controlUi: {
        enabled: dbConfig.controlUiEnabled !== false,
        allowInsecureAuth: dbConfig.controlUiAllowInsecureAuth || false,
      },
      tailscale: {
        mode: (dbConfig.tailscaleMode as "off" | "serve") || "off",
        resetOnExit: dbConfig.tailscaleResetOnExit || false,
      },
    };
  } catch (error) {
    logger.warn("[ConfigLoader] 从数据库加载配置失败:", error);
    return null;
  }
}

/**
 * 加载 Gateway 配置
 *
 * 配置优先级:
 * 1. 数据库配置 (租户配置 > 系统配置)
 * 2. 环境变量
 * 3. 默认配置
 */
export async function loadGatewayConfig(userId?: string): Promise<GatewayConfig> {
  logger.info("[ConfigLoader] 加载 Gateway 配置...", { userId });

  // 1. 尝试从数据库加载
  try {
    const dbConfig = await loadConfigFromDatabase(userId);
    if (dbConfig) {
      logger.info("[ConfigLoader] 使用数据库配置");
      return dbConfig;
    }
  } catch (error) {
    logger.warn("[ConfigLoader] 数据库配置加载失败,回退到环境变量:", error);
  }

  // 2. 从环境变量加载
  const envConfig = loadConfigFromEnv();

  // 3. 合并配置 (环境变量 > 默认配置)
  const finalConfig: GatewayConfig = {
    ...DEFAULT_CONFIG,
    ...envConfig,
    auth: {
      ...DEFAULT_CONFIG.auth,
      ...envConfig.auth,
    },
    controlUi: {
      ...DEFAULT_CONFIG.controlUi,
      ...envConfig.controlUi,
    },
    tailscale: {
      ...DEFAULT_CONFIG.tailscale,
      ...envConfig.tailscale,
    },
  };

  logger.info("[ConfigLoader] 使用环境变量 + 默认配置", {
    mode: finalConfig.mode,
    port: finalConfig.port,
    authMode: finalConfig.auth.mode,
  });

  return finalConfig;
}

/**
 * 验证配置有效性
 */
export function validateGatewayConfig(config: GatewayConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证端口
  if (config.port < 1 || config.port > 65535) {
    errors.push(`无效的端口号: ${config.port}`);
  }

  // 验证认证模式
  if (config.auth.mode === "token" && !config.auth.token) {
    errors.push("认证模式为 token,但未提供 token");
  }

  if (config.auth.mode === "password" && !config.auth.password) {
    errors.push("认证模式为 password,但未提供 password");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 完整数据库配置加载（Phase 1 新增）
// ---------------------------------------------------------------------------

/** system_configs 中需要加载的 B 类配置 key 列表 */
const SYSTEM_CONFIG_KEYS = [
  "logging",
  "session",
  "messages",
  "cron",
  "hooks",
  "approvals",
  "talk",
  "ui",
  "tools",
  "memory_embedding",
  "memory_llm",
] as const;

/**
 * 从数据库加载所有配置表的数据
 *
 * 并行查询 gateway_configs、model_providers、agent_configs、system_configs，
 * 返回 DatabaseConfigs 供 config-merger 合并使用。
 * 任何数据库错误均被捕获并返回 null（不阻塞 Gateway 启动）。
 *
 * @param userId - 可选的租户 ID（传入时返回租户级有效配置）
 * @returns DatabaseConfigs 或 null（数据库不可用时）
 */
export async function loadAllDatabaseConfigs(userId?: string): Promise<DatabaseConfigs | null> {
  try {
    const db = getDatabase();

    const gwRepo = new GatewayConfigRepository(db);
    const mpRepo = new ModelProviderRepository(db);
    const acRepo = new AgentDefaultConfigRepository(db);
    const apRepo = new AuthProfileRepository(db);
    const apoRepo = new AuthProfileOrderRepository(db);

    // 并行查询所有配置表（含 auth_profiles）
    const [
      gatewayConfig,
      modelProviders,
      agentConfig,
      systemConfigRows,
      authProfiles,
      authProfileOrders,
    ] = await Promise.all([
      gwRepo.getEffectiveConfig(userId),
      mpRepo.listEffectiveProviders(userId),
      acRepo.getEffectiveConfig(userId),
      loadSystemConfigEntries(db),
      apRepo.listEffectiveProfiles(userId),
      apoRepo.listEffectiveOrders(userId),
    ]);

    logger.info("[ConfigLoader] 数据库配置加载完成", {
      hasGateway: gatewayConfig != null,
      providerCount: modelProviders.length,
      hasAgent: agentConfig != null,
      systemConfigKeys: Object.keys(systemConfigRows),
      authProfileCount: authProfiles.length,
      authProfileOrderCount: authProfileOrders.length,
    });

    return {
      gatewayConfig,
      modelProviders,
      agentConfig,
      systemConfigs: systemConfigRows,
      authProfiles,
      authProfileOrders,
    };
  } catch (error) {
    logger.warn("[ConfigLoader] 数据库配置加载失败，将使用文件配置:", error);
    return null;
  }
}

/**
 * 批量查询 system_configs 表中的 B 类配置项
 *
 * @returns key → value 的映射表
 */
async function loadSystemConfigEntries(
  db: ReturnType<typeof getDatabase>,
): Promise<Record<string, unknown>> {
  try {
    const rows = await db
      .select({ key: systemConfigs.key, value: systemConfigs.value })
      .from(systemConfigs)
      .where(inArray(systemConfigs.key, [...SYSTEM_CONFIG_KEYS]));

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  } catch (error) {
    logger.warn("[ConfigLoader] system_configs 查询失败:", error);
    return {};
  }
}

// ---------------------------------------------------------------------------
// 记忆系统默认配置初始化
// ---------------------------------------------------------------------------

/** 记忆系统 embedding 默认配置 */
const DEFAULT_MEMORY_EMBEDDING_CONFIG = {
  provider: "openai",
  model: "Qwen3-Embedding-0.6B",
  dimensions: 1024,
  baseUrl: "https://wss.sczxsc.cn:35031/v1",
};

/** 记忆系统 LLM 默认配置 */
const DEFAULT_MEMORY_LLM_CONFIG = {
  enabled: true,
  provider: "anthropic",
  model: "anyrouter/claude-opus-4-6",
  maxTokens: 1024,
  temperature: 0.3,
  timeoutMs: 30_000,
};

/**
 * 确保数据库中存在记忆系统默认配置
 *
 * 在 Gateway 启动时调用，检查 system_configs 表中是否已存在
 * memory_embedding 和 memory_llm 配置。如果不存在则插入默认值。
 * 已存在的配置不会被覆盖。
 *
 * @param db - 数据库实例
 */
export async function ensureMemorySystemConfigs(db: ReturnType<typeof getDatabase>): Promise<void> {
  try {
    const existingRows = await db
      .select({ key: systemConfigs.key })
      .from(systemConfigs)
      .where(inArray(systemConfigs.key, ["memory_embedding", "memory_llm"]));

    const existingKeys = new Set(existingRows.map((r) => r.key));

    const toInsert: Array<{
      id: string;
      key: string;
      value: unknown;
      valueType: "json";
      group: string;
      description: string;
      isReadonly: boolean;
      isSensitive: boolean;
      requiresRestart: boolean;
    }> = [];

    if (!existingKeys.has("memory_embedding")) {
      toInsert.push({
        id: generateId(),
        key: "memory_embedding",
        value: DEFAULT_MEMORY_EMBEDDING_CONFIG,
        valueType: "json",
        group: "memory",
        description: "记忆系统向量嵌入服务配置（provider, model, dimensions, baseUrl）",
        isReadonly: false,
        isSensitive: false,
        requiresRestart: false,
      });
    }

    if (!existingKeys.has("memory_llm")) {
      toInsert.push({
        id: generateId(),
        key: "memory_llm",
        value: DEFAULT_MEMORY_LLM_CONFIG,
        valueType: "json",
        group: "memory",
        description: "记忆系统 LLM 服务配置（provider, model, maxTokens, temperature）",
        isReadonly: false,
        isSensitive: false,
        requiresRestart: false,
      });
    }

    if (toInsert.length > 0) {
      await db.insert(systemConfigs).values(toInsert);
      logger.info("[ConfigLoader] 已插入记忆系统默认配置", {
        keys: toInsert.map((r) => r.key),
      });
    } else {
      logger.debug("[ConfigLoader] 记忆系统配置已存在，跳过插入");
    }
  } catch (error) {
    logger.warn("[ConfigLoader] 记忆系统默认配置初始化失败:", error);
  }
}
