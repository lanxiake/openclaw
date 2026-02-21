/**
 * Agent Todo 表 Schema
 *
 * 存储 Agent 运行期间的 TodoWrite 工具调用产生的任务列表。
 * 每次 TodoWrite 调用会生成一份完整的 todo 快照（snapshot），
 * Gateway 只保留每个 (sessionKey, runId) 的最新快照。
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
 * 单个 Todo 项
 */
export interface TodoItem {
  /** 待办内容（祈使语气） */
  content: string;
  /** 进行中显示文本（现在进行时） */
  activeForm?: string;
  /** 状态 */
  status: "pending" | "in_progress" | "completed";
}

// ==================== agent_todos 表 ====================

/**
 * Agent Todo 快照表
 *
 * 每条记录是一次 TodoWrite 工具调用的完整快照。
 * 同一 (sessionKey, runId) 只保留最新一条（upsert 策略）。
 */
export const agentTodos = pgTable(
  "agent_todos",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 所属用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 关联的 conversation ID（可选，首次可能尚未创建） */
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    /** Gateway sessionKey */
    sessionKey: text("session_key").notNull(),
    /** Agent run ID */
    runId: text("run_id").notNull(),
    /** Todo 项列表（完整快照） */
    items: jsonb("items").$type<TodoItem[]>().notNull(),
    /** 完成数量（冗余，加速查询） */
    completedCount: integer("completed_count").default(0).notNull(),
    /** 总数量（冗余，加速查询） */
    totalCount: integer("total_count").default(0).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间（每次 TodoWrite 调用更新） */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 按 sessionKey + runId 查找最新快照（核心查询）
    index("agent_todos_session_run_idx").on(table.sessionKey, table.runId),
    // 按用户查找 todo 列表
    index("agent_todos_user_id_idx").on(table.userId),
    // 按 conversation 查找
    index("agent_todos_conversation_id_idx").on(table.conversationId),
  ],
);

// ==================== Relations ====================

/**
 * agentTodos 关系定义
 */
export const agentTodosRelations = relations(agentTodos, ({ one }) => ({
  /** 所属用户 */
  user: one(users, {
    fields: [agentTodos.userId],
    references: [users.id],
  }),
  /** 关联的对话 */
  conversation: one(conversations, {
    fields: [agentTodos.conversationId],
    references: [conversations.id],
  }),
}));

// ==================== Zod Schemas ====================

export const insertAgentTodoSchema = createInsertSchema(agentTodos);
export const selectAgentTodoSchema = createSelectSchema(agentTodos);

// ==================== Type Exports ====================

export type AgentTodo = typeof agentTodos.$inferSelect;
export type NewAgentTodo = typeof agentTodos.$inferInsert;
