/**
 * 内存工作记忆提供者
 *
 * 使用内存存储会话数据，适用于开发和测试环境。
 * 进程重启后数据会丢失。
 *
 * @module memory/pluggable/providers/working
 */

import { randomUUID } from 'node:crypto'
import type {
  IWorkingMemoryProvider,
  HealthStatus,
  SessionOptions,
  Message,
  WorkingMemory,
  SessionInfo,
  ToolState,
  PendingConfirm,
} from '../../interfaces/index.js'
import { registerProvider } from '../factory.js'

/**
 * 内存工作记忆配置
 */
export interface MemoryWorkingConfig {
  /** 默认会话 TTL（毫秒），默认 30 分钟 */
  defaultTtl?: number
  /** 清理检查间隔（毫秒），默认 60 秒 */
  cleanupInterval?: number
}

/**
 * 内存工作记忆提供者
 *
 * 简单的内存实现，用于开发和测试
 */
export class MemoryWorkingMemoryProvider implements IWorkingMemoryProvider {
  readonly name = 'memory-working'
  readonly version = '1.0.0'

  private sessions = new Map<string, WorkingMemory>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private defaultTtl: number
  private cleanupInterval: number

  constructor(config: MemoryWorkingConfig = {}) {
    this.defaultTtl = config.defaultTtl ?? 30 * 60 * 1000
    this.cleanupInterval = config.cleanupInterval ?? 60 * 1000
  }

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    console.log(`[${this.name}] 初始化内存工作记忆提供者`)

    // 启动过期清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, this.cleanupInterval)

    console.log(`[${this.name}] 初始化完成 (TTL: ${this.defaultTtl}ms)`)
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.name}] 关闭提供者`)

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.sessions.clear()
    console.log(`[${this.name}] 已关闭`)
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      latency: 0,
      details: {
        sessionCount: this.sessions.size,
        provider: 'memory',
      },
    }
  }

  // ==================== 会话管理 ====================

  async createSession(userId: string, options?: SessionOptions): Promise<string> {
    const sessionId = randomUUID()
    const now = new Date()

    const session: WorkingMemory = {
      sessionId,
      userId,
      messages: [],
      contextWindow: options?.contextWindow ?? 8000,
      activeTools: [],
      pendingConfirms: [],
      variables: {},
      createdAt: now,
      lastActiveAt: now,
      ttl: options?.ttl ?? this.defaultTtl,
    }

    this.sessions.set(sessionId, session)
    console.log(`[${this.name}] 创建会话: ${sessionId} (用户: ${userId})`)

    return sessionId
  }

  async getSession(sessionId: string): Promise<WorkingMemory | null> {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return null
    }

    // 检查是否过期
    if (this.isSessionExpired(session)) {
      this.sessions.delete(sessionId)
      return null
    }

    return { ...session }
  }

  async updateSession(sessionId: string, updates: Partial<WorkingMemory>): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    Object.assign(session, updates, { lastActiveAt: new Date() })
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    console.log(`[${this.name}] 删除会话: ${sessionId}`)
  }

  async listSessions(userId: string): Promise<SessionInfo[]> {
    const result: SessionInfo[] = []

    for (const session of this.sessions.values()) {
      if (session.userId === userId && !this.isSessionExpired(session)) {
        result.push({
          sessionId: session.sessionId,
          userId: session.userId,
          messageCount: session.messages.length,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          ttl: session.ttl,
        })
      }
    }

    return result.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
  }

  // ==================== 消息管理 ====================

  async addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'createdAt'>
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const messageId = randomUUID()
    const fullMessage: Message = {
      ...message,
      id: messageId,
      createdAt: new Date(),
    }

    session.messages.push(fullMessage)
    session.lastActiveAt = new Date()

    return messageId
  }

  async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    if (limit && limit > 0) {
      return session.messages.slice(-limit)
    }

    return [...session.messages]
  }

  async getContextWindow(sessionId: string, maxTokens: number): Promise<Message[]> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    const result: Message[] = []
    let tokenCount = 0

    // 从后往前取消息
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const msg = session.messages[i]
      const msgTokens = this.estimateTokens(msg.content)

      if (tokenCount + msgTokens > maxTokens) {
        break
      }

      result.unshift(msg)
      tokenCount += msgTokens
    }

    return result
  }

  // ==================== 状态管理 ====================

  async setVariable(sessionId: string, key: string, value: unknown): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    session.variables[key] = value
    session.lastActiveAt = new Date()
  }

  async getVariable(sessionId: string, key: string): Promise<unknown> {
    const session = this.sessions.get(sessionId)
    return session?.variables[key]
  }

  async clearVariables(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.variables = {}
      session.lastActiveAt = new Date()
    }
  }

  // ==================== 工具状态 ====================

  async addToolState(sessionId: string, state: Omit<ToolState, 'startedAt'>): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    session.activeTools.push({
      ...state,
      startedAt: new Date(),
    })
    session.lastActiveAt = new Date()
  }

  async updateToolState(
    sessionId: string,
    callId: string,
    updates: Partial<ToolState>
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const tool = session.activeTools.find(t => t.callId === callId)
    if (tool) {
      Object.assign(tool, updates)
    }
    session.lastActiveAt = new Date()
  }

  async getToolStates(sessionId: string): Promise<ToolState[]> {
    const session = this.sessions.get(sessionId)
    return session?.activeTools ?? []
  }

  // ==================== 待确认操作 ====================

  async addPendingConfirm(
    sessionId: string,
    confirm: Omit<PendingConfirm, 'id' | 'createdAt'>
  ): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const confirmId = randomUUID()
    session.pendingConfirms.push({
      ...confirm,
      id: confirmId,
      createdAt: new Date(),
    })
    session.lastActiveAt = new Date()

    return confirmId
  }

  async resolvePendingConfirm(
    sessionId: string,
    confirmId: string,
    _confirmed: boolean
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const index = session.pendingConfirms.findIndex(c => c.id === confirmId)
    if (index !== -1) {
      session.pendingConfirms.splice(index, 1)
    }
    session.lastActiveAt = new Date()
  }

  async getPendingConfirms(sessionId: string): Promise<PendingConfirm[]> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    const now = new Date()
    return session.pendingConfirms.filter(c => c.expiresAt > now)
  }

  // ==================== 私有方法 ====================

  /**
   * 检查会话是否过期
   */
  private isSessionExpired(session: WorkingMemory): boolean {
    const now = Date.now()
    const expiresAt = session.lastActiveAt.getTime() + session.ttl
    return now > expiresAt
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    let cleaned = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`[${this.name}] 清理了 ${cleaned} 个过期会话`)
    }
  }

  /**
   * 估算 Token 数
   */
  private estimateTokens(text: string): number {
    // 简单估算：每 4 个字符约 1 个 token
    return Math.ceil(text.length / 4)
  }
}

// 注册提供者
registerProvider('working', 'memory', MemoryWorkingMemoryProvider)
