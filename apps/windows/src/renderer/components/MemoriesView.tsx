/**
 * MemoriesView Component - 用户记忆查看视图
 *
 * 只读显示用户的记忆列表，支持：
 * - 按类型过滤（情景记忆/用户画像/偏好设置/事实知识）
 * - 分页加载
 * - 刷新
 */

import React from 'react'
import {
  useMemories,
  MEMORY_TYPE_LABELS,
  type MemoryType,
  type MemoryItem,
} from '../hooks/useMemories'
import './MemoriesView.css'

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 重要度的样式
 */
function getImportanceClass(importance: number): string {
  if (importance >= 8) return 'high'
  if (importance >= 5) return 'medium'
  return 'low'
}

/**
 * 记忆类型选项
 */
const TYPE_OPTIONS: Array<{ value: MemoryType | ''; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'fact', label: '事实知识' },
  { value: 'profile', label: '用户画像' },
  { value: 'preference', label: '偏好设置' },
  { value: 'episodic', label: '情景记忆' },
]

/**
 * 记忆卡片组件（只读）
 */
const MemoryCard: React.FC<{
  memory: MemoryItem
}> = ({ memory }) => {
  return (
    <div className="memory-card">
      <div className="memory-card-header">
        <span className={`memory-type-badge type-${memory.type}`}>
          {MEMORY_TYPE_LABELS[memory.type]}
        </span>
        {memory.category && (
          <span className="memory-category">{memory.category}</span>
        )}
        <span className={`memory-importance ${getImportanceClass(memory.importance)}`}>
          {memory.importance}
        </span>
      </div>
      <div className="memory-card-content">
        {memory.content}
      </div>
      {memory.summary && (
        <div className="memory-card-summary">{memory.summary}</div>
      )}
      <div className="memory-card-footer">
        <span className="memory-time">{formatDateTime(memory.updatedAt || memory.createdAt)}</span>
      </div>
    </div>
  )
}

/**
 * 记忆管理视图主组件
 */
export const MemoriesView: React.FC = () => {
  const {
    memories,
    total,
    isLoading,
    error,
    typeFilter,
    setTypeFilter,
    refresh,
    loadMore,
    hasMore,
  } = useMemories()

  return (
    <div className="memories-view">
      {/* 标题栏 */}
      <div className="view-header">
        <h2>记忆管理</h2>
        <div className="header-actions">
          <button className="btn-refresh" onClick={refresh} disabled={isLoading}>
            {isLoading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* 类型过滤 */}
      <div className="filter-bar">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-chip ${typeFilter === opt.value ? 'active' : ''}`}
            onClick={() => setTypeFilter(opt.value as MemoryType | '')}
          >
            {opt.label}
          </button>
        ))}
        <span className="filter-count">共 {total} 条</span>
      </div>

      {/* 记忆列表 */}
      {memories.length === 0 && !isLoading ? (
        <div className="empty-state">
          <p>暂无记忆数据</p>
          <p className="empty-hint">AI 助手会在对话中自动记住你的偏好和重要信息。</p>
        </div>
      ) : (
        <div className="memories-list">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
            />
          ))}
        </div>
      )}

      {/* 加载更多 */}
      {hasMore && (
        <div className="load-more">
          <button className="btn-load-more" onClick={loadMore} disabled={isLoading}>
            加载更多
          </button>
        </div>
      )}
    </div>
  )
}
