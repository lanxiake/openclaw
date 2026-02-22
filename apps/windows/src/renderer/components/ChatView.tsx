/**
 * ChatView - 对话视图 Orchestrator
 *
 * 编排对话界面各子组件：SessionSidebar、ChatToolbar、MessageItem、ChatInput
 * 管理会话状态、流式响应、消息发送、消息排队等核心逻辑
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChatHistory, type ChatMessage, type MessageAttachment } from '../hooks/useChatHistory'
import { useChatStream } from '../hooks/useChatStream'
import { useToolStream } from '../hooks/useToolStream'
import { useAgentTodo } from '../hooks/useAgentTodo'
import { useMessageQueue, type QueuedMessage } from '../hooks/useMessageQueue'
import { useChatCheckpoint } from '../hooks/useChatCheckpoint'
import { SessionSidebar, ChatToolbar, ChatInput, MessageItem, AgentTodoList, MessageQueuePanel, CheckpointResumeDialog } from './chat'
import './ChatView.css'

interface ChatViewProps {
  isConnected: boolean
}

/**
 * 生成消息唯一 ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 对话视图组件 - 顶层 orchestrator
 */
export const ChatView: React.FC<ChatViewProps> = ({ isConnected }) => {
  const {
    sessions,
    activeSession,
    activeSessionId,
    currentMessages,
    isLoading: isLoadingHistory,
    isSyncing,
    isLoadingMessages,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    clearCurrentSession,
    addMessage,
    updateMessage,
    syncSessionsFromServer,
    loadServerMessages,
  } = useChatHistory()

  const { streamingMessage, startStream } = useChatStream()
  const { getToolCalls } = useToolStream()
  const { todos, completedCount, totalCount } = useAgentTodo()
  const { queue, queueLength, enqueue, dequeue, remove: removeFromQueue, clear: clearQueue } = useMessageQueue()
  const {
    checkpoints,
    isLoading: isLoadingCheckpoints,
    error: checkpointError,
    saveCheckpoint,
    resumeFromCheckpoint,
    loadCheckpoints,
    clearError: clearCheckpointError,
  } = useChatCheckpoint()

  const [isLoading, setIsLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
   * 连接 Gateway 后自动同步服务端会话列表
   */
  const hasSyncedRef = useRef(false)
  useEffect(() => {
    if (isConnected && !hasSyncedRef.current) {
      hasSyncedRef.current = true
      console.log('[ChatView] Gateway 已连接，同步服务端会话列表')
      syncSessionsFromServer().then((count) => {
        console.log('[ChatView] 同步完成，获取', count, '个服务端会话')
      })
    }
    if (!isConnected) {
      hasSyncedRef.current = false
    }
  }, [isConnected, syncSessionsFromServer])

  /**
   * 切换到服务端会话时自动加载消息历史
   */
  useEffect(() => {
    if (!activeSession) return
    if (activeSession.source === 'server' && !activeSession.messagesLoaded) {
      console.log('[ChatView] 切换到服务端会话，加载消息历史:', activeSession.id)
      loadServerMessages(activeSession.id)
    }
  }, [activeSessionId, activeSession, loadServerMessages])

  /**
   * 发送消息到 Gateway 的核心逻辑
   * 不包含排队判断，直接执行发送
   */
  const doSend = useCallback(async (content: string, attachments: MessageAttachment[]) => {
    if (!isConnected) return

    let sessionKey: string = activeSessionId || ''
    if (!sessionKey) {
      const newSession = createSession()
      sessionKey = newSession.id
    }

    if (activeSession?.source === 'server' && activeSession.serverKey) {
      sessionKey = activeSession.serverKey
    }

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }

    console.log('[ChatView] 发送消息:', userMessage.content, '附件数量:', attachments.length)
    addMessage(userMessage)
    setIsLoading(true)

    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setCurrentRunId(runId)

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

    startStream(runId, sessionKey)

    try {
      console.log('[ChatView] 调用 chat.send:', {
        sessionKey,
        runId,
        attachmentCount: attachments.length,
        attachmentTotalSize: attachments.reduce((sum, a) => sum + (a.content?.length ?? 0), 0),
      })
      await window.electronAPI.gateway.call('chat.send', {
        sessionKey,
        message: content,
        idempotencyKey: runId,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      console.log('[ChatView] chat.send 调用成功，等待流式响应')
    } catch (error: unknown) {
      console.warn('[ChatView] chat.send 失败，回退到 assistant.chat:', error)

      try {
        const response = await window.electronAPI.gateway.call<{
          content: string
          sessionId: string
          timestamp: number
        }>('assistant.chat', {
          message: content,
          sessionId: sessionKey,
          attachments: attachments.length > 0 ? attachments : undefined,
        })

        console.log('[ChatView] 收到响应:', response)
        updateMessage(assistantMessageId, {
          content: response.content || '抱歉，我没有收到有效的回复。',
          isStreaming: false,
        })
        setIsLoading(false)
        setCurrentRunId(null)
        setCurrentAssistantMessageId(null)
      } catch (fallbackError) {
        console.error('[ChatView] assistant.chat 也失败:', fallbackError)
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
  }, [isConnected, activeSessionId, activeSession, createSession, addMessage, updateMessage, startStream])

  /**
   * 监听流式响应更新，同步到消息
   * 当 run 完成后，自动从队列中取出下一条消息发送
   */
  useEffect(() => {
    if (!streamingMessage || !currentAssistantMessageId) {
      return
    }

    if (streamingMessage.runId !== currentRunId) {
      return
    }

    if (streamingMessage.isComplete) {
      console.log('[ChatView] 流式响应完成, isAborted:', streamingMessage.isAborted)
      setIsLoading(false)
      setCurrentRunId(null)
      setCurrentAssistantMessageId(null)

      if (streamingMessage.isAborted) {
        const pending = pendingSendImmediatelyRef.current
        const isSendImmediatelyAbort = pending !== null

        /** 中断完成：仅在用户手动中断时标记 isAborted，立即发送引起的中断不标记 */
        updateMessage(currentAssistantMessageId, {
          content: streamingMessage.content || '',
          isStreaming: false,
          isAborted: !isSendImmediatelyAbort,
        })

        if (pending) {
          console.log('[ChatView] 中断完成，发送暂存的立即发送消息:', pending.content)
          pendingSendImmediatelyRef.current = null
          clearSendImmediatelyTimeout()
          queueMicrotask(() => {
            doSend(pending.content, pending.attachments)
          })
        }
      } else if (streamingMessage.error) {
        updateMessage(currentAssistantMessageId, {
          content: `错误: ${streamingMessage.error}`,
          role: 'system',
          isStreaming: false,
        })
      } else {
        /** 正常完成 */
        updateMessage(currentAssistantMessageId, {
          content: streamingMessage.content || '',
          isStreaming: false,
        })
      }

      /** 自动派发队列中的下一条消息（中断时不自动派发，除非有暂存的立即发送消息） */
      if (!streamingMessage.isAborted) {
        const next = dequeue()
        if (next) {
          console.log('[ChatView] 自动派发队列消息:', next.content)
          queueMicrotask(() => {
            doSend(next.content, next.attachments)
          })
        }
      }
    } else {
      /** 仍在流式传输中，更新消息内容 */
      updateMessage(currentAssistantMessageId, {
        content: streamingMessage.content || '',
        isStreaming: streamingMessage.isStreaming,
      })
    }
  }, [streamingMessage, currentAssistantMessageId, currentRunId, updateMessage, dequeue, doSend])

  /**
   * 处理新建会话
   */
  const handleNewSession = useCallback(() => {
    console.log('[ChatView] 创建新会话')
    createSession()
  }, [createSession])

  /**
   * 中断当前执行
   * @returns 是否成功发送中断请求
   */
  const handleAbort = useCallback(async (): Promise<boolean> => {
    if (!currentRunId || !activeSessionId) return false

    const sessionKey = activeSession?.source === 'server' && activeSession.serverKey
      ? activeSession.serverKey
      : activeSessionId

    try {
      console.log('[ChatView] 中断执行:', { sessionKey, runId: currentRunId })
      await window.electronAPI.gateway.call('chat.abort', {
        sessionKey,
        runId: currentRunId,
      })
      console.log('[ChatView] 中断请求已发送')
      return true
    } catch (error) {
      console.error('[ChatView] 中断失败:', error)
      return false
    }
  }, [currentRunId, activeSessionId, activeSession])

  /**
   * 立即发送队列中的指定消息
   *
   * 流程：中断当前对话 → 从队列移除 → 等待中断完成 → 发送消息
   * 使用 ref 暂存待发送消息，由 streamingMessage effect 在中断完成时触发实际发送。
   * 包含 5 秒超时兜底：若 abort 事件未到达，直接发送暂存消息。
   */
  const pendingSendImmediatelyRef = useRef<QueuedMessage | null>(null)
  const sendImmediatelyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 清理超时定时器 */
  const clearSendImmediatelyTimeout = useCallback(() => {
    if (sendImmediatelyTimeoutRef.current) {
      clearTimeout(sendImmediatelyTimeoutRef.current)
      sendImmediatelyTimeoutRef.current = null
    }
  }, [])

  /** session 切换或组件卸载时清理暂存状态 */
  useEffect(() => {
    pendingSendImmediatelyRef.current = null
    clearSendImmediatelyTimeout()
  }, [activeSessionId, clearSendImmediatelyTimeout])

  const handleSendImmediately = useCallback(async (target: QueuedMessage) => {
    console.log('[ChatView] 立即发送：中断当前对话并发送消息:', target.content)

    /** 从队列移除 */
    removeFromQueue(target.id)

    if (!isLoading) {
      /** 未在执行中，直接发送 */
      await doSend(target.content, target.attachments)
      return
    }

    /** 暂存消息到 ref，等中断完成后由 effect 发送 */
    pendingSendImmediatelyRef.current = { ...target }

    /** 设置 5 秒超时兜底：若中断事件未到达则直接发送 */
    clearSendImmediatelyTimeout()
    sendImmediatelyTimeoutRef.current = setTimeout(() => {
      const pending = pendingSendImmediatelyRef.current
      if (pending) {
        console.warn('[ChatView] 立即发送超时兜底：中断事件未到达，直接发送消息')
        pendingSendImmediatelyRef.current = null
        doSend(pending.content, pending.attachments)
      }
    }, 5000)

    /** 中断当前执行；若 abort 失败则清除 ref 直接发送 */
    const aborted = await handleAbort()
    if (!aborted) {
      console.warn('[ChatView] 立即发送：中断失败，直接发送消息')
      pendingSendImmediatelyRef.current = null
      clearSendImmediatelyTimeout()
      await doSend(target.content, target.attachments)
    }
  }, [isLoading, handleAbort, removeFromQueue, doSend, clearSendImmediatelyTimeout])

  /**
   * 存档并停止：保存检查点后中断执行
   */
  const handleCheckpoint = useCallback(async () => {
    if (!activeSessionId) return

    const sessionKey = activeSession?.source === 'server' && activeSession.serverKey
      ? activeSession.serverKey
      : activeSessionId

    console.log('[ChatView] 存档并停止:', sessionKey)
    const checkpoint = await saveCheckpoint(sessionKey)
    if (checkpoint) {
      console.log('[ChatView] 检查点已保存:', checkpoint.checkpointId)
      // 保存成功后中断执行
      await handleAbort()
    }
  }, [activeSessionId, activeSession, saveCheckpoint, handleAbort])

  /**
   * 打开恢复对话框并加载检查点列表
   */
  const handleShowResumeDialog = useCallback(() => {
    if (!activeSessionId) return

    const sessionKey = activeSession?.source === 'server' && activeSession.serverKey
      ? activeSession.serverKey
      : activeSessionId

    console.log('[ChatView] 打开恢复对话框:', sessionKey)
    setShowResumeDialog(true)
    loadCheckpoints(sessionKey)
  }, [activeSessionId, activeSession, loadCheckpoints])

  /**
   * 从检查点恢复对话
   */
  const handleResumeFromCheckpoint = useCallback(async (checkpointId: string) => {
    if (!activeSessionId) return

    const sessionKey = activeSession?.source === 'server' && activeSession.serverKey
      ? activeSession.serverKey
      : activeSessionId

    console.log('[ChatView] 从检查点恢复:', { sessionKey, checkpointId })
    const success = await resumeFromCheckpoint(sessionKey, checkpointId)
    if (success) {
      setShowResumeDialog(false)
      console.log('[ChatView] 恢复成功')
    }
  }, [activeSessionId, activeSession, resumeFromCheckpoint])

  /**
   * 处理用户发送消息
   *
   * 逻辑：
   * 1. 空闲时 + 队列有消息 → 先出队发送队列头部消息，当前输入加入队列尾部
   * 2. 空闲时 + 队列为空 → 直接发送
   * 3. 执行中 → 加入队列
   */
  const handleSend = useCallback(async (content: string, attachments: MessageAttachment[]) => {
    if (!isConnected) return

    if (isLoading) {
      /** agent 正在执行，加入队列 */
      console.log('[ChatView] Agent 执行中，消息加入队列:', content)
      enqueue(content, attachments)
      return
    }

    /** 空闲时检查队列，有排队消息则优先发送队首 */
    if (queueLength > 0) {
      console.log('[ChatView] 队列有待发送消息，优先发送队首，当前输入入队')
      enqueue(content, attachments)
      const next = dequeue()
      if (next) {
        await doSend(next.content, next.attachments)
      }
      return
    }

    await doSend(content, attachments)
  }, [isConnected, isLoading, queueLength, enqueue, dequeue, doSend])

  /**
   * 格式化时间
   */
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  /** 加载状态 */
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
          isSyncing={isSyncing}
          onSelect={switchSession}
          onNew={handleNewSession}
          onDelete={deleteSession}
          onRename={renameSession}
        />
      )}

      {/* 主对话区域 */}
      <div className="chat-main">
        {/* 对话工具栏 */}
        <ChatToolbar
          title={activeSession?.title || 'AI 助手对话'}
          showSidebar={showSidebar}
          canClear={currentMessages.length > 1}
          isLoading={isLoading}
          hasCheckpoints={checkpoints.length > 0}
          onToggleSidebar={() => setShowSidebar((prev) => !prev)}
          onNewSession={handleNewSession}
          onClear={clearCurrentSession}
          onCheckpoint={handleCheckpoint}
          onShowResumeDialog={handleShowResumeDialog}
        />

        {/* 消息列表 */}
        <div className="messages-container">
          {isLoadingMessages && (
            <div className="messages-loading-overlay">
              <div className="loading-message">
                <span className="spinner">&#8987;</span>
                <p>加载服务端消息...</p>
              </div>
            </div>
          )}

          {currentMessages.map((message) => {
            const messageToolCalls =
              currentRunId && message.id === currentAssistantMessageId
                ? getToolCalls(currentRunId)
                : undefined

            return (
              <MessageItem
                key={message.id}
                message={message}
                formatTime={formatTime}
                toolCalls={messageToolCalls}
              />
            )
          })}

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

        {/* Agent 任务列表 */}
        <AgentTodoList
          todos={todos}
          completedCount={completedCount}
          totalCount={totalCount}
        />

        {/* 消息排队面板 */}
        <MessageQueuePanel
          queue={queue}
          isLoading={isLoading}
          onRemove={removeFromQueue}
          onClear={clearQueue}
          onSendImmediately={handleSendImmediately}
        />

        {/* 输入区域 */}
        <ChatInput
          isConnected={isConnected}
          isLoading={isLoading}
          sessionCount={sessions.length}
          queueLength={queueLength}
          onSend={handleSend}
          onAbort={handleAbort}
        />
      </div>

      {/* 检查点恢复对话框 */}
      <CheckpointResumeDialog
        isOpen={showResumeDialog}
        checkpoints={checkpoints}
        isLoading={isLoadingCheckpoints}
        error={checkpointError}
        onResume={handleResumeFromCheckpoint}
        onClose={() => {
          setShowResumeDialog(false)
          clearCheckpointError()
        }}
      />
    </div>
  )
}
