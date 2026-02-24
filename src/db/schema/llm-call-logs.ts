/**
 * LLM 调用日志表 Schema
 *
 * 记录每次 LLM API 调用的详细信息：
 * - 调用上下文（userId, sessionId, runId, channel）
 * - 模型信息（provider, model）
 * - Token 使用（input, output, cacheRead, cacheWrite, total）
 * - 性能与结果（durationMs, status, errorMessage）
 * - 扩展元数据（authProfileId, contextTokens, thinkLevel 等）
 *
 * 建议保留 30 天，定期清理。
 */

import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ==================== 类型定义 ====================

/**
 * LLM 调用状态枚举
 */
export type LlmCallStatus = "success" | "error" | "timeout" | "rate_limited" | "auth_error";

/**
 * LLM 调用扩展元数据
 */
export interface LlmCallMetadata {
  /** 使用的 auth profile ID */
  authProfileId?: string;
  /** 上下文窗口大小 (tokens) */
  contextTokens?: number;
  /** Thinking level 设置 */
  thinkLevel?: string;
  /** 是否被中断 */
  aborted?: boolean;
  /** 失败转移原因 */
  failoverReason?: string;
  /** 额外扩展字段 */
  [key: string]: unknown;
}

// ==================== 表定义 ====================

/**
 * LLM 调用日志表
 *
 * 记录每次 LLM API 调用的完整信息，支持按用户、模型、时间等维度查询和聚合。
 */
export const llmCallLogs = pgTable(
  "llm_call_logs",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    // ---- 调用上下文 ----

    /** 用户 ID（可为空，系统调用无 userId） */
    userId: text("user_id"),

    /** Agent session ID */
    sessionId: text("session_id"),

    /** 单次 run ID */
    runId: text("run_id"),

    /** 消息来源频道 (telegram/discord/web/slack 等) */
    channel: text("channel"),

    // ---- 模型信息 ----

    /** 模型提供商 (anthropic/openai/google 等) */
    provider: text("provider").notNull(),

    /** 模型标识 (claude-3-opus/gpt-4o 等) */
    model: text("model").notNull(),

    // ---- Token 使用量 ----

    /** 输入 Token 数 */
    inputTokens: integer("input_tokens"),

    /** 输出 Token 数 */
    outputTokens: integer("output_tokens"),

    /** 缓存读取 Token 数 */
    cacheReadTokens: integer("cache_read_tokens"),

    /** 缓存写入 Token 数 */
    cacheWriteTokens: integer("cache_write_tokens"),

    /** 总 Token 数 */
    totalTokens: integer("total_tokens"),

    // ---- 性能与结果 ----

    /** 调用耗时 (毫秒) */
    durationMs: integer("duration_ms"),

    /** 调用状态 */
    status: text("status", {
      enum: ["success", "error", "timeout", "rate_limited", "auth_error"],
    }).notNull(),

    /** 错误信息 (仅失败时) */
    errorMessage: text("error_message"),

    // ---- 输入输出内容 ----

    /** 输入内容摘要（用户消息/system prompt 摘要，截断到 4KB） */
    inputContent: text("input_content"),

    /** 输出内容摘要（assistant 回复摘要，截断到 4KB） */
    outputContent: text("output_content"),

    /** 本次调用消耗积分 */
    creditsConsumed: integer("credits_consumed"),

    // ---- 扩展信息 ----

    /** 结构化扩展元数据 */
    metadata: jsonb("metadata").$type<LlmCallMetadata>(),

    // ---- 时间戳 ----

    /** 调用发起时间 */
    calledAt: timestamp("called_at", { withTimezone: true }).notNull(),

    /** 记录创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /** 按用户和调用时间查询（用户维度的调用历史） */
    index("llm_call_logs_user_called_at_idx").on(table.userId, table.calledAt),
    /** 按 provider+model 查询（模型使用分布） */
    index("llm_call_logs_provider_model_idx").on(table.provider, table.model),
    /** 按状态和调用时间查询（错误率分析） */
    index("llm_call_logs_status_idx").on(table.status, table.calledAt),
    /** 按调用时间查询（时间线浏览和清理） */
    index("llm_call_logs_called_at_idx").on(table.calledAt),
    /** 按 session ID 查询（会话维度的调用追踪） */
    index("llm_call_logs_session_id_idx").on(table.sessionId),
  ],
);

// ==================== Zod Schemas ====================

export const insertLlmCallLogSchema = createInsertSchema(llmCallLogs);
export const selectLlmCallLogSchema = createSelectSchema(llmCallLogs);

// ==================== TypeScript 类型 ====================

export type LlmCallLog = typeof llmCallLogs.$inferSelect;
export type NewLlmCallLog = typeof llmCallLogs.$inferInsert;
