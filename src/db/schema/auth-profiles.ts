/**
 * Auth Profile 配置表 Schema
 *
 * 存储 API Key / Token / OAuth 凭据的数据库化配置。
 * 支持系统级（system）和租户级（tenant）两种配置类型。
 * 替代原有基于文件（auth-profiles.json）的存储方式。
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./users.js";

// ---------------------------------------------------------------------------
// auth_profiles 表
// ---------------------------------------------------------------------------

export const authProfiles = pgTable(
  "auth_profiles",
  {
    id: text("id").primaryKey(),

    /** 配置类型: system（全局默认） 或 tenant（租户覆盖） */
    configType: varchar("config_type", { length: 20 }).notNull().default("system"),

    /** 租户 ID（仅当 configType='tenant' 时有效） */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),

    /** 配置文件中的 profile ID（如 "anthropic-main", "openai-backup"） */
    profileId: varchar("profile_id", { length: 100 }).notNull(),

    /** 提供商标识（如 "anthropic", "openai", "google"） */
    provider: varchar("provider", { length: 100 }).notNull(),

    /** 凭据类型 */
    credentialMode: varchar("credential_mode", { length: 20 }).notNull().default("api_key"),

    /** API Key（当 credentialMode='api_key' 时） */
    apiKey: varchar("api_key", { length: 500 }),

    /** 静态 Token（当 credentialMode='token' 时） */
    token: text("token"),

    /** Token 过期时间（当 credentialMode='token' 时） */
    tokenExpires: timestamp("token_expires", { withTimezone: true }),

    /** OAuth 凭据 JSON（当 credentialMode='oauth' 时）
     * 包含 accessToken, refreshToken, expiry, clientId 等 */
    oauthCredentials: jsonb("oauth_credentials"),

    /** 关联的 email */
    email: varchar("email", { length: 255 }),

    /** 是否启用 */
    enabled: boolean("enabled").default(true),

    /** 优先级（数值越小优先级越高） */
    priority: integer("priority").default(100),

    /** 模型绑定列表（JSON 数组）
     * 指定此 profile 仅用于特定模型，为空表示适用所有模型 */
    modelBindings: jsonb("model_bindings"),

    /** 运行时使用统计（JSONB）
     * 包含 lastUsed, cooldownUntil, errorCount 等 */
    usageStats: jsonb("usage_stats"),

    /** 冷却配置覆盖（JSONB）
     * 覆盖系统默认的冷却策略 */
    cooldownConfig: jsonb("cooldown_config"),

    /** 扩展配置（JSONB） */
    extraConfig: jsonb("extra_config"),

    // 元数据
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => ({
    /** profileId 在同一 configType + userId 下唯一 */
    profileUnique: unique("auth_profiles_unique").on(
      table.configType,
      table.userId,
      table.profileId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// auth_profile_order 表（agent → profile 优先级顺序）
// ---------------------------------------------------------------------------

export const authProfileOrder = pgTable(
  "auth_profile_order",
  {
    id: text("id").primaryKey(),

    /** 配置类型: system 或 tenant */
    configType: varchar("config_type", { length: 20 }).notNull().default("system"),

    /** 租户 ID */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),

    /** Agent 标识（如 "default", "pi-agent", 特定 agent ID）
     * "default" 代表全局默认顺序 */
    agentKey: varchar("agent_key", { length: 100 }).notNull().default("default"),

    /** 有序的 profileId 列表（JSON 数组） */
    profileIds: jsonb("profile_ids").notNull(),

    // 元数据
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => ({
    /** agentKey 在同一 configType + userId 下唯一 */
    orderUnique: unique("auth_profile_order_unique").on(
      table.configType,
      table.userId,
      table.agentKey,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const authProfilesRelations = relations(authProfiles, ({ one }) => ({
  user: one(users, {
    fields: [authProfiles.userId],
    references: [users.id],
  }),
}));

export const authProfileOrderRelations = relations(authProfileOrder, ({ one }) => ({
  user: one(users, {
    fields: [authProfileOrder.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const insertAuthProfileSchema = createInsertSchema(authProfiles);
export const selectAuthProfileSchema = createSelectSchema(authProfiles);
export const insertAuthProfileOrderSchema = createInsertSchema(authProfileOrder);
export const selectAuthProfileOrderSchema = createSelectSchema(authProfileOrder);

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export type AuthProfile = typeof authProfiles.$inferSelect;
export type NewAuthProfile = typeof authProfiles.$inferInsert;
export type AuthProfileOrderRecord = typeof authProfileOrder.$inferSelect;
export type NewAuthProfileOrderRecord = typeof authProfileOrder.$inferInsert;

/** OAuth 凭据结构（存储在 oauthCredentials JSONB 中） */
export type OAuthCredentialsData = {
  accessToken: string;
  refreshToken?: string;
  expiry?: number;
  clientId?: string;
  scope?: string;
};

/** 使用统计结构（存储在 usageStats JSONB 中） */
export type AuthProfileUsageStats = {
  lastUsed?: number;
  cooldownUntil?: number;
  disabledUntil?: number;
  disabledReason?: string;
  errorCount?: number;
  failureCounts?: Record<string, number>;
  lastFailureAt?: number;
};

/** 冷却配置结构（存储在 cooldownConfig JSONB 中） */
export type AuthProfileCooldownConfig = {
  billingBackoffHours?: number;
  billingBackoffHoursByProvider?: Record<string, number>;
  billingMaxHours?: number;
  failureWindowHours?: number;
};
