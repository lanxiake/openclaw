/**
 * Agent Checkpoint 表 Schema
 *
 * 存储 Agent 运行中断时的断点快照，支持从断点恢复执行。
 * 当用户中断 Agent 运行（abort/timeout/error）时，
 * Gateway 自动保存当前执行状态到断点表，后续可通过
 * chat.resume RPC 从断点恢复。
 *
 * 多租户隔离通过 userId 字段 + TenantScopedRepository 保证。
 */

import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";
import { conversations } from "./conversations.js";

// ==================== 类型定义 ====================

/**
 * 中断原因枚举
 */
export type AbortReason = "user_interrupt" | "timeout" | "error";

/**
 * Agent 状态快照
 *
 * 保存 Agent 运行时的关键状态信息，用于恢复。
 */
export interface AgentStateSnapshot {
  /** Agent session ID */
  sessionId: string;
  /** Session 文件路径（可选，用于 JSONL 场景） */
  sessionFile?: string;
  /** 最后处理的消息索引 */
  lastMessageIndex: number;
}

/**
 * 对话快照
 *
 * 保存中断时的对话上下文，用于恢复时还原显示。
 */
export interface ConversationSnapshot {
  /** 最后一条 assistant 消息的部分文本（中断时可能不完整） */
  lastAssistantPartialText: string;
  /** Todo 列表快照 */
  todoSnapshot: Array<{ content: string; status: string }>;
}

/**
 * 断点元数据
 */
export interface CheckpointMetadata {
  /** 使用的模型 ID */
  model?: string;
  /** 累计 Token 使用量 */
  totalTokensUsed?: number;
  /** 中断时的错误信息 */
  errorMessage?: string;
}

// ==================== agent_checkpoints 表 ====================

/**
 * Agent 断点表
 *
 * 每条记录是一次 Agent 运行中断的完整快照。
 * 用于支持"存档并停止"和"从断点恢复"功能。
 */
export const agentCheckpoints = pgTable(
  "agent_checkpoints",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 关联的 conversation ID */
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    /** Gateway sessionKey */
    sessionKey: text("session_key").notNull(),
    /** 被中断的 Agent run ID */
    runId: text("run_id").notNull(),
    /** 中断原因 */
    abortReason: text("abort_reason", {
      enum: ["user_interrupt", "timeout", "error"],
    }).notNull(),
    /** Agent 状态快照（用于恢复） */
    agentState: jsonb("agent_state").$type<AgentStateSnapshot>(),
    /** 对话上下文快照 */
    conversationSnapshot: jsonb("conversation_snapshot").$type<ConversationSnapshot>(),
    /** 元数据 */
    metadata: jsonb("metadata").$type<CheckpointMetadata>(),
    /** 是否已恢复过（恢复后标记，防止重复恢复） */
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按用户查找断点
    index("agent_checkpoints_user_id_idx").on(table.userId),
    // 按 conversation 查找断点
    index("agent_checkpoints_conversation_id_idx").on(table.conversationId),
    // 按 sessionKey 查找断点（核心查询）
    index("agent_checkpoints_session_key_idx").on(table.sessionKey),
  ],
);

// ==================== Relations ====================

/**
 * agentCheckpoints 关系定义
 */
export const agentCheckpointsRelations = relations(agentCheckpoints, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [agentCheckpoints.userId],
    references: [users.id],
  }),
  /** 关联的对话 */
  conversation: one(conversations, {
    fields: [agentCheckpoints.conversationId],
    references: [conversations.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertAgentCheckpointSchema = createInsertSchema(agentCheckpoints);
export const selectAgentCheckpointSchema = createSelectSchema(agentCheckpoints);

// ==================== Type Exports ====================

export type AgentCheckpoint = typeof agentCheckpoints.$inferSelect;
export type NewAgentCheckpoint = typeof agentCheckpoints.$inferInsert;
