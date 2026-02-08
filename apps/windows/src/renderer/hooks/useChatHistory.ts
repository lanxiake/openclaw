/**
 * useChatHistory Hook - 聊天历史管理 Hook
 *
 * 提供聊天记录的持久化存储、会话管理功能
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
 * 会话类型
 */
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

/**
 * 存储的会话列表
 */
interface StoredSessions {
  sessions: ChatSession[]
  activeSessionId: string | null
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
 * 聊天历史管理 Hook
 */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
   */
  const deleteSession = useCallback((sessionId: string) => {
    console.log('[useChatHistory] 删除会话:', sessionId)

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
  }, [activeSessionId])

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
   */
  const clearCurrentSession = useCallback(() => {
    if (!activeSessionId) return

    console.log('[useChatHistory] 清空当前会话消息')

    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'system',
      content: '对话已清空，开始新的对话。',
      timestamp: new Date(),
    }

    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              title: '新对话',
              messages: [welcomeMessage],
              updatedAt: new Date(),
            }
          : session
      )
    )
  }, [activeSessionId])

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

    // 导入导出
    exportSessions,
    importSessions,
  }
}
