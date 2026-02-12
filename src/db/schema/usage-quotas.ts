/**
 * 用量配额表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * usage_quotas 存储用户的各类用量配额和使用量。
 *
 * 每月为每个用户、每种配额类型创建一条记录。
 * incrementUsage 需要原子操作（SQL UPDATE SET usedValue = usedValue + amount）。
 */

import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ==================== usage_quotas 表 ====================

/**
 * 用量配额表
 *
 * 记录用户在每个计费周期内的配额限制和实际使用量
 */
export const usageQuotas = pgTable(
  "usage_quotas",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 配额类型 */
    quotaType: text("quota_type", {
      enum: ["tokens", "storage", "devices", "skills", "api_calls"],
    }).notNull(),
    /** 计费周期开始 */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** 计费周期结束 */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** 配额上限 */
    limitValue: integer("limit_value").notNull(),
    /** 已使用量 */
    usedValue: integer("used_value").default(0).notNull(),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 用户+类型+周期唯一约束
    uniqueIndex("usage_quotas_user_type_period_idx").on(
      table.userId,
      table.quotaType,
      table.periodStart,
    ),
    // 按用户查配额
    index("usage_quotas_user_id_idx").on(table.userId),
    // 按周期结束时间查过期配额
    index("usage_quotas_period_end_idx").on(table.periodEnd),
  ],
);

// ==================== Relations ====================

/**
 * usageQuotas 关系定义
 */
export const usageQuotasRelations = relations(usageQuotas, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [usageQuotas.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUsageQuotaSchema = createInsertSchema(usageQuotas);
export const selectUsageQuotaSchema = createSelectSchema(usageQuotas);

// ==================== Type Exports ====================

export type UsageQuota = typeof usageQuotas.$inferSelect;
export type NewUsageQuota = typeof usageQuotas.$inferInsert;
