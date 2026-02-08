/**
 * Gateway 连接状态 Hook
 */

import { useState, useEffect } from 'react'
import { gateway, type ConnectionState } from '../services'

/**
 * 监听 Gateway 连接状态
 */
export function useGatewayConnection() {
  const [state, setState] = useState<ConnectionState>(gateway.getConnectionState())
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 订阅连接状态变化
    const unsubscribe = gateway.onConnectionStateChange((newState) => {
      setState(newState)
      setIsConnecting(newState === 'connecting')
      setError(newState === 'error' ? '连接错误' : null)
    })

    return unsubscribe
  }, [])

  /**
   * 连接到 Gateway
   */
  const connect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      await gateway.connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setIsConnecting(false)
    }
  }

  /**
   * 断开连接
   */
  const disconnect = () => {
    gateway.disconnect()
  }

  return {
    state,
    isConnected: state === 'connected',
    isConnecting,
    error,
    connect,
    disconnect,
  }
}
