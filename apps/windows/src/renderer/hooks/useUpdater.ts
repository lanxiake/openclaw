/**
 * useUpdater Hook - 自动更新管理
 *
 * 提供应用自动更新的状态管理和操作方法
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * 更新状态类型
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/**
 * 更新状态
 */
export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion?: string
  releaseNotes?: string
  releaseDate?: string
  downloadProgress?: number
  downloadSpeed?: number
  downloadedBytes?: number
  totalBytes?: number
  error?: string
  lastCheckTime?: number
}

/**
 * 更新配置
 */
export interface UpdaterConfig {
  autoCheck: boolean
  checkInterval: number
  autoDownload: boolean
  autoInstall: boolean
  allowPrerelease: boolean
}

/**
 * Hook 返回值
 */
interface UseUpdaterReturn {
  /** 更新状态 */
  state: UpdateState
  /** 更新配置 */
  config: UpdaterConfig | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 检查更新 */
  checkForUpdates: () => Promise<void>
  /** 下载更新 */
  downloadUpdate: () => Promise<void>
  /** 安装更新 */
  installUpdate: () => void
  /** 更新配置 */
  updateConfig: (config: Partial<UpdaterConfig>) => Promise<void>
  /** 格式化文件大小 */
  formatBytes: (bytes: number) => string
  /** 格式化下载速度 */
  formatSpeed: (bytesPerSecond: number) => string
  /** 格式化时间 */
  formatTime: (timestamp: number) => string
}

/**
 * 默认更新状态
 */
const DEFAULT_STATE: UpdateState = {
  status: 'idle',
  currentVersion: '',
}

/**
 * 自动更新管理 Hook
 */
export function useUpdater(): UseUpdaterReturn {
  const [state, setState] = useState<UpdateState>(DEFAULT_STATE)
  const [config, setConfig] = useState<UpdaterConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  /**
   * 获取初始状态和配置
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [initialState, initialConfig] = await Promise.all([
          window.electronAPI.updater.getState(),
          window.electronAPI.updater.getConfig(),
        ])
        setState(initialState)
        setConfig(initialConfig)
      } catch (error) {
        console.error('[useUpdater] 获取初始数据失败:', error)
      }
    }

    fetchInitialData()
  }, [])

  /**
   * 监听状态变化
   */
  useEffect(() => {
    const unsubscribe = window.electronAPI.updater.onStateChange((newState) => {
      console.log('[useUpdater] 状态变化:', newState.status)
      setState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * 检查更新
   */
  const checkForUpdates = useCallback(async () => {
    console.log('[useUpdater] 检查更新')
    setIsLoading(true)
    try {
      const newState = await window.electronAPI.updater.checkForUpdates()
      setState(newState)
    } catch (error) {
      console.error('[useUpdater] 检查更新失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 下载更新
   */
  const downloadUpdate = useCallback(async () => {
    console.log('[useUpdater] 下载更新')
    try {
      await window.electronAPI.updater.downloadUpdate()
    } catch (error) {
      console.error('[useUpdater] 下载更新失败:', error)
    }
  }, [])

  /**
   * 安装更新
   */
  const installUpdate = useCallback(() => {
    console.log('[useUpdater] 安装更新')
    window.electronAPI.updater.installUpdate()
  }, [])

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (newConfig: Partial<UpdaterConfig>) => {
    console.log('[useUpdater] 更新配置:', newConfig)
    try {
      const updatedConfig = await window.electronAPI.updater.updateConfig(newConfig)
      setConfig(updatedConfig)
    } catch (error) {
      console.error('[useUpdater] 更新配置失败:', error)
    }
  }, [])

  /**
   * 格式化文件大小
   */
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }, [])

  /**
   * 格式化下载速度
   */
  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }, [formatBytes])

  /**
   * 格式化时间
   */
  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  return {
    state,
    config,
    isLoading,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    updateConfig,
    formatBytes,
    formatSpeed,
    formatTime,
  }
}
