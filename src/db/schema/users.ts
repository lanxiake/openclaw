/**
 * 用户表 Schema
 *
 * 用户只管理身份标识，不包含权限（权限在设备层）
 */

import { pgTable, text, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";

/**
 * 用户表
 *
 * 核心身份信息，不包含 role/scopes（这些属于设备）
 */
export const users = pgTable(
  "users",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 手机号 (带国际区号) */
    phone: text("phone"),
    /** 邮箱 */
    email: text("email"),
    /** 微信 OpenID */
    wechatOpenId: text("wechat_open_id"),
    /** 微信 UnionID */
    wechatUnionId: text("wechat_union_id"),
    /** 密码哈希 (bcrypt) */
    passwordHash: text("password_hash"),
    /** 显示名称 */
    displayName: text("display_name"),
    /** 头像 URL */
    avatarUrl: text("avatar_url"),
    /** MFA 密钥 (TOTP, 加密存储) */
    mfaSecret: text("mfa_secret"),
    /** MFA 备用码 (加密存储的 JSON 数组) */
    mfaBackupCodes: jsonb("mfa_backup_codes").$type<string[]>(),
    /** MFA 是否启用 */
    mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
    /** 账户是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 邮箱是否已验证 */
    emailVerified: boolean("email_verified").default(false).notNull(),
    /** 手机是否已验证 */
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    /** 上次登录时间 */
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    /** 用户偏好设置 (JSON) */
    preferences: jsonb("preferences").$type<UserPreferences>(),
    /** 用户配置 (JSON) */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    // 唯一索引：手机号
    uniqueIndex("users_phone_unique_idx")
      .on(table.phone)
      .where(sql`phone IS NOT NULL`),
    // 唯一索引：邮箱
    uniqueIndex("users_email_unique_idx")
      .on(table.email)
      .where(sql`email IS NOT NULL`),
    // 唯一索引：微信 OpenID
    uniqueIndex("users_wechat_openid_unique_idx")
      .on(table.wechatOpenId)
      .where(sql`wechat_open_id IS NOT NULL`),
    // 索引：创建时间
    index("users_created_at_idx").on(table.createdAt),
    // 索引：活跃状态
    index("users_is_active_idx").on(table.isActive),
  ],
);

/**
 * 用户偏好设置类型
 */
export interface UserPreferences {
  /** 语言偏好 */
  language?: string;
  /** 时区 */
  timezone?: string;
  /** 是否启用通知 */
  notificationsEnabled?: boolean;
  /** 主题模式 */
  theme?: "light" | "dark" | "system";
}

/**
 * 用户设备关联表
 *
 * 纯关联表，不复制 device-pairing.ts 的数据
 * 权限 (role, scopes) 保留在 device-pairing.ts
 */
export const userDevices = pgTable(
  "user_devices",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID (外键) */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 设备 ID (对应 device-pairing.ts 中的 deviceId) */
    deviceId: text("device_id").notNull(),
    /** 设备别名 (用户可自定义) */
    alias: text("alias"),
    /** 是否为主设备 */
    isPrimary: boolean("is_primary").default(false).notNull(),
    /** 绑定时间 */
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
    /** 最后活跃时间 */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => [
    // 联合唯一索引：用户+设备
    uniqueIndex("user_devices_user_device_unique_idx").on(table.userId, table.deviceId),
    // 索引：用户 ID
    index("user_devices_user_id_idx").on(table.userId),
    // 索引：设备 ID
    index("user_devices_device_id_idx").on(table.deviceId),
  ],
);

/**
 * 用户会话表
 *
 * 存储用户登录会话（非设备会话）
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID (外键) */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** Refresh Token 哈希 */
    refreshTokenHash: text("refresh_token_hash").notNull(),
    /** 登录设备信息 */
    userAgent: text("user_agent"),
    /** 登录 IP */
    ipAddress: text("ip_address"),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 是否已撤销 */
    revoked: boolean("revoked").default(false).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 最后刷新时间 */
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  },
  (table) => [
    // 索引：用户 ID
    index("user_sessions_user_id_idx").on(table.userId),
    // 索引：Refresh Token 哈希 (用于查找)
    index("user_sessions_refresh_token_hash_idx").on(table.refreshTokenHash),
    // 索引：过期时间 (用于清理)
    index("user_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 登录尝试记录表
 *
 * 用于防暴力破解
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 登录标识 (手机/邮箱/用户ID) */
    identifier: text("identifier").notNull(),
    /** 标识类型 */
    identifierType: text("identifier_type", {
      enum: ["phone", "email", "user_id"],
    }).notNull(),
    /** IP 地址 */
    ipAddress: text("ip_address").notNull(),
    /** 是否成功 */
    success: boolean("success").notNull(),
    /** 失败原因 */
    failureReason: text("failure_reason"),
    /** User Agent */
    userAgent: text("user_agent"),
    /** 尝试时间 */
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 联合索引：标识+IP (用于计数)
    index("login_attempts_identifier_ip_idx").on(table.identifier, table.ipAddress),
    // 索引：尝试时间 (用于清理过期记录)
    index("login_attempts_attempted_at_idx").on(table.attemptedAt),
    // 索引：IP 地址 (用于 IP 级别限流)
    index("login_attempts_ip_address_idx").on(table.ipAddress),
  ],
);

/**
 * 验证码表
 *
 * 存储短信/邮件验证码
 */
export const verificationCodes = pgTable(
  "verification_codes",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 目标 (手机号/邮箱) */
    target: text("target").notNull(),
    /** 目标类型 */
    targetType: text("target_type", {
      enum: ["phone", "email"],
    }).notNull(),
    /** 验证码 (6位) */
    code: text("code").notNull(),
    /** 用途 */
    purpose: text("purpose", {
      enum: ["register", "login", "reset_password", "bind", "verify"],
    }).notNull(),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 是否已使用 */
    used: boolean("used").default(false).notNull(),
    /** 尝试次数 */
    attempts: text("attempts").default("0").notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 联合索引：目标+用途 (用于查找最新验证码)
    index("verification_codes_target_purpose_idx").on(table.target, table.purpose),
    // 索引：过期时间 (用于清理)
    index("verification_codes_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 用户表关系定义
 */
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(userDevices),
  sessions: many(userSessions),
}));

/**
 * 用户设备关系定义
 */
export const userDevicesRelations = relations(userDevices, ({ one }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),
}));

/**
 * 用户会话关系定义
 */
export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertUserDeviceSchema = createInsertSchema(userDevices);
export const selectUserDeviceSchema = createSelectSchema(userDevices);
export const insertUserSessionSchema = createInsertSchema(userSessions);
export const selectUserSessionSchema = createSelectSchema(userSessions);
export const insertLoginAttemptSchema = createInsertSchema(loginAttempts);
export const selectLoginAttemptSchema = createSelectSchema(loginAttempts);
export const insertVerificationCodeSchema = createInsertSchema(verificationCodes);
export const selectVerificationCodeSchema = createSelectSchema(verificationCodes);

// 类型导出
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type NewVerificationCode = typeof verificationCodes.$inferInsert;
