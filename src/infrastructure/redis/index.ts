/**
 * Redis 基础设施模块
 *
 * 导出 Redis 连接、缓存、Pub/Sub 等功能
 */

// 连接管理
export {
  type RedisConfig,
  getRedisConfigFromEnv,
  createRedisConnection,
  getRedis,
  redisHealthCheck,
  closeRedisConnection,
  resetRedisConnection,
  isRedisConnected,
  getRedisStatus,
} from "./connection.js";

// Session 缓存
export {
  type CachedSession,
  cacheSession,
  getCachedSession,
  touchSession,
  deleteCachedSession,
  getUserSessionIds,
  getUserSessions,
  revokeAllUserSessions,
  sessionExists,
  getSessionTTL,
  extendSessionTTL,
} from "./session-cache.js";

// 配额缓存
export {
  type CachedQuota,
  cacheQuota,
  getCachedQuota,
  incrementCachedQuotaUsage,
  checkCachedQuotaAvailable,
  deleteCachedQuota,
  deleteAllUserQuotaCache,
  getUserQuotasFromCache,
  cacheUserQuotas,
} from "./quota-cache.js";

// Pub/Sub 事件总线
export {
  type EventType,
  type EventPayload,
  type EventHandler,
  publishEvent,
  subscribeEvent,
  subscribePattern,
  closePubSub,
  getPubSubStats,
} from "./pubsub.js";
