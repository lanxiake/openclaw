/**
 * useAgentTodo Hook - Agent 任务列表状态管理
 *
 * 从 tool 执行事件流中提取 TodoWrite 工具调用的参数，
 * 解析为结构化的 TodoItem 列表，按 runId 管理。
 *
 * pi-agent 每次调用 TodoWrite 时，工具参数中包含完整的 todo 列表快照，
 * 本 hook 监听 tool 事件，取最新的 TodoWrite 调用参数作为当前状态。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentEventPayload } from '../../preload/index'

/**
 * 单个待办项
 */
export interface TodoItem {
  /** 待办内容（祈使语气，如"修复登录 bug"） */
  content: string
  /** 进行中显示文本（现在进行时，如"修复登录 bug 中"） */
  activeForm?: string
  /** 状态 */
  status: 'pending' | 'in_progress' | 'completed'
}

/**
 * Hook 返回值
 */
export interface UseAgentTodoReturn {
  /** 当前 todo 列表 */
  todos: TodoItem[]
  /** 是否有活跃的 todo（即 agent 正在运行） */
  isActive: boolean
  /** 完成数量 */
  completedCount: number
  /** 总数量 */
  totalCount: number
  /** 清除 todo 列表 */
  clear: () => void
}

/**
 * 从 tool 事件数据中解析 TodoWrite 参数
 */
function parseTodoItems(args: unknown): TodoItem[] | null {
  if (!args || typeof args !== 'object') return null

  const argsObj = args as Record<string, unknown>
  const todos = argsObj.todos

  if (!Array.isArray(todos)) return null

  return todos
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
    )
    .map((item) => ({
      content: typeof item.content === 'string' ? item.content : '',
      activeForm: typeof item.activeForm === 'string' ? item.activeForm : undefined,
      status: (['pending', 'in_progress', 'completed'].includes(item.status as string)
        ? item.status
        : 'pending') as TodoItem['status'],
    }))
    .filter((item) => item.content.length > 0)
}

/**
 * Agent 任务列表管理 Hook
 *
 * 监听 Gateway agent 事件中的 TodoWrite 工具调用，
 * 提取参数作为任务列表展示数据
 */
export function useAgentTodo(): UseAgentTodoReturn {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const todosRef = useRef<TodoItem[]>([])

  /**
   * 处理 agent 事件
   * 只关注 stream === 'tool' 且工具名为 TodoWrite 的事件
   */
  const handleAgentEvent = useCallback((payload: AgentEventPayload) => {
    if (payload.stream !== 'tool') return

    const { data } = payload
    const toolName = data.name as string | undefined

    /** 只处理 TodoWrite 工具 */
    if (!toolName || !toolName.toLowerCase().includes('todowrite')) return

    /** start 阶段有 args，包含完整 todo 列表 */
    if (data.phase === 'start' && data.args) {
      console.log('[useAgentTodo] 收到 TodoWrite 事件:', data.args)
      const parsed = parseTodoItems(data.args)
      if (parsed) {
        todosRef.current = parsed
        setTodos(parsed)
      }
    }
  }, [])

  /**
   * 清除 todo 列表
   */
  const clear = useCallback(() => {
    console.log('[useAgentTodo] 清除 todo 列表')
    todosRef.current = []
    setTodos([])
  }, [])

  /**
   * 监听 Gateway agent 事件
   */
  useEffect(() => {
    console.log('[useAgentTodo] 设置 agent 事件监听')
    const unsubscribe = window.electronAPI.gateway.onAgentEvent(handleAgentEvent)

    return () => {
      console.log('[useAgentTodo] 清理 agent 事件监听')
      unsubscribe()
    }
  }, [handleAgentEvent])

  const completedCount = todos.filter((t) => t.status === 'completed').length
  const totalCount = todos.length
  const isActive = totalCount > 0

  return {
    todos,
    isActive,
    completedCount,
    totalCount,
    clear,
  }
}
