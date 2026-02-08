/**
 * AttachmentPreview Component - 附件预览组件
 *
 * 显示待发送的文件附件预览
 * 支持图片预览、文件信息显示、删除操作
 */

import React, { memo, useCallback } from 'react'
import './AttachmentPreview.css'

/**
 * 附件接口
 */
export interface Attachment {
  /** 唯一标识 */
  id: string
  /** 文件名 */
  fileName: string
  /** MIME 类型 */
  mimeType: string
  /** Base64 内容 */
  content: string
  /** 文件大小 (字节) */
  size: number
  /** 预览 URL (data:URL) */
  preview?: string
}

/**
 * AttachmentPreview 组件属性
 */
interface AttachmentPreviewProps {
  /** 附件列表 */
  attachments: Attachment[]
  /** 删除附件回调 */
  onRemove: (id: string) => void
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

/**
 * 判断是否是图片类型
 */
function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * 单个附件项
 */
const AttachmentItem = memo<{
  attachment: Attachment
  onRemove: (id: string) => void
  disabled?: boolean
}>(({ attachment, onRemove, disabled }) => {
  const handleRemove = useCallback(() => {
    if (!disabled) {
      onRemove(attachment.id)
    }
  }, [attachment.id, onRemove, disabled])

  const isImage = isImageType(attachment.mimeType)

  return (
    <div className="attachment-item">
      {/* 预览区域 */}
      <div className="attachment-preview">
        {isImage && attachment.preview ? (
          <img src={attachment.preview} alt={attachment.fileName} />
        ) : (
          <div className="attachment-icon">
            📄
          </div>
        )}
      </div>

      {/* 文件信息 */}
      <div className="attachment-info">
        <span className="attachment-name" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className="attachment-size">
          {formatFileSize(attachment.size)}
        </span>
      </div>

      {/* 删除按钮 */}
      {!disabled && (
        <button
          className="attachment-remove"
          onClick={handleRemove}
          title="移除附件"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  )
})

AttachmentItem.displayName = 'AttachmentItem'

/**
 * 附件预览组件
 */
export const AttachmentPreview: React.FC<AttachmentPreviewProps> = memo(({
  attachments,
  onRemove,
  disabled = false,
}) => {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="attachment-preview-container">
      <div className="attachment-list">
        {attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
})

AttachmentPreview.displayName = 'AttachmentPreview'
