/**
 * ChatView Component - 对话视图
 *
 * 与 AI 助手进行对话的主界面
 * 支持 Markdown 渲染、代码复制、消息历史持久化、会话管理、流式响应等功能
 *
 * 性能优化:
 * - 使用 React.memo 避免不必要的重渲染
 * - 使用 useMemo 缓存 Markdown 渲染结果
 * - 使用 useCallback 稳定回调引用
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { useChatHistory, type ChatMessage, type ChatSession, type MessageAttachment } from '../hooks/useChatHistory'
import { useChatStream, type ChatEventPayload } from '../hooks/useChatStream'
import { AttachmentPreview, type Attachment } from './AttachmentPreview'
import './ChatView.css'

/**
 * 最大附件数量
 */
const MAX_ATTACHMENTS = 5

/**
 * 最大单个文件大小 (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * 允许的图片类型
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

interface ChatViewProps {
  isConnected: boolean
}

/**
 * 简单的 Markdown 渲染
 * 支持代码块、粗体、斜体、链接等基础语法
 */
function renderMarkdownContent(text: string): React.ReactNode {
  // 处理代码块 (```code```)
  const parts = text.split(/(```[\s\S]*?```)/g)

  return parts.map((part, index) => {
    // 代码块处理
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeContent = part.slice(3, -3)
      const firstNewline = codeContent.indexOf('\n')
      let language = ''
      let code = codeContent

      if (firstNewline > 0 && firstNewline < 20) {
        language = codeContent.slice(0, firstNewline).trim()
        code = codeContent.slice(firstNewline + 1)
      }

      return (
        <CodeBlock key={index} language={language} code={code} />
      )
    }

    // 行内代码处理 (`code`)
    const inlineParts = part.split(/(`[^`]+`)/g)
    return (
      <span key={index}>
        {inlineParts.map((inlinePart, inlineIndex) => {
          if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
            return (
              <code key={inlineIndex} className="inline-code">
                {inlinePart.slice(1, -1)}
              </code>
            )
          }

          // 处理粗体 (**text**)
          const boldParts = inlinePart.split(/(\*\*[^*]+\*\*)/g)
          return boldParts.map((boldPart, boldIndex) => {
            if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
              return <strong key={`${inlineIndex}-${boldIndex}`}>{boldPart.slice(2, -2)}</strong>
            }
            return <span key={`${inlineIndex}-${boldIndex}`}>{boldPart}</span>
          })
        })}
      </span>
    )
  })
}

/**
 * 代码块组件 - 带复制功能
 * 使用 React.memo 优化，避免不必要的重渲染
 */
const CodeBlock = memo<{ language: string; code: string }>(({ language, code }) => {
  const [copied, setCopied] = useState(false)

  /**
   * 复制代码到剪贴板
   */
  const handleCopy = useCallback(async () => {
    try {
      await window.electronAPI.clipboard.writeText(code)
      setCopied(true)
      console.log('[CodeBlock] 代码已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[CodeBlock] 复制失败:', error)
    }
  }, [code])

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{language || 'code'}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <pre className="code-block-content">
        <code>{code}</code>
      </pre>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'

/**
 * 缓存的 Markdown 渲染组件
 * 使用 useMemo 缓存渲染结果，避免重复计算
 */
const MemoizedMarkdown = memo<{ content: string }>(({ content }) => {
  const rendered = useMemo(() => renderMarkdownContent(content), [content])
  return <>{rendered}</>
})

MemoizedMarkdown.displayName = 'MemoizedMarkdown'

/**
 * 单条消息组件
 * 使用 memo 避免列表重渲染时的性能问题
 */
const MessageItem = memo<{
  message: ChatMessage
  formatTime: (date: Date) => string
}>(({ message, formatTime }) => {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️'}
      </div>
      <div className="message-content">
        {/* 显示附件图片 */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, index) => (
              <div key={index} className="message-attachment">
                {att.type === 'image' || att.mimeType.startsWith('image/') ? (
                  <img
                    src={att.preview || `data:${att.mimeType};base64,${att.content}`}
                    alt={att.fileName}
                    className="message-attachment-image"
                  />
                ) : (
                  <div className="message-attachment-file">
                    <span className="message-attachment-icon">📄</span>
                    <span className="message-attachment-name">{att.fileName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="message-text">
          {message.role === 'assistant'
            ? <MemoizedMarkdown content={message.content} />
            : message.content}
          {message.isStreaming && <span className="cursor-blink">▋</span>}
        </div>
        <div className="message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'

/**
 * 会话列表侧边栏
 * 使用 memo 避免父组件重渲染时不必要的更新
 */
const SessionSidebar = memo<{
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}>(({ sessions, activeSessionId, onSelect, onNew, onDelete, onRename }) => {
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

  /**
   * 格式化日期
   */
  const formatDate = (date: Date): string => {
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

  return (
    <div className="session-sidebar">
      <div className="session-sidebar-header">
        <h3>对话历史</h3>
        <button className="new-session-btn" onClick={onNew} title="新建对话">
          +
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="no-sessions">暂无历史对话</div>
        ) : (
          sessions.map((session) => (
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
                    <span className="session-title">{session.title}</span>
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
          ))
        )}
      </div>
    </div>
  )
})

SessionSidebar.displayName = 'SessionSidebar'

/**
 * 生成消息 ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 对话视图组件
 */
export const ChatView: React.FC<ChatViewProps> = ({ isConnected }) => {
  const {
    sessions,
    activeSession,
    activeSessionId,
    currentMessages,
    isLoading: isLoadingHistory,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    clearCurrentSession,
    addMessage,
    updateMessage,
  } = useChatHistory()

  // 流式响应 Hook
  const { streamingMessage, isStreaming: isStreamingResponse, startStream, reset: resetStream } = useChatStream()

  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 滚动到最新消息
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentMessages, scrollToBottom])

  /**
   * 监听流式响应更新，同步到消息
   */
  useEffect(() => {
    if (!streamingMessage || !currentAssistantMessageId) {
      return
    }

    // 检查 runId 是否匹配
    if (streamingMessage.runId !== currentRunId) {
      return
    }

    // 更新助手消息内容
    updateMessage(currentAssistantMessageId, {
      content: streamingMessage.content || '',
      isStreaming: streamingMessage.isStreaming,
    })

    // 流式完成后清理状态
    if (streamingMessage.isComplete) {
      console.log('[ChatView] 流式响应完成')
      setIsLoading(false)
      setCurrentRunId(null)
      setCurrentAssistantMessageId(null)

      // 处理错误情况
      if (streamingMessage.error) {
        updateMessage(currentAssistantMessageId, {
          content: `错误: ${streamingMessage.error}`,
          role: 'system',
          isStreaming: false,
        })
      }
    }
  }, [streamingMessage, currentAssistantMessageId, currentRunId, updateMessage])

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
   * 处理新建会话
   */
  const handleNewSession = useCallback(() => {
    console.log('[ChatView] 创建新会话')
    createSession()
    setPendingAttachments([])
  }, [createSession])

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        ],
      })

      if (result.canceled || !result.filePaths.length) {
        return
      }

      console.log('[ChatView] 选择的文件:', result.filePaths)

      // 检查附件数量限制
      const remainingSlots = MAX_ATTACHMENTS - pendingAttachments.length
      if (remainingSlots <= 0) {
        console.warn('[ChatView] 已达到最大附件数量')
        return
      }

      const filesToProcess = result.filePaths.slice(0, remainingSlots)
      const newAttachments: Attachment[] = []

      for (const filePath of filesToProcess) {
        try {
          const fileData = await window.electronAPI.file.readAsBase64(filePath)

          // 验证文件大小
          if (fileData.size > MAX_FILE_SIZE) {
            console.warn(`[ChatView] 文件过大: ${fileData.fileName} (${fileData.size} 字节)`)
            continue
          }

          // 验证文件类型
          if (!ALLOWED_IMAGE_TYPES.includes(fileData.mimeType)) {
            console.warn(`[ChatView] 不支持的文件类型: ${fileData.mimeType}`)
            continue
          }

          const attachment: Attachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: fileData.fileName,
            mimeType: fileData.mimeType,
            content: fileData.content,
            size: fileData.size,
            preview: `data:${fileData.mimeType};base64,${fileData.content}`,
          }

          newAttachments.push(attachment)
          console.log('[ChatView] 添加附件:', attachment.fileName)
        } catch (error) {
          console.error('[ChatView] 读取文件失败:', filePath, error)
        }
      }

      if (newAttachments.length > 0) {
        setPendingAttachments((prev) => [...prev, ...newAttachments])
      }
    } catch (error) {
      console.error('[ChatView] 文件选择失败:', error)
    }
  }, [pendingAttachments.length])

  /**
   * 移除附件
   */
  const handleRemoveAttachment = useCallback((id: string) => {
    console.log('[ChatView] 移除附件:', id)
    setPendingAttachments((prev) => prev.filter((att) => att.id !== id))
  }, [])

  /**
   * 发送消息 - 使用 chat.send 方法支持流式响应和附件
   */
  const handleSend = useCallback(async () => {
    if ((!inputValue.trim() && pendingAttachments.length === 0) || !isConnected || isLoading) {
      return
    }

    // 如果没有激活会话，创建一个新的
    let sessionKey: string = activeSessionId || ''
    if (!sessionKey) {
      const newSession = createSession()
      sessionKey = newSession.id
    }

    // 转换附件格式
    const attachments: MessageAttachment[] = pendingAttachments.map((att) => ({
      type: att.mimeType.startsWith('image/') ? 'image' : 'file',
      mimeType: att.mimeType,
      fileName: att.fileName,
      content: att.content,
      preview: att.preview,
    }))

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }

    console.log('[ChatView] 发送消息:', userMessage.content, '附件数量:', attachments.length)
    addMessage(userMessage)
    setInputValue('')
    setPendingAttachments([])
    setIsLoading(true)

    // 生成运行 ID（用于匹配流式响应）
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setCurrentRunId(runId)

    // 添加一个空的助手消息用于流式输出
    const assistantMessageId = generateMessageId()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }
    addMessage(assistantMessage)
    setCurrentAssistantMessageId(assistantMessageId)

    // 启动流式消息监听
    startStream(runId, sessionKey)

    try {
      // 尝试使用 chat.send 方法（支持流式响应）
      console.log('[ChatView] 调用 chat.send:', { sessionKey, runId })
      await window.electronAPI.gateway.call('chat.send', {
        sessionKey,
        message: userMessage.content,
        idempotencyKey: runId,
        attachments: attachments.length > 0 ? attachments : undefined,
      })

      console.log('[ChatView] chat.send 调用成功，等待流式响应')
      // 流式响应会通过 useChatStream hook 处理
    } catch (error: unknown) {
      console.warn('[ChatView] chat.send 失败，回退到 assistant.chat:', error)

      // 回退到原有的 assistant.chat 方法
      try {
        const response = await window.electronAPI.gateway.call<{
          content: string
          sessionId: string
          timestamp: number
        }>('assistant.chat', {
          message: userMessage.content,
          sessionId: sessionKey,
          attachments: attachments.length > 0 ? attachments : undefined,
        })

        console.log('[ChatView] 收到响应:', response)

        // 更新助手消息
        updateMessage(assistantMessageId, {
          content: response.content || '抱歉，我没有收到有效的回复。',
          isStreaming: false,
        })
        setIsLoading(false)
        setCurrentRunId(null)
        setCurrentAssistantMessageId(null)
      } catch (fallbackError) {
        console.error('[ChatView] assistant.chat 也失败:', fallbackError)

        // 更新为错误消息
        updateMessage(assistantMessageId, {
          content: '消息发送失败，请检查连接状态后重试。',
          role: 'system',
          isStreaming: false,
        })
        setIsLoading(false)
        setCurrentRunId(null)
        setCurrentAssistantMessageId(null)
      }
    }
  }, [inputValue, pendingAttachments, isConnected, isLoading, activeSessionId, createSession, addMessage, updateMessage, startStream])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  /**
   * 格式化时间 - 使用 useCallback 稳定引用
   */
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  if (isLoadingHistory) {
    return (
      <div className="chat-view loading">
        <div className="loading-message">
          <span className="spinner">⏳</span>
          <p>加载对话历史...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      {/* 会话侧边栏 */}
      {showSidebar && (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={switchSession}
          onNew={handleNewSession}
          onDelete={deleteSession}
          onRename={renameSession}
        />
      )}

      {/* 主对话区域 */}
      <div className="chat-main">
        {/* 对话工具栏 */}
        <div className="chat-toolbar">
          <div className="chat-toolbar-left">
            <button
              className="toolbar-button toggle-sidebar"
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
            >
              {showSidebar ? '◀' : '▶'}
            </button>
            <span className="chat-title">
              {activeSession?.title || 'AI 助手对话'}
            </span>
          </div>
          <div className="chat-toolbar-right">
            <button
              className="toolbar-button"
              onClick={handleNewSession}
              title="新建对话"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a1 1 0 011 1v5h5a1 1 0 110 2H9v5a1 1 0 11-2 0V9H2a1 1 0 110-2h5V2a1 1 0 011-1z"/>
              </svg>
              新对话
            </button>
            <button
              className="toolbar-button"
              onClick={clearCurrentSession}
              title="清空当前对话"
              disabled={currentMessages.length <= 1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z"/>
              </svg>
              清空
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="messages-container">
          {currentMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              formatTime={formatTime}
            />
          ))}

          {isLoading && currentMessages[currentMessages.length - 1]?.content === '' && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
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
              title={pendingAttachments.length >= MAX_ATTACHMENTS ? `最多 ${MAX_ATTACHMENTS} 个附件` : '添加图片'}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              className="message-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? '输入消息... (Enter 发送, Shift+Enter 换行)' : '未连接 Gateway'}
              disabled={!isConnected || isLoading}
              rows={1}
            />

            <button
              className="send-button"
              onClick={handleSend}
              disabled={!isConnected || (!inputValue.trim() && pendingAttachments.length === 0) || isLoading}
              title="发送消息 (Enter)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.01 18L20 10 2.01 2 2 8l12 2-12 2z" />
              </svg>
            </button>
          </div>

          <div className="input-hint">
            <span>Shift + Enter 换行</span>
            <span>
              {pendingAttachments.length > 0 && `${pendingAttachments.length} 个附件 | `}
              共 {sessions.length} 个对话
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
