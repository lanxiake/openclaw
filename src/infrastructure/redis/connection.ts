/**
 * Redis 连接模块
 *
 * 基于 ioredis 驱动
 * 提供连接池管理、健康检查、优雅关闭等功能
 */

import Redis, { type RedisOptions } from "ioredis";

import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// Redis 配置接口
export interface RedisConfig {
  /** Redis 连接 URL (redis://user:password@host:port/db) */
  url?: string;
  /** Redis 主机地址 (默认 localhost) */
  host?: string;
  /** Redis 端口 (默认 6379) */
  port?: number;
  /** Redis 密码 */
  password?: string;
  /** Redis 数据库索引 (默认 0) */
  db?: number;
  /** 连接超时毫秒数 (默认 10000) */
  connectTimeoutMs?: number;
  /** 命令超时毫秒数 (默认 5000) */
  commandTimeoutMs?: number;
  /** 最大重试次数 (默认 3) */
  maxRetries?: number;
  /** 重试延迟毫秒数 (默认 1000) */
  retryDelayMs?: number;
  /** 键前缀 (默认 "openclaw:") */
  keyPrefix?: string;
  /** 是否启用 TLS */
  tls?: boolean;
}

// 模块级变量，用于存储单例连接
let redisInstance: Redis | null = null;

/**
 * 从环境变量获取 Redis 配置
 *
 * @returns RedisConfig 对象
 */
export function getRedisConfigFromEnv(): RedisConfig {
  return {
    url: process.env["REDIS_URL"],
    host: process.env["REDIS_HOST"] || "localhost",
    port: parseInt(process.env["REDIS_PORT"] || "6379", 10),
    password: process.env["REDIS_PASSWORD"],
    db: parseInt(process.env["REDIS_DB"] || "0", 10),
    connectTimeoutMs: parseInt(process.env["REDIS_CONNECT_TIMEOUT_MS"] || "10000", 10),
    commandTimeoutMs: parseInt(process.env["REDIS_COMMAND_TIMEOUT_MS"] || "5000", 10),
    maxRetries: parseInt(process.env["REDIS_MAX_RETRIES"] || "3", 10),
    retryDelayMs: parseInt(process.env["REDIS_RETRY_DELAY_MS"] || "1000", 10),
    keyPrefix: process.env["REDIS_KEY_PREFIX"] || "openclaw:",
    tls: process.env["REDIS_TLS"] === "true",
  };
}

/**
 * 创建 Redis 连接
 *
 * @param config Redis 配置
 * @returns Redis 实例
 */
export function createRedisConnection(config: RedisConfig): Redis {
  logger.info("[redis] Creating Redis connection", {
    host: config.host,
    port: config.port,
    db: config.db,
    keyPrefix: config.keyPrefix,
    tls: !!config.tls,
  });

  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    connectTimeout: config.connectTimeoutMs,
    commandTimeout: config.commandTimeoutMs,
    maxRetriesPerRequest: config.maxRetries,
    retryStrategy: (times: number) => {
      if (times > (config.maxRetries ?? 3)) {
        logger.error("[redis] Max retries exceeded, giving up", { times });
        return null;
      }
      const delay = Math.min(times * (config.retryDelayMs ?? 1000), 5000);
      logger.warn("[redis] Connection retry", { attempt: times, delayMs: delay });
      return delay;
    },
    // 启用离线队列，连接断开时缓存命令
    enableOfflineQueue: true,
    // 启用只读模式检测
    enableReadyCheck: true,
    // 自动重连
    lazyConnect: false,
  };

  // 如果提供了 URL，优先使用 URL
  if (config.url) {
    const redis = new Redis(config.url, {
      ...options,
      // URL 中已包含 host/port/password，不需要重复设置
      host: undefined,
      port: undefined,
      password: undefined,
    });
    setupEventHandlers(redis);
    return redis;
  }

  // 如果启用 TLS
  if (config.tls) {
    options.tls = {};
  }

  const redis = new Redis(options);
  setupEventHandlers(redis);
  return redis;
}

/**
 * 设置 Redis 事件处理器
 */
function setupEventHandlers(redis: Redis): void {
  redis.on("connect", () => {
    logger.info("[redis] Connected to Redis server");
  });

  redis.on("ready", () => {
    logger.info("[redis] Redis connection ready");
  });

  redis.on("error", (error) => {
    logger.error("[redis] Redis connection error", {
      error: error.message,
    });
  });

  redis.on("close", () => {
    logger.info("[redis] Redis connection closed");
  });

  redis.on("reconnecting", (delay: number) => {
    logger.warn("[redis] Reconnecting to Redis", { delayMs: delay });
  });

  redis.on("end", () => {
    logger.info("[redis] Redis connection ended");
  });
}

/**
 * 获取单例 Redis 连接
 *
 * 首次调用时会从环境变量读取配置并创建连接
 * 当 Mock 模式启用时（通过全局标志），返回 Mock Redis 实例
 *
 * @returns Redis 实例
 */
export function getRedis(): Redis {
  // 检查是否处于 Mock 模式（用于单元测试）
  const g = globalThis as Record<string, unknown>;
  if (g.__OPENCLAW_MOCK_ENABLED__ && g.__OPENCLAW_MOCK_REDIS__) {
    return g.__OPENCLAW_MOCK_REDIS__ as Redis;
  }

  if (!redisInstance) {
    const config = getRedisConfigFromEnv();
    redisInstance = createRedisConnection(config);
  }
  return redisInstance;
}

/**
 * Redis 健康检查
 *
 * @returns 检查结果
 */
export async function redisHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const redis = getRedis();
    // 执行 PING 命令检查连接
    const result = await redis.ping();

    if (result !== "PONG") {
      throw new Error(`Unexpected PING response: ${result}`);
    }

    const latencyMs = Date.now() - startTime;
    logger.debug("[redis] Health check passed", { latencyMs });

    return { healthy: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logger.error("[redis] Health check failed", { error: errorMessage, latencyMs });

    return { healthy: false, latencyMs, error: errorMessage };
  }
}

/**
 * 优雅关闭 Redis 连接
 *
 * 等待所有活动命令完成后关闭连接
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    logger.info("[redis] Closing Redis connection...");

    try {
      // 优雅关闭，等待所有命令完成
      await redisInstance.quit();
      logger.info("[redis] Redis connection closed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[redis] Error closing Redis connection", {
        error: errorMessage,
      });
      // 强制断开连接
      redisInstance.disconnect();
    } finally {
      redisInstance = null;
    }
  }
}

/**
 * 重置连接（用于测试）
 *
 * 关闭现有连接并清除单例状态
 */
export async function resetRedisConnection(): Promise<void> {
  await closeRedisConnection();
  redisInstance = null;
}

/**
 * 检查 Redis 是否已连接
 *
 * @returns 是否已连接
 */
export function isRedisConnected(): boolean {
  if (!redisInstance) {
    return false;
  }
  return redisInstance.status === "ready";
}

/**
 * 获取 Redis 连接状态
 *
 * @returns 连接状态字符串
 */
export function getRedisStatus(): string {
  if (!redisInstance) {
    return "disconnected";
  }
  return redisInstance.status;
}

// 进程退出时优雅关闭连接
process.on("SIGTERM", async () => {
  logger.info("[redis] Received SIGTERM signal, closing Redis connection...");
  await closeRedisConnection();
});

process.on("SIGINT", async () => {
  logger.info("[redis] Received SIGINT signal, closing Redis connection...");
  await closeRedisConnection();
});
