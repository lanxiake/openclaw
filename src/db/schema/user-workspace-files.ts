/**
 * 用户 Workspace 文件表 Schema
 *
 * 存储用户个性化的 workspace 文件副本（SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, HEARTBEAT.md）。
 * 默认模板存在 system_configs 表中（group=memory），用户首次访问时从模板初始化。
 * 所有数据通过 userId 进行租户隔离。
 */

import { pgTable, text, timestamp, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

/**
 * 允许的 workspace 文件名枚举
 */
export const WORKSPACE_FILE_NAMES = [
  "SOUL.md",
  "IDENTITY.md",
  "AGENTS.md",
  "TOOLS.md",
  "HEARTBEAT.md",
] as const;

export type WorkspaceFileName = (typeof WORKSPACE_FILE_NAMES)[number];

/**
 * 用户 Workspace 文件表
 *
 * 每个用户对每个文件名只有一条记录，通过 unique(userId, fileName) 约束保证。
 * isCustomized 标记用户是否自行修改过，未修改的记录可随默认模板更新。
 */
export const userWorkspaceFiles = pgTable(
  "user_workspace_files",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 文件名 (SOUL.md | IDENTITY.md | AGENTS.md | TOOLS.md | HEARTBEAT.md) */
    fileName: text("file_name").notNull(),
    /** 文件内容 (Markdown) */
    content: text("content").notNull(),
    /** 用户是否自行修改过，未修改的记录可随默认模板更新 */
    isCustomized: boolean("is_customized").default(false).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_workspace_files_user_id_idx").on(table.userId),
    index("user_workspace_files_user_file_idx").on(table.userId, table.fileName),
    unique("user_workspace_files_user_file_unique").on(table.userId, table.fileName),
  ],
);

// ==================== 关系定义 ====================

/**
 * userWorkspaceFiles 关系定义
 */
export const userWorkspaceFilesRelations = relations(userWorkspaceFiles, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userWorkspaceFiles.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserWorkspaceFileSchema = createInsertSchema(userWorkspaceFiles);
export const selectUserWorkspaceFileSchema = createSelectSchema(userWorkspaceFiles);

// ==================== Type Exports ====================

/** 用户 workspace 文件类型 */
export type UserWorkspaceFile = typeof userWorkspaceFiles.$inferSelect;
export type NewUserWorkspaceFile = typeof userWorkspaceFiles.$inferInsert;
