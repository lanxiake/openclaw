/**
 * Milvus 向量数据库连接模块
 *
 * 基于 @zilliz/milvus2-sdk-node 驱动
 * 提供单例连接管理、健康检查、优雅关闭等功能
 *
 * 环境变量:
 *   MILVUS_ADDRESS  - Milvus 地址 (默认 localhost:19530)
 *   MILVUS_TOKEN    - 认证令牌 (可选)
 *   MILVUS_DATABASE - 数据库名 (默认 default)
 */

import { MilvusClient } from "@zilliz/milvus2-sdk-node";

import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * Milvus 连接配置
 */
export interface MilvusConfig {
  /** Milvus 服务地址 (host:port) */
  address: string;
  /** 认证令牌 */
  token?: string;
  /** 数据库名 (默认 default) */
  database?: string;
  /** 连接超时毫秒数 (默认 10000) */
  connectTimeoutMs?: number;
  /** 日志级别 */
  logLevel?: "debug" | "info" | "warn" | "error";
}

/** 模块级变量，存储单例连接 */
let milvusInstance: MilvusClient | null = null;

/** Mock 模式标志 (单元测试使用) */
let mockEnabled = false;
let mockClient: MilvusClient | null = null;

/**
 * 从环境变量获取 Milvus 配置
 *
 * @returns MilvusConfig 对象
 */
export function getMilvusConfigFromEnv(): MilvusConfig {
  return {
    address: process.env["MILVUS_ADDRESS"] || "localhost:19530",
    token: process.env["MILVUS_TOKEN"] || undefined,
    database: process.env["MILVUS_DATABASE"] || "default",
    connectTimeoutMs: parseInt(process.env["MILVUS_CONNECT_TIMEOUT_MS"] || "10000", 10),
  };
}

/**
 * 创建 Milvus 客户端连接
 *
 * @param config - Milvus 配置
 * @returns MilvusClient 实例
 */
export function createMilvusConnection(config: MilvusConfig): MilvusClient {
  logger.info("[milvus] Creating Milvus connection", {
    address: config.address,
    database: config.database,
  });

  const client = new MilvusClient({
    address: config.address,
    token: config.token,
    database: config.database,
    timeout: config.connectTimeoutMs,
    logLevel: config.logLevel,
  });

  logger.info("[milvus] Milvus client created successfully");
  return client;
}

/**
 * 获取单例 Milvus 连接
 *
 * 首次调用时从环境变量读取配置并创建连接。
 * Mock 模式启用时返回 Mock 实例。
 *
 * @returns MilvusClient 实例
 */
export function getMilvus(): MilvusClient {
  if (mockEnabled && mockClient) {
    return mockClient;
  }

  if (!milvusInstance) {
    const config = getMilvusConfigFromEnv();
    milvusInstance = createMilvusConnection(config);
  }
  return milvusInstance;
}

/**
 * Milvus 健康检查
 *
 * @returns 检查结果 (healthy, latencyMs, error)
 */
export async function milvusHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = getMilvus();
    const response = await client.checkHealth();
    const latencyMs = Date.now() - startTime;

    if (response.isHealthy) {
      logger.debug("[milvus] Health check passed", { latencyMs });
      return { healthy: true, latencyMs };
    }

    const reasons = response.reasons?.join("; ") ?? "Unknown unhealthy state";
    logger.warn("[milvus] Health check unhealthy", { latencyMs, reasons });
    return { healthy: false, latencyMs, error: reasons };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[milvus] Health check failed", {
      error: errorMessage,
      latencyMs,
    });
    return { healthy: false, latencyMs, error: errorMessage };
  }
}

/**
 * 优雅关闭 Milvus 连接
 */
export async function closeMilvusConnection(): Promise<void> {
  if (milvusInstance) {
    logger.info("[milvus] Closing Milvus connection...");

    try {
      await milvusInstance.closeConnection();
      logger.info("[milvus] Milvus connection closed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[milvus] Error closing Milvus connection", {
        error: errorMessage,
      });
    } finally {
      milvusInstance = null;
    }
  }
}

/**
 * 重置连接 (用于测试)
 */
export async function resetMilvusConnection(): Promise<void> {
  await closeMilvusConnection();
  milvusInstance = null;
}

/**
 * 启用 Mock 模式 (单元测试使用)
 *
 * @param client - Mock 的 MilvusClient 实例
 */
export function enableMilvusMock(client: MilvusClient): void {
  mockEnabled = true;
  mockClient = client;
  logger.debug("[milvus] Mock mode enabled");
}

/**
 * 禁用 Mock 模式
 */
export function disableMilvusMock(): void {
  mockEnabled = false;
  mockClient = null;
  logger.debug("[milvus] Mock mode disabled");
}

/**
 * 检查 Milvus 是否已连接
 */
export function isMilvusConnected(): boolean {
  return milvusInstance !== null || (mockEnabled && mockClient !== null);
}

// 进程退出时优雅关闭连接
process.on("SIGTERM", async () => {
  logger.info("[milvus] Received SIGTERM signal, closing Milvus connection...");
  await closeMilvusConnection();
});

process.on("SIGINT", async () => {
  logger.info("[milvus] Received SIGINT signal, closing Milvus connection...");
  await closeMilvusConnection();
});
