/**
 * Redis Session 缓存模块
 *
 * 用于缓存用户会话信息，减少数据库查询
 * 支持 TTL 自动过期、批量操作、会话吊销等功能
 */

import { getLogger } from "../../logging/logger.js";
import { getRedis } from "./connection.js";

const logger = getLogger();

// Session 缓存键前缀
const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user_sessions:";

// 默认 TTL（秒）
const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60; // 7 天

/**
 * 缓存的会话数据结构
 */
export interface CachedSession {
  /** 会话 ID */
  sessionId: string;
  /** 用户 ID */
  userId: string;
  /** 设备 ID */
  deviceId?: string;
  /** 用户角色 */
  role?: string;
  /** 会话创建时间 */
  createdAt: string;
  /** 会话过期时间 */
  expiresAt: string;
  /** 最后活动时间 */
  lastActiveAt: string;
  /** IP 地址 */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 获取会话缓存键
 */
function getSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

/**
 * 获取用户会话集合键
 */
function getUserSessionsKey(userId: string): string {
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

/**
 * 缓存会话
 *
 * @param session 会话数据
 * @param ttlSeconds TTL 秒数（默认 7 天）
 */
export async function cacheSession(
  session: CachedSession,
  ttlSeconds: number = DEFAULT_SESSION_TTL,
): Promise<void> {
  const redis = getRedis();
  const key = getSessionKey(session.sessionId);

  try {
    // 使用 pipeline 批量执行
    const pipeline = redis.pipeline();

    // 存储会话数据
    pipeline.setex(key, ttlSeconds, JSON.stringify(session));

    // 将会话 ID 添加到用户的会话集合
    const userSessionsKey = getUserSessionsKey(session.userId);
    pipeline.sadd(userSessionsKey, session.sessionId);
    // 设置用户会话集合的 TTL（比单个会话稍长）
    pipeline.expire(userSessionsKey, ttlSeconds + 3600);

    await pipeline.exec();

    logger.debug("[session-cache] Session cached", {
      sessionId: session.sessionId,
      userId: session.userId,
      ttlSeconds,
    });
  } catch (error) {
    logger.error("[session-cache] Failed to cache session", {
      sessionId: session.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 获取缓存的会话
 *
 * @param sessionId 会话 ID
 * @returns 会话数据，不存在返回 null
 */
export async function getCachedSession(sessionId: string): Promise<CachedSession | null> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    const data = await redis.get(key);

    if (!data) {
      logger.debug("[session-cache] Session not found in cache", { sessionId });
      return null;
    }

    const session = JSON.parse(data) as CachedSession;

    logger.debug("[session-cache] Session retrieved from cache", {
      sessionId,
      userId: session.userId,
    });

    return session;
  } catch (error) {
    logger.error("[session-cache] Failed to get cached session", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 更新会话最后活动时间
 *
 * @param sessionId 会话 ID
 * @param ttlSeconds 新的 TTL（可选，不传则保持原 TTL）
 */
export async function touchSession(sessionId: string, ttlSeconds?: number): Promise<boolean> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    const data = await redis.get(key);

    if (!data) {
      return false;
    }

    const session = JSON.parse(data) as CachedSession;
    session.lastActiveAt = new Date().toISOString();

    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, JSON.stringify(session));
    } else {
      // 保持原 TTL
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        await redis.setex(key, ttl, JSON.stringify(session));
      }
    }

    logger.debug("[session-cache] Session touched", { sessionId });
    return true;
  } catch (error) {
    logger.error("[session-cache] Failed to touch session", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 删除缓存的会话
 *
 * @param sessionId 会话 ID
 * @param userId 用户 ID（可选，用于清理用户会话集合）
 */
export async function deleteCachedSession(sessionId: string, userId?: string): Promise<boolean> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    const pipeline = redis.pipeline();

    // 删除会话数据
    pipeline.del(key);

    // 如果提供了 userId，从用户会话集合中移除
    if (userId) {
      const userSessionsKey = getUserSessionsKey(userId);
      pipeline.srem(userSessionsKey, sessionId);
    }

    await pipeline.exec();

    logger.debug("[session-cache] Session deleted from cache", { sessionId, userId });
    return true;
  } catch (error) {
    logger.error("[session-cache] Failed to delete cached session", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 获取用户的所有会话 ID
 *
 * @param userId 用户 ID
 * @returns 会话 ID 列表
 */
export async function getUserSessionIds(userId: string): Promise<string[]> {
  const redis = getRedis();
  const key = getUserSessionsKey(userId);

  try {
    const sessionIds = await redis.smembers(key);
    logger.debug("[session-cache] Retrieved user session IDs", {
      userId,
      count: sessionIds.length,
    });
    return sessionIds;
  } catch (error) {
    logger.error("[session-cache] Failed to get user session IDs", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * 获取用户的所有会话
 *
 * @param userId 用户 ID
 * @returns 会话列表
 */
export async function getUserSessions(userId: string): Promise<CachedSession[]> {
  const redis = getRedis();

  try {
    const sessionIds = await getUserSessionIds(userId);

    if (sessionIds.length === 0) {
      return [];
    }

    // 批量获取会话数据
    const keys = sessionIds.map((id) => getSessionKey(id));
    const results = await redis.mget(...keys);

    const sessions: CachedSession[] = [];
    const expiredIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const data = results[i];
      if (data) {
        sessions.push(JSON.parse(data) as CachedSession);
      } else {
        // 会话已过期，记录下来稍后清理
        expiredIds.push(sessionIds[i]!);
      }
    }

    // 清理过期的会话 ID
    if (expiredIds.length > 0) {
      const userSessionsKey = getUserSessionsKey(userId);
      await redis.srem(userSessionsKey, ...expiredIds);
      logger.debug("[session-cache] Cleaned up expired session IDs", {
        userId,
        count: expiredIds.length,
      });
    }

    logger.debug("[session-cache] Retrieved user sessions", {
      userId,
      count: sessions.length,
    });

    return sessions;
  } catch (error) {
    logger.error("[session-cache] Failed to get user sessions", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * 吊销用户的所有会话
 *
 * @param userId 用户 ID
 * @returns 吊销的会话数量
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const redis = getRedis();

  try {
    const sessionIds = await getUserSessionIds(userId);

    if (sessionIds.length === 0) {
      return 0;
    }

    const pipeline = redis.pipeline();

    // 删除所有会话数据
    for (const sessionId of sessionIds) {
      pipeline.del(getSessionKey(sessionId));
    }

    // 删除用户会话集合
    pipeline.del(getUserSessionsKey(userId));

    await pipeline.exec();

    logger.info("[session-cache] Revoked all user sessions", {
      userId,
      count: sessionIds.length,
    });

    return sessionIds.length;
  } catch (error) {
    logger.error("[session-cache] Failed to revoke user sessions", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * 检查会话是否存在
 *
 * @param sessionId 会话 ID
 * @returns 是否存在
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error("[session-cache] Failed to check session existence", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 获取会话剩余 TTL
 *
 * @param sessionId 会话 ID
 * @returns TTL 秒数，-1 表示无过期，-2 表示不存在
 */
export async function getSessionTTL(sessionId: string): Promise<number> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    return await redis.ttl(key);
  } catch (error) {
    logger.error("[session-cache] Failed to get session TTL", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return -2;
  }
}

/**
 * 延长会话 TTL
 *
 * @param sessionId 会话 ID
 * @param ttlSeconds 新的 TTL 秒数
 * @returns 是否成功
 */
export async function extendSessionTTL(sessionId: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  const key = getSessionKey(sessionId);

  try {
    const result = await redis.expire(key, ttlSeconds);
    return result === 1;
  } catch (error) {
    logger.error("[session-cache] Failed to extend session TTL", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
