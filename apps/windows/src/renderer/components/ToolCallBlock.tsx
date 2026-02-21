/**
 * ToolCallBlock - Tool 调用可视化组件
 *
 * 在聊天消息中展示 AI 使用的工具调用信息
 * 支持三个阶段的可视化：
 * - start: 显示工具名称和参数（执行中状态 + 实时计时）
 * - update: 显示部分结果（流式更新）
 * - result: 显示最终结果（成功/失败 + 耗时）
 *
 * 增强功能：实时计时器、完成耗时展示、连续同类工具分组折叠
 */

import React, { useState, useCallback, useEffect, memo } from 'react'
import type { ToolCall } from '../hooks/useToolStream'
import './ToolCallBlock.css'

/**
 * 工具名称到友好显示名称的映射
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  exec: '执行命令',
  read: '读取文件',
  write: '写入文件',
  edit: '编辑文件',
  search: '搜索',
  browser: '浏览器',
  list: '列出文件',
  mkdir: '创建目录',
  rm: '删除文件',
  mv: '移动文件',
  cp: '复制文件',
  fetch: '网络请求',
  shell: '终端命令',
}

/**
 * 获取工具的友好显示名称
 */
function getToolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] || name
}

/**
 * 获取工具的状态图标
 */
function getPhaseIcon(phase: ToolCall['phase'], isError?: boolean): string {
  if (phase === 'result' && isError) return '!'
  if (phase === 'result') return '\u2713'
  return '\u25B6'
}

/**
 * 截断长文本
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 将 unknown 类型格式化为可展示的字符串
 */
function formatValue(value: unknown, maxLength: number = 200): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return truncateText(value, maxLength)
  try {
    return truncateText(JSON.stringify(value, null, 2), maxLength)
  } catch {
    return String(value)
  }
}

/**
 * 格式化耗时为人类可读字符串
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m${seconds}s`
}

/**
 * 从工具参数中提取简短摘要
 */
function getArgsSummary(name: string, args?: Record<string, unknown>): string {
  if (!args) return ''

  if (name === 'exec' || name === 'shell') {
    return typeof args.command === 'string' ? args.command : ''
  }
  if (name === 'read' || name === 'write' || name === 'edit') {
    return typeof args.path === 'string' ? args.path : ''
  }
  if (name === 'search') {
    return typeof args.query === 'string' ? args.query : ''
  }
  if (name === 'fetch') {
    return typeof args.url === 'string' ? args.url : ''
  }

  const firstString = Object.values(args).find((v) => typeof v === 'string')
  return typeof firstString === 'string' ? firstString : ''
}

/**
 * 实时计时器组件
 * 工具执行中时每秒更新显示的运行时间
 */
const LiveTimer = memo<{ startTime: number }>(({ startTime }) => {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 100)
    return () => clearInterval(timer)
  }, [startTime])

  return (
    <span className="tool-call-timer running">{formatDuration(elapsed)}</span>
  )
})

LiveTimer.displayName = 'LiveTimer'

/**
 * 单个 Tool 调用块
 */
const SingleToolCall = memo<{ toolCall: ToolCall }>(({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const displayName = getToolDisplayName(toolCall.name)
  const phaseIcon = getPhaseIcon(toolCall.phase, toolCall.isError)
  const argsSummary = getArgsSummary(toolCall.name, toolCall.args)
  const isRunning = toolCall.phase === 'start' || toolCall.phase === 'update'

  return (
    <div
      className={`tool-call-item ${toolCall.phase} ${toolCall.isError ? 'error' : ''}`}
      onClick={handleToggle}
    >
      {/* 工具调用头部 */}
      <div className="tool-call-header">
        <span className={`tool-call-icon ${isRunning ? 'running' : ''}`}>
          {phaseIcon}
        </span>
        <span className="tool-call-name">{displayName}</span>
        {argsSummary && (
          <span className="tool-call-summary">{truncateText(argsSummary, 60)}</span>
        )}
        {/* 计时显示 */}
        {isRunning && <LiveTimer startTime={toolCall.startTime} />}
        {toolCall.phase === 'result' && toolCall.durationMs !== undefined && (
          <span className="tool-call-timer completed">{formatDuration(toolCall.durationMs)}</span>
        )}
        <span className="tool-call-expand">{isExpanded ? '\u25BC' : '\u25B8'}</span>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="tool-call-details">
          {/* 参数 */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">参数</div>
              <pre className="tool-call-pre">{formatValue(toolCall.args, 500)}</pre>
            </div>
          )}

          {/* 部分结果 */}
          {toolCall.partialResult !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">部分结果</div>
              <pre className="tool-call-pre">{formatValue(toolCall.partialResult, 500)}</pre>
            </div>
          )}

          {/* 最终结果 */}
          {toolCall.phase === 'result' && toolCall.result !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">
                {toolCall.isError ? '错误' : '结果'}
              </div>
              <pre className={`tool-call-pre ${toolCall.isError ? 'error' : ''}`}>
                {formatValue(toolCall.result, 800)}
              </pre>
            </div>
          )}

          {/* 元数据 */}
          {toolCall.meta && (
            <div className="tool-call-meta">{toolCall.meta}</div>
          )}
        </div>
      )}
    </div>
  )
})

SingleToolCall.displayName = 'SingleToolCall'

/**
 * 工具调用分组：将连续的同名工具调用合并为一组
 */
interface ToolCallGroup {
  /** 组内工具名称 */
  name: string
  /** 组内的工具调用 */
  calls: ToolCall[]
}

/**
 * 将工具调用列表按连续同名分组
 */
function groupToolCalls(toolCalls: ToolCall[]): ToolCallGroup[] {
  const groups: ToolCallGroup[] = []

  for (const tc of toolCalls) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.name === tc.name) {
      lastGroup.calls.push(tc)
    } else {
      groups.push({ name: tc.name, calls: [tc] })
    }
  }

  return groups
}

/**
 * 工具调用分组组件 - 可折叠的同类工具组
 */
const ToolCallGroupBlock = memo<{ group: ToolCallGroup }>(({ group }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  /** 单项直接渲染，不需要分组折叠 */
  if (group.calls.length === 1) {
    return <SingleToolCall toolCall={group.calls[0]} />
  }

  const completedCount = group.calls.filter((tc) => tc.phase === 'result').length
  const errorCount = group.calls.filter((tc) => tc.isError).length
  const totalCount = group.calls.length
  const displayName = getToolDisplayName(group.name)

  /** 计算组的总耗时 */
  const totalDuration = group.calls.reduce((sum, tc) => sum + (tc.durationMs || 0), 0)
  const hasRunning = group.calls.some((tc) => tc.phase !== 'result')

  return (
    <div className="tool-call-group">
      <div
        className="tool-call-group-header"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <span className="tool-call-group-icon">{isCollapsed ? '\u25B8' : '\u25BC'}</span>
        <span className="tool-call-group-name">{displayName}</span>
        <span className="tool-call-group-count">
          {completedCount}/{totalCount}
          {errorCount > 0 && <span className="tool-call-group-errors"> ({errorCount} 错误)</span>}
        </span>
        {!hasRunning && totalDuration > 0 && (
          <span className="tool-call-timer completed">{formatDuration(totalDuration)}</span>
        )}
      </div>
      {!isCollapsed && (
        <div className="tool-call-group-list">
          {group.calls.map((tc) => (
            <SingleToolCall key={tc.toolCallId} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  )
})

ToolCallGroupBlock.displayName = 'ToolCallGroupBlock'

/**
 * Tool 调用块组件 Props
 */
interface ToolCallBlockProps {
  /** 当前消息关联的 tool 调用列表 */
  toolCalls: ToolCall[]
}

/**
 * Tool 调用块组件
 *
 * 展示一组关联的工具调用，支持实时计时、耗时展示和分组折叠
 */
export const ToolCallBlock = memo<ToolCallBlockProps>(({ toolCalls }) => {
  if (toolCalls.length === 0) return null

  const completedCount = toolCalls.filter((tc) => tc.phase === 'result').length
  const errorCount = toolCalls.filter((tc) => tc.isError).length
  const totalCount = toolCalls.length

  /** 计算总耗时 */
  const totalDuration = toolCalls.reduce((sum, tc) => sum + (tc.durationMs || 0), 0)
  const hasRunning = toolCalls.some((tc) => tc.phase !== 'result')

  /** 将连续同名工具调用分组 */
  const groups = groupToolCalls(toolCalls)

  return (
    <div className="tool-call-block">
      <div className="tool-call-block-header">
        <span className="tool-call-block-label">
          工具调用 ({completedCount}/{totalCount})
        </span>
        <div className="tool-call-block-meta">
          {!hasRunning && totalDuration > 0 && (
            <span className="tool-call-block-duration">总耗时 {formatDuration(totalDuration)}</span>
          )}
          {hasRunning && (
            <span className="tool-call-block-running">执行中...</span>
          )}
          {errorCount > 0 && (
            <span className="tool-call-block-errors">{errorCount} 个错误</span>
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className="tool-call-progress">
        <div
          className={`tool-call-progress-bar ${hasRunning ? 'running' : ''} ${errorCount > 0 ? 'has-errors' : ''}`}
          style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      <div className="tool-call-block-list">
        {groups.map((group, index) => (
          <ToolCallGroupBlock key={`${group.name}-${index}`} group={group} />
        ))}
      </div>
    </div>
  )
})

ToolCallBlock.displayName = 'ToolCallBlock'
