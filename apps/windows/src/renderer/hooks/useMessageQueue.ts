/**
 * useMessageQueue Hook - 消息排队机制
 *
 * 当 agent 正在执行时，用户发送的消息进入队列而非直接发送
 * 当前 run 完成后，自动发送队列中的下一条消息
 *
 * 功能：
 * - 排队/出队/自动派发
 * - 持久化到 localStorage（防页面刷新丢失）
 * - 最大队列容量 10 条
 * - 支持删除单条队列消息
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MessageAttachment } from './useChatHistory'

/**
 * 最大队列容量
 */
const MAX_QUEUE_SIZE = 10

/**
 * localStorage key
 */
const STORAGE_KEY = 'openclaw_message_queue'

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
 * 从 localStorage 加载队列
 */
function loadQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
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
 * 保存队列到 localStorage
 */
function saveQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch (error) {
    console.error('[useMessageQueue] 保存队列失败:', error)
  }
}

/**
 * 消息排队机制 Hook
 */
export function useMessageQueue(): UseMessageQueueReturn {
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue())
  const queueRef = useRef<QueuedMessage[]>(queue)

  /** 同步 ref */
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  /**
   * 添加消息到队列尾部
   */
  const enqueue = useCallback((content: string, attachments: MessageAttachment[]) => {
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      console.warn('[useMessageQueue] 队列已满，拒绝入队')
      return
    }

    const item: QueuedMessage = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      attachments,
      queuedAt: Date.now(),
    }

    console.log('[useMessageQueue] 消息入队:', item.content)
    setQueue((prev) => {
      const next = [...prev, item]
      saveQueue(next)
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
    saveQueue(rest)
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
      saveQueue(next)
      return next
    })
  }, [])

  /**
   * 清空队列
   */
  const clear = useCallback(() => {
    console.log('[useMessageQueue] 清空队列')
    setQueue([])
    saveQueue([])
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
