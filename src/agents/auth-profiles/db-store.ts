/**
 * DB → AuthProfileStore 转换模块
 *
 * 将数据库 auth_profiles 行转换为 Agent 运行时使用的 AuthProfileStore 格式，
 * 使 Agent 可以直接从数据库读取凭据，不依赖 auth-profiles.json 文件。
 *
 * 三级配置优先级: 租户级(tenant) > 管理员级(system) > 系统级(文件)
 */

import { getLogger } from "../../logging/logger.js";
import { getDatabase } from "../../db/connection.js";
import {
  AuthProfileRepository,
  AuthProfileOrderRepository,
} from "../../db/repositories/auth-profile-configs.js";
import type {
  AuthProfile,
  AuthProfileOrderRecord,
  OAuthCredentialsData,
} from "../../db/schema/auth-profiles.js";
import type { AuthProfileCredential, AuthProfileStore } from "./types.js";

const logger = getLogger();

/**
 * 将单个数据库 AuthProfile 转换为 AuthProfileCredential
 *
 * 根据 credentialMode 分别处理 api_key / token / oauth 三种模式。
 * 无效凭据（缺少必需字段）返回 null。
 *
 * @param dbProfile - 数据库中的 auth profile 记录
 * @returns 转换后的凭据对象，无效凭据返回 null
 */
function convertDbProfileToCredential(dbProfile: AuthProfile): AuthProfileCredential | null {
  const mode = dbProfile.credentialMode;

  if (mode === "api_key" && dbProfile.apiKey) {
    logger.debug("[db-store] converting api_key profile", {
      profileId: dbProfile.profileId,
      provider: dbProfile.provider,
    });
    return {
      type: "api_key",
      provider: dbProfile.provider,
      key: dbProfile.apiKey,
      ...(dbProfile.email ? { email: dbProfile.email } : {}),
    };
  }

  if (mode === "token" && dbProfile.token) {
    const expires = dbProfile.tokenExpires ? new Date(dbProfile.tokenExpires).getTime() : undefined;
    logger.debug("[db-store] converting token profile", {
      profileId: dbProfile.profileId,
      provider: dbProfile.provider,
    });
    return {
      type: "token",
      provider: dbProfile.provider,
      token: dbProfile.token,
      ...(typeof expires === "number" ? { expires } : {}),
      ...(dbProfile.email ? { email: dbProfile.email } : {}),
    };
  }

  if (mode === "oauth" && dbProfile.oauthCredentials) {
    const oauthData = dbProfile.oauthCredentials as OAuthCredentialsData;
    if (!oauthData.accessToken) {
      logger.debug("[db-store] skipping oauth profile without access token", {
        profileId: dbProfile.profileId,
      });
      return null;
    }
    logger.debug("[db-store] converting oauth profile", {
      profileId: dbProfile.profileId,
      provider: dbProfile.provider,
    });
    return {
      type: "oauth",
      provider: dbProfile.provider,
      access: oauthData.accessToken,
      refresh: oauthData.refreshToken ?? "",
      expires: oauthData.expiry ?? 0,
      ...(oauthData.clientId ? { clientId: oauthData.clientId } : {}),
      ...(dbProfile.email ? { email: dbProfile.email } : {}),
    };
  }

  logger.debug("[db-store] skipping profile with no valid credentials", {
    profileId: dbProfile.profileId,
    credentialMode: mode,
  });
  return null;
}

/**
 * 将数据库 AuthProfile 列表和 Order 记录转换为 AuthProfileStore
 *
 * 仅处理 enabled=true 的 profiles。
 * Order 记录按 agentKey 映射为 profileIds 数组。
 *
 * @param dbProfiles - 数据库中的 auth profile 列表
 * @param dbOrders - 数据库中的 auth profile order 列表
 * @returns 完整的 AuthProfileStore 对象
 */
export function convertDbProfilesToAuthStore(
  dbProfiles: AuthProfile[],
  dbOrders: AuthProfileOrderRecord[],
): AuthProfileStore {
  const profiles: Record<string, AuthProfileCredential> = {};

  for (const dbProfile of dbProfiles) {
    if (!dbProfile.enabled) {
      logger.debug("[db-store] skipping disabled profile", {
        profileId: dbProfile.profileId,
      });
      continue;
    }

    const credential = convertDbProfileToCredential(dbProfile);
    if (credential) {
      profiles[dbProfile.profileId] = credential;
    }
  }

  // 转换 order 记录
  let order: Record<string, string[]> | undefined;
  if (dbOrders.length > 0) {
    const orderMap: Record<string, string[]> = {};
    for (const dbOrder of dbOrders) {
      const ids = dbOrder.profileIds;
      if (Array.isArray(ids) && ids.length > 0) {
        orderMap[dbOrder.agentKey] = ids as string[];
      }
    }
    if (Object.keys(orderMap).length > 0) {
      order = orderMap;
    }
  }

  return {
    version: 1,
    profiles,
    ...(order ? { order } : {}),
  };
}

/**
 * 合并 file store 和 DB store
 *
 * 策略：
 * - DB profiles 覆盖 file store 中同 profileId 的 profiles
 * - DB order 覆盖 file order 中相同 agentKey 的配置
 * - 保留 file store 的 lastGood 和 usageStats（运行时状态）
 *
 * @param fileStore - 文件系统加载的 auth profile store
 * @param dbStore - 数据库转换的 auth profile store
 * @returns 合并后的 AuthProfileStore（新对象，不修改原对象）
 */
export function mergeAuthStores(
  fileStore: AuthProfileStore,
  dbStore: AuthProfileStore,
): AuthProfileStore {
  // DB profiles 覆盖同名 file profiles
  const mergedProfiles: Record<string, AuthProfileCredential> = {
    ...fileStore.profiles,
    ...dbStore.profiles,
  };

  // DB order 覆盖 file order 中相同 agentKey
  let mergedOrder: Record<string, string[]> | undefined;
  if (fileStore.order || dbStore.order) {
    mergedOrder = {
      ...fileStore.order,
      ...dbStore.order,
    };
  }

  return {
    version: 1,
    profiles: mergedProfiles,
    ...(mergedOrder ? { order: mergedOrder } : {}),
    // 保留文件 store 的运行时状态
    ...(fileStore.lastGood ? { lastGood: fileStore.lastGood } : {}),
    ...(fileStore.usageStats ? { usageStats: fileStore.usageStats } : {}),
  };
}

/**
 * 从数据库加载指定用户的 AuthProfileStore
 *
 * 查询 listEffectiveProfiles (租户覆盖系统) 和 listEffectiveOrders，
 * 转换为 Agent 运行时可直接使用的 AuthProfileStore。
 *
 * @param userId - 用户 ID，用于加载租户级覆盖配置
 * @returns 数据库加载的 AuthProfileStore，加载失败返回 null
 */
export async function loadDbAuthProfileStore(userId?: string): Promise<AuthProfileStore | null> {
  logger.debug("[db-store] loading auth profiles from database", { userId });

  try {
    const db = getDatabase();
    const profileRepo = new AuthProfileRepository(db);
    const orderRepo = new AuthProfileOrderRepository(db);

    const dbProfiles = await profileRepo.listEffectiveProfiles(userId);
    const dbOrders = await orderRepo.listEffectiveOrders(userId);

    logger.debug("[db-store] loaded from database", {
      userId,
      profileCount: dbProfiles.length,
      orderCount: dbOrders.length,
    });

    if (dbProfiles.length === 0 && dbOrders.length === 0) {
      return null;
    }

    return convertDbProfilesToAuthStore(dbProfiles, dbOrders);
  } catch (err) {
    logger.warn("[db-store] failed to load auth profiles from database", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
