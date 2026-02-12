/**
 * 对话与消息表 Schema
 *
 * 多租户核心数据表，所有数据通过 userId 进行租户隔离。
 * conversations 存储对话会话，messages 存储对话消息。
 */

import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ==================== 类型定义 ====================

/**
 * Agent 配置快照（存储在对话创建时的配置）
 */
export interface AgentConfig {
  /** 模型 ID */
  modelId?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** 其他配置 */
  [key: string]: unknown;
}

/**
 * 消息附件
 */
export interface MessageAttachment {
  /** 文件 ID */
  fileId: string;
  /** 文件名 */
  name: string;
  /** MIME 类型 */
  type: string;
  /** 文件 URL */
  url?: string;
}

// ==================== conversations 表 ====================

/**
 * 对话会话表
 *
 * 记录用户与 AI 的对话会话元信息
 */
export const conversations = pgTable(
  "conversations",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 对话标题（AI 自动生成或用户命名） */
    title: text("title"),
    /** 对话类型 */
    type: text("type", {
      enum: ["chat", "task", "agent"],
    }).notNull(),
    /** 对话状态 */
    status: text("status", {
      enum: ["active", "archived", "deleted"],
    })
      .default("active")
      .notNull(),
    /** 发起对话的设备 ID */
    deviceId: text("device_id"),
    /** 本次对话的 Agent 配置快照 */
    agentConfig: jsonb("agent_config").$type<AgentConfig>(),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 最后消息时间（冗余，加速排序） */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    /** 消息数（冗余，加速展示） */
    messageCount: integer("message_count").default(0).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查对话
    index("conversations_user_id_idx").on(table.userId),
    // 按用户+更新时间排序（最近对话列表）
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
    // 按状态过滤
    index("conversations_status_idx").on(table.status),
  ],
);

// ==================== messages 表 ====================

/**
 * 对话消息表
 *
 * 存储对话中的每条消息（用户消息、AI 回复、系统消息、工具调用）
 */
export const messages = pgTable(
  "messages",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属对话 ID */
    conversationId: text("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    /** 冗余 userId（加速查询，避免 JOIN） */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 消息角色 */
    role: text("role", {
      enum: ["user", "assistant", "system", "tool"],
    }).notNull(),
    /** 消息文本内容 */
    content: text("content"),
    /** 内容类型 */
    contentType: text("content_type", {
      enum: ["text", "markdown", "json", "image"],
    }).default("text"),
    /** AI 工具调用记录 */
    toolCalls: jsonb("tool_calls").$type<Record<string, unknown>[]>(),
    /** 工具执行结果 */
    toolResults: jsonb("tool_results").$type<Record<string, unknown>[]>(),
    /** 附件列表 */
    attachments: jsonb("attachments").$type<MessageAttachment[]>(),
    /** Token 消耗数 */
    tokenCount: integer("token_count"),
    /** 使用的 AI 模型 ID */
    modelId: text("model_id"),
    /** 扩展元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按对话+时间查消息（分页查询核心索引）
    index("messages_conversation_id_idx").on(table.conversationId, table.createdAt),
    // 按用户查消息
    index("messages_user_id_idx").on(table.userId),
    // 按创建时间排序
    index("messages_created_at_idx").on(table.createdAt),
  ],
);

// ==================== Relations ====================

/**
 * conversations 关系定义
 */
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  /** 对话中的消息 */
  messages: many(messages),
}));

/**
 * messages 关系定义
 */
export const messagesRelations = relations(messages, ({ one }) => ({
  /** 所属对话 */
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  /** 所属用户 */
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

// ==================== Type Exports ====================

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
