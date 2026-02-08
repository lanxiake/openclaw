/**
 * 审计日志表 Schema
 *
 * 记录用户和系统操作，支持风险分级和月度分区
 */

import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

/**
 * 审计日志风险等级
 */
export type AuditRiskLevel = "low" | "medium" | "high" | "critical";

/**
 * 审计日志操作类别
 */
export type AuditCategory =
  | "auth"
  | "user"
  | "device"
  | "subscription"
  | "payment"
  | "skill"
  | "system"
  | "security";

/**
 * 审计日志表
 *
 * 建议按月分区，使用 created_at 字段
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID (可为空，表示系统操作) */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 设备 ID (可为空) */
    deviceId: text("device_id"),
    /** 操作类别 */
    category: text("category", {
      enum: ["auth", "user", "device", "subscription", "payment", "skill", "system", "security"],
    }).notNull(),
    /** 操作动作 */
    action: text("action").notNull(),
    /** 资源类型 */
    resourceType: text("resource_type"),
    /** 资源 ID */
    resourceId: text("resource_id"),
    /** 风险等级 */
    riskLevel: text("risk_level", {
      enum: ["low", "medium", "high", "critical"],
    })
      .default("low")
      .notNull(),
    /** IP 地址 */
    ipAddress: text("ip_address"),
    /** User Agent */
    userAgent: text("user_agent"),
    /** 操作详情 (JSON) */
    details: jsonb("details").$type<AuditLogDetails>(),
    /** 操作前数据快照 */
    beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
    /** 操作后数据快照 */
    afterState: jsonb("after_state").$type<Record<string, unknown>>(),
    /** 操作结果 */
    result: text("result", {
      enum: ["success", "failure", "partial"],
    }).notNull(),
    /** 错误信息 */
    errorMessage: text("error_message"),
    /** 创建时间 (用于分区) */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 联合索引：用户 + 时间 (查询用户操作历史)
    index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
    // 索引：类别 (按类别查询)
    index("audit_logs_category_idx").on(table.category),
    // 索引：风险等级 (查询高风险操作)
    index("audit_logs_risk_level_idx").on(table.riskLevel),
    // 索引：资源 (查询特定资源的操作)
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    // 索引：创建时间 (时间范围查询 + 分区)
    index("audit_logs_created_at_idx").on(table.createdAt),
    // 索引：IP 地址 (安全审计)
    index("audit_logs_ip_address_idx").on(table.ipAddress),
  ],
);

/**
 * 审计日志详情接口
 */
export interface AuditLogDetails {
  /** 请求方法 */
  method?: string;
  /** 请求路径 */
  path?: string;
  /** 请求参数 (脱敏后) */
  params?: Record<string, unknown>;
  /** 响应状态码 */
  statusCode?: number;
  /** 耗时 (毫秒) */
  durationMs?: number;
  /** 目标类型 (用于验证码等场景) */
  targetType?: string;
  /** 用途 */
  purpose?: string;
  /** 目标 (脱敏后) */
  target?: string;
  /** 失败原因 */
  failureReason?: string;
  /** 设备 ID */
  deviceId?: string;
  /** 设备平台 */
  platform?: string;
  /** 设备别名 */
  alias?: string;
  /** 是否主设备 */
  isPrimary?: boolean;
  /** 是否曾是主设备 (解绑时) */
  wasPrimary?: boolean;
  /** 原因说明 (用于限流、拒绝等场景) */
  reason?: string;
  /** 导出类型 */
  exportType?: string;
  /** 导出格式 */
  format?: string;
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 数量 */
  recentExports?: number;
  /** 最大允许数量 */
  maxExports?: number;
  /** 额外信息 */
  extra?: Record<string, unknown>;
}

/**
 * 导出日志表
 *
 * 记录数据导出操作
 */
export const exportLogs = pgTable(
  "export_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 导出类型 */
    exportType: text("export_type", {
      enum: ["user_data", "audit_logs", "chat_history", "files"],
    }).notNull(),
    /** 导出状态 */
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed", "expired"],
    }).notNull(),
    /** 导出格式 */
    format: text("format", {
      enum: ["json", "csv", "zip"],
    }).notNull(),
    /** 文件路径/URL */
    filePath: text("file_path"),
    /** 文件大小 (字节) */
    fileSize: text("file_size"),
    /** 导出参数 */
    params: jsonb("params").$type<ExportParams>(),
    /** 错误信息 */
    errorMessage: text("error_message"),
    /** 请求时间 */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    /** 完成时间 */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** 下载次数 */
    downloadCount: text("download_count").default("0").notNull(),
    /** 最后下载时间 */
    lastDownloadAt: timestamp("last_download_at", { withTimezone: true }),
  },
  (table) => [
    // 索引：用户 ID
    index("export_logs_user_id_idx").on(table.userId),
    // 索引：状态
    index("export_logs_status_idx").on(table.status),
    // 索引：过期时间 (用于清理)
    index("export_logs_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 导出参数接口
 */
export interface ExportParams {
  /** 开始时间 */
  startDate?: string;
  /** 结束时间 */
  endDate?: string;
  /** 包含的字段 */
  fields?: string[];
  /** 过滤条件 */
  filters?: Record<string, unknown>;
}

/**
 * 关系定义
 */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const exportLogsRelations = relations(exportLogs, ({ one }) => ({
  user: one(users, {
    fields: [exportLogs.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);
export const insertExportLogSchema = createInsertSchema(exportLogs);
export const selectExportLogSchema = createSelectSchema(exportLogs);

// 类型导出
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ExportLog = typeof exportLogs.$inferSelect;
export type NewExportLog = typeof exportLogs.$inferInsert;
