/**
 * useMessageQueue Hook - 消息排队机制（按会话隔离）
 *
 * 当 agent 正在执行时，用户发送的消息进入队列而非直接发送
 * 当前 run 完成后，自动发送队列中的下一条消息
 *
 * 功能：
 * - 排队/出队/自动派发
 * - 持久化到 localStorage（按 sessionId 隔离）
 * - 最大队列容量 10 条
 * - 支持删除单条队列消息
 * - 切换会话时自动加载对应会话的队列
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MessageAttachment } from './useChatHistory'

/**
 * 最大队列容量
 */
const MAX_QUEUE_SIZE = 10

/**
 * localStorage key 前缀
 */
const STORAGE_KEY_PREFIX = 'mtbot_message_queue_'

/**
 * 队列消息项
 */
export interface QueuedMessage {
  /** 唯一标识 */
  id: string
  /** 消息文本内容 */
  content: string
  /** 附件列表 */
  attachments: MessageAttachment[]
  /** 入队时间 */
  queuedAt: number
}

/**
 * Hook 返回值
 */
export interface UseMessageQueueReturn {
  /** 当前队列 */
  queue: QueuedMessage[]
  /** 队列长度 */
  queueLength: number
  /** 是否达到最大容量 */
  isFull: boolean
  /** 添加消息到队列 */
  enqueue: (content: string, attachments: MessageAttachment[]) => void
  /** 取出队列头部消息 */
  dequeue: () => QueuedMessage | undefined
  /** 查看队列头部消息（不移除） */
  peek: () => QueuedMessage | undefined
  /** 移除指定消息 */
  remove: (id: string) => void
  /** 清空队列 */
  clear: () => void
}

/**
 * 生成会话级 localStorage key
 */
function getStorageKey(sessionId: string | null): string {
  if (!sessionId) return `${STORAGE_KEY_PREFIX}_default`
  return `${STORAGE_KEY_PREFIX}${sessionId}`
}

/**
 * 从 localStorage 加载指定会话的队列
 */
function loadQueue(sessionId: string | null): QueuedMessage[] {
  try {
    const key = getStorageKey(sessionId)
    const stored = localStorage.getItem(key)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (error) {
    console.error('[useMessageQueue] 加载队列失败:', error)
    return []
  }
}

/**
 * 保存队列到 localStorage（按会话隔离）
 */
function saveQueue(sessionId: string | null, queue: QueuedMessage[]): void {
  try {
    const key = getStorageKey(sessionId)
    if (queue.length === 0) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(queue))
    }
  } catch (error) {
    console.error('[useMessageQueue] 保存队列失败:', error)
  }
}

/**
 * 消息排队机制 Hook
 *
 * @param sessionId 当前活跃会话 ID，切换会话时自动加载对应队列
 */
export function useMessageQueue(sessionId: string | null): UseMessageQueueReturn {
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue(sessionId))
  const queueRef = useRef<QueuedMessage[]>(queue)
  const sessionIdRef = useRef<string | null>(sessionId)

  /** 同步 ref */
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  /** 会话切换时加载对应队列 */
  useEffect(() => {
    if (sessionIdRef.current !== sessionId) {
      console.log('[useMessageQueue] 会话切换，加载队列:', sessionId)
      sessionIdRef.current = sessionId
      const loaded = loadQueue(sessionId)
      setQueue(loaded)
      queueRef.current = loaded
    }
  }, [sessionId])

  /**
   * 添加消息到队列尾部
   */
  const enqueue = useCallback((content: string, attachments: MessageAttachment[]) => {
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      console.warn('[useMessageQueue] 队列已满，拒绝入队')
      return
    }

    const item: QueuedMessage = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      content,
      attachments,
      queuedAt: Date.now(),
    }

    console.log('[useMessageQueue] 消息入队:', item.content, '会话:', sessionIdRef.current)
    setQueue((prev) => {
      const next = [...prev, item]
      saveQueue(sessionIdRef.current, next)
      return next
    })
  }, [])

  /**
   * 取出队列头部消息
   */
  const dequeue = useCallback((): QueuedMessage | undefined => {
    const current = queueRef.current
    if (current.length === 0) return undefined

    const [first, ...rest] = current
    console.log('[useMessageQueue] 消息出队:', first.content)
    setQueue(rest)
    saveQueue(sessionIdRef.current, rest)
    return first
  }, [])

  /**
   * 查看队列头部消息（不移除）
   */
  const peek = useCallback((): QueuedMessage | undefined => {
    return queueRef.current[0]
  }, [])

  /**
   * 移除指定消息
   */
  const remove = useCallback((id: string) => {
    console.log('[useMessageQueue] 移除消息:', id)
    setQueue((prev) => {
      const next = prev.filter((item) => item.id !== id)
      saveQueue(sessionIdRef.current, next)
      return next
    })
  }, [])

  /**
   * 清空队列
   */
  const clear = useCallback(() => {
    console.log('[useMessageQueue] 清空队列:', sessionIdRef.current)
    setQueue([])
    saveQueue(sessionIdRef.current, [])
  }, [])

  return {
    queue,
    queueLength: queue.length,
    isFull: queue.length >= MAX_QUEUE_SIZE,
    enqueue,
    dequeue,
    peek,
    remove,
    clear,
  }
}
