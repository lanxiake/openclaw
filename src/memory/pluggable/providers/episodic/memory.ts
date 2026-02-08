/**
 * 内存情节记忆提供者
 *
 * 使用内存存储实现情节记忆，适用于开发和测试环境。
 * 数据在进程重启后会丢失。
 *
 * @module memory/pluggable/providers/episodic
 */

import { randomUUID } from 'node:crypto'

import type { HealthStatus, ProviderConfig } from '../../interfaces/memory-provider.js'
import type { Message } from '../../interfaces/working-memory.js'
import type {
  ConversationSummary,
  EmotionalRecord,
  EmotionTrend,
  EpisodicQueryOptions,
  EpisodeSearchResult,
  EventQueryOptions,
  IEpisodicMemoryProvider,
  KeyEvent,
  TimelineEntry,
} from '../../interfaces/episodic-memory.js'
import { registerProvider } from '../factory.js'

/**
 * 用户情节数据存储结构
 */
interface UserEpisodicData {
  /** 对话历史 (sessionId -> messages) */
  conversations: Map<string, Message[]>
  /** 对话摘要 (sessionId -> summary) */
  summaries: Map<string, ConversationSummary>
  /** 关键事件 (eventId -> event) */
  events: Map<string, KeyEvent>
  /** 情绪记录 (sessionId -> record) */
  emotions: Map<string, EmotionalRecord>
}

/**
 * 内存情节记忆提供者
 *
 * 特性:
 * - 内存存储，重启后数据丢失
 * - 简化的摘要生成（基于关键词提取）
 * - 简单的文本搜索
 *
 * @example
 * ```typescript
 * const provider = new MemoryEpisodicMemoryProvider()
 * await provider.initialize()
 *
 * await provider.addConversation('user-1', 'session-1', messages)
 * const summary = await provider.summarizeConversation('user-1', 'session-1')
 *
 * await provider.shutdown()
 * ```
 */
export class MemoryEpisodicMemoryProvider implements IEpisodicMemoryProvider {
  readonly name = 'memory-episodic'
  readonly version = '1.0.0'

  /** 用户数据存储 (userId -> data) */
  private storage = new Map<string, UserEpisodicData>()

  /**
   * 创建内存情节记忆提供者
   *
   * @param _config - 配置（当前未使用）
   */
  constructor(_config?: ProviderConfig) {
    // 内存提供者不需要配置
  }

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    console.log('[memory-episodic] 初始化内存情节记忆提供者')
    this.storage.clear()
    console.log('[memory-episodic] 初始化完成')
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log('[memory-episodic] 关闭提供者')
    this.storage.clear()
    console.log('[memory-episodic] 已关闭')
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      latency: 0,
      details: {
        userCount: this.storage.size,
      },
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取或创建用户数据
   */
  private getUserData(userId: string): UserEpisodicData {
    let data = this.storage.get(userId)
    if (!data) {
      data = {
        conversations: new Map(),
        summaries: new Map(),
        events: new Map(),
        emotions: new Map(),
      }
      this.storage.set(userId, data)
    }
    return data
  }

  /**
   * 简单文本匹配搜索
   *
   * 使用简单的关键词匹配进行搜索
   */
  private textMatch(text: string, query: string): number {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 0)

    if (words.length === 0) return 0

    let matchCount = 0
    for (const word of words) {
      if (lowerText.includes(word)) {
        matchCount++
      }
    }

    return matchCount / words.length
  }

  /**
   * 提取关键词
   *
   * 简单的关键词提取，用于生成摘要
   */
  private extractKeywords(messages: Message[]): string[] {
    const allText = messages.map(m => m.content).join(' ')
    // 移除常见停用词，提取有意义的词
    const stopWords = new Set([
      '的', '是', '在', '了', '和', '与', '或', '有', '我', '你', '他',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that',
    ])

    const words = allText
      .toLowerCase()
      .split(/[\s,.!?;:'"()\[\]{}]+/)
      .filter(w => w.length > 2 && !stopWords.has(w))

    // 统计词频
    const wordFreq = new Map<string, number>()
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    // 返回频率最高的前 5 个词
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }

  /**
   * 估算 token 数量
   *
   * 简单估算：中文约 1.5 字/token，英文约 4 字符/token
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 1.5 + otherChars / 4)
  }

  // ==================== 对话历史 ====================

  /**
   * 添加对话到历史
   */
  async addConversation(userId: string, sessionId: string, messages: Message[]): Promise<void> {
    console.log(`[memory-episodic] 添加对话: ${sessionId} (用户: ${userId}, 消息数: ${messages.length})`)

    const data = this.getUserData(userId)

    // 存储对话
    data.conversations.set(sessionId, [...messages])
  }

  /**
   * 生成对话摘要
   *
   * 注意：这是一个简化版本，生产环境应该使用 AI 生成摘要
   */
  async summarizeConversation(userId: string, sessionId: string): Promise<ConversationSummary> {
    console.log(`[memory-episodic] 生成摘要: ${sessionId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const messages = data.conversations.get(sessionId)

    if (!messages || messages.length === 0) {
      throw new Error(`对话不存在: ${sessionId}`)
    }

    // 检查是否已有摘要
    const existing = data.summaries.get(sessionId)
    if (existing) {
      return existing
    }

    // 提取关键词作为话题
    const keyTopics = this.extractKeywords(messages)

    // 计算 token
    const allText = messages.map(m => m.content).join(' ')
    const tokenCount = this.estimateTokens(allText)

    // 生成简单摘要（取第一条和最后一条消息的前 100 字符）
    const firstMsg = messages[0].content.slice(0, 100)
    const lastMsg = messages[messages.length - 1].content.slice(0, 100)
    const summary = messages.length > 1
      ? `对话开始于"${firstMsg}..."，结束于"${lastMsg}..."`
      : `对话内容: ${firstMsg}...`

    const conversationSummary: ConversationSummary = {
      id: randomUUID(),
      sessionId,
      summary,
      keyTopics,
      decisions: [], // 简化版不提取决定
      messageCount: messages.length,
      tokenCount,
      timestamp: new Date(),
    }

    data.summaries.set(sessionId, conversationSummary)

    return conversationSummary
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(
    userId: string,
    options?: EpisodicQueryOptions
  ): Promise<ConversationSummary[]> {
    const data = this.getUserData(userId)
    let summaries = Array.from(data.summaries.values())

    // 时间过滤
    if (options?.startDate) {
      summaries = summaries.filter(s => s.timestamp >= options.startDate!)
    }
    if (options?.endDate) {
      summaries = summaries.filter(s => s.timestamp <= options.endDate!)
    }

    // 话题过滤
    if (options?.topics && options.topics.length > 0) {
      const topicSet = new Set(options.topics.map(t => t.toLowerCase()))
      summaries = summaries.filter(s =>
        s.keyTopics.some(t => topicSet.has(t.toLowerCase()))
      )
    }

    // 排序（最新在前）
    summaries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // 分页
    const offset = options?.offset || 0
    const limit = options?.limit || 10

    return summaries.slice(offset, offset + limit)
  }

  /**
   * 删除对话
   */
  async deleteConversation(userId: string, sessionId: string): Promise<void> {
    console.log(`[memory-episodic] 删除对话: ${sessionId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    data.conversations.delete(sessionId)
    data.summaries.delete(sessionId)
    data.emotions.delete(sessionId)
  }

  // ==================== 关键事件 ====================

  /**
   * 添加关键事件
   */
  async addKeyEvent(userId: string, event: Omit<KeyEvent, 'id'>): Promise<string> {
    const eventId = randomUUID()
    console.log(`[memory-episodic] 添加事件: ${eventId} (类型: ${event.type}, 用户: ${userId})`)

    const data = this.getUserData(userId)
    const fullEvent: KeyEvent = {
      ...event,
      id: eventId,
    }

    data.events.set(eventId, fullEvent)

    return eventId
  }

  /**
   * 获取关键事件
   */
  async getKeyEvents(userId: string, options?: EventQueryOptions): Promise<KeyEvent[]> {
    const data = this.getUserData(userId)
    let events = Array.from(data.events.values())

    // 类型过滤
    if (options?.types && options.types.length > 0) {
      const typeSet = new Set(options.types)
      events = events.filter(e => typeSet.has(e.type))
    }

    // 时间过滤
    if (options?.startDate) {
      events = events.filter(e => e.timestamp >= options.startDate!)
    }
    if (options?.endDate) {
      events = events.filter(e => e.timestamp <= options.endDate!)
    }

    // 重要性过滤
    if (options?.minImportance !== undefined) {
      events = events.filter(e => e.importance >= options.minImportance!)
    }

    // 排序（最新在前）
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // 分页
    const offset = options?.offset || 0
    const limit = options?.limit || 10

    return events.slice(offset, offset + limit)
  }

  /**
   * 更新关键事件
   */
  async updateKeyEvent(userId: string, eventId: string, updates: Partial<KeyEvent>): Promise<void> {
    console.log(`[memory-episodic] 更新事件: ${eventId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const event = data.events.get(eventId)

    if (!event) {
      throw new Error(`事件不存在: ${eventId}`)
    }

    // 更新字段（不允许更新 id）
    const updatedEvent: KeyEvent = {
      ...event,
      ...updates,
      id: eventId, // 确保 ID 不变
    }

    data.events.set(eventId, updatedEvent)
  }

  /**
   * 删除关键事件
   */
  async deleteKeyEvent(userId: string, eventId: string): Promise<void> {
    console.log(`[memory-episodic] 删除事件: ${eventId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    data.events.delete(eventId)
  }

  // ==================== 搜索 ====================

  /**
   * 搜索情节
   *
   * 在对话历史和事件中搜索相关内容
   */
  async searchEpisodes(
    userId: string,
    query: string,
    options?: { limit?: number; minScore?: number; startDate?: Date; endDate?: Date }
  ): Promise<EpisodeSearchResult[]> {
    console.log(`[memory-episodic] 搜索: "${query}" (用户: ${userId})`)

    const data = this.getUserData(userId)
    const results: EpisodeSearchResult[] = []
    const minScore = options?.minScore || 0.1

    // 搜索对话摘要
    for (const summary of data.summaries.values()) {
      // 时间过滤
      if (options?.startDate && summary.timestamp < options.startDate) continue
      if (options?.endDate && summary.timestamp > options.endDate) continue

      const score = this.textMatch(
        `${summary.summary} ${summary.keyTopics.join(' ')}`,
        query
      )

      if (score >= minScore) {
        results.push({
          id: summary.id,
          content: summary.summary,
          score,
          type: 'conversation',
          timestamp: summary.timestamp,
          sessionId: summary.sessionId,
        })
      }
    }

    // 搜索事件
    for (const event of data.events.values()) {
      // 时间过滤
      if (options?.startDate && event.timestamp < options.startDate) continue
      if (options?.endDate && event.timestamp > options.endDate) continue

      const score = this.textMatch(
        `${event.description} ${event.context}`,
        query
      )

      if (score >= minScore) {
        results.push({
          id: event.id,
          content: event.description,
          score,
          type: 'event',
          timestamp: event.timestamp,
          metadata: {
            eventType: event.type,
            importance: event.importance,
          },
        })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    // 限制返回数量
    const limit = options?.limit || 10
    return results.slice(0, limit)
  }

  /**
   * 获取时间线
   */
  async getTimeline(userId: string, startDate: Date, endDate: Date): Promise<TimelineEntry[]> {
    console.log(`[memory-episodic] 获取时间线: ${startDate.toISOString()} - ${endDate.toISOString()} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const entries: TimelineEntry[] = []

    // 添加对话摘要
    for (const summary of data.summaries.values()) {
      if (summary.timestamp >= startDate && summary.timestamp <= endDate) {
        entries.push({
          id: summary.id,
          type: 'conversation',
          title: summary.keyTopics.slice(0, 3).join(', ') || '对话',
          description: summary.summary,
          timestamp: summary.timestamp,
          importance: 0.5, // 普通对话重要性中等
          metadata: {
            sessionId: summary.sessionId,
            messageCount: summary.messageCount,
          },
        })
      }
    }

    // 添加事件
    for (const event of data.events.values()) {
      if (event.timestamp >= startDate && event.timestamp <= endDate) {
        entries.push({
          id: event.id,
          type: event.type === 'milestone' ? 'milestone' : 'event',
          title: event.type,
          description: event.description,
          timestamp: event.timestamp,
          importance: event.importance,
          metadata: {
            eventType: event.type,
            context: event.context,
          },
        })
      }
    }

    // 按时间排序（最新在前）
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return entries
  }

  // ==================== 情绪追踪 ====================

  /**
   * 记录情绪
   */
  async recordEmotion(
    userId: string,
    sessionId: string,
    emotion: Omit<EmotionalRecord, 'sessionId'>
  ): Promise<void> {
    console.log(`[memory-episodic] 记录情绪: ${sessionId} (用户: ${userId}, 情绪: ${emotion.sentiment})`)

    const data = this.getUserData(userId)
    const record: EmotionalRecord = {
      ...emotion,
      sessionId,
    }

    data.emotions.set(sessionId, record)
  }

  /**
   * 获取情绪趋势
   */
  async getEmotionTrend(userId: string, startDate: Date, endDate: Date): Promise<EmotionTrend> {
    console.log(`[memory-episodic] 获取情绪趋势: ${startDate.toISOString()} - ${endDate.toISOString()} (用户: ${userId})`)

    const data = this.getUserData(userId)

    // 筛选时间范围内的记录
    const records = Array.from(data.emotions.values())
      .filter(r => r.timestamp >= startDate && r.timestamp <= endDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    if (records.length === 0) {
      return {
        averageSentiment: 0,
        satisfactionTrend: [],
        frustrationTrend: [],
        timestamps: [],
      }
    }

    // 计算平均情绪
    const sentimentValues: number[] = records.map(r => {
      switch (r.sentiment) {
        case 'positive': return 1
        case 'neutral': return 0
        case 'negative': return -1
      }
    })
    const averageSentiment = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length

    return {
      averageSentiment,
      satisfactionTrend: records.map(r => r.satisfaction),
      frustrationTrend: records.map(r => r.frustration),
      timestamps: records.map(r => r.timestamp),
    }
  }
}

// 自动注册提供者
registerProvider('episodic', 'memory', MemoryEpisodicMemoryProvider as unknown as new (options: Record<string, unknown>) => MemoryEpisodicMemoryProvider)
