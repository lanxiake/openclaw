/**
 * MessageQueuePanel - 消息排队面板
 *
 * 显示在输入区域上方，展示待发送的排队消息
 * 支持删除单条和清空全部
 */

import React, { memo, useCallback } from 'react'
import type { QueuedMessage } from '../../hooks/useMessageQueue'
import './MessageQueuePanel.css'

/**
 * MessageQueuePanel Props
 */
interface MessageQueuePanelProps {
  /** 排队消息列表 */
  queue: QueuedMessage[]
  /** 移除单条消息 */
  onRemove: (id: string) => void
  /** 清空队列 */
  onClear: () => void
}

/**
 * 截断文本用于预览
 */
function truncatePreview(text: string, maxLen: number = 60): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

/**
 * 消息排队面板组件
 */
export const MessageQueuePanel = memo<MessageQueuePanelProps>(({
  queue,
  onRemove,
  onClear,
}) => {
  if (queue.length === 0) return null

  return (
    <div className="message-queue-panel">
      <div className="message-queue-header">
        <span className="message-queue-label">
          排队消息 ({queue.length})
        </span>
        <button
          className="message-queue-clear"
          onClick={onClear}
          title="清空队列"
        >
          清空
        </button>
      </div>
      <div className="message-queue-list">
        {queue.map((item, index) => (
          <div key={item.id} className="message-queue-item">
            <span className="message-queue-index">{index + 1}</span>
            <span className="message-queue-content">
              {truncatePreview(item.content)}
              {item.attachments.length > 0 && (
                <span className="message-queue-att"> +{item.attachments.length} 附件</span>
              )}
            </span>
            <button
              className="message-queue-remove"
              onClick={() => onRemove(item.id)}
              title="移除"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
})

MessageQueuePanel.displayName = 'MessageQueuePanel'
