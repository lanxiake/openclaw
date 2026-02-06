/**
 * 确认请求管理 Hook
 *
 * 管理来自 Gateway 的敏感操作确认请求队列
 */

import { useState, useEffect, useCallback } from 'react'
import type { ConfirmRequest } from '../components/ConfirmDialog'

/**
 * 确认请求管理 Hook
 * @returns 确认请求队列和响应处理函数
 */
export function useConfirmRequests() {
  // 确认请求队列
  const [requests, setRequests] = useState<ConfirmRequest[]>([])

  /**
   * 添加新的确认请求
   */
  const addRequest = useCallback((request: ConfirmRequest) => {
    console.log('[useConfirmRequests] 收到新的确认请求:', request)
    setRequests((prev) => {
      // 检查是否已存在相同 requestId 的请求
      const exists = prev.some((r) => r.requestId === request.requestId)
      if (exists) {
        console.log('[useConfirmRequests] 请求已存在，跳过:', request.requestId)
        return prev
      }
      return [...prev, request]
    })
  }, [])

  /**
   * 移除确认请求
   */
  const removeRequest = useCallback((requestId: string) => {
    console.log('[useConfirmRequests] 移除确认请求:', requestId)
    setRequests((prev) => prev.filter((r) => r.requestId !== requestId))
  }, [])

  /**
   * 处理用户响应
   */
  const handleResponse = useCallback(
    async (requestId: string, approved: boolean) => {
      console.log('[useConfirmRequests] 处理用户响应:', { requestId, approved })

      try {
        // 调用 IPC 发送响应到 Gateway
        const result = await window.electronAPI.gateway.call('assistant.confirm.response', {
          requestId,
          approved,
        })
        console.log('[useConfirmRequests] 响应发送成功:', result)
      } catch (error) {
        console.error('[useConfirmRequests] 响应发送失败:', error)
      }

      // 无论成功与否，都从队列中移除
      removeRequest(requestId)
    },
    [removeRequest]
  )

  // 监听来自主进程的确认请求
  useEffect(() => {
    console.log('[useConfirmRequests] 初始化确认请求监听')

    // 设置 IPC 监听器
    const removeListener = window.electronAPI.gateway.onConfirmRequest((request: ConfirmRequest) => {
      addRequest(request)
    })

    return () => {
      console.log('[useConfirmRequests] 清理确认请求监听')
      if (removeListener) {
        removeListener()
      }
    }
  }, [addRequest])

  // 当前显示的请求（队列中的第一个）
  const currentRequest = requests.length > 0 ? requests[0] : null

  return {
    /** 当前显示的确认请求 */
    currentRequest,
    /** 确认请求队列 */
    requests,
    /** 处理用户响应 */
    handleResponse,
    /** 队列中是否有待处理的请求 */
    hasPendingRequests: requests.length > 0,
  }
}
