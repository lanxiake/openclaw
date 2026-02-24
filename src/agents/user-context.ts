/**
 * 用户 Agent 上下文
 *
 * 为 Agent 运行时提供用户感知能力，包括：
 * - 用户基本信息
 * - 设备列表和权限
 * - 助手配置
 * - 配额信息
 * - 用户画像记忆（profile, facts, preferences）
 * - 用户 workspace 文件
 */

import { eq, and } from "drizzle-orm";

import { getDatabase } from "../db/connection.js";
import { getAssistantConfigRepository } from "../db/repositories/assistant-configs.js";
import { getUsageQuotaRepository } from "../db/repositories/usage-quotas.js";
import {
  getUserProfileRepository,
  getUserFactRepository,
  getUserPreferencesV2Repository,
} from "../db/repositories/profile-memory.js";
import { getUserWorkspaceFilesRepository } from "../db/repositories/user-workspace-files.js";
import { getLogger } from "../logging/logger.js";
import type { UserProfile, UserFactRecord, UserPreferencesV2Record } from "../db/schema/index.js";
import { userInstalledSkills, skillStoreItems, systemConfigs } from "../db/schema/index.js";
import { CONFIG_KEYS } from "../db/schema/system-config.js";

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
 * 用户画像记忆
 */
export interface UserProfileMemory {
  profile: UserProfile | null;
  facts: UserFactRecord[];
  preferences: UserPreferencesV2Record | null;
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
  /** 用户画像记忆（profile, facts, preferences） */
  profileMemory?: UserProfileMemory;
  /** 用户 workspace 文件 Map<文件名, 内容> */
  workspaceFiles?: Map<string, string>;
  /** 用户已禁用的技能名称集合（从 userInstalledSkills 表加载） */
  disabledSkillNames?: Set<string>;
  /** 管理员禁用的 bundled 技能名称集合（从 systemConfigs 表加载） */
  adminDisabledSkillNames?: Set<string>;
  /** 上下文加载时间 */
  loadedAt: Date;
}

/**
 * 加载用户 Agent 上下文
 *
 * 并行查询用户的设备、助手配置和配额信息
 * userId 为空时返回空上下文（无法加载用户数据）
 *
 * @param userId - 用户 ID
 * @returns 用户 Agent 上下文
 */
export async function loadUserAgentContext(
  userId: string | undefined | null,
): Promise<UserAgentContext> {
  const normalizedUserId = (userId ?? "").trim().toLowerCase();

  if (!normalizedUserId) {
    logger.debug("[user-context] 无用户 ID，返回空上下文");
    return {
      userId: "",
      isDefaultUser: true,
      devices: [],
      assistantConfig: undefined,
      quotas: [],
      loadedAt: new Date(),
    };
  }

  logger.debug(`[user-context] 加载用户上下文, userId=${normalizedUserId}`);

  // 并行加载用户数据
  const [
    assistantConfig,
    devices,
    quotas,
    profileMemory,
    workspaceFiles,
    disabledSkillNames,
    adminDisabledSkillNames,
  ] = await Promise.all([
    loadAssistantConfig(normalizedUserId),
    loadUserDevices(normalizedUserId),
    loadUserQuotas(normalizedUserId),
    loadProfileMemory(normalizedUserId),
    loadWorkspaceFiles(normalizedUserId),
    loadDisabledSkillNames(normalizedUserId),
    loadAdminDisabledSkillNames(),
  ]);

  logger.debug(
    `[user-context] 用户上下文加载完成, userId=${normalizedUserId}, devices=${devices.length}, hasConfig=${!!assistantConfig}, hasProfile=${!!profileMemory?.profile}, factsCount=${profileMemory?.facts.length ?? 0}, workspaceFiles=${workspaceFiles?.size ?? 0}, disabledSkills=${disabledSkillNames?.size ?? 0}, adminDisabledSkills=${adminDisabledSkillNames?.size ?? 0}`,
  );

  return {
    userId: normalizedUserId,
    isDefaultUser: false,
    devices,
    assistantConfig,
    quotas,
    profileMemory,
    workspaceFiles,
    disabledSkillNames,
    adminDisabledSkillNames,
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
 * 从 usage_quotas 表查询当前有效期内的所有配额
 */
async function loadUserQuotas(userId: string): Promise<UserQuota[]> {
  try {
    const db = getDatabase();
    const repo = getUsageQuotaRepository(db, userId);
    const quotas = await repo.findAll();

    // 过滤出当前有效期内的配额
    const now = new Date();
    const activeQuotas = quotas.filter((q) => q.periodStart <= now && q.periodEnd >= now);

    return activeQuotas.map((q) => ({
      quotaType: q.quotaType,
      totalValue: q.limitValue,
      usedValue: q.usedValue,
      remainingValue: q.limitValue - q.usedValue,
      periodStart: q.periodStart,
      periodEnd: q.periodEnd,
    }));
  } catch (error) {
    logger.warn(`[user-context] 加载配额信息失败, userId=${userId}`, error);
    return [];
  }
}

/**
 * 加载用户画像记忆（profile, facts, preferences）
 *
 * 从 profile-memory 表并行查询用户画像、事实和偏好
 *
 * @param userId - 用户 ID
 * @returns 用户画像记忆，加载失败返回 undefined
 */
async function loadProfileMemory(userId: string): Promise<UserProfileMemory | undefined> {
  try {
    const db = getDatabase();

    const profileRepo = getUserProfileRepository(db, userId);
    const factRepo = getUserFactRepository(db, userId);
    const prefsRepo = getUserPreferencesV2Repository(db, userId);

    const [profile, factsResult, preferences] = await Promise.all([
      profileRepo.get(),
      factRepo.findAll({ activeOnly: true, limit: 100 }),
      prefsRepo.get(),
    ]);

    logger.debug(
      `[user-context] 画像记忆加载完成, userId=${userId}, hasProfile=${!!profile}, facts=${factsResult.facts.length}, hasPrefs=${!!preferences}`,
    );

    return {
      profile,
      facts: factsResult.facts,
      preferences,
    };
  } catch (error) {
    logger.warn(`[user-context] 加载画像记忆失败, userId=${userId}`, error);
    return undefined;
  }
}

/**
 * 加载用户 workspace 文件
 *
 * 从 user_workspace_files 表查询用户的所有 workspace 文件。
 * 当用户无任何记录时（新用户），自动从 system_configs 加载默认模板
 * 并调用 initializeForUser() 创建初始记录。
 *
 * @param userId - 用户 ID
 * @returns 文件名到内容的 Map，加载失败返回 undefined
 */
async function loadWorkspaceFiles(userId: string): Promise<Map<string, string> | undefined> {
  try {
    const db = getDatabase();
    const repo = getUserWorkspaceFilesRepository(db, userId);
    let files = await repo.getAllForUser();

    if (files.length === 0) {
      logger.debug(
        `[user-context] 新用户无 workspace 文件, 尝试从默认模板初始化, userId=${userId}`,
      );

      try {
        const { getMemoryDefaultsByFileName } = await import("../db/seed/memory-defaults.js");
        const defaults = await getMemoryDefaultsByFileName();

        if (defaults.size > 0) {
          const count = await repo.initializeForUser(defaults);
          logger.info(
            `[user-context] 从默认模板初始化 workspace 文件完成, userId=${userId}, count=${count}`,
          );

          // 重新查询初始化后的文件
          files = await repo.getAllForUser();
        } else {
          logger.warn(`[user-context] 无默认模板可用, 跳过初始化, userId=${userId}`);
        }
      } catch (initError) {
        logger.warn(`[user-context] 从默认模板初始化失败, userId=${userId}`, initError);
      }
    }

    if (files.length === 0) {
      logger.debug(`[user-context] 无 workspace 文件, userId=${userId}`);
      return undefined;
    }

    const map = new Map<string, string>();
    for (const file of files) {
      map.set(file.fileName, file.content);
    }

    logger.debug(`[user-context] workspace 文件加载完成, userId=${userId}, count=${map.size}`);

    return map;
  } catch (error) {
    logger.warn(`[user-context] 加载 workspace 文件失败, userId=${userId}`, error);
    return undefined;
  }
}

/**
 * 加载用户已安装但禁用的技能名称集合
 *
 * 从 userInstalledSkills 表 join skillStoreItems 表查询
 * 返回 isEnabled=false 的技能名称，用于在 Agent 提示词构建时过滤掉
 *
 * @param userId - 用户 ID
 * @returns 已禁用的技能名称集合，加载失败返回 undefined
 */
async function loadDisabledSkillNames(userId: string): Promise<Set<string> | undefined> {
  try {
    const db = getDatabase();

    const results = await db
      .select({ name: skillStoreItems.name })
      .from(userInstalledSkills)
      .innerJoin(skillStoreItems, eq(userInstalledSkills.skillItemId, skillStoreItems.id))
      .where(and(eq(userInstalledSkills.userId, userId), eq(userInstalledSkills.isEnabled, false)));

    const names = new Set(results.map((r) => r.name));

    logger.debug(`[user-context] 已禁用技能名称加载完成, userId=${userId}, count=${names.size}`);

    return names;
  } catch (error) {
    logger.warn(`[user-context] 加载已禁用技能名称失败, userId=${userId}`, error);
    return undefined;
  }
}

/**
 * 加载管理员禁用的 bundled 技能名称集合
 *
 * 从 systemConfigs 表读取 bundled_skills.disabled 配置项，
 * 返回管理员禁用的技能名称 Set，用于在 Agent 提示词构建时过滤掉
 *
 * @returns 管理员禁用的技能名称集合，加载失败返回 undefined
 */
async function loadAdminDisabledSkillNames(): Promise<Set<string> | undefined> {
  try {
    const db = getDatabase();

    const result = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, CONFIG_KEYS.BUNDLED_SKILLS_DISABLED))
      .limit(1);

    if (result.length === 0) {
      logger.debug("[user-context] 管理员禁用技能配置不存在，返回空集合");
      return new Set();
    }

    const rawValue = result[0].value;
    const disabledList = Array.isArray(rawValue)
      ? rawValue.filter((v): v is string => typeof v === "string")
      : [];
    const names = new Set(disabledList);

    logger.debug(`[user-context] 管理员禁用技能名称加载完成, count=${names.size}`);

    return names;
  } catch (error) {
    logger.warn("[user-context] 加载管理员禁用技能名称失败", error);
    return undefined;
  }
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
