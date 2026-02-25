/**
 * ChatInput - 聊天输入区域组件
 *
 * 处理消息输入、文件选择、附件管理和发送操作
 * 支持自动高度调整、键盘快捷键和附件预览
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import { AttachmentPreview, type Attachment } from '../AttachmentPreview'
import type { MessageAttachment } from '../../hooks/useChatHistory'
import './ChatInput.css'

/**
 * 最大附件数量
 */
const MAX_ATTACHMENTS = 5

/**
 * 最大单个文件大小 (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * 允许的文件类型（图片 + 文档 + 代码）
 */
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]

/**
 * ChatInput Props
 */
interface ChatInputProps {
  /** 是否已连接 Gateway */
  isConnected: boolean
  /** 是否正在加载（agent 执行中） */
  isLoading: boolean
  /** 会话数量（显示在底部提示中） */
  sessionCount: number
  /** 队列中的消息数量 */
  queueLength: number
  /** 发送消息回调（父级负责路由：空闲时直接发送，执行中加入队列） */
  onSend: (content: string, attachments: MessageAttachment[]) => void
  /** 中断执行回调 */
  onAbort?: () => void
}

/**
 * 聊天输入区域组件
 */
export const ChatInput = memo<ChatInputProps>(({
  isConnected,
  isLoading,
  sessionCount,
  queueLength,
  onSend,
  onAbort,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * 自动调整输入框高度
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue])

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePaths.length) {
        return
      }

      console.log('[ChatInput] 选择的文件:', result.filePaths)

      // 检查附件数量限制
      const remainingSlots = MAX_ATTACHMENTS - pendingAttachments.length
      if (remainingSlots <= 0) {
        console.warn('[ChatInput] 已达到最大附件数量')
        return
      }

      const filesToProcess = result.filePaths.slice(0, remainingSlots)
      const newAttachments: Attachment[] = []

      for (const filePath of filesToProcess) {
        try {
          const fileData = await window.electronAPI.file.readAsBase64(filePath)

          // 验证文件大小
          if (fileData.size > MAX_FILE_SIZE) {
            console.warn(`[ChatInput] 文件过大: ${fileData.fileName} (${fileData.size} 字节)`)
            continue
          }

          // 验证文件类型（允许列表内的 MIME 或任意 text/* 类型）
          if (!ALLOWED_FILE_TYPES.includes(fileData.mimeType) && !fileData.mimeType.startsWith('text/')) {
            console.warn(`[ChatInput] 不支持的文件类型: ${fileData.mimeType}`)
            continue
          }

          const isImage = fileData.mimeType.startsWith('image/')
          const attachment: Attachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: fileData.fileName,
            mimeType: fileData.mimeType,
            content: fileData.content,
            size: fileData.size,
            preview: isImage ? `data:${fileData.mimeType};base64,${fileData.content}` : undefined,
          }

          newAttachments.push(attachment)
          console.log('[ChatInput] 添加附件:', attachment.fileName)
        } catch (error) {
          console.error('[ChatInput] 读取文件失败:', filePath, error)
        }
      }

      if (newAttachments.length > 0) {
        setPendingAttachments((prev) => [...prev, ...newAttachments])
      }
    } catch (error) {
      console.error('[ChatInput] 文件选择失败:', error)
    }
  }, [pendingAttachments.length])

  /**
   * 移除附件
   */
  const handleRemoveAttachment = useCallback((id: string) => {
    console.log('[ChatInput] 移除附件:', id)
    setPendingAttachments((prev) => prev.filter((att) => att.id !== id))
  }, [])

  /**
   * 发送消息
   * 不再阻止 isLoading 状态下的发送，父级 ChatView 负责路由：
   * 空闲时直接发送，agent 执行中自动加入队列
   */
  const handleSend = useCallback(() => {
    if ((!inputValue.trim() && pendingAttachments.length === 0) || !isConnected) {
      return
    }

    // 转换附件格式（不发送 preview 字段，避免消息体过大）
    const attachments: MessageAttachment[] = pendingAttachments.map((att) => ({
      type: att.mimeType.startsWith('image/') ? 'image' : 'file',
      mimeType: att.mimeType,
      fileName: att.fileName,
      content: att.content,
    }))

    console.log('[ChatInput] 发送消息, isLoading:', isLoading, 'queueLength:', queueLength)
    onSend(inputValue.trim(), attachments)
    setInputValue('')
    setPendingAttachments([])
  }, [inputValue, pendingAttachments, isConnected, isLoading, queueLength, onSend])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="input-container">
      {!isConnected && (
        <div className="connection-hint">请先连接 Gateway 后再发送消息</div>
      )}

      {/* 附件预览 */}
      {pendingAttachments.length > 0 && (
        <AttachmentPreview
          attachments={pendingAttachments}
          onRemove={handleRemoveAttachment}
          disabled={isLoading}
        />
      )}

      <div className="input-wrapper">
        {/* 附件按钮 */}
        <button
          className="attachment-button"
          onClick={handleFileSelect}
          disabled={!isConnected || isLoading || pendingAttachments.length >= MAX_ATTACHMENTS}
          title={pendingAttachments.length >= MAX_ATTACHMENTS ? `最多 ${MAX_ATTACHMENTS} 个附件` : '添加文件'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15.7 5.3l-6.4 6.4c-1.2 1.2-3.1 1.2-4.2 0-1.2-1.2-1.2-3.1 0-4.2L11.5 1c.8-.8 2-.8 2.8 0 .8.8.8 2 0 2.8L8 10.1c-.4.4-1 .4-1.4 0-.4-.4-.4-1 0-1.4l5.7-5.7-.7-.7-5.7 5.7c-.8.8-.8 2 0 2.8.8.8 2 .8 2.8 0l6.4-6.4c1.2-1.2 1.2-3.1 0-4.2-1.2-1.2-3.1-1.2-4.2 0L4.4 6.7c-1.6 1.6-1.6 4.1 0 5.7 1.6 1.6 4.1 1.6 5.7 0l6.4-6.4-.7-.7z"/>
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          className="message-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !isConnected
              ? '未连接 Gateway'
              : isLoading
                ? '输入消息加入队列... (Enter 发送, Shift+Enter 换行)'
                : '输入消息... (Enter 发送, Shift+Enter 换行)'
          }
          disabled={!isConnected}
          rows={1}
        />

        {/* 发送/停止/排队按钮 */}
        {isLoading && onAbort ? (
          <div className="input-actions">
            {/* 排队发送按钮 */}
            <button
              className="send-button queue-send"
              onClick={handleSend}
              disabled={!isConnected || (!inputValue.trim() && pendingAttachments.length === 0)}
              title="加入队列 (Enter)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z" />
              </svg>
            </button>
            {/* 停止生成按钮 */}
            <button
              className="stop-button"
              onClick={onAbort}
              title="停止生成"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="4" y="4" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            className="send-button"
            onClick={handleSend}
            disabled={!isConnected || (!inputValue.trim() && pendingAttachments.length === 0)}
            title="发送消息 (Enter)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.01 18L20 10 2.01 2 2 8l12 2-12 2z" />
            </svg>
          </button>
        )}
      </div>

      <div className="input-hint">
        <span>Shift + Enter 换行</span>
        <span>
          {queueLength > 0 && `${queueLength} 条排队 | `}
          {pendingAttachments.length > 0 && `${pendingAttachments.length} 个附件 | `}
          共 {sessionCount} 个对话
        </span>
      </div>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'
