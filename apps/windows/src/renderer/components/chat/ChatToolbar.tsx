/**
 * ChatToolbar - 对话工具栏
 *
 * 显示在主对话区域顶部，包含侧边栏切换、会话标题和操作按钮
 * 运行时显示"存档并停止"按钮，空闲时显示"恢复"按钮
 */

import React, { memo } from 'react'
import './ChatToolbar.css'

/**
 * ChatToolbar Props
 */
interface ChatToolbarProps {
  /** 会话标题 */
  title: string
  /** 侧边栏是否可见 */
  showSidebar: boolean
  /** 是否允许清空 */
  canClear: boolean
  /** Agent 是否正在运行 */
  isLoading: boolean
  /** 是否有可用的检查点 */
  hasCheckpoints: boolean
  /** 切换侧边栏 */
  onToggleSidebar: () => void
  /** 新建会话 */
  onNewSession: () => void
  /** 清空当前会话 */
  onClear: () => void
  /** 存档并停止当前运行 */
  onCheckpoint?: () => void
  /** 打开恢复对话框 */
  onShowResumeDialog?: () => void
}

/**
 * 对话工具栏组件
 */
export const ChatToolbar = memo<ChatToolbarProps>(({
  title,
  showSidebar,
  canClear,
  isLoading,
  hasCheckpoints,
  onToggleSidebar,
  onNewSession,
  onClear,
  onCheckpoint,
  onShowResumeDialog,
}) => {
  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar-left">
        <button
          className="toolbar-button toggle-sidebar"
          onClick={onToggleSidebar}
          title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
        >
          {showSidebar ? '◀' : '▶'}
        </button>
        <span className="chat-title">{title}</span>
      </div>
      <div className="chat-toolbar-right">
        {/* 存档并停止 - 仅在 Agent 运行时显示 */}
        {isLoading && onCheckpoint && (
          <button
            className="toolbar-button checkpoint-button"
            onClick={onCheckpoint}
            title="存档当前状态并停止运行"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2v12h12V5.5L10.5 2H2zm1 1h7v3h3v8H3V3zm8 .5L13.5 6H11V3.5z"/>
              <path d="M5 8h6v1H5V8zm0 2h6v1H5v-1z"/>
            </svg>
            存档
          </button>
        )}

        {/* 恢复 - 仅在有检查点且非运行时显示 */}
        {!isLoading && hasCheckpoints && onShowResumeDialog && (
          <button
            className="toolbar-button resume-button"
            onClick={onShowResumeDialog}
            title="从检查点恢复对话"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 110 10A5 5 0 018 3zm0 1a4 4 0 100 8 4 4 0 000-8z"/>
              <path d="M8 1.5V4l2.5-1.5L8 1.5z"/>
            </svg>
            恢复
          </button>
        )}

        <button
          className="toolbar-button"
          onClick={onNewSession}
          title="新建对话"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a1 1 0 011 1v5h5a1 1 0 110 2H9v5a1 1 0 11-2 0V9H2a1 1 0 110-2h5V2a1 1 0 011-1z"/>
          </svg>
          新对话
        </button>
        <button
          className="toolbar-button"
          onClick={onClear}
          title="清空当前对话"
          disabled={!canClear}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z"/>
          </svg>
          清空
        </button>
      </div>
    </div>
  )
})

ChatToolbar.displayName = 'ChatToolbar'
