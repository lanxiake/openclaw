/**
 * 用户文件元数据表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * user_files 存储用户上传文件的元数据，实际文件存储在 MinIO 中。
 *
 * storageKey 初期只存路径字符串（Phase 5 MinIO 引入后才有实际文件存储）。
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ==================== user_files 表 ====================

/**
 * 用户文件元数据表
 *
 * 存储文件元信息（名称、大小、类型、存储位置等），
 * 实际文件存储在 MinIO 对象存储中。
 */
export const userFiles = pgTable(
  "user_files",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 原始文件名 */
    fileName: text("file_name").notNull(),
    /** 文件大小（字节） */
    fileSize: integer("file_size").notNull(),
    /** MIME 类型 */
    mimeType: text("mime_type").notNull(),
    /** MinIO 存储 key */
    storageKey: text("storage_key").notNull(),
    /** MinIO bucket 名 */
    storageBucket: text("storage_bucket").notNull(),
    /** 文件分类 */
    category: text("category", {
      enum: ["attachment", "avatar", "skill_package", "document"],
    }).default("attachment"),
    /** 来源类型 */
    sourceType: text("source_type", {
      enum: ["conversation", "upload", "skill"],
    }),
    /** 来源 ID */
    sourceId: text("source_id"),
    /** 缩略图存储 key */
    thumbnailKey: text("thumbnail_key"),
    /** 文件 SHA-256 哈希 */
    checksum: text("checksum"),
    /** 扩展元数据（图片尺寸、PDF 页数等） */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 是否公开可访问 */
    isPublic: boolean("is_public").default(false).notNull(),
    /** 过期时间（临时文件） */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** 上传时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查文件
    index("user_files_user_id_idx").on(table.userId),
    // storageKey 唯一索引
    uniqueIndex("user_files_storage_key_idx").on(table.storageKey),
    // 按分类过滤
    index("user_files_category_idx").on(table.category),
  ],
);

// ==================== Relations ====================

/**
 * userFiles 关系定义
 */
export const userFilesRelations = relations(userFiles, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userFiles.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserFileSchema = createInsertSchema(userFiles);
export const selectUserFileSchema = createSelectSchema(userFiles);

// ==================== Type Exports ====================

export type UserFile = typeof userFiles.$inferSelect;
export type NewUserFile = typeof userFiles.$inferInsert;
