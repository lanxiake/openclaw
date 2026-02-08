/**
 * 工作记忆接口
 *
 * 工作记忆管理当前对话会话的临时上下文，类似人类的"短期记忆"。
 * 会话结束后自动清理，支持跨设备同步。
 *
 * @module memory/pluggable/interfaces
 */

import type { IMemoryProvider, HealthStatus } from './memory-provider.js'

// ==================== 基础类型 ====================

/**
 * 会话创建选项
 */
export interface SessionOptions {
  /** 上下文窗口大小（tokens） */
  contextWindow?: number
  /** 会话超时时间（毫秒），默认 30 分钟 */
  ttl?: number
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/**
 * 工具调用
 */
export interface ToolCall {
  /** 调用 ID */
  id: string
  /** 工具名称 */
  name: string
  /** 调用参数 */
  arguments: Record<string, unknown>
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 对应的调用 ID */
  callId: string
  /** 执行输出 */
  output: unknown
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * 消息
 */
export interface Message {
  /** 消息 ID */
  id: string
  /** 发送者角色 */
  role: MessageRole
  /** 消息内容 */
  content: string
  /** 工具调用列表（assistant 消息可能包含） */
  toolCalls?: ToolCall[]
  /** 工具执行结果（tool 消息包含） */
  toolResult?: ToolResult
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt: Date
}

/**
 * 工具执行状态
 */
export interface ToolState {
  /** 调用 ID */
  callId: string
  /** 工具名称 */
  name: string
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 开始时间 */
  startedAt: Date
  /** 完成时间 */
  completedAt?: Date
  /** 执行结果 */
  result?: unknown
  /** 错误信息 */
  error?: string
}

/**
 * 待确认操作
 *
 * 敏感操作需要用户确认后才能执行
 */
export interface PendingConfirm {
  /** 确认 ID */
  id: string
  /** 操作描述 */
  operation: string
  /** 操作类型 */
  type: 'destructive' | 'sensitive' | 'cost'
  /** 操作详情 */
  details: Record<string, unknown>
  /** 过期时间 */
  expiresAt: Date
  /** 创建时间 */
  createdAt: Date
}

/**
 * 工作记忆
 *
 * 表示一个完整的会话状态
 */
export interface WorkingMemory {
  /** 会话 ID */
  sessionId: string
  /** 用户 ID */
  userId: string
  /** 对话消息列表 */
  messages: Message[]
  /** 上下文窗口大小（tokens） */
  contextWindow: number
  /** 正在执行的工具状态 */
  activeTools: ToolState[]
  /** 待确认操作队列 */
  pendingConfirms: PendingConfirm[]
  /** 临时变量存储 */
  variables: Record<string, unknown>
  /** 创建时间 */
  createdAt: Date
  /** 最后活动时间 */
  lastActiveAt: Date
  /** 超时时间（毫秒） */
  ttl: number
}

/**
 * 会话信息摘要
 *
 * 用于列表展示
 */
export interface SessionInfo {
  /** 会话 ID */
  sessionId: string
  /** 用户 ID */
  userId: string
  /** 消息数量 */
  messageCount: number
  /** 创建时间 */
  createdAt: Date
  /** 最后活动时间 */
  lastActiveAt: Date
  /** 超时时间（毫秒） */
  ttl: number
}

// ==================== 提供者接口 ====================

/**
 * 工作记忆提供者接口
 *
 * 管理短期对话会话，支持消息追加、变量存储、工具状态追踪等。
 *
 * @example
 * ```typescript
 * const provider = new Mem0WorkingMemoryProvider({ apiKey: '...' })
 * await provider.initialize()
 *
 * const sessionId = await provider.createSession('user-123')
 * await provider.addMessage(sessionId, { role: 'user', content: 'Hello' })
 * const messages = await provider.getContextWindow(sessionId, 4000)
 *
 * await provider.shutdown()
 * ```
 */
export interface IWorkingMemoryProvider extends IMemoryProvider {
  // ==================== 会话管理 ====================

  /**
   * 创建新会话
   *
   * @param userId - 用户 ID
   * @param options - 会话选项
   * @returns 新会话 ID
   */
  createSession(userId: string, options?: SessionOptions): Promise<string>

  /**
   * 获取会话
   *
   * @param sessionId - 会话 ID
   * @returns 会话对象，不存在或已过期返回 null
   */
  getSession(sessionId: string): Promise<WorkingMemory | null>

  /**
   * 更新会话
   *
   * @param sessionId - 会话 ID
   * @param updates - 要更新的字段
   */
  updateSession(sessionId: string, updates: Partial<WorkingMemory>): Promise<void>

  /**
   * 删除会话
   *
   * @param sessionId - 会话 ID
   */
  deleteSession(sessionId: string): Promise<void>

  /**
   * 列出用户的所有会话
   *
   * @param userId - 用户 ID
   * @returns 会话信息列表，按最后活动时间降序排列
   */
  listSessions(userId: string): Promise<SessionInfo[]>

  // ==================== 消息管理 ====================

  /**
   * 添加消息到会话
   *
   * @param sessionId - 会话 ID
   * @param message - 消息内容（不含 id 和 createdAt）
   * @returns 新消息 ID
   */
  addMessage(sessionId: string, message: Omit<Message, 'id' | 'createdAt'>): Promise<string>

  /**
   * 获取会话消息
   *
   * @param sessionId - 会话 ID
   * @param limit - 最大返回数量（从最新开始）
   * @returns 消息列表
   */
  getMessages(sessionId: string, limit?: number): Promise<Message[]>

  /**
   * 获取上下文窗口
   *
   * 从最新消息开始，返回不超过 maxTokens 的消息列表
   *
   * @param sessionId - 会话 ID
   * @param maxTokens - 最大 token 数
   * @returns 消息列表
   */
  getContextWindow(sessionId: string, maxTokens: number): Promise<Message[]>

  // ==================== 状态管理 ====================

  /**
   * 设置临时变量
   *
   * @param sessionId - 会话 ID
   * @param key - 变量名
   * @param value - 变量值
   */
  setVariable(sessionId: string, key: string, value: unknown): Promise<void>

  /**
   * 获取临时变量
   *
   * @param sessionId - 会话 ID
   * @param key - 变量名
   * @returns 变量值，不存在返回 undefined
   */
  getVariable(sessionId: string, key: string): Promise<unknown>

  /**
   * 清除所有临时变量
   *
   * @param sessionId - 会话 ID
   */
  clearVariables(sessionId: string): Promise<void>

  // ==================== 工具状态 ====================

  /**
   * 添加工具执行状态
   *
   * @param sessionId - 会话 ID
   * @param state - 工具状态（不含 startedAt）
   */
  addToolState(sessionId: string, state: Omit<ToolState, 'startedAt'>): Promise<void>

  /**
   * 更新工具执行状态
   *
   * @param sessionId - 会话 ID
   * @param callId - 调用 ID
   * @param updates - 要更新的字段
   */
  updateToolState(sessionId: string, callId: string, updates: Partial<ToolState>): Promise<void>

  /**
   * 获取所有工具状态
   *
   * @param sessionId - 会话 ID
   * @returns 工具状态列表
   */
  getToolStates(sessionId: string): Promise<ToolState[]>

  // ==================== 待确认操作 ====================

  /**
   * 添加待确认操作
   *
   * @param sessionId - 会话 ID
   * @param confirm - 确认信息（不含 id 和 createdAt）
   * @returns 确认 ID
   */
  addPendingConfirm(
    sessionId: string,
    confirm: Omit<PendingConfirm, 'id' | 'createdAt'>
  ): Promise<string>

  /**
   * 解决待确认操作
   *
   * @param sessionId - 会话 ID
   * @param confirmId - 确认 ID
   * @param confirmed - 是否确认执行
   */
  resolvePendingConfirm(sessionId: string, confirmId: string, confirmed: boolean): Promise<void>

  /**
   * 获取待确认操作列表
   *
   * @param sessionId - 会话 ID
   * @returns 未过期的待确认操作列表
   */
  getPendingConfirms(sessionId: string): Promise<PendingConfirm[]>
}
