/**
 * 管理员表 Schema
 *
 * 管理后台管理员相关数据结构
 */

import { pgTable, text, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

/**
 * 管理员角色类型
 */
export type AdminRole = "super_admin" | "admin" | "operator";

/**
 * 管理员状态类型
 */
export type AdminStatus = "active" | "suspended" | "locked";

/**
 * 管理员权限类型
 */
export interface AdminPermissions {
  /** 用户管理权限 */
  users?: {
    view?: boolean;
    edit?: boolean;
    suspend?: boolean;
    delete?: boolean;
  };
  /** 订阅管理权限 */
  subscriptions?: {
    view?: boolean;
    edit?: boolean;
    refund?: boolean;
  };
  /** 技能商店权限 */
  skills?: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    publish?: boolean;
    delete?: boolean;
  };
  /** 系统配置权限 */
  system?: {
    viewConfig?: boolean;
    editConfig?: boolean;
    viewLogs?: boolean;
  };
  /** 管理员管理权限 */
  admins?: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
}

/**
 * 管理员表
 *
 * 存储管理后台用户信息
 */
export const admins = pgTable(
  "admins",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户名 (唯一) */
    username: text("username").notNull(),
    /** 密码哈希 (bcrypt) */
    passwordHash: text("password_hash").notNull(),
    /** 显示名称 */
    displayName: text("display_name").notNull(),
    /** 邮箱 */
    email: text("email"),
    /** 手机号 */
    phone: text("phone"),
    /** 头像 URL */
    avatarUrl: text("avatar_url"),
    /** 角色 */
    role: text("role", {
      enum: ["super_admin", "admin", "operator"],
    })
      .default("operator")
      .notNull(),
    /** 账户状态 */
    status: text("status", {
      enum: ["active", "suspended", "locked"],
    })
      .default("active")
      .notNull(),
    /** 自定义权限 (覆盖角色默认权限) */
    permissions: jsonb("permissions").$type<AdminPermissions>(),
    /** MFA 密钥 (TOTP, 加密存储) */
    mfaSecret: text("mfa_secret"),
    /** MFA 备用码 (加密存储的 JSON 数组) */
    mfaBackupCodes: jsonb("mfa_backup_codes").$type<string[]>(),
    /** MFA 是否启用 */
    mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
    /** 登录失败次数 (用于锁定) */
    failedLoginAttempts: text("failed_login_attempts").default("0").notNull(),
    /** 最后登录失败时间 */
    lastFailedLoginAt: timestamp("last_failed_login_at", { withTimezone: true }),
    /** 锁定截止时间 */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    /** 上次登录时间 */
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** 上次登录 IP */
    lastLoginIp: text("last_login_ip"),
    /** 密码修改时间 */
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    /** 创建者 ID (外键) */
    createdBy: text("created_by"),
  },
  (table) => [
    // 唯一索引：用户名
    uniqueIndex("admins_username_unique_idx").on(table.username),
    // 唯一索引：邮箱
    uniqueIndex("admins_email_unique_idx").on(table.email),
    // 索引：角色
    index("admins_role_idx").on(table.role),
    // 索引：状态
    index("admins_status_idx").on(table.status),
    // 索引：创建时间
    index("admins_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 管理员会话表
 *
 * 存储管理员登录会话
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 管理员 ID (外键) */
    adminId: text("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
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
    /** 最后活跃时间 */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => [
    // 索引：管理员 ID
    index("admin_sessions_admin_id_idx").on(table.adminId),
    // 索引：Refresh Token 哈希
    index("admin_sessions_refresh_token_hash_idx").on(table.refreshTokenHash),
    // 索引：过期时间
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 管理员操作日志表
 *
 * 记录管理员的所有操作
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 管理员 ID (外键) */
    adminId: text("admin_id").references(() => admins.id, { onDelete: "set null" }),
    /** 管理员用户名 (冗余，防止删除后无法追溯) */
    adminUsername: text("admin_username").notNull(),
    /** 操作类型 */
    action: text("action").notNull(),
    /** 目标类型 (user, subscription, skill, admin, system) */
    targetType: text("target_type"),
    /** 目标 ID */
    targetId: text("target_id"),
    /** 目标名称 (冗余，便于展示) */
    targetName: text("target_name"),
    /** 操作详情 (JSON) */
    details: jsonb("details").$type<AdminAuditLogDetails>(),
    /** 操作前数据快照 (JSON) */
    beforeSnapshot: jsonb("before_snapshot").$type<Record<string, unknown>>(),
    /** 操作后数据快照 (JSON) */
    afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown>>(),
    /** IP 地址 */
    ipAddress: text("ip_address"),
    /** User Agent */
    userAgent: text("user_agent"),
    /** 风险等级 */
    riskLevel: text("risk_level", {
      enum: ["low", "medium", "high", "critical"],
    })
      .default("low")
      .notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 索引：管理员 ID
    index("admin_audit_logs_admin_id_idx").on(table.adminId),
    // 索引：操作类型
    index("admin_audit_logs_action_idx").on(table.action),
    // 索引：目标类型+目标 ID
    index("admin_audit_logs_target_idx").on(table.targetType, table.targetId),
    // 索引：风险等级
    index("admin_audit_logs_risk_level_idx").on(table.riskLevel),
    // 索引：创建时间
    index("admin_audit_logs_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 管理员审计日志详情类型
 */
export interface AdminAuditLogDetails {
  /** 操作描述 */
  description?: string;
  /** 变更字段 */
  changedFields?: string[];
  /** 原因 */
  reason?: string;
  /** 额外数据 */
  extra?: Record<string, unknown>;
}

/**
 * 管理员登录尝试记录表
 *
 * 用于防暴力破解
 */
export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户名 */
    username: text("username").notNull(),
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
    // 联合索引：用户名+IP
    index("admin_login_attempts_username_ip_idx").on(table.username, table.ipAddress),
    // 索引：尝试时间
    index("admin_login_attempts_attempted_at_idx").on(table.attemptedAt),
    // 索引：IP 地址
    index("admin_login_attempts_ip_address_idx").on(table.ipAddress),
  ],
);

/**
 * 管理员表关系定义
 */
export const adminsRelations = relations(admins, ({ many, one }) => ({
  sessions: many(adminSessions),
  auditLogs: many(adminAuditLogs),
  creator: one(admins, {
    fields: [admins.createdBy],
    references: [admins.id],
  }),
}));

/**
 * 管理员会话关系定义
 */
export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(admins, {
    fields: [adminSessions.adminId],
    references: [admins.id],
  }),
}));

/**
 * 管理员审计日志关系定义
 */
export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(admins, {
    fields: [adminAuditLogs.adminId],
    references: [admins.id],
  }),
}));

// Zod schemas for validation
export const insertAdminSchema = createInsertSchema(admins);
export const selectAdminSchema = createSelectSchema(admins);
export const insertAdminSessionSchema = createInsertSchema(adminSessions);
export const selectAdminSessionSchema = createSelectSchema(adminSessions);
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs);
export const selectAdminAuditLogSchema = createSelectSchema(adminAuditLogs);
export const insertAdminLoginAttemptSchema = createInsertSchema(adminLoginAttempts);
export const selectAdminLoginAttemptSchema = createSelectSchema(adminLoginAttempts);

// 类型导出
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
export type AdminLoginAttempt = typeof adminLoginAttempts.$inferSelect;
export type NewAdminLoginAttempt = typeof adminLoginAttempts.$inferInsert;
