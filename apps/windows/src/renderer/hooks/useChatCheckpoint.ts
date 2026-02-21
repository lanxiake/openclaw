/**
 * useChatCheckpoint Hook - 聊天检查点管理
 *
 * 封装 Gateway 断点/恢复 RPC 调用：
 * - chat.checkpoint: 保存当前对话状态为检查点
 * - chat.resume: 从检查点恢复对话
 * - chat.listCheckpoints: 列出会话的所有检查点
 *
 * 依赖 Gateway 侧实现对应的 RPC 方法
 */

import { useState, useCallback } from 'react'

/**
 * 检查点数据结构
 */
export interface ChatCheckpoint {
  /** 检查点唯一 ID */
  checkpointId: string
  /** 关联的 runId */
  runId?: string
  /** 会话 Key */
  sessionKey: string
  /** 用户定义的名称 */
  name?: string
  /** 检查点时的消息数 */
  messageCount: number
  /** 创建时间 (ms since epoch) */
  createdAt: number
  /** 元数据 */
  metadata?: {
    /** 中断原因 */
    abortReason?: 'user_interrupt' | 'timeout' | 'error'
    /** 使用的模型 */
    model?: string
    /** Token 使用量 */
    totalTokensUsed?: number
  }
}

/**
 * Hook 返回值
 */
export interface UseChatCheckpointReturn {
  /** 当前会话的检查点列表 */
  checkpoints: ChatCheckpoint[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 保存检查点 */
  saveCheckpoint: (sessionKey: string, name?: string) => Promise<ChatCheckpoint | null>
  /** 从检查点恢复 */
  resumeFromCheckpoint: (sessionKey: string, checkpointId: string) => Promise<boolean>
  /** 加载检查点列表 */
  loadCheckpoints: (sessionKey: string) => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

/**
 * 聊天检查点管理 Hook
 *
 * 通过 Gateway RPC 管理对话检查点的创建、列表和恢复
 */
export function useChatCheckpoint(): UseChatCheckpointReturn {
  const [checkpoints, setCheckpoints] = useState<ChatCheckpoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 保存检查点
   * 调用 Gateway chat.checkpoint RPC
   */
  const saveCheckpoint = useCallback(async (
    sessionKey: string,
    name?: string,
  ): Promise<ChatCheckpoint | null> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[useChatCheckpoint] 保存检查点:', { sessionKey, name })
      const result = await window.electronAPI.gateway.call<{
        checkpointId: string
        messageCount: number
        createdAt: number
      }>('chat.checkpoint', { sessionKey, name })

      const checkpoint: ChatCheckpoint = {
        checkpointId: result.checkpointId,
        sessionKey,
        name,
        messageCount: result.messageCount,
        createdAt: result.createdAt || Date.now(),
      }

      console.log('[useChatCheckpoint] 检查点已保存:', checkpoint.checkpointId)
      setCheckpoints((prev) => [checkpoint, ...prev])
      return checkpoint
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存检查点失败'
      console.error('[useChatCheckpoint] 保存检查点失败:', err)
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 从检查点恢复
   * 调用 Gateway chat.resume RPC
   */
  const resumeFromCheckpoint = useCallback(async (
    sessionKey: string,
    checkpointId: string,
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[useChatCheckpoint] 从检查点恢复:', { sessionKey, checkpointId })
      await window.electronAPI.gateway.call('chat.resume', {
        sessionKey,
        checkpointId,
      })

      console.log('[useChatCheckpoint] 恢复成功')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '恢复检查点失败'
      console.error('[useChatCheckpoint] 恢复失败:', err)
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 加载检查点列表
   * 调用 Gateway chat.listCheckpoints RPC
   */
  const loadCheckpoints = useCallback(async (sessionKey: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[useChatCheckpoint] 加载检查点列表:', sessionKey)
      const result = await window.electronAPI.gateway.call<{
        checkpoints: ChatCheckpoint[]
        total: number
      }>('chat.listCheckpoints', { sessionKey })

      console.log('[useChatCheckpoint] 加载完成, 共', result.total, '个检查点')
      setCheckpoints(result.checkpoints)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载检查点列表失败'
      console.error('[useChatCheckpoint] 加载失败:', err)
      setError(message)
      setCheckpoints([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    checkpoints,
    isLoading,
    error,
    saveCheckpoint,
    resumeFromCheckpoint,
    loadCheckpoints,
    clearError,
  }
}
