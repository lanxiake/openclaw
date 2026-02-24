/**
 * LLM 调用日志类型定义
 */

/**
 * LLM 调用状态
 */
export type LlmCallStatus = 'success' | 'error' | 'timeout' | 'rate_limited' | 'auth_error'

/**
 * LLM 调用日志记录
 */
export interface LlmCallLog {
  id: string
  userId?: string
  userName?: string
  sessionId?: string
  runId?: string
  channel?: string
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalTokens?: number
  durationMs?: number
  status: LlmCallStatus
  errorMessage?: string
  inputContent?: string
  outputContent?: string
  creditsConsumed?: number
  metadata?: Record<string, unknown>
  calledAt: string
  createdAt: string
}

/**
 * LLM 日志查询参数
 */
export interface LlmLogQuery {
  userId?: string
  userName?: string
  provider?: string
  model?: string
  status?: LlmCallStatus
  channel?: string
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}

/**
 * LLM 日志列表响应
 */
export interface LlmLogListResponse {
  logs: LlmCallLog[]
  total: number
  hasMore: boolean
}

/**
 * LLM 调用统计
 */
export interface LlmLogStats {
  totalCalls: number
  successCalls: number
  errorCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  avgDurationMs: number
  byProvider: Record<string, number>
  byModel: Record<string, number>
}

/**
 * LLM 模型使用分布
 */
export interface LlmModelDistribution {
  byModel: Record<string, number>
  byProvider: Record<string, number>
  totalCalls: number
}

/**
 * LLM 性能指标
 */
export interface LlmPerformanceStats {
  totalCalls: number
  successCalls: number
  errorCalls: number
  errorRate: number
  avgDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
}
