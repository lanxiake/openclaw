/**
 * 用户自建技能表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * user_custom_skills 存储用户自建/上传的技能。
 *
 * 小型技能（<100KB）直接存 code 字段；大型技能存 MinIO，packageFileId 指向 user_files。
 */

import { pgTable, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";
import { userFiles } from "./files.js";
import { skillStoreItems } from "./skill-store.js";

// ==================== 类型定义 ====================

/**
 * 技能清单（入口、权限、依赖等）
 */
export interface SkillManifest {
  /** 入口函数/文件 */
  entry?: string;
  /** 权限需求 */
  permissions?: string[];
  /** 运行时依赖 */
  dependencies?: Record<string, string>;
  /** 工具声明 */
  tools?: Record<string, unknown>[];
  /** 其他配置 */
  [key: string]: unknown;
}

// ==================== user_custom_skills 表 ====================

/**
 * 用户自建技能表
 *
 * 存储用户创建的技能，支持从草稿到发布的完整生命周期
 */
export const userCustomSkills = pgTable(
  "user_custom_skills",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 技能名称 */
    name: text("name").notNull(),
    /** 技能描述 */
    description: text("description"),
    /** 版本号 */
    version: text("version").default("1.0.0"),
    /** 技能代码（小型技能直接存 DB） */
    code: text("code"),
    /** 技能包文件 ID（大型技能） */
    packageFileId: text("package_file_id").references(() => userFiles.id),
    /** 技能清单（入口、权限、依赖等） */
    manifest: jsonb("manifest").$type<SkillManifest>().notNull(),
    /** 技能状态 */
    status: text("status", {
      enum: ["draft", "testing", "ready", "published", "disabled"],
    })
      .default("draft")
      .notNull(),
    /** 最近测试结果 */
    testResults: jsonb("test_results").$type<Record<string, unknown>>(),
    /** 已同步的设备 ID 列表 */
    syncedDevices: jsonb("synced_devices").$type<string[]>(),
    /** 是否已提交到技能商店 */
    isPublished: boolean("is_published").default(false).notNull(),
    /** 关联的商店条目 */
    storeItemId: text("store_item_id").references(() => skillStoreItems.id),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查技能
    index("user_custom_skills_user_id_idx").on(table.userId),
    // 按状态过滤
    index("user_custom_skills_status_idx").on(table.status),
    // 用户+名称唯一约束
    uniqueIndex("user_custom_skills_user_name_idx").on(table.userId, table.name),
  ],
);

// ==================== Relations ====================

/**
 * userCustomSkills 关系定义
 */
export const userCustomSkillsRelations = relations(userCustomSkills, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userCustomSkills.userId],
    references: [users.id],
  }),
  /** 技能包文件 */
  packageFile: one(userFiles, {
    fields: [userCustomSkills.packageFileId],
    references: [userFiles.id],
  }),
  /** 关联的商店条目 */
  storeItem: one(skillStoreItems, {
    fields: [userCustomSkills.storeItemId],
    references: [skillStoreItems.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserCustomSkillSchema = createInsertSchema(userCustomSkills);
export const selectUserCustomSkillSchema = createSelectSchema(userCustomSkills);

// ==================== Type Exports ====================

export type UserCustomSkill = typeof userCustomSkills.$inferSelect;
export type NewUserCustomSkill = typeof userCustomSkills.$inferInsert;
