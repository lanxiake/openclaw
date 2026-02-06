/**
 * ChatView Component - 对话视图
 *
 * 与 AI 助手进行对话的主界面
 * 支持 Markdown 渲染、代码复制、消息历史等功能
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import './ChatView.css'

interface ChatViewProps {
  isConnected: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  /** 是否正在流式输出 */
  isStreaming?: boolean
}

/**
 * 简单的 Markdown 渲染
 * 支持代码块、粗体、斜体、链接等基础语法
 */
function renderMarkdown(text: string): React.ReactNode {
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
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false)

  /**
   * 复制代码到剪贴板
   */
  const handleCopy = async () => {
    try {
      await window.electronAPI.clipboard.writeText(code)
      setCopied(true)
      console.log('[CodeBlock] 代码已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[CodeBlock] 复制失败:', error)
    }
  }

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
}

/**
 * 对话视图组件
 */
export const ChatView: React.FC<ChatViewProps> = ({ isConnected }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: '欢迎使用 OpenClaw Assistant！连接 Gateway 后即可开始对话。',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * 滚动到最新消息
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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
   * 生成消息 ID
   */
  const generateId = (): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 发送消息
   */
  const handleSend = async () => {
    if (!inputValue.trim() || !isConnected || isLoading) {
      return
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    console.log('[ChatView] 发送消息:', userMessage.content)
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 添加一个空的助手消息用于流式输出
    const assistantMessageId = generateId()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ])

    try {
      // 调用 Gateway API 发送消息
      const response = await window.electronAPI.gateway.call<{
        content: string
        sessionId: string
        timestamp: number
      }>('assistant.chat', {
        message: userMessage.content,
        sessionId,
      })

      console.log('[ChatView] 收到响应:', response)

      // 保存会话 ID
      if (response.sessionId && !sessionId) {
        setSessionId(response.sessionId)
      }

      // 更新助手消息
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: response.content || '抱歉，我没有收到有效的回复。',
                isStreaming: false,
              }
            : msg
        )
      )
    } catch (error) {
      console.error('[ChatView] 发送消息失败:', error)

      // 移除空的助手消息，添加错误消息
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== assistantMessageId),
        {
          id: generateId(),
          role: 'system',
          content: '消息发送失败，请检查连接状态后重试。',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 处理键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /**
   * 清空对话历史
   */
  const handleClearHistory = () => {
    console.log('[ChatView] 清空对话历史')
    setMessages([
      {
        id: generateId(),
        role: 'system',
        content: '对话已清空，开始新的对话。',
        timestamp: new Date(),
      },
    ])
    setSessionId(null)
  }

  /**
   * 格式化时间
   */
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="chat-view">
      {/* 对话工具栏 */}
      <div className="chat-toolbar">
        <div className="chat-toolbar-left">
          <span className="chat-title">AI 助手对话</span>
          {sessionId && (
            <span className="session-indicator" title={`会话 ID: ${sessionId}`}>
              会话中
            </span>
          )}
        </div>
        <div className="chat-toolbar-right">
          <button
            className="toolbar-button"
            onClick={handleClearHistory}
            title="清空对话"
            disabled={messages.length <= 1}
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
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️'}
            </div>
            <div className="message-content">
              <div className="message-text">
                {message.role === 'assistant'
                  ? renderMarkdown(message.content)
                  : message.content}
                {message.isStreaming && <span className="cursor-blink">▋</span>}
              </div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.content === '' && (
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

        <div className="input-wrapper">
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
            disabled={!isConnected || !inputValue.trim() || isLoading}
            title="发送消息 (Enter)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.01 18L20 10 2.01 2 2 8l12 2-12 2z" />
            </svg>
          </button>
        </div>

        <div className="input-hint">
          <span>Shift + Enter 换行</span>
        </div>
      </div>
    </div>
  )
}
