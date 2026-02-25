/**
 * MemoriesView Component - 用户记忆管理视图
 *
 * 显示用户的记忆列表，支持：
 * - 按类型过滤（情景记忆/用户画像/偏好设置/事实知识）
 * - 创建新记忆
 * - 编辑记忆内容
 * - 删除记忆
 */

import React, { useState } from 'react'
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
 * 记忆卡片组件
 */
const MemoryCard: React.FC<{
  memory: MemoryItem
  onEdit: (memory: MemoryItem) => void
  onDelete: (id: string) => void
}> = ({ memory, onEdit, onDelete }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

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
        <div className="memory-actions">
          <button className="btn-edit" onClick={() => onEdit(memory)} title="编辑">
            编辑
          </button>
          {showConfirmDelete ? (
            <span className="confirm-delete">
              <button className="btn-confirm-delete" onClick={() => { onDelete(memory.id); setShowConfirmDelete(false) }}>
                确认删除
              </button>
              <button className="btn-cancel-delete" onClick={() => setShowConfirmDelete(false)}>
                取消
              </button>
            </span>
          ) : (
            <button className="btn-delete" onClick={() => setShowConfirmDelete(true)} title="删除">
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 编辑/创建记忆对话框
 */
const MemoryDialog: React.FC<{
  mode: 'create' | 'edit'
  memory?: MemoryItem | null
  onSave: (data: { type: MemoryType; content: string; category?: string; importance?: number }) => Promise<boolean>
  onCancel: () => void
}> = ({ mode, memory, onSave, onCancel }) => {
  const [type, setType] = useState<MemoryType>(memory?.type ?? 'fact')
  const [content, setContent] = useState(memory?.content ?? '')
  const [category, setCategory] = useState(memory?.category ?? '')
  const [importance, setImportance] = useState(memory?.importance ?? 5)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    const success = await onSave({
      type,
      content: content.trim(),
      category: category.trim() || undefined,
      importance,
    })
    setSaving(false)
    if (success) {
      onCancel()
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog memory-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'create' ? '添加记忆' : '编辑记忆'}</h3>

        <div className="form-group">
          <label>类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MemoryType)}
            disabled={mode === 'edit'}
          >
            {Object.entries(MEMORY_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>分类（可选）</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="如：personal, work, hobby..."
          />
        </div>

        <div className="form-group">
          <label>内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入记忆内容..."
            rows={5}
          />
        </div>

        <div className="form-group">
          <label>重要度: {importance}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
          />
        </div>

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
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
    createMemory,
    updateMemory,
    deleteMemory,
  } = useMemories()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null)

  /**
   * 处理创建
   */
  const handleCreate = async (data: {
    type: MemoryType
    content: string
    category?: string
    importance?: number
  }): Promise<boolean> => {
    return createMemory(data)
  }

  /**
   * 处理编辑保存
   */
  const handleEditSave = async (data: {
    type: MemoryType
    content: string
    category?: string
    importance?: number
  }): Promise<boolean> => {
    if (!editingMemory) return false
    return updateMemory(editingMemory.id, {
      content: data.content,
      category: data.category,
      importance: data.importance,
    })
  }

  /**
   * 处理删除
   */
  const handleDelete = async (id: string) => {
    await deleteMemory(id)
  }

  return (
    <div className="memories-view">
      {/* 标题栏 */}
      <div className="view-header">
        <h2>记忆管理</h2>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
            添加记忆
          </button>
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
          <p className="empty-hint">AI 助手会在对话中自动记住你的偏好和重要信息，你也可以手动添加。</p>
        </div>
      ) : (
        <div className="memories-list">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={setEditingMemory}
              onDelete={handleDelete}
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

      {/* 创建对话框 */}
      {showCreateDialog && (
        <MemoryDialog
          mode="create"
          onSave={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* 编辑对话框 */}
      {editingMemory && (
        <MemoryDialog
          mode="edit"
          memory={editingMemory}
          onSave={handleEditSave}
          onCancel={() => setEditingMemory(null)}
        />
      )}
    </div>
  )
}
