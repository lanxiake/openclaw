/**
 * useChatStream Hook - 流式消息状态管理
 *
 * 管理来自 Gateway 的流式 chat 响应
 * 处理 delta (增量)、final (最终结果)、error (错误) 状态
 *
 * 支持多会话并行：使用 Map<runId, StreamingMessage> 同时追踪多个 run
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Chat 事件负载接口
 *
 * Gateway 广播的 chat 事件结构：
 * - delta: message.content 为 [{type:"text", text:"完整累积文本"}] 格式（每次覆盖，非增量）
 * - final: message.content 同上，为最终完整文本
 * - error: errorMessage 为错误描述字符串
 */
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  state: 'delta' | 'final' | 'error' | 'aborted'
  message?: Record<string, unknown>
  errorMessage?: string
  /** 中断原因（state='aborted' 时由 Gateway 提供） */
  stopReason?: string
}

/**
 * 清理 Gateway 内联指令标记（如 [[reply_to:...]]、[[reply_to_current]]）
 *
 * 这些标记是 LLM 输出的消息路由指令，用于消息引用回复。
 * 在 messaging channel（WhatsApp/Telegram 等）中由 gateway 在发送前清除，
 * 但 webchat 流式广播路径直接转发原始文本，需要客户端自行清理。
 */
function stripInlineDirectives(text: string): string {
  return text.replace(/\[\[\s*reply_to(?:_current|:\s*[^\]]*?)?\s*\]\]/gi, '').trim()
}

/**
 * 从 Gateway 的 message 对象中提取纯文本内容
 *
 * Gateway 发送的 message.content 格式为 [{type:"text", text:"..."}] 数组，
 * 需要遍历提取所有 text 块并拼接为字符串
 */
function extractTextFromMessage(message: Record<string, unknown> | undefined): string {
  if (!message) return ''
  const content = message.content
  // 如果 content 已经是字符串，直接返回
  if (typeof content === 'string') return stripInlineDirectives(content)
  // 如果 content 是数组，提取所有 text 块
  if (Array.isArray(content)) {
    const raw = content
      .filter((block): block is { type: 'text'; text: string } =>
        typeof block === 'object' && block !== null &&
        block.type === 'text' &&
        typeof block.text === 'string'
      )
      .map((block) => block.text)
      .join('')
    return stripInlineDirectives(raw)
  }
  return ''
}

/**
 * 流式消息状态
 */
export interface StreamingMessage {
  /** 运行 ID */
  runId: string
  /** 会话 Key */
  sessionKey: string
  /** 累积的内容 */
  content: string
  /** 是否正在流式输出 */
  isStreaming: boolean
  /** 是否已完成 */
  isComplete: boolean
  /** 是否被用户中断 */
  isAborted?: boolean
  /** 错误信息 */
  error?: string
}

/**
 * Hook 返回值
 */
export interface UseChatStreamReturn {
  /** 当前流式消息（兼容单 run 场景，返回最后活跃的 streamingMessage） */
  streamingMessage: StreamingMessage | null
  /** 是否正在流式输出 */
  isStreaming: boolean
  /** 重置流式消息状态 */
  reset: () => void
  /** 开始新的流式消息 */
  startStream: (runId: string, sessionKey: string) => void
  /** 根据 runId 获取特定 run 的流式状态 */
  getStreamByRunId: (runId: string) => StreamingMessage | null
  /** streamMap 变化版本号，每次 streamMap 更新时递增 */
  streamVersion: number
}

/**
 * 流式消息状态管理 Hook
 *
 * 支持多会话并行：内部用 Map 追踪所有活跃 run，
 * 外部通过 getStreamByRunId 按 runId 查询特定 run 的状态。
 */
export function useChatStream(): UseChatStreamReturn {
  /** 所有活跃 run 的流式状态 Map */
  const [streamMap, setStreamMap] = useState<Map<string, StreamingMessage>>(new Map())
  /** 最后一次 startStream 的 runId，用于兼容旧的 streamingMessage 返回值 */
  const [lastRunId, setLastRunId] = useState<string | null>(null)
  /** streamMap 变化版本号，每次 setStreamMap 后递增 */
  const [streamVersion, setStreamVersion] = useState(0)
  /** 每个 run 的累积内容 ref（避免频繁重建 Map） */
  const contentRefs = useRef<Map<string, string>>(new Map())
  /** 已完成 run 的独立清理定时器（按 runId 跟踪，避免级联取消） */
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  /**
   * 更新 streamMap 并自动递增 streamVersion
   * 确保任何 streamMap 变化都能被依赖 streamVersion 的 effect 感知
   */
  const updateStreamMap = useCallback((updater: (prev: Map<string, StreamingMessage>) => Map<string, StreamingMessage>) => {
    setStreamMap(updater)
    setStreamVersion((v) => v + 1)
  }, [])

  /**
   * 重置所有流式消息状态
   */
  const reset = useCallback(() => {
    console.log('[useChatStream] 重置流式消息状态')
    updateStreamMap(() => new Map())
    setLastRunId(null)
    contentRefs.current.clear()
  }, [updateStreamMap])

  /**
   * 开始新的流式消息
   */
  const startStream = useCallback((runId: string, sessionKey: string) => {
    console.log('[useChatStream] 开始新的流式消息:', { runId, sessionKey })
    contentRefs.current.set(runId, '')
    setLastRunId(runId)
    updateStreamMap((prev) => {
      const next = new Map(prev)
      next.set(runId, {
        runId,
        sessionKey,
        content: '',
        isStreaming: true,
        isComplete: false,
      })
      return next
    })
  }, [updateStreamMap])

  /**
   * 根据 runId 获取特定 run 的流式状态
   */
  const getStreamByRunId = useCallback((runId: string): StreamingMessage | null => {
    return streamMap.get(runId) ?? null
  }, [streamMap])

  /**
   * 为已完成的 run 设置独立的延迟清理定时器
   *
   * 每个 run 有自己的定时器，不会因为其他 run 的事件而被取消。
   * 5 秒后从 streamMap 中移除，确保 ChatView effect 有时间处理完成事件。
   */
  const scheduleRunCleanup = useCallback((runId: string) => {
    // 如果已有定时器则跳过
    if (cleanupTimersRef.current.has(runId)) return

    const timer = setTimeout(() => {
      updateStreamMap((prev) => {
        const entry = prev.get(runId)
        if (!entry?.isComplete) return prev
        const next = new Map(prev)
        next.delete(runId)
        contentRefs.current.delete(runId)
        return next
      })
      cleanupTimersRef.current.delete(runId)
    }, 5000)

    cleanupTimersRef.current.set(runId, timer)
  }, [updateStreamMap])

  /**
   * 处理 chat 事件
   */
  const handleChatEvent = useCallback((payload: ChatEventPayload) => {
    const { runId, state, message, errorMessage, stopReason } = payload
    console.log('[useChatStream] 收到 chat 事件:', { runId, state })

    updateStreamMap((prev) => {
      const existing = prev.get(runId)
      // 如果这个 runId 没有被追踪（没有对应的 startStream 调用），忽略
      if (!existing) {
        console.log('[useChatStream] 忽略未追踪的 runId:', runId)
        return prev
      }

      const next = new Map(prev)

      switch (state) {
        case 'delta': {
          const deltaText = extractTextFromMessage(message)
          if (deltaText) {
            contentRefs.current.set(runId, deltaText)
            next.set(runId, {
              ...existing,
              content: deltaText,
              isStreaming: true,
              isComplete: false,
            })
          }
          break
        }

        case 'final': {
          const extractedFinalContent = extractTextFromMessage(message)
          const accumulatedContent = contentRefs.current.get(runId) ?? ''
          const finalContent = extractedFinalContent || accumulatedContent
          console.log('[useChatStream] 流式完成, runId:', runId, 'extractedLen:', extractedFinalContent.length, 'accumulatedLen:', accumulatedContent.length, 'finalLen:', finalContent.length)
          next.set(runId, {
            ...existing,
            content: finalContent,
            isStreaming: false,
            isComplete: true,
          })
          // 为此 run 独立设置延迟清理定时器
          scheduleRunCleanup(runId)
          break
        }

        case 'aborted': {
          console.log('[useChatStream] 流式被中断, runId:', runId, 'stopReason:', stopReason)
          next.set(runId, {
            ...existing,
            content: contentRefs.current.get(runId) ?? '',
            isStreaming: false,
            isComplete: true,
            isAborted: true,
          })
          scheduleRunCleanup(runId)
          break
        }

        case 'error': {
          console.error('[useChatStream] 流式错误, runId:', runId, ':', errorMessage)
          next.set(runId, {
            ...existing,
            isStreaming: false,
            isComplete: true,
            error: errorMessage || '未知错误',
          })
          scheduleRunCleanup(runId)
          break
        }

        default:
          return prev
      }

      return next
    })
  }, [updateStreamMap, scheduleRunCleanup])

  /**
   * 监听 Gateway chat 事件
   */
  useEffect(() => {
    console.log('[useChatStream] 设置 chat 事件监听')
    const unsubscribe = window.electronAPI.gateway.onChatEvent(handleChatEvent)

    return () => {
      console.log('[useChatStream] 清理 chat 事件监听')
      unsubscribe()
    }
  }, [handleChatEvent])

  /** 兼容返回：返回最后一次 startStream 的 streamingMessage */
  const streamingMessage = lastRunId ? streamMap.get(lastRunId) ?? null : null

  return {
    streamingMessage,
    isStreaming: streamingMessage?.isStreaming ?? false,
    reset,
    startStream,
    getStreamByRunId,
    streamVersion,
  }
}
