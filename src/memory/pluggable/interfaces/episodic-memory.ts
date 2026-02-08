/**
 * 情节记忆接口
 *
 * 情节记忆存储用户的长期对话历史，自动生成摘要、提取关键事件，
 * 构建用户交互时间线。
 *
 * @module memory/pluggable/interfaces
 */

import type { IMemoryProvider } from './memory-provider.js'
import type { Message } from './working-memory.js'

// ==================== 基础类型 ====================

/**
 * 对话摘要
 */
export interface ConversationSummary {
  /** 摘要 ID */
  id: string
  /** 来源会话 ID */
  sessionId: string
  /** AI 生成的摘要文本 */
  summary: string
  /** 主要话题列表 */
  keyTopics: string[]
  /** 做出的决定 */
  decisions: string[]
  /** 消息数量 */
  messageCount: number
  /** Token 数量 */
  tokenCount: number
  /** 时间戳 */
  timestamp: Date
}

/**
 * 关键事件类型
 */
export type KeyEventType =
  | 'task_completed'      // 任务完成
  | 'preference_changed'  // 偏好变更
  | 'important_info'      // 重要信息
  | 'milestone'           // 里程碑
  | 'decision'            // 决定
  | 'error'               // 错误
  | 'feedback'            // 反馈

/**
 * 关键事件
 */
export interface KeyEvent {
  /** 事件 ID */
  id: string
  /** 事件类型 */
  type: KeyEventType
  /** 事件描述 */
  description: string
  /** 相关上下文 */
  context: string
  /** 重要性分数 (0-1) */
  importance: number
  /** 相关会话 ID 列表 */
  relatedSessions: string[]
  /** 时间戳 */
  timestamp: Date
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 情绪记录
 */
export interface EmotionalRecord {
  /** 来源会话 ID */
  sessionId: string
  /** 情绪倾向 */
  sentiment: 'positive' | 'neutral' | 'negative'
  /** 满意度分数 (0-1) */
  satisfaction: number
  /** 挫败感分数 (0-1) */
  frustration: number
  /** 检测置信度 (0-1) */
  confidence: number
  /** 时间戳 */
  timestamp: Date
}

/**
 * 情绪趋势
 */
export interface EmotionTrend {
  /** 平均情绪值 */
  averageSentiment: number
  /** 满意度趋势 */
  satisfactionTrend: number[]
  /** 挫败感趋势 */
  frustrationTrend: number[]
  /** 时间点列表 */
  timestamps: Date[]
}

// ==================== 查询选项 ====================

/**
 * 情节查询选项
 */
export interface EpisodicQueryOptions {
  /** 开始日期 */
  startDate?: Date
  /** 结束日期 */
  endDate?: Date
  /** 话题过滤 */
  topics?: string[]
  /** 最大返回数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 事件查询选项
 */
export interface EventQueryOptions {
  /** 事件类型过滤 */
  types?: KeyEventType[]
  /** 开始日期 */
  startDate?: Date
  /** 结束日期 */
  endDate?: Date
  /** 最小重要性 */
  minImportance?: number
  /** 最大返回数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 搜索选项
 */
export interface EpisodicSearchOptions {
  /** 最大返回数量 */
  limit?: number
  /** 最小相关度分数 */
  minScore?: number
  /** 开始日期 */
  startDate?: Date
  /** 结束日期 */
  endDate?: Date
}

// ==================== 结果类型 ====================

/**
 * 情节搜索结果
 */
export interface EpisodeSearchResult {
  /** 结果 ID */
  id: string
  /** 内容 */
  content: string
  /** 相关度分数 */
  score: number
  /** 结果类型 */
  type: 'conversation' | 'event' | 'memory'
  /** 时间戳 */
  timestamp: Date
  /** 来源会话 ID */
  sessionId?: string
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 时间线条目
 */
export interface TimelineEntry {
  /** 条目 ID */
  id: string
  /** 条目类型 */
  type: 'conversation' | 'event' | 'milestone'
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** 时间戳 */
  timestamp: Date
  /** 重要性分数 */
  importance: number
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

// ==================== 提供者接口 ====================

/**
 * 情节记忆提供者接口
 *
 * 管理长期对话历史，支持摘要生成、事件提取、情绪追踪等。
 *
 * @example
 * ```typescript
 * const provider = new Mem0EpisodicMemoryProvider({ apiKey: '...' })
 * await provider.initialize()
 *
 * // 保存对话
 * await provider.addConversation('user-123', 'session-456', messages)
 *
 * // 搜索历史
 * const results = await provider.searchEpisodes('user-123', '上周讨论的项目')
 *
 * // 获取时间线
 * const timeline = await provider.getTimeline('user-123', lastWeek, today)
 *
 * await provider.shutdown()
 * ```
 */
export interface IEpisodicMemoryProvider extends IMemoryProvider {
  // ==================== 对话历史 ====================

  /**
   * 添加对话到历史
   *
   * 保存完整对话并触发摘要生成
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param messages - 对话消息列表
   */
  addConversation(userId: string, sessionId: string, messages: Message[]): Promise<void>

  /**
   * 生成对话摘要
   *
   * 使用 AI 生成对话摘要，提取关键话题和决定
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @returns 对话摘要
   */
  summarizeConversation(userId: string, sessionId: string): Promise<ConversationSummary>

  /**
   * 获取对话历史
   *
   * @param userId - 用户 ID
   * @param options - 查询选项
   * @returns 对话摘要列表
   */
  getConversationHistory(
    userId: string,
    options?: EpisodicQueryOptions
  ): Promise<ConversationSummary[]>

  /**
   * 删除对话
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   */
  deleteConversation(userId: string, sessionId: string): Promise<void>

  // ==================== 关键事件 ====================

  /**
   * 添加关键事件
   *
   * @param userId - 用户 ID
   * @param event - 事件信息（不含 id）
   * @returns 事件 ID
   */
  addKeyEvent(userId: string, event: Omit<KeyEvent, 'id'>): Promise<string>

  /**
   * 获取关键事件
   *
   * @param userId - 用户 ID
   * @param options - 查询选项
   * @returns 事件列表
   */
  getKeyEvents(userId: string, options?: EventQueryOptions): Promise<KeyEvent[]>

  /**
   * 更新关键事件
   *
   * @param userId - 用户 ID
   * @param eventId - 事件 ID
   * @param updates - 要更新的字段
   */
  updateKeyEvent(userId: string, eventId: string, updates: Partial<KeyEvent>): Promise<void>

  /**
   * 删除关键事件
   *
   * @param userId - 用户 ID
   * @param eventId - 事件 ID
   */
  deleteKeyEvent(userId: string, eventId: string): Promise<void>

  // ==================== 搜索 ====================

  /**
   * 搜索情节
   *
   * 在对话历史和事件中搜索相关内容
   *
   * @param userId - 用户 ID
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  searchEpisodes(
    userId: string,
    query: string,
    options?: EpisodicSearchOptions
  ): Promise<EpisodeSearchResult[]>

  /**
   * 获取时间线
   *
   * 获取指定时间范围内的所有重要事件和对话
   *
   * @param userId - 用户 ID
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 时间线条目列表
   */
  getTimeline(userId: string, startDate: Date, endDate: Date): Promise<TimelineEntry[]>

  // ==================== 情绪追踪 ====================

  /**
   * 记录情绪
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param emotion - 情绪记录（不含 sessionId）
   */
  recordEmotion(
    userId: string,
    sessionId: string,
    emotion: Omit<EmotionalRecord, 'sessionId'>
  ): Promise<void>

  /**
   * 获取情绪趋势
   *
   * @param userId - 用户 ID
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 情绪趋势数据
   */
  getEmotionTrend(userId: string, startDate: Date, endDate: Date): Promise<EmotionTrend>
}
