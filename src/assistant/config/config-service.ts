/**
 * 系统配置服务
 *
 * 提供系统配置的 CRUD 操作，支持：
 * - 配置分组管理
 * - 敏感数据脱敏
 * - 变更历史追踪
 * - 默认值和验证规则
 */

import { eq, like, and, sql, desc } from "drizzle-orm";
import { getDatabase, generateId } from "../../db/index.js";
import {
  systemConfigs,
  configChangeHistory,
  type SystemConfig,
  type NewSystemConfig,
  type ConfigChangeHistory,
  type ConfigValueType,
  type ConfigGroup,
  CONFIG_GROUPS,
  CONFIG_KEYS,
} from "../../db/schema/system-config.js";

/**
 * 配置服务选项
 */
export interface ConfigServiceOptions {
  /** 是否记录变更历史 */
  enableHistory?: boolean;
  /** 变更人 ID */
  adminId?: string;
  /** 变更人名称 */
  adminName?: string;
  /** IP 地址 */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 配置搜索参数
 */
export interface ConfigSearchParams {
  /** 分组过滤 */
  group?: string;
  /** 关键字搜索 */
  search?: string;
  /** 是否包含敏感配置 */
  includeSensitive?: boolean;
  /** 分页偏移 */
  offset?: number;
  /** 分页限制 */
  limit?: number;
}

/**
 * 配置搜索结果
 */
export interface ConfigSearchResult {
  configs: SystemConfig[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * 获取所有配置
 */
export async function getAllConfigs(
  params: ConfigSearchParams = {}
): Promise<ConfigSearchResult> {
  console.log("[ConfigService] 获取所有配置, params:", params);

  const db = await getDatabase();
  const {
    group,
    search,
    includeSensitive = false,
    offset = 0,
    limit = 100,
  } = params;

  // 构建查询条件
  const conditions = [];

  if (group) {
    conditions.push(eq(systemConfigs.group, group));
  }

  if (search) {
    conditions.push(
      sql`(${systemConfigs.key} ILIKE ${`%${search}%`} OR ${systemConfigs.description} ILIKE ${`%${search}%`})`
    );
  }

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(systemConfigs)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = Number(countResult[0]?.count || 0);

  // 查询配置列表
  let configs = await db
    .select()
    .from(systemConfigs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(systemConfigs.group, systemConfigs.key)
    .offset(offset)
    .limit(limit);

  // 脱敏处理
  if (!includeSensitive) {
    configs = configs.map((config) => {
      if (config.isSensitive) {
        return {
          ...config,
          value: "******",
        };
      }
      return config;
    });
  }

  console.log("[ConfigService] 查询结果: total=", total, ", returned=", configs.length);

  return {
    configs,
    total,
    offset,
    limit,
  };
}

/**
 * 根据 key 获取配置
 */
export async function getConfigByKey(
  key: string,
  options: { includeSensitive?: boolean } = {}
): Promise<SystemConfig | null> {
  console.log("[ConfigService] 获取配置:", key);

  const db = await getDatabase();

  const result = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  if (result.length === 0) {
    console.log("[ConfigService] 配置不存在:", key);
    return null;
  }

  const config = result[0];

  // 脱敏处理
  if (config.isSensitive && !options.includeSensitive) {
    return {
      ...config,
      value: "******",
    };
  }

  return config;
}

/**
 * 获取配置值（仅返回值）
 */
export async function getConfigValue<T = unknown>(
  key: string,
  defaultValue?: T
): Promise<T> {
  console.log("[ConfigService] 获取配置值:", key);

  const db = await getDatabase();

  const result = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  if (result.length === 0) {
    console.log("[ConfigService] 配置不存在，使用默认值:", key, defaultValue);
    return defaultValue as T;
  }

  return result[0].value as T;
}

/**
 * 设置配置值
 */
export async function setConfigValue(
  key: string,
  value: unknown,
  options: ConfigServiceOptions = {}
): Promise<SystemConfig> {
  console.log("[ConfigService] 设置配置值:", key);

  const db = await getDatabase();
  const { enableHistory = true, adminId, adminName, ipAddress, userAgent } = options;

  // 检查配置是否存在
  const existing = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`配置项不存在: ${key}`);
  }

  const config = existing[0];

  // 检查是否只读
  if (config.isReadonly) {
    throw new Error(`配置项 ${key} 是只读的`);
  }

  // 记录变更历史
  if (enableHistory) {
    await db.insert(configChangeHistory).values({
      id: generateId(),
      configId: config.id,
      configKey: key,
      oldValue: config.value,
      newValue: value,
      changeType: "update",
      changedBy: adminId,
      changedByName: adminName,
      ipAddress,
      userAgent,
    });
  }

  // 更新配置
  const updated = await db
    .update(systemConfigs)
    .set({
      value,
      updatedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(systemConfigs.key, key))
    .returning();

  console.log("[ConfigService] 配置已更新:", key);

  return updated[0];
}

/**
 * 创建配置
 */
export async function createConfig(
  data: {
    key: string;
    value: unknown;
    valueType?: ConfigValueType;
    group?: string;
    description?: string;
    isSensitive?: boolean;
    isReadonly?: boolean;
    requiresRestart?: boolean;
    defaultValue?: unknown;
    validationRules?: Record<string, unknown>;
  },
  options: ConfigServiceOptions = {}
): Promise<SystemConfig> {
  console.log("[ConfigService] 创建配置:", data.key);

  const db = await getDatabase();
  const { enableHistory = true, adminId, adminName, ipAddress, userAgent } = options;

  // 检查是否已存在
  const existing = await db
    .select({ id: systemConfigs.id })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, data.key))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`配置项已存在: ${data.key}`);
  }

  const id = generateId();

  // 创建配置
  const created = await db
    .insert(systemConfigs)
    .values({
      id,
      key: data.key,
      value: data.value,
      valueType: data.valueType || "string",
      group: data.group || CONFIG_GROUPS.GENERAL,
      description: data.description,
      isSensitive: data.isSensitive || false,
      isReadonly: data.isReadonly || false,
      requiresRestart: data.requiresRestart || false,
      defaultValue: data.defaultValue,
      validationRules: data.validationRules,
      updatedBy: adminId,
    })
    .returning();

  // 记录变更历史
  if (enableHistory) {
    await db.insert(configChangeHistory).values({
      id: generateId(),
      configId: id,
      configKey: data.key,
      oldValue: null,
      newValue: data.value,
      changeType: "create",
      changedBy: adminId,
      changedByName: adminName,
      ipAddress,
      userAgent,
    });
  }

  console.log("[ConfigService] 配置已创建:", data.key);

  return created[0];
}

/**
 * 删除配置
 */
export async function deleteConfig(
  key: string,
  options: ConfigServiceOptions = {}
): Promise<void> {
  console.log("[ConfigService] 删除配置:", key);

  const db = await getDatabase();
  const { enableHistory = true, adminId, adminName, ipAddress, userAgent } = options;

  // 获取现有配置
  const existing = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`配置项不存在: ${key}`);
  }

  const config = existing[0];

  // 检查是否只读
  if (config.isReadonly) {
    throw new Error(`配置项 ${key} 是只读的，不能删除`);
  }

  // 记录变更历史
  if (enableHistory) {
    await db.insert(configChangeHistory).values({
      id: generateId(),
      configId: config.id,
      configKey: key,
      oldValue: config.value,
      newValue: null,
      changeType: "delete",
      changedBy: adminId,
      changedByName: adminName,
      ipAddress,
      userAgent,
    });
  }

  // 删除配置
  await db.delete(systemConfigs).where(eq(systemConfigs.key, key));

  console.log("[ConfigService] 配置已删除:", key);
}

/**
 * 批量设置配置
 */
export async function setConfigsBatch(
  configs: Array<{ key: string; value: unknown }>,
  options: ConfigServiceOptions = {}
): Promise<SystemConfig[]> {
  console.log("[ConfigService] 批量设置配置:", configs.length, "项");

  const results: SystemConfig[] = [];

  for (const { key, value } of configs) {
    try {
      const updated = await setConfigValue(key, value, options);
      results.push(updated);
    } catch (error) {
      console.error("[ConfigService] 批量设置失败:", key, error);
      throw error;
    }
  }

  console.log("[ConfigService] 批量设置完成:", results.length, "项");

  return results;
}

/**
 * 获取配置变更历史
 */
export async function getConfigHistory(
  params: {
    configKey?: string;
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
    offset?: number;
    limit?: number;
  } = {}
): Promise<{ history: ConfigChangeHistory[]; total: number }> {
  console.log("[ConfigService] 获取配置变更历史:", params);

  const db = await getDatabase();
  const { configKey, adminId, startDate, endDate, offset = 0, limit = 50 } = params;

  // 构建查询条件
  const conditions = [];

  if (configKey) {
    conditions.push(eq(configChangeHistory.configKey, configKey));
  }

  if (adminId) {
    conditions.push(eq(configChangeHistory.changedBy, adminId));
  }

  if (startDate) {
    conditions.push(sql`${configChangeHistory.changedAt} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${configChangeHistory.changedAt} <= ${endDate}`);
  }

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(configChangeHistory)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = Number(countResult[0]?.count || 0);

  // 查询历史记录
  const history = await db
    .select()
    .from(configChangeHistory)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(configChangeHistory.changedAt))
    .offset(offset)
    .limit(limit);

  console.log("[ConfigService] 历史记录: total=", total, ", returned=", history.length);

  return { history, total };
}

/**
 * 获取配置分组列表
 */
export async function getConfigGroups(): Promise<
  Array<{ group: string; count: number; label: string }>
> {
  console.log("[ConfigService] 获取配置分组列表");

  const db = await getDatabase();

  const result = await db
    .select({
      group: systemConfigs.group,
      count: sql<number>`count(*)`,
    })
    .from(systemConfigs)
    .groupBy(systemConfigs.group)
    .orderBy(systemConfigs.group);

  // 添加标签
  const groupLabels: Record<string, string> = {
    [CONFIG_GROUPS.GENERAL]: "通用配置",
    [CONFIG_GROUPS.SECURITY]: "安全配置",
    [CONFIG_GROUPS.GATEWAY]: "网关配置",
    [CONFIG_GROUPS.AI]: "AI 配置",
    [CONFIG_GROUPS.STORAGE]: "存储配置",
    [CONFIG_GROUPS.EMAIL]: "邮件配置",
    [CONFIG_GROUPS.NOTIFICATION]: "通知配置",
    [CONFIG_GROUPS.SUBSCRIPTION]: "订阅配置",
    [CONFIG_GROUPS.MAINTENANCE]: "维护配置",
  };

  return result.map((row) => ({
    group: row.group,
    count: Number(row.count),
    label: groupLabels[row.group] || row.group,
  }));
}

/**
 * 重置配置为默认值
 */
export async function resetConfigToDefault(
  key: string,
  options: ConfigServiceOptions = {}
): Promise<SystemConfig | null> {
  console.log("[ConfigService] 重置配置为默认值:", key);

  const db = await getDatabase();

  // 获取配置
  const existing = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`配置项不存在: ${key}`);
  }

  const config = existing[0];

  // 检查是否有默认值
  if (config.defaultValue === null || config.defaultValue === undefined) {
    console.log("[ConfigService] 配置没有默认值:", key);
    return null;
  }

  // 设置为默认值
  return setConfigValue(key, config.defaultValue, {
    ...options,
    enableHistory: true,
  });
}

/**
 * 初始化默认配置
 *
 * 用于首次部署或重置系统配置
 */
export async function initializeDefaultConfigs(
  options: ConfigServiceOptions = {}
): Promise<void> {
  console.log("[ConfigService] 初始化默认配置");

  const defaultConfigs = [
    // 通用配置
    {
      key: CONFIG_KEYS.SITE_NAME,
      value: "OpenClaw Assistant",
      valueType: "string" as ConfigValueType,
      group: CONFIG_GROUPS.GENERAL,
      description: "站点名称",
      defaultValue: "OpenClaw Assistant",
    },
    {
      key: CONFIG_KEYS.SITE_DESCRIPTION,
      value: "智能助手平台",
      valueType: "string" as ConfigValueType,
      group: CONFIG_GROUPS.GENERAL,
      description: "站点描述",
      defaultValue: "智能助手平台",
    },
    {
      key: CONFIG_KEYS.MAINTENANCE_MODE,
      value: false,
      valueType: "boolean" as ConfigValueType,
      group: CONFIG_GROUPS.MAINTENANCE,
      description: "维护模式开关",
      defaultValue: false,
    },
    {
      key: CONFIG_KEYS.MAINTENANCE_MESSAGE,
      value: "系统正在维护中，请稍后再试",
      valueType: "string" as ConfigValueType,
      group: CONFIG_GROUPS.MAINTENANCE,
      description: "维护模式提示信息",
      defaultValue: "系统正在维护中，请稍后再试",
    },
    // 安全配置
    {
      key: CONFIG_KEYS.MAX_LOGIN_ATTEMPTS,
      value: 5,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.SECURITY,
      description: "最大登录尝试次数",
      defaultValue: 5,
      validationRules: { min: 1, max: 10 },
    },
    {
      key: CONFIG_KEYS.LOCKOUT_DURATION,
      value: 1800,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.SECURITY,
      description: "账户锁定时长（秒）",
      defaultValue: 1800,
      validationRules: { min: 60, max: 86400 },
    },
    {
      key: CONFIG_KEYS.SESSION_TIMEOUT,
      value: 7200,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.SECURITY,
      description: "会话超时时间（秒）",
      defaultValue: 7200,
      validationRules: { min: 300, max: 86400 },
    },
    {
      key: CONFIG_KEYS.TWO_FACTOR_ENABLED,
      value: false,
      valueType: "boolean" as ConfigValueType,
      group: CONFIG_GROUPS.SECURITY,
      description: "是否启用双因素认证",
      defaultValue: false,
    },
    // Gateway 配置
    {
      key: CONFIG_KEYS.GATEWAY_TIMEOUT,
      value: 30000,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.GATEWAY,
      description: "Gateway 请求超时（毫秒）",
      defaultValue: 30000,
      validationRules: { min: 1000, max: 120000 },
    },
    {
      key: CONFIG_KEYS.MAX_CONNECTIONS,
      value: 1000,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.GATEWAY,
      description: "最大连接数",
      defaultValue: 1000,
      validationRules: { min: 10, max: 10000 },
    },
    // AI 配置
    {
      key: CONFIG_KEYS.DEFAULT_MODEL,
      value: "gpt-4",
      valueType: "string" as ConfigValueType,
      group: CONFIG_GROUPS.AI,
      description: "默认 AI 模型",
      defaultValue: "gpt-4",
    },
    {
      key: CONFIG_KEYS.MAX_TOKENS,
      value: 4096,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.AI,
      description: "最大 Token 数",
      defaultValue: 4096,
      validationRules: { min: 100, max: 128000 },
    },
    {
      key: CONFIG_KEYS.TEMPERATURE,
      value: 0.7,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.AI,
      description: "AI 温度参数",
      defaultValue: 0.7,
      validationRules: { min: 0, max: 2 },
    },
    // 存储配置
    {
      key: CONFIG_KEYS.STORAGE_PROVIDER,
      value: "local",
      valueType: "string" as ConfigValueType,
      group: CONFIG_GROUPS.STORAGE,
      description: "存储提供商",
      defaultValue: "local",
    },
    {
      key: CONFIG_KEYS.MAX_FILE_SIZE,
      value: 10485760,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.STORAGE,
      description: "最大文件大小（字节）",
      defaultValue: 10485760,
      validationRules: { min: 1024, max: 104857600 },
    },
    // 通知配置
    {
      key: CONFIG_KEYS.NOTIFICATION_ENABLED,
      value: true,
      valueType: "boolean" as ConfigValueType,
      group: CONFIG_GROUPS.NOTIFICATION,
      description: "是否启用通知",
      defaultValue: true,
    },
    // 订阅配置
    {
      key: CONFIG_KEYS.FREE_QUOTA,
      value: 100,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.SUBSCRIPTION,
      description: "免费用户每日配额",
      defaultValue: 100,
      validationRules: { min: 0, max: 10000 },
    },
    {
      key: CONFIG_KEYS.PRO_QUOTA,
      value: 1000,
      valueType: "number" as ConfigValueType,
      group: CONFIG_GROUPS.SUBSCRIPTION,
      description: "Pro 用户每日配额",
      defaultValue: 1000,
      validationRules: { min: 0, max: 100000 },
    },
  ];

  for (const config of defaultConfigs) {
    try {
      // 检查是否已存在
      const existing = await getConfigByKey(config.key, { includeSensitive: true });
      if (!existing) {
        await createConfig(config, options);
      } else {
        console.log("[ConfigService] 配置已存在，跳过:", config.key);
      }
    } catch (error) {
      console.error("[ConfigService] 初始化配置失败:", config.key, error);
    }
  }

  console.log("[ConfigService] 默认配置初始化完成");
}
