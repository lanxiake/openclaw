/**
 * 用户画像记忆表 Schema (Phase 1: L3 Archival Memory)
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * 包含 4 个专用表：
 * - user_profiles: 核心身份数据
 * - user_facts: 分类知识（含 confidence、sensitivity）
 * - user_preferences_v2: 交互偏好设置
 * - behavior_patterns: 学习到的用户习惯
 */

import { pgTable, text, timestamp, real, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ==================== user_profiles 表 ====================

/**
 * 用户画像核心表
 *
 * 存储用户的核心身份信息，每个用户只有一条记录
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    /** 显示名称 */
    displayName: text("display_name"),
    /** 昵称 */
    nickname: text("nickname"),
    /** 头像 URL */
    avatarUrl: text("avatar_url"),
    /** 简介 */
    bio: text("bio"),
    /** 语言偏好 */
    language: text("language").default("zh-CN"),
    /** 时区 */
    timezone: text("timezone").default("Asia/Shanghai"),
    /** 工作模式 (如 developer, designer, manager) */
    workRole: text("work_role"),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("user_profiles_user_id_idx").on(table.userId)],
);

// ==================== user_facts 表 ====================

/**
 * 用户事实表
 *
 * 存储用户的分类知识，支持置信度和敏感度标记
 */
export const userFacts = pgTable(
  "user_facts",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 事实类别 */
    category: text("category", {
      enum: ["personal", "work", "hobby", "skill", "relationship", "health", "finance", "other"],
    }).notNull(),
    /** 事实键（如 name, company, birthday） */
    key: text("key").notNull(),
    /** 事实值 */
    value: text("value").notNull(),
    /** 置信度 (0-1) */
    confidence: real("confidence").default(1.0).notNull(),
    /** 来源类型 */
    source: text("source", {
      enum: ["explicit", "inferred"],
    })
      .default("explicit")
      .notNull(),
    /** 提取来源会话 ID */
    extractedFrom: text("extracted_from"),
    /** 是否敏感信息 */
    sensitive: boolean("sensitive").default(false).notNull(),
    /** 有效期（null = 永久） */
    validUntil: timestamp("valid_until", { withTimezone: true }),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 是否有效 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_facts_user_id_idx").on(table.userId),
    index("user_facts_user_category_idx").on(table.userId, table.category),
    index("user_facts_user_key_idx").on(table.userId, table.key),
  ],
);

// ==================== user_preferences_v2 表 ====================

/**
 * 用户偏好设置表 (v2)
 *
 * 存储用户的交互偏好，每个用户只有一条记录
 */
export const userPreferencesV2 = pgTable(
  "user_preferences_v2",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    /** 语言偏好 */
    language: text("language").default("zh-CN").notNull(),
    /** 时区 */
    timezone: text("timezone").default("Asia/Shanghai").notNull(),
    /** 响应风格 */
    responseStyle: text("response_style", {
      enum: ["concise", "detailed", "casual", "formal"],
    })
      .default("detailed")
      .notNull(),
    /** 确认级别 */
    confirmLevel: text("confirm_level", {
      enum: ["low", "medium", "high"],
    })
      .default("medium")
      .notNull(),
    /** 喜欢的技能 (JSON 数组) */
    favoriteSkills: jsonb("favorite_skills").$type<string[]>().default([]),
    /** 禁用的技能 (JSON 数组) */
    disabledSkills: jsonb("disabled_skills").$type<string[]>().default([]),
    /** 思考级别 */
    thinkingLevel: text("thinking_level", {
      enum: ["low", "medium", "high"],
    })
      .default("medium")
      .notNull(),
    /** 详细程度 */
    verboseLevel: text("verbose_level", {
      enum: ["minimal", "normal", "verbose"],
    })
      .default("normal")
      .notNull(),
    /** 通知设置 (JSON 对象) */
    notifications: jsonb("notifications")
      .$type<{
        enabled: boolean;
        quietHours?: { start: string; end: string };
        channels: string[];
      }>()
      .default({ enabled: true, channels: [] }),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("user_preferences_v2_user_id_idx").on(table.userId)],
);

// ==================== behavior_patterns 表 ====================

/**
 * 行为模式表
 *
 * 存储从用户行为中学习到的模式
 */
export const behaviorPatterns = pgTable(
  "behavior_patterns",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 模式类型 */
    type: text("type", {
      enum: ["time_preference", "topic_interest", "work_style", "communication"],
    }).notNull(),
    /** 模式描述 */
    pattern: text("pattern").notNull(),
    /** 支撑证据 (JSON 数组) */
    evidence: jsonb("evidence").$type<string[]>().default([]),
    /** 置信度 (0-1) */
    confidence: real("confidence").default(0.5).notNull(),
    /** 用户是否确认 */
    confirmed: boolean("confirmed"),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 是否有效 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("behavior_patterns_user_id_idx").on(table.userId),
    index("behavior_patterns_user_type_idx").on(table.userId, table.type),
  ],
);

// ==================== 关系定义 ====================

/**
 * userProfiles 关系定义
 */
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

/**
 * userFacts 关系定义
 */
export const userFactsRelations = relations(userFacts, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userFacts.userId],
    references: [users.id],
  }),
}));

/**
 * userPreferencesV2 关系定义
 */
export const userPreferencesV2Relations = relations(userPreferencesV2, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userPreferencesV2.userId],
    references: [users.id],
  }),
}));

/**
 * behaviorPatterns 关系定义
 */
export const behaviorPatternsRelations = relations(behaviorPatterns, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [behaviorPatterns.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserProfileSchema = createInsertSchema(userProfiles);
export const selectUserProfileSchema = createSelectSchema(userProfiles);

export const insertUserFactSchema = createInsertSchema(userFacts);
export const selectUserFactSchema = createSelectSchema(userFacts);

export const insertUserPreferencesV2Schema = createInsertSchema(userPreferencesV2);
export const selectUserPreferencesV2Schema = createSelectSchema(userPreferencesV2);

export const insertBehaviorPatternSchema = createInsertSchema(behaviorPatterns);
export const selectBehaviorPatternSchema = createSelectSchema(behaviorPatterns);

// ==================== Type Exports ====================

/** 用户画像类型 */
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

/** 用户事实类型 */
export type UserFactRecord = typeof userFacts.$inferSelect;
export type NewUserFactRecord = typeof userFacts.$inferInsert;

/** 用户偏好类型 (v2) */
export type UserPreferencesV2Record = typeof userPreferencesV2.$inferSelect;
export type NewUserPreferencesV2Record = typeof userPreferencesV2.$inferInsert;

/** 行为模式类型 */
export type BehaviorPatternRecord = typeof behaviorPatterns.$inferSelect;
export type NewBehaviorPatternRecord = typeof behaviorPatterns.$inferInsert;

// ==================== 枚举类型导出 ====================

/** 事实类别枚举 */
export type FactCategoryEnum =
  | "personal"
  | "work"
  | "hobby"
  | "skill"
  | "relationship"
  | "health"
  | "finance"
  | "other";

/** 事实来源枚举 */
export type FactSourceEnum = "explicit" | "inferred";

/** 响应风格枚举 */
export type ResponseStyleEnum = "concise" | "detailed" | "casual" | "formal";

/** 确认级别枚举 */
export type ConfirmLevelEnum = "low" | "medium" | "high";

/** 思考级别枚举 */
export type ThinkingLevelEnum = "low" | "medium" | "high";

/** 详细程度枚举 */
export type VerboseLevelEnum = "minimal" | "normal" | "verbose";

/** 行为模式类型枚举 */
export type BehaviorPatternTypeEnum =
  | "time_preference"
  | "topic_interest"
  | "work_style"
  | "communication";
