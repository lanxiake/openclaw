/**
 * MessageItem - 单条消息组件
 *
 * 渲染对话中的单条消息，支持 Markdown、代码块、附件和工具调用展示
 * 使用 React.memo 避免列表重渲染时的性能问题
 */

import React, { useState, useCallback, useMemo, memo } from 'react'
import type { ChatMessage, MessageAttachment } from '../../hooks/useChatHistory'
import type { ToolCall } from '../../hooks/useToolStream'
import { ToolCallBlock } from '../ToolCallBlock'
import './MessageItem.css'

/**
 * 简单的 Markdown 渲染
 * 支持代码块、行内代码、粗体等基础语法
 */
function renderMarkdownContent(text: string): React.ReactNode {
  // 防御性检查：确保 text 是字符串
  if (typeof text !== 'string') {
    console.warn('[MessageItem] renderMarkdownContent 收到非字符串内容:', typeof text)
    return String(text ?? '')
  }
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
const CodeBlock = memo<{ language: string; code: string }>(({ language, code }) => {
  const [copied, setCopied] = useState(false)

  /**
   * 复制代码到剪贴板
   */
  const handleCopy = useCallback(async () => {
    try {
      await window.electronAPI.clipboard.writeText(code)
      setCopied(true)
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
 */
const MemoizedMarkdown = memo<{ content: string }>(({ content }) => {
  const rendered = useMemo(() => renderMarkdownContent(content), [content])
  return <>{rendered}</>
})

MemoizedMarkdown.displayName = 'MemoizedMarkdown'

/**
 * MessageItem Props
 */
interface MessageItemProps {
  /** 消息数据 */
  message: ChatMessage
  /** 时间格式化函数 */
  formatTime: (date: Date) => string
  /** 关联的工具调用列表 */
  toolCalls?: ToolCall[]
}

/**
 * 单条消息组件
 */
export const MessageItem = memo<MessageItemProps>(({ message, formatTime, toolCalls }) => {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️'}
      </div>
      <div className="message-content">
        {/* 显示附件 */}
        {message.attachments && message.attachments.length > 0 && (
          <MessageAttachments attachments={message.attachments} />
        )}

        {/* Tool 调用可视化 - 显示在 assistant 消息文本之前 */}
        {message.role === 'assistant' && toolCalls && toolCalls.length > 0 && (
          <ToolCallBlock toolCalls={toolCalls} />
        )}

        <div className="message-text">
          {message.role === 'assistant'
            ? <MemoizedMarkdown content={message.content} />
            : message.content}
          {message.isStreaming && <span className="cursor-blink">▋</span>}
          {message.isAborted && (
            <span className="message-aborted-label">[已中断]</span>
          )}
        </div>
        <div className="message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'

/**
 * 消息内附件展示
 */
const MessageAttachments = memo<{ attachments: MessageAttachment[] }>(({ attachments }) => {
  return (
    <div className="message-attachments">
      {attachments.map((att, index) => (
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
  )
})

MessageAttachments.displayName = 'MessageAttachments'
