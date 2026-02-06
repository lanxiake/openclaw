/**
 * useConnectionStatus Hook - 连接状态管理
 *
 * 管理 Gateway 连接状态的自定义 Hook
 */

import { useState, useEffect, useCallback } from 'react'

interface UseConnectionStatusReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  connect: (url: string) => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * 连接状态 Hook
 */
export function useConnectionStatus(): UseConnectionStatusReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 监听连接状态变化
   */
  useEffect(() => {
    console.log('[useConnectionStatus] 注册状态监听')

    const unsubscribe = window.electronAPI.gateway.onStatusChange((connected: boolean) => {
      console.log('[useConnectionStatus] 状态变化:', connected)
      setIsConnected(connected)
      setIsConnecting(false)

      if (!connected) {
        setError(null)
      }
    })

    // 初始检查连接状态
    window.electronAPI.gateway.isConnected().then((connected) => {
      console.log('[useConnectionStatus] 初始状态:', connected)
      setIsConnected(connected)
    })

    return () => {
      console.log('[useConnectionStatus] 清理状态监听')
      unsubscribe()
    }
  }, [])

  /**
   * 连接 Gateway
   */
  const connect = useCallback(async (url: string) => {
    console.log('[useConnectionStatus] 开始连接:', url)

    setIsConnecting(true)
    setError(null)

    try {
      await window.electronAPI.gateway.connect(url)
      console.log('[useConnectionStatus] 连接成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '连接失败'
      console.error('[useConnectionStatus] 连接失败:', errorMessage)
      setError(errorMessage)
      setIsConnecting(false)
    }
  }, [])

  /**
   * 断开连接
   */
  const disconnect = useCallback(async () => {
    console.log('[useConnectionStatus] 断开连接')

    try {
      await window.electronAPI.gateway.disconnect()
      console.log('[useConnectionStatus] 已断开')
    } catch (err) {
      console.error('[useConnectionStatus] 断开失败:', err)
    }
  }, [])

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  }
}
