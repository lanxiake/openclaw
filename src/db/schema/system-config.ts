/**
 * 系统配置 Schema
 *
 * 用于存储系统级别的配置项，支持分组、类型验证、审计追踪
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { admins } from "./admins.js";

/**
 * 配置值类型
 */
export type ConfigValueType = "string" | "number" | "boolean" | "json" | "array";

/**
 * 系统配置表
 *
 * 存储系统级别的配置项，支持分组管理
 */
export const systemConfigs = pgTable(
  "system_configs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    /** 配置键名 (唯一) */
    key: text("key").notNull(),

    /** 配置值 (JSON 格式存储) */
    value: jsonb("value").notNull(),

    /** 值类型 */
    valueType: text("value_type", {
      enum: ["string", "number", "boolean", "json", "array"],
    }).notNull().default("string"),

    /** 配置分组 */
    group: text("group").notNull().default("general"),

    /** 配置描述 */
    description: text("description"),

    /** 是否敏感数据 (显示时需要脱敏) */
    isSensitive: boolean("is_sensitive").default(false).notNull(),

    /** 是否只读 (不允许通过 UI 修改) */
    isReadonly: boolean("is_readonly").default(false).notNull(),

    /** 是否需要重启生效 */
    requiresRestart: boolean("requires_restart").default(false).notNull(),

    /** 默认值 */
    defaultValue: jsonb("default_value"),

    /** 验证规则 (JSON Schema 或自定义) */
    validationRules: jsonb("validation_rules").$type<{
      min?: number;
      max?: number;
      pattern?: string;
      enum?: string[];
      required?: boolean;
    }>(),

    /** 最后修改人 */
    updatedBy: text("updated_by")
      .references(() => admins.id, { onDelete: "set null" }),

    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 配置键唯一索引
    uniqueIndex("system_configs_key_unique_idx").on(table.key),
    // 分组索引
    index("system_configs_group_idx").on(table.group),
    // 敏感数据索引
    index("system_configs_is_sensitive_idx").on(table.isSensitive),
  ]
);

/**
 * 配置变更历史表
 *
 * 记录所有配置的修改历史，用于审计和回滚
 */
export const configChangeHistory = pgTable(
  "config_change_history",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    /** 关联的配置 ID */
    configId: text("config_id")
      .references(() => systemConfigs.id, { onDelete: "cascade" })
      .notNull(),

    /** 配置键名 (冗余存储，便于查询) */
    configKey: text("config_key").notNull(),

    /** 变更前的值 */
    oldValue: jsonb("old_value"),

    /** 变更后的值 */
    newValue: jsonb("new_value"),

    /** 变更类型 */
    changeType: text("change_type", {
      enum: ["create", "update", "delete"],
    }).notNull(),

    /** 变更原因 */
    reason: text("reason"),

    /** 变更人 ID */
    changedBy: text("changed_by")
      .references(() => admins.id, { onDelete: "set null" }),

    /** 变更人名称 (冗余存储) */
    changedByName: text("changed_by_name"),

    /** 变更时间 */
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** IP 地址 */
    ipAddress: text("ip_address"),

    /** User Agent */
    userAgent: text("user_agent"),
  },
  (table) => [
    index("config_change_history_config_id_idx").on(table.configId),
    index("config_change_history_config_key_idx").on(table.configKey),
    index("config_change_history_changed_by_idx").on(table.changedBy),
    index("config_change_history_changed_at_idx").on(table.changedAt),
    index("config_change_history_change_type_idx").on(table.changeType),
  ]
);

/**
 * 关系定义
 */
export const systemConfigsRelations = relations(systemConfigs, ({ one, many }) => ({
  updatedByAdmin: one(admins, {
    fields: [systemConfigs.updatedBy],
    references: [admins.id],
  }),
  history: many(configChangeHistory),
}));

export const configChangeHistoryRelations = relations(configChangeHistory, ({ one }) => ({
  config: one(systemConfigs, {
    fields: [configChangeHistory.configId],
    references: [systemConfigs.id],
  }),
  changedByAdmin: one(admins, {
    fields: [configChangeHistory.changedBy],
    references: [admins.id],
  }),
}));

// Zod schemas
export const insertSystemConfigSchema = createInsertSchema(systemConfigs);
export const selectSystemConfigSchema = createSelectSchema(systemConfigs);
export const insertConfigChangeHistorySchema = createInsertSchema(configChangeHistory);
export const selectConfigChangeHistorySchema = createSelectSchema(configChangeHistory);

// 类型导出
export type SystemConfig = typeof systemConfigs.$inferSelect;
export type NewSystemConfig = typeof systemConfigs.$inferInsert;
export type ConfigChangeHistory = typeof configChangeHistory.$inferSelect;
export type NewConfigChangeHistory = typeof configChangeHistory.$inferInsert;

/**
 * 配置分组枚举
 */
export const CONFIG_GROUPS = {
  GENERAL: "general",
  SECURITY: "security",
  GATEWAY: "gateway",
  AI: "ai",
  STORAGE: "storage",
  EMAIL: "email",
  NOTIFICATION: "notification",
  SUBSCRIPTION: "subscription",
  MAINTENANCE: "maintenance",
} as const;

export type ConfigGroup = (typeof CONFIG_GROUPS)[keyof typeof CONFIG_GROUPS];

/**
 * 预定义配置键
 */
export const CONFIG_KEYS = {
  // 通用配置
  SITE_NAME: "site_name",
  SITE_DESCRIPTION: "site_description",
  MAINTENANCE_MODE: "maintenance_mode",
  MAINTENANCE_MESSAGE: "maintenance_message",

  // 安全配置
  MAX_LOGIN_ATTEMPTS: "max_login_attempts",
  LOCKOUT_DURATION: "lockout_duration",
  SESSION_TIMEOUT: "session_timeout",
  TWO_FACTOR_ENABLED: "two_factor_enabled",

  // Gateway 配置
  GATEWAY_URL: "gateway_url",
  GATEWAY_TIMEOUT: "gateway_timeout",
  MAX_CONNECTIONS: "max_connections",

  // AI 配置
  DEFAULT_MODEL: "default_model",
  MAX_TOKENS: "max_tokens",
  TEMPERATURE: "temperature",

  // 存储配置
  STORAGE_PROVIDER: "storage_provider",
  STORAGE_PATH: "storage_path",
  MAX_FILE_SIZE: "max_file_size",

  // 邮件配置
  SMTP_HOST: "smtp_host",
  SMTP_PORT: "smtp_port",
  SMTP_USER: "smtp_user",
  SMTP_PASSWORD: "smtp_password",
  SMTP_FROM: "smtp_from",

  // 通知配置
  NOTIFICATION_ENABLED: "notification_enabled",
  SLACK_WEBHOOK: "slack_webhook",
  DISCORD_WEBHOOK: "discord_webhook",

  // 订阅配置
  FREE_QUOTA: "free_quota",
  PRO_QUOTA: "pro_quota",
  TEAM_QUOTA: "team_quota",
  ENTERPRISE_QUOTA: "enterprise_quota",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
