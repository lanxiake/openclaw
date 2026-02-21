/**
 * useToolStream Hook - Tool 执行事件流管理
 *
 * 监听 Gateway 的 agent 事件通道，处理 tool 执行的三个阶段：
 * - start: 工具开始执行（获取工具名称、参数）
 * - update: 部分结果流式更新
 * - result: 工具执行完成（获取最终结果）
 *
 * 将 tool 执行信息关联到对应的 runId，
 * 供 ChatView 在消息中展示 tool 调用可视化
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentEventPayload } from '../../preload/index'

/**
 * 单次 Tool 调用状态
 */
export interface ToolCall {
  /** 工具调用唯一 ID */
  toolCallId: string
  /** 工具名称 */
  name: string
  /** 工具参数 */
  args?: Record<string, unknown>
  /** 执行阶段 */
  phase: 'start' | 'update' | 'result'
  /** 部分结果（流式更新） */
  partialResult?: unknown
  /** 最终结果 */
  result?: unknown
  /** 工具元数据描述 */
  meta?: string
  /** 是否出错 */
  isError?: boolean
  /** 时间戳 */
  timestamp: number
  /** 工具开始执行的时间（ms since epoch） */
  startTime: number
  /** 工具执行结束的时间（ms since epoch），仅 phase=result 时有值 */
  endTime?: number
  /** 工具执行耗时（ms），仅 phase=result 时有值 */
  durationMs?: number
}

/**
 * 按 runId 分组的 tool 调用集合
 */
export interface RunToolCalls {
  /** 运行 ID */
  runId: string
  /** 该运行中的所有 tool 调用（按时间顺序） */
  toolCalls: ToolCall[]
}

/**
 * Hook 返回值
 */
export interface UseToolStreamReturn {
  /** 当前运行的 tool 调用集合（按 runId 索引） */
  toolCallsByRun: Map<string, ToolCall[]>
  /** 获取指定 runId 的 tool 调用列表 */
  getToolCalls: (runId: string) => ToolCall[]
  /** 重置所有 tool 调用状态 */
  reset: () => void
  /** 清除指定 runId 的 tool 调用 */
  clearRun: (runId: string) => void
}

/**
 * Tool 执行事件流管理 Hook
 *
 * 监听 Gateway agent 事件通道，收集 tool 执行信息
 * 自动按 runId 分组，按时间顺序排列
 */
export function useToolStream(): UseToolStreamReturn {
  const [toolCallsByRun, setToolCallsByRun] = useState<Map<string, ToolCall[]>>(new Map())
  const toolCallsRef = useRef<Map<string, ToolCall[]>>(new Map())

  /**
   * 处理 agent 事件
   * 只关注 stream === 'tool' 的事件
   */
  const handleAgentEvent = useCallback((payload: AgentEventPayload) => {
    // 只处理 tool 流事件
    if (payload.stream !== 'tool') {
      return
    }

    const { runId, data, ts } = payload
    const { phase, name, toolCallId, args, partialResult, meta, isError, result } = data

    // 必须有 toolCallId 和 phase
    if (!toolCallId || !phase) {
      console.warn('[useToolStream] 缺少 toolCallId 或 phase，忽略事件:', payload)
      return
    }

    console.log('[useToolStream] 收到 tool 事件:', { runId, phase, name, toolCallId })

    setToolCallsByRun((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(runId) || []

      switch (phase) {
        case 'start': {
          // 新 tool 调用开始
          const now = Date.now()
          const newCall: ToolCall = {
            toolCallId,
            name: name || 'unknown',
            args,
            phase: 'start',
            timestamp: ts,
            startTime: now,
          }
          newMap.set(runId, [...existing, newCall])
          break
        }
        case 'update': {
          // 更新已有的 tool 调用
          const updated = existing.map((call) =>
            call.toolCallId === toolCallId
              ? { ...call, phase: 'update' as const, partialResult }
              : call
          )
          newMap.set(runId, updated)
          break
        }
        case 'result': {
          // tool 调用完成，计算耗时
          const now = Date.now()
          const completed = existing.map((call) => {
            if (call.toolCallId !== toolCallId) return call
            const durationMs = now - call.startTime
            return {
              ...call,
              phase: 'result' as const,
              result,
              meta,
              isError,
              endTime: now,
              durationMs,
            }
          })
          newMap.set(runId, completed)
          break
        }
        default:
          break
      }

      // 同步 ref
      toolCallsRef.current = newMap
      return newMap
    })
  }, [])

  /**
   * 获取指定 runId 的 tool 调用列表
   */
  const getToolCalls = useCallback((runId: string): ToolCall[] => {
    return toolCallsByRun.get(runId) || []
  }, [toolCallsByRun])

  /**
   * 重置所有 tool 调用状态
   */
  const reset = useCallback(() => {
    console.log('[useToolStream] 重置所有 tool 调用状态')
    setToolCallsByRun(new Map())
    toolCallsRef.current = new Map()
  }, [])

  /**
   * 清除指定 runId 的 tool 调用
   */
  const clearRun = useCallback((runId: string) => {
    console.log('[useToolStream] 清除 runId:', runId)
    setToolCallsByRun((prev) => {
      const newMap = new Map(prev)
      newMap.delete(runId)
      toolCallsRef.current = newMap
      return newMap
    })
  }, [])

  /**
   * 监听 Gateway agent 事件
   */
  useEffect(() => {
    console.log('[useToolStream] 设置 agent 事件监听')
    const unsubscribe = window.electronAPI.gateway.onAgentEvent(handleAgentEvent)

    return () => {
      console.log('[useToolStream] 清理 agent 事件监听')
      unsubscribe()
    }
  }, [handleAgentEvent])

  return {
    toolCallsByRun,
    getToolCalls,
    reset,
    clearRun,
  }
}
