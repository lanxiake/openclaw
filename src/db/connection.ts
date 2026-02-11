/**
 * PostgreSQL 数据库连接模块
 *
 * 基于 Drizzle ORM + postgres.js 驱动
 * 提供连接池管理、健康检查、优雅关闭等功能
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { getLogger } from "../shared/logging/logger.js";
import * as schema from "./schema/index.js";

// 获取 logger 实例
const logger = getLogger();

// 数据库配置接口
export interface DatabaseConfig {
  /** 数据库连接字符串 */
  connectionString: string;
  /** 最大连接数 (默认 10) */
  maxConnections?: number;
  /** 连接超时毫秒数 (默认 10000) */
  connectionTimeoutMs?: number;
  /** 空闲超时毫秒数 (默认 300000 = 5分钟) */
  idleTimeoutMs?: number;
  /** 是否启用 SSL (默认 false) */
  ssl?: boolean | "require" | "prefer";
}

// 数据库实例类型
export type Database = PostgresJsDatabase<typeof schema>;

// 模块级变量，用于存储单例连接
let dbInstance: Database | null = null;
let sqlClient: Sql | null = null;

/**
 * 从环境变量获取数据库配置
 *
 * @returns DatabaseConfig 对象
 */
export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Please configure PostgreSQL connection string.",
    );
  }

  return {
    connectionString,
    maxConnections: parseInt(process.env["DATABASE_MAX_CONNECTIONS"] || "10", 10),
    connectionTimeoutMs: parseInt(process.env["DATABASE_CONNECTION_TIMEOUT_MS"] || "10000", 10),
    idleTimeoutMs: parseInt(process.env["DATABASE_IDLE_TIMEOUT_MS"] || "300000", 10),
    ssl: parseSslOption(process.env["DATABASE_SSL"]),
  };
}

/**
 * 解析 SSL 配置选项
 */
function parseSslOption(value: string | undefined): boolean | "require" | "prefer" {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "require") return "require";
  if (lower === "prefer") return "prefer";
  return false;
}

/**
 * 创建数据库连接
 *
 * @param config 数据库配置
 * @returns Drizzle 数据库实例
 */
export function createConnection(config: DatabaseConfig): {
  db: Database;
  sql: Sql;
} {
  logger.info("[db] Creating PostgreSQL connection pool", {
    maxConnections: config.maxConnections,
    connectionTimeout: config.connectionTimeoutMs,
    idleTimeout: config.idleTimeoutMs,
    ssl: !!config.ssl,
  });

  // 创建 postgres.js 连接
  const sql = postgres(config.connectionString, {
    max: config.maxConnections ?? 10,
    connect_timeout: Math.floor((config.connectionTimeoutMs ?? 10000) / 1000),
    idle_timeout: Math.floor((config.idleTimeoutMs ?? 300000) / 1000),
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    // 启用预处理语句提升性能
    prepare: true,
    // 连接时的钩子
    onnotice: (notice) => {
      logger.debug("[db] PostgreSQL notice", { message: notice.message });
    },
  });

  // 创建 Drizzle ORM 实例
  const db = drizzle(sql, { schema });

  logger.info("[db] Database connection pool created successfully");

  return { db, sql };
}

/**
 * 获取单例数据库连接
 *
 * 首次调用时会从环境变量读取配置并创建连接
 * 当 Mock 模式启用时（通过全局标志），返回 Mock 数据库实例
 *
 * @returns Drizzle 数据库实例
 */
export function getDatabase(): Database {
  // 检查是否处于 Mock 模式（用于单元测试）
  const g = globalThis as Record<string, unknown>;
  if (g.__OPENCLAW_MOCK_ENABLED__ && g.__OPENCLAW_MOCK_DB__) {
    return g.__OPENCLAW_MOCK_DB__ as Database;
  }

  if (!dbInstance) {
    const config = getDatabaseConfigFromEnv();
    const { db, sql } = createConnection(config);
    dbInstance = db;
    sqlClient = sql;
  }
  return dbInstance;
}

/**
 * 获取原始 SQL 客户端
 *
 * 用于执行原生 SQL 查询或事务
 *
 * @returns postgres.js SQL 实例
 */
export function getSqlClient(): Sql {
  if (!sqlClient) {
    // 确保连接已创建
    getDatabase();
  }
  if (!sqlClient) {
    throw new Error("SQL client not initialized");
  }
  return sqlClient;
}

/**
 * 数据库健康检查
 *
 * @returns 检查结果
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const sql = getSqlClient();
    // 执行简单的健康检查查询
    await sql`SELECT 1 as health_check`;

    const latencyMs = Date.now() - startTime;
    logger.debug("[db] Health check passed", { latencyMs });

    return { healthy: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logger.error("[db] Health check failed", { error: errorMessage, latencyMs });

    return { healthy: false, latencyMs, error: errorMessage };
  }
}

/**
 * 优雅关闭数据库连接
 *
 * 等待所有活动查询完成后关闭连接池
 */
export async function closeConnection(): Promise<void> {
  if (sqlClient) {
    logger.info("[db] Closing database connection pool...");

    try {
      // 结束所有连接
      await sqlClient.end({ timeout: 5 });
      logger.info("[db] Database connection pool closed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[db] Error closing database connection", {
        error: errorMessage,
      });
      throw error;
    } finally {
      sqlClient = null;
      dbInstance = null;
    }
  }
}

/**
 * 重置连接（用于测试）
 *
 * 关闭现有连接并清除单例状态
 */
export async function resetConnection(): Promise<void> {
  await closeConnection();
  dbInstance = null;
  sqlClient = null;
}

/**
 * 执行事务
 *
 * @param callback 事务回调函数
 * @returns 事务执行结果
 */
export async function transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T> {
  const db = getDatabase();
  // Drizzle ORM 的事务 API
  return db.transaction(callback);
}

// 进程退出时优雅关闭连接
process.on("SIGTERM", async () => {
  logger.info("[db] Received SIGTERM signal, closing database connection...");
  await closeConnection();
});

process.on("SIGINT", async () => {
  logger.info("[db] Received SIGINT signal, closing database connection...");
  await closeConnection();
});
