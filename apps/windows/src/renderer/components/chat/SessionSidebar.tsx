/**
 * SessionSidebar - 会话列表侧边栏
 *
 * 管理对话会话列表：新建、切换、删除、重命名
 * 支持本地会话和服务端会话分组显示
 */

import React, { useState, memo } from 'react'
import type { ChatSession } from '../../hooks/useChatHistory'
import './SessionSidebar.css'

/**
 * SessionSidebar Props
 */
interface SessionSidebarProps {
  /** 所有会话列表 */
  sessions: ChatSession[]
  /** 当前激活的会话 ID */
  activeSessionId: string | null
  /** 是否正在同步 */
  isSyncing?: boolean
  /** 选择会话回调 */
  onSelect: (id: string) => void
  /** 新建会话回调 */
  onNew: () => void
  /** 删除会话回调 */
  onDelete: (id: string) => void
  /** 重命名会话回调 */
  onRename: (id: string, title: string) => void
}

/**
 * 格式化会话日期为相对时间
 */
function formatDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

/**
 * 会话列表侧边栏
 */
export const SessionSidebar = memo<SessionSidebarProps>(({
  sessions,
  activeSessionId,
  isSyncing,
  onSelect,
  onNew,
  onDelete,
  onRename,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  /**
   * 开始编辑标题
   */
  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  /**
   * 保存标题
   */
  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  // 分组会话：本地在前，服务端在后
  const localSessions = sessions.filter((s) => s.source === 'local')
  const serverSessions = sessions.filter((s) => s.source === 'server')

  /**
   * 渲染单个会话条目
   */
  const renderSessionItem = (session: ChatSession) => (
    <div
      key={session.id}
      className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
      onClick={() => onSelect(session.id)}
    >
      {editingId === session.id ? (
        <div className="session-edit">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <button onClick={(e) => { e.stopPropagation(); handleSaveEdit() }}>✓</button>
          <button onClick={(e) => { e.stopPropagation(); handleCancelEdit() }}>✕</button>
        </div>
      ) : (
        <>
          <div className="session-info">
            <span className="session-title">
              {session.source === 'server' && (
                <span className="session-source-badge server" title="服务端会话">&#9729;</span>
              )}
              {session.title}
            </span>
            <span className="session-time">{formatDate(session.updatedAt)}</span>
          </div>
          <div className="session-actions">
            <button
              className="session-action-btn"
              onClick={(e) => { e.stopPropagation(); handleStartEdit(session) }}
              title="重命名"
            >
              ✏️
            </button>
            <button
              className="session-action-btn danger"
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm('确定要删除这个对话吗？')) {
                  onDelete(session.id)
                }
              }}
              title="删除"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="session-sidebar">
      <div className="session-sidebar-header">
        <h3>对话历史</h3>
        <button className="new-session-btn" onClick={onNew} title="新建对话">
          +
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && !isSyncing ? (
          <div className="no-sessions">暂无历史对话</div>
        ) : (
          <>
            {/* 本地会话 */}
            {localSessions.length > 0 && (
              <>
                {serverSessions.length > 0 && (
                  <div className="session-group-label">本地对话</div>
                )}
                {localSessions.map(renderSessionItem)}
              </>
            )}

            {/* 服务端会话 */}
            {serverSessions.length > 0 && (
              <>
                <div className="session-group-label">
                  {isSyncing ? '同步中...' : '服务端对话'}
                </div>
                {serverSessions.map(renderSessionItem)}
              </>
            )}

            {/* 同步中但尚无服务端会话 */}
            {isSyncing && serverSessions.length === 0 && (
              <div className="session-sync-hint">正在同步服务端会话...</div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

SessionSidebar.displayName = 'SessionSidebar'
