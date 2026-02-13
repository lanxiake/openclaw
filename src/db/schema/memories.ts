/**
 * 用户记忆表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * user_memories 存储用户的各层级记忆数据：
 * - L2 情景记忆 (episodic): 对话摘要、交互事件
 * - L3 档案记忆 (profile/preference/fact): 用户画像、偏好、事实知识
 *
 * embedding 字段使用 pgvector 的 vector(1536) 类型，支持语义搜索。
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";

import { users } from "./users.js";

// ==================== pgvector 自定义类型 ====================

/**
 * pgvector vector 类型
 *
 * 用于存储向量嵌入，支持语义搜索
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // 解析 PostgreSQL 返回的向量格式 "[1,2,3]"
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});

// ==================== user_memories 表 ====================

/**
 * 用户记忆表
 *
 * 存储用户的多层级记忆数据，支持按类型、分类、重要性查询
 */
export const userMemories = pgTable(
  "user_memories",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 记忆类型 */
    type: text("type", {
      enum: ["episodic", "profile", "preference", "fact"],
    }).notNull(),
    /** 记忆分类（如 work, personal, skill） */
    category: text("category"),
    /** 记忆文本内容 */
    content: text("content").notNull(),
    /** 记忆摘要（用于展示） */
    summary: text("summary"),
    /** 向量嵌入（pgvector vector(1536)，用于语义搜索） */
    embedding: vector("embedding"),
    /** 重要性 1-10（影响检索权重） */
    importance: integer("importance").default(5).notNull(),
    /** 来源类型 */
    sourceType: text("source_type", {
      enum: ["conversation", "file", "manual", "system"],
    }),
    /** 来源 ID（conversationId / fileId） */
    sourceId: text("source_id"),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 过期时间（null = 永久） */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** 是否有效 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查记忆
    index("user_memories_user_id_idx").on(table.userId),
    // 按用户+类型过滤
    index("user_memories_user_type_idx").on(table.userId, table.type),
    // 按用户+分类过滤
    index("user_memories_user_category_idx").on(table.userId, table.category),
    // 按重要性排序
    index("user_memories_importance_idx").on(table.importance),
    // 向量索引（使用 HNSW 算法，余弦距离）
    // 注意：需要在 migration 中手动创建，因为 Drizzle 不直接支持 HNSW 索引
    // CREATE INDEX user_memories_embedding_idx ON user_memories USING hnsw (embedding vector_cosine_ops);
  ],
);

// ==================== Relations ====================

/**
 * userMemories 关系定义
 */
export const userMemoriesRelations = relations(userMemories, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [userMemories.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertUserMemorySchema = createInsertSchema(userMemories);
export const selectUserMemorySchema = createSelectSchema(userMemories);

// ==================== Type Exports ====================

export type UserMemory = typeof userMemories.$inferSelect;
export type NewUserMemory = typeof userMemories.$inferInsert;
