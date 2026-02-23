/**
 * 系统告警表 Schema
 *
 * 存储系统监控告警记录，支持风险自动生成和手动创建。
 * 告警可被管理员确认（acknowledge）和解决（resolve）。
 */

import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * 告警类型
 */
export type AlertType = "cpu" | "memory" | "disk" | "api_error" | "service_down" | "custom";

/**
 * 告警严重级别
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * 系统告警表
 */
export const systemAlerts = pgTable(
  "system_alerts",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    /** 告警类型 */
    type: text("type", {
      enum: ["cpu", "memory", "disk", "api_error", "service_down", "custom"],
    }).notNull(),

    /** 严重级别 */
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    }).notNull(),

    /** 告警标题 */
    title: text("title").notNull(),

    /** 告警消息 */
    message: text("message").notNull(),

    /** 告警来源 */
    source: text("source").notNull(),

    /** 关联审计日志 ID（可选） */
    auditLogId: text("audit_log_id"),

    /** 是否已确认 */
    acknowledged: boolean("acknowledged").default(false).notNull(),

    /** 确认人 */
    acknowledgedBy: text("acknowledged_by"),

    /** 确认时间 */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    /** 是否已解决 */
    resolved: boolean("resolved").default(false).notNull(),

    /** 解决时间 */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("system_alerts_created_at_idx").on(table.createdAt),
    index("system_alerts_severity_idx").on(table.severity),
    index("system_alerts_acknowledged_idx").on(table.acknowledged),
    index("system_alerts_resolved_idx").on(table.resolved),
  ],
);

// ==================== Zod Schemas ====================

export const insertSystemAlertSchema = createInsertSchema(systemAlerts);
export const selectSystemAlertSchema = createSelectSchema(systemAlerts);

// ==================== TypeScript 类型 ====================

export type SystemAlert = typeof systemAlerts.$inferSelect;
export type NewSystemAlert = typeof systemAlerts.$inferInsert;
