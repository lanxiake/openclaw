/**
 * 技能商店 Schema
 *
 * 包含技能分类、技能商店条目、技能评价等
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";
import { admins } from "./admins.js";

/**
 * 技能分类表
 */
export const skillCategories = pgTable(
  "skill_categories",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 分类名称 */
    name: text("name").notNull(),
    /** 分类描述 */
    description: text("description"),
    /** 分类图标 */
    icon: text("icon"),
    /** 排序权重 */
    sortOrder: integer("sort_order").default(0).notNull(),
    /** 技能数量 (缓存) */
    skillCount: integer("skill_count").default(0).notNull(),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skill_categories_sort_order_idx").on(table.sortOrder),
    index("skill_categories_is_active_idx").on(table.isActive),
  ],
);

/**
 * 技能商店条目表
 *
 * 用户上传的技能，等待审核后发布
 */
export const skillStoreItems = pgTable(
  "skill_store_items",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 技能名称 */
    name: text("name").notNull(),
    /** 技能描述 */
    description: text("description"),
    /** 详细说明 (Markdown) */
    readme: text("readme"),

    /** 作者用户 ID */
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    /** 作者名称 (缓存) */
    authorName: text("author_name"),

    /** 版本号 */
    version: text("version").notNull().default("1.0.0"),

    /** 分类 ID */
    categoryId: text("category_id").references(() => skillCategories.id, { onDelete: "set null" }),

    /** 标签列表 */
    tags: jsonb("tags").$type<string[]>(),

    /** 技能状态 */
    status: text("status", {
      enum: ["pending", "published", "unpublished", "rejected"],
    })
      .notNull()
      .default("pending"),

    /** 订阅级别要求 */
    subscriptionLevel: text("subscription_level", {
      enum: ["free", "pro", "team", "enterprise"],
    })
      .notNull()
      .default("free"),

    /** 下载次数 */
    downloadCount: integer("download_count").default(0).notNull(),

    /** 平均评分 */
    ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).default("0"),

    /** 评分数量 */
    ratingCount: integer("rating_count").default(0).notNull(),

    /** 图标 URL */
    iconUrl: text("icon_url"),

    /** 技能配置文件 URL */
    manifestUrl: text("manifest_url"),

    /** 技能包下载 URL */
    packageUrl: text("package_url"),

    /** 技能配置 (JSON) */
    config: jsonb("config").$type<Record<string, unknown>>(),

    /** 审核备注 */
    reviewNote: text("review_note"),

    /** 审核人 ID */
    reviewedBy: text("reviewed_by").references(() => admins.id, { onDelete: "set null" }),

    /** 审核时间 */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    /** 是否推荐 */
    isFeatured: boolean("is_featured").default(false).notNull(),

    /** 推荐排序 */
    featuredOrder: integer("featured_order"),

    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    /** 发布时间 */
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("skill_store_items_status_idx").on(table.status),
    index("skill_store_items_category_id_idx").on(table.categoryId),
    index("skill_store_items_author_id_idx").on(table.authorId),
    index("skill_store_items_is_featured_idx").on(table.isFeatured, table.featuredOrder),
    index("skill_store_items_subscription_level_idx").on(table.subscriptionLevel),
    index("skill_store_items_download_count_idx").on(table.downloadCount),
    index("skill_store_items_rating_avg_idx").on(table.ratingAvg),
    index("skill_store_items_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 技能评价表
 */
export const skillReviews = pgTable(
  "skill_reviews",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 技能 ID */
    skillId: text("skill_id")
      .references(() => skillStoreItems.id, { onDelete: "cascade" })
      .notNull(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 评分 (1-5) */
    rating: integer("rating").notNull(),
    /** 评价内容 */
    comment: text("comment"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 每个用户只能对一个技能评价一次
    uniqueIndex("skill_reviews_skill_user_unique_idx").on(table.skillId, table.userId),
    index("skill_reviews_skill_id_idx").on(table.skillId),
    index("skill_reviews_user_id_idx").on(table.userId),
    index("skill_reviews_rating_idx").on(table.rating),
  ],
);

/**
 * 用户安装的技能表
 */
export const userInstalledSkills = pgTable(
  "user_installed_skills",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 技能商店条目 ID */
    skillItemId: text("skill_item_id")
      .references(() => skillStoreItems.id, { onDelete: "cascade" })
      .notNull(),
    /** 安装的版本 */
    installedVersion: text("installed_version").notNull(),
    /** 是否启用 */
    isEnabled: boolean("is_enabled").default(true).notNull(),
    /** 安装时间 */
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
    /** 最后使用时间 */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    // 每个用户只能安装一个技能一次
    uniqueIndex("user_installed_skills_user_skill_unique_idx").on(table.userId, table.skillItemId),
    index("user_installed_skills_user_id_idx").on(table.userId),
    index("user_installed_skills_skill_item_id_idx").on(table.skillItemId),
  ],
);

/**
 * 关系定义
 */
export const skillCategoriesRelations = relations(skillCategories, ({ many }) => ({
  skills: many(skillStoreItems),
}));

export const skillStoreItemsRelations = relations(skillStoreItems, ({ one, many }) => ({
  author: one(users, {
    fields: [skillStoreItems.authorId],
    references: [users.id],
  }),
  category: one(skillCategories, {
    fields: [skillStoreItems.categoryId],
    references: [skillCategories.id],
  }),
  reviewer: one(admins, {
    fields: [skillStoreItems.reviewedBy],
    references: [admins.id],
  }),
  reviews: many(skillReviews),
  installedBy: many(userInstalledSkills),
}));

export const skillReviewsRelations = relations(skillReviews, ({ one }) => ({
  skill: one(skillStoreItems, {
    fields: [skillReviews.skillId],
    references: [skillStoreItems.id],
  }),
  user: one(users, {
    fields: [skillReviews.userId],
    references: [users.id],
  }),
}));

export const userInstalledSkillsRelations = relations(userInstalledSkills, ({ one }) => ({
  user: one(users, {
    fields: [userInstalledSkills.userId],
    references: [users.id],
  }),
  skillItem: one(skillStoreItems, {
    fields: [userInstalledSkills.skillItemId],
    references: [skillStoreItems.id],
  }),
}));

// Zod schemas
export const insertSkillCategorySchema = createInsertSchema(skillCategories);
export const selectSkillCategorySchema = createSelectSchema(skillCategories);
export const insertSkillStoreItemSchema = createInsertSchema(skillStoreItems);
export const selectSkillStoreItemSchema = createSelectSchema(skillStoreItems);
export const insertSkillReviewSchema = createInsertSchema(skillReviews);
export const selectSkillReviewSchema = createSelectSchema(skillReviews);
export const insertUserInstalledSkillSchema = createInsertSchema(userInstalledSkills);
export const selectUserInstalledSkillSchema = createSelectSchema(userInstalledSkills);

// 类型导出
export type SkillCategory = typeof skillCategories.$inferSelect;
export type NewSkillCategory = typeof skillCategories.$inferInsert;
export type SkillStoreItem = typeof skillStoreItems.$inferSelect;
export type NewSkillStoreItem = typeof skillStoreItems.$inferInsert;
export type SkillReview = typeof skillReviews.$inferSelect;
export type NewSkillReview = typeof skillReviews.$inferInsert;
export type UserInstalledSkill = typeof userInstalledSkills.$inferSelect;
export type NewUserInstalledSkill = typeof userInstalledSkills.$inferInsert;

/**
 * 技能状态类型
 */
export type SkillStatus = "pending" | "published" | "unpublished" | "rejected";

/**
 * 订阅级别类型
 */
export type SubscriptionLevel = "free" | "pro" | "team" | "enterprise";
