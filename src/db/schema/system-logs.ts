/**
 * 系统日志表 Schema
 *
 * 存储应用运行时的结构化日志，替代分散的 console.log。
 * 通过 tslog transport 自动收集，支持级别过滤、来源筛选和全文搜索。
 */

import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * 日志级别类型
 */
export type LogLevelEnum = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志元数据接口
 */
export interface SystemLogMetadata {
  /** 请求/操作追踪 ID */
  traceId?: string;
  /** 关联用户 ID */
  userId?: string;
  /** 请求 ID */
  requestId?: string;
  /** 操作耗时 (毫秒) */
  durationMs?: number;
  /** 错误堆栈 (仅 error/fatal) */
  errorStack?: string;
  /** 进程 PID */
  pid?: number;
  /** 主机名 */
  hostname?: string;
  /** 额外信息 */
  [key: string]: unknown;
}

/**
 * 系统日志表
 *
 * 存储结构化应用日志，建议保留 7 天，定期清理
 */
export const systemLogs = pgTable(
  "system_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    /** 日志时间戳 */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

    /** 日志级别 */
    level: text("level", {
      enum: ["trace", "debug", "info", "warn", "error", "fatal"],
    }).notNull(),

    /** 日志来源模块 (如 gateway, db, auth, agent) */
    source: text("source").notNull(),

    /** 日志消息 */
    message: text("message").notNull(),

    /** 错误名称 (仅 error/fatal 级别) */
    errorName: text("error_name"),

    /** 结构化元数据 (traceId, userId, stack 等) */
    metadata: jsonb("metadata").$type<SystemLogMetadata>(),

    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /** 按级别和时间查询 (过滤特定级别的最新日志) */
    index("system_logs_level_timestamp_idx").on(table.level, table.timestamp),
    /** 按来源和时间查询 (过滤特定模块的日志) */
    index("system_logs_source_timestamp_idx").on(table.source, table.timestamp),
    /** 按时间范围查询 (时间线浏览和清理) */
    index("system_logs_timestamp_idx").on(table.timestamp),
  ],
);

// ==================== Zod Schemas ====================

export const insertSystemLogSchema = createInsertSchema(systemLogs);
export const selectSystemLogSchema = createSelectSchema(systemLogs);

// ==================== TypeScript 类型 ====================

export type SystemLog = typeof systemLogs.$inferSelect;
export type NewSystemLog = typeof systemLogs.$inferInsert;
