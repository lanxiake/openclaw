/**
 * useChatHistory Hook - 聊天历史管理 Hook
 *
 * 提供聊天记录的持久化存储、会话管理功能
 * 支持服务端同步：连接 Gateway 后从服务端加载会话列表和消息历史
 * 本地 localStorage 作为缓存和离线回退
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 消息附件类型
 */
export interface MessageAttachment {
  /** 文件类型 */
  type: 'file' | 'image'
  /** MIME 类型 */
  mimeType: string
  /** 文件名 */
  fileName: string
  /** Base64 内容 */
  content: string
  /** 预览 URL (用于图片) */
  preview?: string
}

/**
 * 消息类型
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
  attachments?: MessageAttachment[]
}

/**
 * 会话来源类型
 */
export type SessionSource = 'local' | 'server'

/**
 * 会话类型
 */
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  /** 会话来源: local (本地创建) / server (服务端同步) */
  source: SessionSource
  /** 服务端 session key (source=server 时存在) */
  serverKey?: string
  /** 服务端 session 类型 */
  serverKind?: 'direct' | 'group' | 'global' | 'unknown'
  /** 是否已从服务端加载消息历史 */
  messagesLoaded?: boolean
}

/**
 * 存储的会话列表
 */
interface StoredSessions {
  sessions: ChatSession[]
  activeSessionId: string | null
}

/**
 * 服务端会话行（来自 sessions.list 返回）
 */
interface ServerSessionRow {
  key: string
  kind: 'direct' | 'group' | 'global' | 'unknown'
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  updatedAt: number | null
  sessionId?: string
  totalTokens?: number
  label?: string
  model?: string
}

/**
 * 服务端消息（来自 chat.history 返回）
 */
interface ServerMessage {
  role?: string
  content?: unknown
  timestamp?: number
}

/**
 * 服务端 chat.history 响应
 */
interface ChatHistoryResponse {
  sessionKey: string
  sessionId?: string
  messages: ServerMessage[]
  thinkingLevel?: string
}

/**
 * 服务端 sessions.list 响应
 */
interface SessionsListResponse {
  ts: number
  count: number
  sessions: ServerSessionRow[]
}

/**
 * LocalStorage 键名
 */
const STORAGE_KEY = 'openclaw-chat-history'

/**
 * 最大会话数量
 */
const MAX_SESSIONS = 50

/**
 * 每个会话最大消息数量
 */
const MAX_MESSAGES_PER_SESSION = 200

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 从消息内容生成会话标题
 */
function generateSessionTitle(firstMessage: ChatMessage): string {
  const content = firstMessage.content.trim()
  if (content.length <= 30) {
    return content
  }
  return content.substring(0, 30) + '...'
}

/**
 * 解析存储的日期
 */
function parseStoredDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr
  return new Date(dateStr)
}

/**
 * 加载存储的会话
 */
function loadStoredSessions(): StoredSessions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { sessions: [], activeSessionId: null }
    }

    const parsed = JSON.parse(stored)

    // 转换日期字符串为 Date 对象
    const sessions = (parsed.sessions || []).map((session: ChatSession) => ({
      ...session,
      source: session.source || 'local',
      createdAt: parseStoredDate(session.createdAt),
      updatedAt: parseStoredDate(session.updatedAt),
      messages: session.messages.map((msg) => ({
        ...msg,
        timestamp: parseStoredDate(msg.timestamp),
      })),
    }))

    console.log('[useChatHistory] 加载了', sessions.length, '个会话')

    return {
      sessions,
      activeSessionId: parsed.activeSessionId || null,
    }
  } catch (err) {
    console.error('[useChatHistory] 加载会话失败:', err)
    return { sessions: [], activeSessionId: null }
  }
}

/**
 * 保存会话到存储
 */
function saveStoredSessions(data: StoredSessions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    console.log('[useChatHistory] 保存了', data.sessions.length, '个会话')
  } catch (err) {
    console.error('[useChatHistory] 保存会话失败:', err)
  }
}

/**
 * 从服务端消息中提取文本内容
 * 服务端消息的 content 可能是字符串、content block 数组等多种格式
 */
function extractTextFromServerMessage(msg: ServerMessage): string {
  const { content } = msg
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    // content block 数组: [{type: "text", text: "..."}, {type: "toolCall", ...}]
    return content
      .filter((block: Record<string, unknown>) => block.type === 'text' && typeof block.text === 'string')
      .map((block: Record<string, unknown>) => block.text as string)
      .join('')
  }
  return ''
}

/**
 * 将服务端消息转换为本地 ChatMessage 格式
 */
function convertServerMessage(msg: ServerMessage, index: number): ChatMessage | null {
  const role = msg.role
  // 只处理 user/assistant/system 三种角色
  if (role !== 'user' && role !== 'assistant' && role !== 'system') {
    return null
  }

  const text = extractTextFromServerMessage(msg)
  // 跳过空消息
  if (!text.trim()) {
    return null
  }

  return {
    id: `server-${index}-${Date.now()}`,
    role,
    content: text,
    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }
}

/**
 * 聊天历史管理 Hook
 *
 * 支持服务端同步：
 * - syncSessionsFromServer(): 从 Gateway 加载会话列表
 * - loadServerMessages(): 从 Gateway 加载指定会话的消息历史
 */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const saveTimeoutRef = useRef<number | null>(null)

  /**
   * 获取当前激活的会话
   */
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null

  /**
   * 初始化 - 加载存储的会话
   */
  useEffect(() => {
    console.log('[useChatHistory] 初始化')
    const data = loadStoredSessions()
    setSessions(data.sessions)
    setActiveSessionId(data.activeSessionId)
    setIsLoading(false)
  }, [])

  /**
   * 防抖保存
   */
  const debouncedSave = useCallback((sessionsToSave: ChatSession[], activeId: string | null) => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveStoredSessions({ sessions: sessionsToSave, activeSessionId: activeId })
    }, 500)
  }, [])

  /**
   * 会话或激活状态变化时保存
   */
  useEffect(() => {
    if (!isLoading) {
      debouncedSave(sessions, activeSessionId)
    }
  }, [sessions, activeSessionId, isLoading, debouncedSave])

  /**
   * 从服务端同步会话列表
   *
   * 调用 sessions.list RPC 获取 Gateway 上的会话
   * 合并到本地列表，服务端会话以 serverKey 去重
   */
  const syncSessionsFromServer = useCallback(async (): Promise<number> => {
    console.log('[useChatHistory] 开始从服务端同步会话列表')
    setIsSyncing(true)

    try {
      const response = await window.electronAPI.gateway.call<SessionsListResponse>(
        'sessions.list',
        {
          limit: 30,
          includeDerivedTitles: true,
          includeLastMessage: true,
        },
      )

      console.log('[useChatHistory] 服务端返回', response.count, '个会话')

      const serverSessions: ChatSession[] = response.sessions
        .filter((row) => row.sessionId)
        .map((row) => {
          const title = row.derivedTitle || row.displayName || row.label || row.key
          const updatedAt = row.updatedAt ? new Date(row.updatedAt) : new Date()

          // 如果有最后一条消息预览，构建一条占位消息
          const messages: ChatMessage[] = []
          if (row.lastMessagePreview) {
            messages.push({
              id: `preview-${row.key}`,
              role: 'assistant',
              content: row.lastMessagePreview,
              timestamp: updatedAt,
            })
          }

          return {
            id: `server-${row.key}`,
            title,
            messages,
            createdAt: updatedAt,
            updatedAt,
            source: 'server' as const,
            serverKey: row.key,
            serverKind: row.kind,
            messagesLoaded: false,
          }
        })

      setSessions((prev) => {
        // 现有的本地会话
        const localSessions = prev.filter((s) => s.source === 'local')

        // 已有的服务端会话 key 集合
        const existingServerKeys = new Set(
          prev.filter((s) => s.source === 'server').map((s) => s.serverKey),
        )

        // 合并：更新已有的服务端会话，添加新的
        const updatedServerSessions = serverSessions.map((newSession) => {
          // 找到已有的服务端会话（可能已加载消息）
          const existing = prev.find(
            (s) => s.source === 'server' && s.serverKey === newSession.serverKey,
          )
          if (existing) {
            // 保留已加载的消息，只更新元数据
            return {
              ...existing,
              title: newSession.title,
              updatedAt: newSession.updatedAt,
            }
          }
          return newSession
        })

        // 合并：本地在前，服务端按更新时间排序在后
        const merged = [
          ...localSessions,
          ...updatedServerSessions.slice().sort(
            (a: ChatSession, b: ChatSession) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          ),
        ].slice(0, MAX_SESSIONS)

        console.log(
          '[useChatHistory] 合并后:',
          localSessions.length,
          '个本地 +',
          updatedServerSessions.length,
          '个服务端',
        )

        return merged
      })

      setIsSyncing(false)
      return serverSessions.length
    } catch (err) {
      console.error('[useChatHistory] 同步会话列表失败:', err)
      setIsSyncing(false)
      return 0
    }
  }, [])

  /**
   * 从服务端加载指定会话的消息历史
   *
   * 调用 chat.history RPC 获取完整消息记录
   * 替换会话中的消息列表
   */
  const loadServerMessages = useCallback(async (sessionId: string): Promise<boolean> => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) {
      console.warn('[useChatHistory] 未找到会话:', sessionId)
      return false
    }

    // 只对服务端会话且未加载过的会话执行
    if (session.source !== 'server' || !session.serverKey) {
      console.log('[useChatHistory] 非服务端会话，跳过加载:', sessionId)
      return false
    }

    if (session.messagesLoaded) {
      console.log('[useChatHistory] 消息已加载过，跳过:', sessionId)
      return true
    }

    console.log('[useChatHistory] 从服务端加载消息:', session.serverKey)
    setIsLoadingMessages(true)

    try {
      const response = await window.electronAPI.gateway.call<ChatHistoryResponse>(
        'chat.history',
        {
          sessionKey: session.serverKey,
          limit: 200,
        },
      )

      console.log('[useChatHistory] 服务端返回', response.messages.length, '条原始消息')

      // 转换服务端消息格式
      const messages: ChatMessage[] = response.messages
        .map((msg, index) => convertServerMessage(msg, index))
        .filter((msg): msg is ChatMessage => msg !== null)

      console.log('[useChatHistory] 转换后', messages.length, '条有效消息')

      // 如果没有有效消息，添加一条系统消息
      if (messages.length === 0) {
        messages.push({
          id: generateId(),
          role: 'system',
          content: '此会话暂无消息记录。',
          timestamp: new Date(),
        })
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages, messagesLoaded: true, updatedAt: new Date() }
            : s,
        ),
      )

      setIsLoadingMessages(false)
      return true
    } catch (err) {
      console.error('[useChatHistory] 加载服务端消息失败:', err)
      setIsLoadingMessages(false)

      // 加载失败时添加错误提示
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  {
                    id: generateId(),
                    role: 'system' as const,
                    content: '加载服务端消息失败，请检查 Gateway 连接后重试。',
                    timestamp: new Date(),
                  },
                ],
                messagesLoaded: false,
              }
            : s,
        ),
      )
      return false
    }
  }, [sessions])

  /**
   * 创建新会话
   */
  const createSession = useCallback((initialMessage?: ChatMessage): ChatSession => {
    const now = new Date()
    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'system',
      content: '欢迎使用 OpenClaw Assistant！连接 Gateway 后即可开始对话。',
      timestamp: now,
    }

    const newSession: ChatSession = {
      id: generateId(),
      title: initialMessage ? generateSessionTitle(initialMessage) : '新对话',
      messages: initialMessage ? [welcomeMessage, initialMessage] : [welcomeMessage],
      createdAt: now,
      updatedAt: now,
      source: 'local',
    }

    console.log('[useChatHistory] 创建新会话:', newSession.id)

    setSessions((prev) => {
      // 限制最大会话数量，删除最旧的
      let updated = [newSession, ...prev]
      if (updated.length > MAX_SESSIONS) {
        updated = updated.slice(0, MAX_SESSIONS)
        console.log('[useChatHistory] 超过最大会话数量，已删除旧会话')
      }
      return updated
    })

    setActiveSessionId(newSession.id)
    return newSession
  }, [])

  /**
   * 切换会话
   */
  const switchSession = useCallback((sessionId: string) => {
    console.log('[useChatHistory] 切换到会话:', sessionId)
    setActiveSessionId(sessionId)
  }, [])

  /**
   * 删除会话
   * 对于服务端会话同时调用 sessions.delete 删除服务端数据
   */
  const deleteSession = useCallback((sessionId: string) => {
    console.log('[useChatHistory] 删除会话:', sessionId)

    // 查找并删除服务端会话
    const session = sessions.find((s) => s.id === sessionId)
    if (session?.source === 'server' && session.serverKey) {
      console.log('[useChatHistory] 同时删除服务端会话:', session.serverKey)
      window.electronAPI.gateway
        .call('sessions.delete', { key: session.serverKey })
        .catch((err) => console.error('[useChatHistory] 服务端删除失败:', err))
    }

    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
      return updated
    })

    // 如果删除的是当前会话，切换到第一个会话或清空
    if (activeSessionId === sessionId) {
      setSessions((prev) => {
        if (prev.length > 0) {
          setActiveSessionId(prev[0].id)
        } else {
          setActiveSessionId(null)
        }
        return prev
      })
    }
  }, [activeSessionId, sessions])

  /**
   * 重命名会话
   */
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    console.log('[useChatHistory] 重命名会话:', sessionId, '->', newTitle)

    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, title: newTitle, updatedAt: new Date() }
          : session
      )
    )
  }, [])

  /**
   * 添加消息到当前会话
   */
  const addMessage = useCallback((message: ChatMessage) => {
    console.log('[useChatHistory] 添加消息:', message.role)

    setSessions((prev) => {
      // 如果没有激活的会话，创建一个新的
      if (!activeSessionId) {
        const newSession = createSession(message)
        return [newSession, ...prev]
      }

      return prev.map((session) => {
        if (session.id !== activeSessionId) return session

        // 更新会话标题（如果是第一条用户消息）
        const userMessages = session.messages.filter((m) => m.role === 'user')
        const newTitle =
          userMessages.length === 0 && message.role === 'user'
            ? generateSessionTitle(message)
            : session.title

        // 限制每个会话的消息数量
        let newMessages = [...session.messages, message]
        if (newMessages.length > MAX_MESSAGES_PER_SESSION) {
          // 保留系统消息和最新的消息
          const systemMessages = newMessages.filter((m) => m.role === 'system').slice(0, 1)
          const otherMessages = newMessages.filter((m) => m.role !== 'system')
          newMessages = [...systemMessages, ...otherMessages.slice(-MAX_MESSAGES_PER_SESSION + 1)]
          console.log('[useChatHistory] 超过最大消息数量，已删除旧消息')
        }

        return {
          ...session,
          title: newTitle,
          messages: newMessages,
          updatedAt: new Date(),
        }
      })
    })
  }, [activeSessionId, createSession])

  /**
   * 更新消息内容
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session

        return {
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
          updatedAt: new Date(),
        }
      })
    )
  }, [activeSessionId])

  /**
   * 清空当前会话的消息
   * 对于服务端会话同时调用 sessions.reset 重置服务端数据
   */
  const clearCurrentSession = useCallback(() => {
    if (!activeSessionId) return

    console.log('[useChatHistory] 清空当前会话消息')

    // 如果是服务端会话，重置服务端数据
    const session = sessions.find((s) => s.id === activeSessionId)
    if (session?.source === 'server' && session.serverKey) {
      console.log('[useChatHistory] 同时重置服务端会话:', session.serverKey)
      window.electronAPI.gateway
        .call('sessions.reset', { key: session.serverKey })
        .catch((err) => console.error('[useChatHistory] 服务端重置失败:', err))
    }

    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'system',
      content: '对话已清空，开始新的对话。',
      timestamp: new Date(),
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: '新对话',
              messages: [welcomeMessage],
              messagesLoaded: false,
              updatedAt: new Date(),
            }
          : s
      )
    )
  }, [activeSessionId, sessions])

  /**
   * 清空所有会话
   */
  const clearAllSessions = useCallback(() => {
    console.log('[useChatHistory] 清空所有会话')
    setSessions([])
    setActiveSessionId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  /**
   * 导出会话
   */
  const exportSessions = useCallback((): string => {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions,
    }
    return JSON.stringify(data, null, 2)
  }, [sessions])

  /**
   * 导入会话
   */
  const importSessions = useCallback((jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData)
      if (!data.sessions || !Array.isArray(data.sessions)) {
        console.error('[useChatHistory] 无效的导入数据格式')
        return false
      }

      const importedSessions = data.sessions.map((session: ChatSession) => ({
        ...session,
        id: generateId(), // 生成新 ID 避免冲突
        source: session.source || 'local',
        createdAt: parseStoredDate(session.createdAt),
        updatedAt: parseStoredDate(session.updatedAt),
        messages: session.messages.map((msg) => ({
          ...msg,
          id: generateId(),
          timestamp: parseStoredDate(msg.timestamp),
        })),
      }))

      setSessions((prev) => {
        const combined = [...importedSessions, ...prev]
        return combined.slice(0, MAX_SESSIONS)
      })

      console.log('[useChatHistory] 成功导入', importedSessions.length, '个会话')
      return true
    } catch (err) {
      console.error('[useChatHistory] 导入会话失败:', err)
      return false
    }
  }, [])

  /**
   * 获取当前会话的消息
   */
  const currentMessages = activeSession?.messages || []

  return {
    // 状态
    sessions,
    activeSession,
    activeSessionId,
    currentMessages,
    isLoading,
    isSyncing,
    isLoadingMessages,

    // 会话操作
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    clearCurrentSession,
    clearAllSessions,

    // 消息操作
    addMessage,
    updateMessage,

    // 服务端同步
    syncSessionsFromServer,
    loadServerMessages,

    // 导入导出
    exportSessions,
    importSessions,
  }
}
