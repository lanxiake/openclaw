/**
 * 记忆系统审计日志 Schema
 *
 * 记录所有记忆读写操作的审计日志，用于追踪谁在什么时间对记忆做了什么操作。
 * 审计日志异步写入（fire-and-forget），不阻塞主流程。
 */

import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * 审计操作类型枚举
 */
export const MEMORY_AUDIT_ACTIONS = [
  "read_profile",
  "update_profile",
  "read_facts",
  "add_fact",
  "update_fact",
  "delete_fact",
  "read_preferences",
  "update_preferences",
  "read_workspace_file",
  "update_workspace_file",
  "reset_workspace_file",
  "export_profile",
  "system_load",
] as const;

export type MemoryAuditAction = (typeof MEMORY_AUDIT_ACTIONS)[number];

/**
 * 审计来源类型枚举
 */
export const MEMORY_AUDIT_SOURCES = ["agent", "admin", "api", "system"] as const;

export type MemoryAuditSource = (typeof MEMORY_AUDIT_SOURCES)[number];

/**
 * 审计日志详情接口
 */
export interface MemoryAuditDetails {
  /** 变更前的值摘要 */
  before?: string;
  /** 变更后的值摘要 */
  after?: string;
  /** 文件名（workspace 文件操作） */
  fileName?: string;
  /** 事实类别 */
  category?: string;
  /** 额外信息 */
  extra?: Record<string, unknown>;
}

/**
 * 记忆审计日志表
 *
 * 所有记忆系统的读写操作都记录在此表中，支持按用户、会话、时间范围查询。
 */
export const memoryAuditLogs = pgTable(
  "memory_audit_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 目标用户 ID（被操作的记忆所属用户） */
    userId: text("user_id").notNull(),
    /** 操作类型 */
    action: text("action").notNull(),
    /** 目标记录 ID（如 fact_id, workspace_file_id 等） */
    targetId: text("target_id"),
    /** 操作来源 */
    source: text("source").notNull(),
    /** 会话 ID（Agent 对话场景） */
    sessionId: text("session_id"),
    /** Agent ID（Agent 对话场景） */
    agentId: text("agent_id"),
    /** 管理员 ID（Admin 操作场景） */
    adminId: text("admin_id"),
    /** 操作详情（JSON） */
    details: jsonb("details").$type<MemoryAuditDetails>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memory_audit_logs_user_id_idx").on(table.userId),
    index("memory_audit_logs_user_action_idx").on(table.userId, table.action),
    index("memory_audit_logs_session_id_idx").on(table.sessionId),
    index("memory_audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// ==================== Zod Schemas ====================

export const insertMemoryAuditLogSchema = createInsertSchema(memoryAuditLogs);
export const selectMemoryAuditLogSchema = createSelectSchema(memoryAuditLogs);

// ==================== Type Exports ====================

/** 记忆审计日志类型 */
export type MemoryAuditLog = typeof memoryAuditLogs.$inferSelect;
export type NewMemoryAuditLog = typeof memoryAuditLogs.$inferInsert;
