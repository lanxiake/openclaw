/**
 * 用户 Agent 上下文
 *
 * 为 Agent 运行时提供用户感知能力，包括：
 * - 用户基本信息
 * - 设备列表和权限
 * - 助手配置
 * - 配额信息
 */

import { getDatabase } from "../db/connection.js";
import { getAssistantConfigRepository } from "../db/repositories/assistant-configs.js";
import { getLogger } from "../logging/logger.js";
import { DEFAULT_USER_ID } from "../routing/session-key.js";

const logger = getLogger();

/**
 * 用户设备信息
 */
export interface UserDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  isOnline: boolean;
  lastSeenAt?: Date;
}

/**
 * 用户助手配置
 */
export interface UserAssistantConfig {
  configId: string;
  name: string;
  personality?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  modelConfig?: Record<string, unknown>;
  devicePermissions?: Record<string, unknown>;
  systemPrompt?: string;
}

/**
 * 用户配额信息
 */
export interface UserQuota {
  quotaType: string;
  totalValue: number;
  usedValue: number;
  remainingValue: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * 用户 Agent 上下文
 *
 * 包含 Agent 运行时所需的所有用户相关信息
 */
export interface UserAgentContext {
  /** 用户 ID */
  userId: string;
  /** 是否为默认用户（单用户模式向后兼容） */
  isDefaultUser: boolean;
  /** 用户设备列表 */
  devices: UserDevice[];
  /** 当前助手配置 */
  assistantConfig?: UserAssistantConfig;
  /** 配额信息 */
  quotas: UserQuota[];
  /** 上下文加载时间 */
  loadedAt: Date;
}

/**
 * 加载用户 Agent 上下文
 *
 * 并行查询用户的设备、助手配置和配额信息
 * 如果 userId 为空或 "default"，返回默认上下文（单用户模式）
 *
 * @param userId - 用户 ID
 * @returns 用户 Agent 上下文
 */
export async function loadUserAgentContext(
  userId: string | undefined | null,
): Promise<UserAgentContext> {
  const normalizedUserId = (userId ?? "").trim().toLowerCase() || DEFAULT_USER_ID;
  const isDefaultUser = normalizedUserId === DEFAULT_USER_ID;

  logger.debug(
    `[user-context] 加载用户上下文, userId=${normalizedUserId}, isDefault=${isDefaultUser}`,
  );

  // 默认用户返回空上下文（向后兼容单用户模式）
  if (isDefaultUser) {
    return {
      userId: normalizedUserId,
      isDefaultUser: true,
      devices: [],
      assistantConfig: undefined,
      quotas: [],
      loadedAt: new Date(),
    };
  }

  // 并行加载用户数据
  const [assistantConfig, devices, quotas] = await Promise.all([
    loadAssistantConfig(normalizedUserId),
    loadUserDevices(normalizedUserId),
    loadUserQuotas(normalizedUserId),
  ]);

  logger.debug(
    `[user-context] 用户上下文加载完成, userId=${normalizedUserId}, devices=${devices.length}, hasConfig=${!!assistantConfig}`,
  );

  return {
    userId: normalizedUserId,
    isDefaultUser: false,
    devices,
    assistantConfig,
    quotas,
    loadedAt: new Date(),
  };
}

/**
 * 加载用户默认助手配置
 */
async function loadAssistantConfig(userId: string): Promise<UserAssistantConfig | undefined> {
  try {
    const db = getDatabase();
    const repo = getAssistantConfigRepository(db, userId);
    const config = await repo.findDefault();

    if (!config) {
      return undefined;
    }

    return {
      configId: config.id,
      name: config.name,
      personality: config.personality as Record<string, unknown> | undefined,
      preferences: config.preferences as Record<string, unknown> | undefined,
      modelConfig: config.modelConfig as Record<string, unknown> | undefined,
      devicePermissions: config.devicePermissions as Record<string, unknown> | undefined,
      systemPrompt: config.systemPrompt ?? undefined,
    };
  } catch (error) {
    logger.warn(`[user-context] 加载助手配置失败, userId=${userId}`, error);
    return undefined;
  }
}

/**
 * 加载用户设备列表
 *
 * TODO: 实际实现需要查询 devices 表，当前返回空数组
 */
async function loadUserDevices(_userId: string): Promise<UserDevice[]> {
  // TODO: Sprint 11 实现设备管理后补充
  return [];
}

/**
 * 加载用户配额信息
 *
 * TODO: 实际实现需要查询 usage_quotas 表，当前返回空数组
 */
async function loadUserQuotas(_userId: string): Promise<UserQuota[]> {
  // TODO: Sprint 10 实现配额计费后补充
  return [];
}

/**
 * 检查用户是否有权限操作指定设备
 *
 * @param context - 用户上下文
 * @param deviceId - 设备 ID
 * @returns 是否有权限
 */
export function hasDevicePermission(context: UserAgentContext, deviceId: string): boolean {
  // 默认用户有所有权限（向后兼容）
  if (context.isDefaultUser) {
    return true;
  }

  // 检查设备是否属于该用户
  return context.devices.some((d) => d.deviceId === deviceId);
}

/**
 * 检查用户配额是否充足
 *
 * @param context - 用户上下文
 * @param quotaType - 配额类型
 * @param amount - 需要的数量
 * @returns 是否充足
 */
export function hasQuotaAvailable(
  context: UserAgentContext,
  quotaType: string,
  amount: number,
): boolean {
  // 默认用户无配额限制（向后兼容）
  if (context.isDefaultUser) {
    return true;
  }

  const quota = context.quotas.find((q) => q.quotaType === quotaType);
  if (!quota) {
    // 无配额记录视为无限制
    return true;
  }

  return quota.remainingValue >= amount;
}
