/**
 * Redis 配额缓存模块
 *
 * 用于缓存用户配额信息，减少数据库查询
 * 支持原子递增、批量查询、自动同步等功能
 */

import { getLogger } from "../../logging/logger.js";
import { getRedis } from "./connection.js";

const logger = getLogger();

// 配额缓存键前缀
const QUOTA_PREFIX = "quota:";
const QUOTA_LOCK_PREFIX = "quota_lock:";

// 默认 TTL（秒）
const DEFAULT_QUOTA_TTL = 60 * 60; // 1 小时
const LOCK_TTL = 10; // 锁 TTL 10 秒

/**
 * 缓存的配额数据结构
 */
export interface CachedQuota {
  /** 用户 ID */
  userId: string;
  /** 配额类型 (tokens, storage, api_calls 等) */
  quotaType: string;
  /** 配额限制值 */
  limitValue: number;
  /** 已使用值 */
  usedValue: number;
  /** 剩余值 */
  remainingValue: number;
  /** 周期开始时间 */
  periodStart: string;
  /** 周期结束时间 */
  periodEnd: string;
  /** 缓存时间 */
  cachedAt: string;
}

/**
 * 获取配额缓存键
 */
function getQuotaKey(userId: string, quotaType: string): string {
  return `${QUOTA_PREFIX}${userId}:${quotaType}`;
}

/**
 * 获取配额锁键
 */
function getQuotaLockKey(userId: string, quotaType: string): string {
  return `${QUOTA_LOCK_PREFIX}${userId}:${quotaType}`;
}

/**
 * 缓存配额
 *
 * @param quota 配额数据
 * @param ttlSeconds TTL 秒数（默认 1 小时）
 */
export async function cacheQuota(
  quota: CachedQuota,
  ttlSeconds: number = DEFAULT_QUOTA_TTL,
): Promise<void> {
  const redis = getRedis();
  const key = getQuotaKey(quota.userId, quota.quotaType);

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(quota));

    logger.debug("[quota-cache] Quota cached", {
      userId: quota.userId,
      quotaType: quota.quotaType,
      remaining: quota.remainingValue,
      ttlSeconds,
    });
  } catch (error) {
    logger.error("[quota-cache] Failed to cache quota", {
      userId: quota.userId,
      quotaType: quota.quotaType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 获取缓存的配额
 *
 * @param userId 用户 ID
 * @param quotaType 配额类型
 * @returns 配额数据，不存在返回 null
 */
export async function getCachedQuota(
  userId: string,
  quotaType: string,
): Promise<CachedQuota | null> {
  const redis = getRedis();
  const key = getQuotaKey(userId, quotaType);

  try {
    const data = await redis.get(key);

    if (!data) {
      logger.debug("[quota-cache] Quota not found in cache", { userId, quotaType });
      return null;
    }

    const quota = JSON.parse(data) as CachedQuota;

    // 检查配额是否过期（周期结束）
    if (new Date(quota.periodEnd) < new Date()) {
      logger.debug("[quota-cache] Quota period expired, invalidating cache", {
        userId,
        quotaType,
      });
      await redis.del(key);
      return null;
    }

    logger.debug("[quota-cache] Quota retrieved from cache", {
      userId,
      quotaType,
      remaining: quota.remainingValue,
    });

    return quota;
  } catch (error) {
    logger.error("[quota-cache] Failed to get cached quota", {
      userId,
      quotaType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 原子递增配额使用量（在缓存中）
 *
 * 注意：这只更新缓存，需要配合数据库同步使用
 *
 * @param userId 用户 ID
 * @param quotaType 配额类型
 * @param amount 递增量
 * @returns 更新后的配额，如果缓存不存在返回 null
 */
export async function incrementCachedQuotaUsage(
  userId: string,
  quotaType: string,
  amount: number,
): Promise<CachedQuota | null> {
  const redis = getRedis();
  const key = getQuotaKey(userId, quotaType);
  const lockKey = getQuotaLockKey(userId, quotaType);

  try {
    // 获取分布式锁
    const lockAcquired = await redis.set(lockKey, "1", "EX", LOCK_TTL, "NX");

    if (!lockAcquired) {
      logger.warn("[quota-cache] Failed to acquire lock for quota increment", {
        userId,
        quotaType,
      });
      // 等待一小段时间后重试
      await new Promise((resolve) => setTimeout(resolve, 100));
      return incrementCachedQuotaUsage(userId, quotaType, amount);
    }

    try {
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      const quota = JSON.parse(data) as CachedQuota;

      // 更新使用量
      quota.usedValue += amount;
      quota.remainingValue = Math.max(0, quota.limitValue - quota.usedValue);
      quota.cachedAt = new Date().toISOString();

      // 获取剩余 TTL
      const ttl = await redis.ttl(key);
      const newTtl = ttl > 0 ? ttl : DEFAULT_QUOTA_TTL;

      // 保存更新后的配额
      await redis.setex(key, newTtl, JSON.stringify(quota));

      logger.debug("[quota-cache] Quota usage incremented in cache", {
        userId,
        quotaType,
        amount,
        newUsed: quota.usedValue,
        remaining: quota.remainingValue,
      });

      return quota;
    } finally {
      // 释放锁
      await redis.del(lockKey);
    }
  } catch (error) {
    logger.error("[quota-cache] Failed to increment cached quota usage", {
      userId,
      quotaType,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 检查配额是否足够（从缓存）
 *
 * @param userId 用户 ID
 * @param quotaType 配额类型
 * @param requiredAmount 需要的量
 * @returns 是否足够，缓存不存在返回 null（需要查数据库）
 */
export async function checkCachedQuotaAvailable(
  userId: string,
  quotaType: string,
  requiredAmount: number,
): Promise<boolean | null> {
  const quota = await getCachedQuota(userId, quotaType);

  if (!quota) {
    return null; // 缓存未命中，需要查数据库
  }

  return quota.remainingValue >= requiredAmount;
}

/**
 * 删除缓存的配额
 *
 * @param userId 用户 ID
 * @param quotaType 配额类型
 */
export async function deleteCachedQuota(userId: string, quotaType: string): Promise<boolean> {
  const redis = getRedis();
  const key = getQuotaKey(userId, quotaType);

  try {
    await redis.del(key);
    logger.debug("[quota-cache] Quota deleted from cache", { userId, quotaType });
    return true;
  } catch (error) {
    logger.error("[quota-cache] Failed to delete cached quota", {
      userId,
      quotaType,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 删除用户的所有配额缓存
 *
 * @param userId 用户 ID
 * @param quotaTypes 配额类型列表
 */
export async function deleteAllUserQuotaCache(
  userId: string,
  quotaTypes: string[] = ["tokens", "storage", "api_calls"],
): Promise<void> {
  const redis = getRedis();

  try {
    const pipeline = redis.pipeline();

    for (const quotaType of quotaTypes) {
      pipeline.del(getQuotaKey(userId, quotaType));
    }

    await pipeline.exec();

    logger.debug("[quota-cache] All user quota cache deleted", {
      userId,
      quotaTypes,
    });
  } catch (error) {
    logger.error("[quota-cache] Failed to delete all user quota cache", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 批量获取用户的所有配额
 *
 * @param userId 用户 ID
 * @param quotaTypes 配额类型列表
 * @returns 配额映射表
 */
export async function getUserQuotasFromCache(
  userId: string,
  quotaTypes: string[] = ["tokens", "storage", "api_calls"],
): Promise<Map<string, CachedQuota>> {
  const redis = getRedis();
  const result = new Map<string, CachedQuota>();

  try {
    const keys = quotaTypes.map((type) => getQuotaKey(userId, type));
    const values = await redis.mget(...keys);

    for (let i = 0; i < quotaTypes.length; i++) {
      const data = values[i];
      if (data) {
        const quota = JSON.parse(data) as CachedQuota;
        // 检查是否过期
        if (new Date(quota.periodEnd) >= new Date()) {
          result.set(quotaTypes[i]!, quota);
        }
      }
    }

    logger.debug("[quota-cache] Retrieved user quotas from cache", {
      userId,
      found: result.size,
      requested: quotaTypes.length,
    });

    return result;
  } catch (error) {
    logger.error("[quota-cache] Failed to get user quotas from cache", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

/**
 * 批量缓存用户的所有配额
 *
 * @param quotas 配额列表
 * @param ttlSeconds TTL 秒数
 */
export async function cacheUserQuotas(
  quotas: CachedQuota[],
  ttlSeconds: number = DEFAULT_QUOTA_TTL,
): Promise<void> {
  if (quotas.length === 0) {
    return;
  }

  const redis = getRedis();

  try {
    const pipeline = redis.pipeline();

    for (const quota of quotas) {
      const key = getQuotaKey(quota.userId, quota.quotaType);
      pipeline.setex(key, ttlSeconds, JSON.stringify(quota));
    }

    await pipeline.exec();

    logger.debug("[quota-cache] User quotas cached", {
      userId: quotas[0]?.userId,
      count: quotas.length,
    });
  } catch (error) {
    logger.error("[quota-cache] Failed to cache user quotas", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
