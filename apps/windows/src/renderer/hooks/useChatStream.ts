/**
 * useChatStream Hook - 流式消息状态管理
 *
 * 管理来自 Gateway 的流式 chat 响应
 * 处理 delta (增量)、final (最终结果)、error (错误) 状态
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Chat 事件负载接口
 */
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  state: 'delta' | 'final' | 'error'
  delta?: string
  message?: Record<string, unknown>
  errorMessage?: string
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
  /** 错误信息 */
  error?: string
}

/**
 * Hook 返回值
 */
export interface UseChatStreamReturn {
  /** 当前流式消息 */
  streamingMessage: StreamingMessage | null
  /** 是否正在流式输出 */
  isStreaming: boolean
  /** 重置流式消息状态 */
  reset: () => void
  /** 开始新的流式消息 */
  startStream: (runId: string, sessionKey: string) => void
}

/**
 * 流式消息状态管理 Hook
 *
 * 用于接收和处理来自 Gateway 的流式 chat 响应
 * 自动处理 delta、final、error 状态转换
 */
export function useChatStream(): UseChatStreamReturn {
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const contentRef = useRef<string>('')

  /**
   * 重置流式消息状态
   */
  const reset = useCallback(() => {
    console.log('[useChatStream] 重置流式消息状态')
    setStreamingMessage(null)
    contentRef.current = ''
  }, [])

  /**
   * 开始新的流式消息
   */
  const startStream = useCallback((runId: string, sessionKey: string) => {
    console.log('[useChatStream] 开始新的流式消息:', { runId, sessionKey })
    contentRef.current = ''
    setStreamingMessage({
      runId,
      sessionKey,
      content: '',
      isStreaming: true,
      isComplete: false,
    })
  }, [])

  /**
   * 处理 chat 事件
   */
  const handleChatEvent = useCallback((payload: ChatEventPayload) => {
    const { runId, sessionKey, state, delta, message, errorMessage } = payload
    console.log('[useChatStream] 收到 chat 事件:', { runId, state })

    setStreamingMessage((prev) => {
      // 如果没有当前流式消息或者 runId 不匹配，忽略
      if (!prev || prev.runId !== runId) {
        console.log('[useChatStream] 忽略不匹配的事件')
        return prev
      }

      switch (state) {
        case 'delta':
          // 累积增量内容
          if (delta) {
            contentRef.current += delta
            return {
              ...prev,
              content: contentRef.current,
              isStreaming: true,
              isComplete: false,
            }
          }
          return prev

        case 'final':
          // 流式完成
          console.log('[useChatStream] 流式完成')
          const finalContent = message?.content as string || contentRef.current
          return {
            ...prev,
            content: finalContent,
            isStreaming: false,
            isComplete: true,
          }

        case 'error':
          // 发生错误
          console.error('[useChatStream] 流式错误:', errorMessage)
          return {
            ...prev,
            isStreaming: false,
            isComplete: true,
            error: errorMessage || '未知错误',
          }

        default:
          return prev
      }
    })
  }, [])

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

  return {
    streamingMessage,
    isStreaming: streamingMessage?.isStreaming ?? false,
    reset,
    startStream,
  }
}
