/**
 * CheckpointResumeDialog - 检查点恢复确认对话框
 *
 * 显示会话的检查点列表，供用户选择恢复到某个检查点
 * 包含确认操作和取消操作
 */

import React, { useEffect, useCallback, memo } from 'react'
import type { ChatCheckpoint } from '../../hooks/useChatCheckpoint'
import './CheckpointResumeDialog.css'

/**
 * CheckpointResumeDialog Props
 */
interface CheckpointResumeDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean
  /** 检查点列表 */
  checkpoints: ChatCheckpoint[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 选择检查点恢复 */
  onResume: (checkpointId: string) => void
  /** 关闭对话框 */
  onClose: () => void
}

/**
 * 格式化时间戳为可读字符串
 */
function formatCheckpointTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 检查点恢复确认对话框
 */
export const CheckpointResumeDialog = memo<CheckpointResumeDialogProps>(({
  isOpen,
  checkpoints,
  isLoading,
  error,
  onResume,
  onClose,
}) => {
  /**
   * ESC 键关闭对话框
   */
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  /**
   * 点击遮罩层关闭
   */
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="checkpoint-dialog-overlay" onClick={handleOverlayClick}>
      <div className="checkpoint-dialog">
        {/* 标题栏 */}
        <div className="checkpoint-dialog-header">
          <h3 className="checkpoint-dialog-title">恢复检查点</h3>
          <button className="checkpoint-dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* 内容区 */}
        <div className="checkpoint-dialog-content">
          {isLoading && (
            <div className="checkpoint-dialog-loading">
              <span className="spinner">&#8987;</span>
              <p>加载检查点列表...</p>
            </div>
          )}

          {error && (
            <div className="checkpoint-dialog-error">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && checkpoints.length === 0 && (
            <div className="checkpoint-dialog-empty">
              <p>暂无检查点</p>
              <p className="checkpoint-dialog-empty-hint">
                在 Agent 运行时点击"存档并停止"按钮可创建检查点
              </p>
            </div>
          )}

          {!isLoading && checkpoints.length > 0 && (
            <ul className="checkpoint-list">
              {checkpoints.map((cp) => (
                <li key={cp.checkpointId} className="checkpoint-item">
                  <div className="checkpoint-item-info">
                    <span className="checkpoint-item-name">
                      {cp.name || `检查点 #${cp.checkpointId.slice(0, 8)}`}
                    </span>
                    <span className="checkpoint-item-meta">
                      {cp.messageCount} 条消息 &middot; {formatCheckpointTime(cp.createdAt)}
                    </span>
                    {cp.metadata?.model && (
                      <span className="checkpoint-item-model">
                        {cp.metadata.model}
                      </span>
                    )}
                  </div>
                  <button
                    className="checkpoint-item-resume"
                    onClick={() => onResume(cp.checkpointId)}
                    title="恢复到此检查点"
                  >
                    恢复
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部 */}
        <div className="checkpoint-dialog-footer">
          <button className="checkpoint-dialog-cancel" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
})

CheckpointResumeDialog.displayName = 'CheckpointResumeDialog'
