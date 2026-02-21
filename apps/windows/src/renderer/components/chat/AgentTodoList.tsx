/**
 * AgentTodoList - Agent 任务列表组件
 *
 * 显示在消息列表和输入框之间，展示 Agent 当前的任务清单
 * 包含状态图标、进度条和实时更新
 */

import React, { memo } from 'react'
import type { TodoItem } from '../../hooks/useAgentTodo'
import './AgentTodoList.css'

/**
 * 状态图标映射
 */
function getStatusIcon(status: TodoItem['status']): string {
  switch (status) {
    case 'completed': return '\u2713'
    case 'in_progress': return '\u25B6'
    case 'pending': return '\u25CB'
  }
}

/**
 * 状态 CSS 类名
 */
function getStatusClass(status: TodoItem['status']): string {
  switch (status) {
    case 'completed': return 'completed'
    case 'in_progress': return 'in-progress'
    case 'pending': return 'pending'
  }
}

/**
 * 单个待办项组件
 */
const TodoItemRow = memo<{ item: TodoItem }>(({ item }) => {
  const statusIcon = getStatusIcon(item.status)
  const statusClass = getStatusClass(item.status)
  const displayText = item.status === 'in_progress' && item.activeForm
    ? item.activeForm
    : item.content

  return (
    <div className={`agent-todo-item ${statusClass}`}>
      <span className={`agent-todo-icon ${statusClass}`}>
        {statusIcon}
      </span>
      <span className="agent-todo-text">{displayText}</span>
    </div>
  )
})

TodoItemRow.displayName = 'TodoItemRow'

/**
 * AgentTodoList Props
 */
interface AgentTodoListProps {
  /** 待办项列表 */
  todos: TodoItem[]
  /** 完成数量 */
  completedCount: number
  /** 总数量 */
  totalCount: number
}

/**
 * Agent 任务列表组件
 *
 * 仅在有任务时显示，位于消息区和输入区之间
 */
export const AgentTodoList = memo<AgentTodoListProps>(({
  todos,
  completedCount,
  totalCount,
}) => {
  if (totalCount === 0) return null

  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const hasInProgress = todos.some((t) => t.status === 'in_progress')

  return (
    <div className="agent-todo-list">
      {/* 头部 */}
      <div className="agent-todo-header">
        <span className="agent-todo-label">
          任务进度 ({completedCount}/{totalCount})
        </span>
        {hasInProgress && (
          <span className="agent-todo-running">执行中...</span>
        )}
      </div>

      {/* 进度条 */}
      <div className="agent-todo-progress">
        <div
          className={`agent-todo-progress-bar ${hasInProgress ? 'running' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 待办项列表 */}
      <div className="agent-todo-items">
        {todos.map((item, index) => (
          <TodoItemRow key={`${item.content}-${index}`} item={item} />
        ))}
      </div>
    </div>
  )
})

AgentTodoList.displayName = 'AgentTodoList'
