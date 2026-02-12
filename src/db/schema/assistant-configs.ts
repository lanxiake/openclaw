/**
 * 用户助手配置表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * user_assistant_configs 存储用户的 AI 助手个性化配置。
 *
 * 每用户可有多个配置，但 isDefault=true 的配置只有一个。
 */

import { pgTable, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ==================== 类型定义 ====================

/**
 * 助手性格设定
 */
export interface AssistantPersonality {
  /** 语气风格: formal / casual / friendly / professional */
  tone?: string;
  /** 回复详细程度: concise / balanced / detailed */
  verbosity?: string;
  /** 是否主动建议 */
  proactive?: boolean;
  /** 幽默感程度 0-10 */
  humor?: number;
  /** 自定义角色描述 */
  roleDescription?: string;
}

/**
 * 助手交互偏好
 */
export interface AssistantPreferences {
  /** 首选语言 */
  language?: string;
  /** 时区 */
  timezone?: string;
  /** 操作确认阈值: low / medium / high */
  confirmationLevel?: string;
  /** 自动执行任务的范围 */
  autoExecuteScopes?: string[];
}

/**
 * 助手模型配置
 */
export interface AssistantModelConfig {
  /** 首选模型 */
  modelId?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 token */
  maxTokens?: number;
  /** 自定义模型参数 */
  params?: Record<string, unknown>;
}

// ==================== user_assistant_configs 表 ====================

/**
 * 用户助手配置表
 *
 * 存储用户对 AI 助手的个性化设置
 */
export const userAssistantConfigs = pgTable(
  "user_assistant_configs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 助手名称 */
    name: text("name").notNull(),
    /** 是否为默认助手配置 */
    isDefault: boolean("is_default").default(false).notNull(),
    /** 性格设定 */
    personality: jsonb("personality").$type<AssistantPersonality>(),
    /** 交互偏好 */
    preferences: jsonb("preferences").$type<AssistantPreferences>(),
    /** AI 模型配置 */
    modelConfig: jsonb("model_config").$type<AssistantModelConfig>(),
    /** 设备级权限配置 */
    devicePermissions: jsonb("device_permissions").$type<Record<string, unknown>>(),
    /** 自定义系统提示 */
    systemPrompt: text("system_prompt"),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查配置
    index("user_assistant_configs_user_id_idx").on(table.userId),
    // 默认配置索引
    index("user_assistant_configs_default_idx").on(table.userId, table.isDefault),
  ],
);

// ==================== Relations ====================

/**
 * userAssistantConfigs 关系定义
 */
export const userAssistantConfigsRelations = relations(userAssistantConfigs, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userAssistantConfigs.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserAssistantConfigSchema = createInsertSchema(userAssistantConfigs);
export const selectUserAssistantConfigSchema = createSelectSchema(userAssistantConfigs);

// ==================== Type Exports ====================

export type UserAssistantConfig = typeof userAssistantConfigs.$inferSelect;
export type NewUserAssistantConfig = typeof userAssistantConfigs.$inferInsert;
