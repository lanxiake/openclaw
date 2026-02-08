/**
 * useDevicePairing Hook - 设备配对管理
 *
 * 管理 Windows 客户端与 Gateway 的配对流程
 * 支持配对码快速配对和手动配对请求
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备唯一标识 */
  deviceId: string
  /** 设备名称 */
  displayName: string
  /** 平台 */
  platform: string
  /** 客户端 ID */
  clientId: string
  /** 客户端模式 */
  clientMode: string
  /** 创建时间 */
  createdAt: number
}

/**
 * 配对状态
 */
export interface PairingState {
  /** 设备信息 */
  device: DeviceInfo
  /** 配对状态 */
  status: 'unpaired' | 'pending' | 'paired'
  /** Gateway URL */
  gatewayUrl?: string
  /** 认证 Token */
  token?: string
  /** 请求 ID (配对中) */
  requestId?: string
  /** 配对时间 */
  pairedAt?: number
}

/**
 * 配对结果
 */
export interface PairingResult {
  success: boolean
  message: string
  token?: string
}

/**
 * Hook 返回类型
 */
interface UseDevicePairingReturn {
  /** 设备信息 */
  device: DeviceInfo | null
  /** 配对状态 */
  pairingState: PairingState | null
  /** 是否已配对 */
  isPaired: boolean
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否正在配对中 */
  isPairing: boolean
  /** 错误信息 */
  error: string | null
  /** 发起配对请求 */
  requestPairing: (gatewayUrl: string) => Promise<void>
  /** 检查配对状态 */
  checkPairingStatus: () => Promise<void>
  /** 使用配对码配对 */
  pairWithCode: (pairingCode: string, gatewayUrl: string) => Promise<PairingResult>
  /** 取消配对 */
  unpair: () => Promise<void>
  /** 刷新 Token */
  refreshToken: () => Promise<string | null>
  /** 验证 Token */
  verifyToken: () => Promise<boolean>
  /** 重置设备 */
  resetDevice: () => Promise<void>
  /** 更新设备名称 */
  updateDisplayName: (displayName: string) => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

/**
 * 轮询间隔 (毫秒)
 */
const POLLING_INTERVAL = 3000

/**
 * 设备配对管理 Hook
 */
export function useDevicePairing(): UseDevicePairingReturn {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [pairingState, setPairingState] = useState<PairingState | null>(null)
  const [isPaired, setIsPaired] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPairing, setIsPairing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 加载初始状态
   */
  const loadState = useCallback(async () => {
    console.log('[useDevicePairing] 加载配对状态')
    try {
      const [deviceInfo, state, paired] = await Promise.all([
        window.electronAPI.pairing.getDevice(),
        window.electronAPI.pairing.getStatus(),
        window.electronAPI.pairing.isPaired(),
      ])

      setDevice(deviceInfo)
      setPairingState(state)
      setIsPaired(paired)

      // 如果状态为 pending，开始轮询
      if (state?.status === 'pending') {
        startPolling()
      }

      console.log('[useDevicePairing] 配对状态已加载:', {
        deviceId: deviceInfo?.deviceId,
        status: state?.status,
        isPaired: paired,
      })
    } catch (err) {
      console.error('[useDevicePairing] 加载配对状态失败:', err)
      setError(err instanceof Error ? err.message : '加载配对状态失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 初始化
   */
  useEffect(() => {
    loadState()

    return () => {
      // 清理轮询
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [loadState])

  /**
   * 开始轮询配对状态
   */
  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      return
    }

    console.log('[useDevicePairing] 开始轮询配对状态')
    pollingRef.current = setInterval(async () => {
      try {
        const status = await window.electronAPI.pairing.checkStatus()
        console.log('[useDevicePairing] 轮询结果:', status)

        if (status === 'paired') {
          // 配对成功，停止轮询
          stopPolling()
          await loadState()
        } else if (status === 'unpaired') {
          // 配对被拒绝，停止轮询
          stopPolling()
          await loadState()
          setError('配对请求被拒绝')
        }
      } catch (err) {
        console.error('[useDevicePairing] 轮询失败:', err)
      }
    }, POLLING_INTERVAL)
  }, [loadState])

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      console.log('[useDevicePairing] 停止轮询')
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  /**
   * 发起配对请求
   */
  const requestPairing = useCallback(
    async (gatewayUrl: string) => {
      console.log('[useDevicePairing] 发起配对请求:', gatewayUrl)
      setIsPairing(true)
      setError(null)

      try {
        const result = await window.electronAPI.pairing.requestPairing(gatewayUrl)
        console.log('[useDevicePairing] 配对请求结果:', result)

        // 更新状态
        await loadState()

        // 开始轮询
        startPolling()
      } catch (err) {
        console.error('[useDevicePairing] 配对请求失败:', err)
        setError(err instanceof Error ? err.message : '配对请求失败')
      } finally {
        setIsPairing(false)
      }
    },
    [loadState, startPolling]
  )

  /**
   * 检查配对状态
   */
  const checkPairingStatus = useCallback(async () => {
    try {
      await window.electronAPI.pairing.checkStatus()
      await loadState()
    } catch (err) {
      console.error('[useDevicePairing] 检查配对状态失败:', err)
    }
  }, [loadState])

  /**
   * 使用配对码配对
   */
  const pairWithCode = useCallback(
    async (pairingCode: string, gatewayUrl: string): Promise<PairingResult> => {
      console.log('[useDevicePairing] 使用配对码配对')
      setIsPairing(true)
      setError(null)

      try {
        const result = await window.electronAPI.pairing.pairWithCode(pairingCode, gatewayUrl)
        console.log('[useDevicePairing] 配对码配对结果:', result)

        if (result.success) {
          await loadState()
        } else {
          setError(result.message)
        }

        return result
      } catch (err) {
        console.error('[useDevicePairing] 配对码配对失败:', err)
        const message = err instanceof Error ? err.message : '配对失败'
        setError(message)
        return { success: false, message }
      } finally {
        setIsPairing(false)
      }
    },
    [loadState]
  )

  /**
   * 取消配对
   */
  const unpair = useCallback(async () => {
    console.log('[useDevicePairing] 取消配对')
    setError(null)

    try {
      stopPolling()
      await window.electronAPI.pairing.unpair()
      await loadState()
    } catch (err) {
      console.error('[useDevicePairing] 取消配对失败:', err)
      setError(err instanceof Error ? err.message : '取消配对失败')
    }
  }, [loadState, stopPolling])

  /**
   * 刷新 Token
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    console.log('[useDevicePairing] 刷新 Token')
    setError(null)

    try {
      const newToken = await window.electronAPI.pairing.refreshToken()
      if (newToken) {
        await loadState()
      }
      return newToken
    } catch (err) {
      console.error('[useDevicePairing] 刷新 Token 失败:', err)
      setError(err instanceof Error ? err.message : '刷新 Token 失败')
      return null
    }
  }, [loadState])

  /**
   * 验证 Token
   */
  const verifyToken = useCallback(async (): Promise<boolean> => {
    console.log('[useDevicePairing] 验证 Token')

    try {
      const isValid = await window.electronAPI.pairing.verifyToken()
      if (!isValid) {
        await loadState()
      }
      return isValid
    } catch (err) {
      console.error('[useDevicePairing] 验证 Token 失败:', err)
      return false
    }
  }, [loadState])

  /**
   * 重置设备
   */
  const resetDevice = useCallback(async () => {
    console.log('[useDevicePairing] 重置设备')
    setError(null)

    try {
      stopPolling()
      await window.electronAPI.pairing.resetDevice()
      await loadState()
    } catch (err) {
      console.error('[useDevicePairing] 重置设备失败:', err)
      setError(err instanceof Error ? err.message : '重置设备失败')
    }
  }, [loadState, stopPolling])

  /**
   * 更新设备名称
   */
  const updateDisplayName = useCallback(
    async (displayName: string) => {
      console.log('[useDevicePairing] 更新设备名称:', displayName)
      setError(null)

      try {
        await window.electronAPI.pairing.updateDisplayName(displayName)
        await loadState()
      } catch (err) {
        console.error('[useDevicePairing] 更新设备名称失败:', err)
        setError(err instanceof Error ? err.message : '更新设备名称失败')
      }
    },
    [loadState]
  )

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    device,
    pairingState,
    isPaired,
    isLoading,
    isPairing,
    error,
    requestPairing,
    checkPairingStatus,
    pairWithCode,
    unpair,
    refreshToken,
    verifyToken,
    resetDevice,
    updateDisplayName,
    clearError,
  }
}
