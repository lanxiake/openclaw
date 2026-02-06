/**
 * ChatView Component - 对话视图
 *
 * 与 AI 助手进行对话的主界面
 */

import React, { useState, useRef, useEffect } from 'react'
import './ChatView.css'

interface ChatViewProps {
  isConnected: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /**
   * 滚动到最新消息
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    if (!inputValue.trim() || !isConnected || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // 调用 Gateway API 发送消息
      const response = await window.electronAPI.gateway.call<{ content: string }>('assistant.chat', {
        message: userMessage.content,
      })

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.content || '抱歉，我没有收到有效的回复。',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('[ChatView] 发送消息失败:', error)

      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: '消息发送失败，请检查连接状态后重试。',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
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
      {/* 消息列表 */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}

        {isLoading && (
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
          <div className="connection-hint">
            请先连接 Gateway 后再发送消息
          </div>
        )}

        <div className="input-wrapper">
          <textarea
            className="message-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? '输入消息...' : '未连接 Gateway'}
            disabled={!isConnected || isLoading}
            rows={1}
          />

          <button
            className="send-button"
            onClick={handleSend}
            disabled={!isConnected || !inputValue.trim() || isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.01 18L20 10 2.01 2 2 8l12 2-12 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
