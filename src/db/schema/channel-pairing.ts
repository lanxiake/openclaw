/**
 * 频道配对 Schema
 *
 * 替代文件存储的 {channel}-pairing.json 和 {channel}-allowFrom.json
 * 支持多实例部署和多租户隔离
 */

import { pgTable, text, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

/**
 * 配对请求状态
 */
export type ChannelPairingStatus = "pending" | "approved" | "expired";

/**
 * 频道配对请求表
 *
 * 替代 {channel}-pairing.json 文件存储
 * 存储待配对的频道发送者请求
 */
export const channelPairingRequests = pgTable(
  "channel_pairing_requests",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 频道标识 (telegram/discord/slack/signal/...) */
    channel: text("channel").notNull(),
    /** 频道内发送者 ID */
    senderId: text("sender_id").notNull(),
    /** 发送者附加信息 (username, firstName 等) */
    senderMeta: jsonb("sender_meta").$type<Record<string, string>>(),
    /** 8 位人类可读配对码 */
    code: text("code").notNull().unique(),
    /** 请求状态 */
    status: text("status").$type<ChannelPairingStatus>().default("pending").notNull(),
    /** 关联用户 ID (审批后绑定) */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 最后活跃时间 */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    /** 处理时间 */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** 处理人 */
    resolvedBy: text("resolved_by"),
  },
  (table) => [
    index("cpr_channel_sender_idx").on(table.channel, table.senderId),
    index("cpr_status_idx").on(table.status),
    index("cpr_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 用户频道绑定表
 *
 * 替代 {channel}-allowFrom.json 文件存储
 * 存储已配对成功的频道用户绑定关系
 */
export const userChannelBindings = pgTable(
  "user_channel_bindings",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 关联用户 ID */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** 频道标识 (telegram/discord/slack/signal/...) */
    channel: text("channel").notNull(),
    /** 频道内用户 ID */
    channelUserId: text("channel_user_id").notNull(),
    /** 显示名称 */
    displayName: text("display_name"),
    /** 是否已验证 (通过配对流程验证) */
    verified: boolean("verified").default(false).notNull(),
    /** 绑定时间 */
    boundAt: timestamp("bound_at", { withTimezone: true }).defaultNow().notNull(),
    /** 最后消息时间 */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ucb_channel_user_unique_idx").on(table.channel, table.channelUserId),
    index("ucb_user_id_idx").on(table.userId),
    index("ucb_channel_idx").on(table.channel),
  ],
);

/**
 * 频道配对请求关系定义
 */
export const channelPairingRequestsRelations = relations(channelPairingRequests, ({ one }) => ({
  user: one(users, {
    fields: [channelPairingRequests.userId],
    references: [users.id],
  }),
}));

/**
 * 用户频道绑定关系定义
 */
export const userChannelBindingsRelations = relations(userChannelBindings, ({ one }) => ({
  user: one(users, {
    fields: [userChannelBindings.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertChannelPairingRequestSchema = createInsertSchema(channelPairingRequests);
export const selectChannelPairingRequestSchema = createSelectSchema(channelPairingRequests);
export const insertUserChannelBindingSchema = createInsertSchema(userChannelBindings);
export const selectUserChannelBindingSchema = createSelectSchema(userChannelBindings);

// 类型导出
export type ChannelPairingRequest = typeof channelPairingRequests.$inferSelect;
export type NewChannelPairingRequest = typeof channelPairingRequests.$inferInsert;
export type UserChannelBinding = typeof userChannelBindings.$inferSelect;
export type NewUserChannelBinding = typeof userChannelBindings.$inferInsert;
