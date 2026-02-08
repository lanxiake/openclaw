/**
 * useSystemMonitor Hook - 系统监控 Hook
 *
 * 获取系统信息、进程列表、资源使用情况
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 系统信息类型（来自 main 进程）
 */
export interface SystemInfo {
  hostname: string
  platform: string
  arch: string
  release: string
  uptime: number
  cpuModel: string
  cpuCores: number
  totalMemory: number
  freeMemory: number
  usedMemory: number
  memoryUsagePercent: number
  cpuUsage?: number // CPU 使用率 (可选，取决于 main 进程实现)
}

/**
 * 磁盘信息
 */
export interface DiskInfo {
  name: string
  mount: string
  type: string
  total: number
  free: number
  used: number
  usagePercent: number
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  memoryBytes: number
  status: string
  user?: string
  startTime?: Date
}

/**
 * 进程排序方式
 */
export type ProcessSortBy = 'name' | 'cpu' | 'memory' | 'pid'

/**
 * 系统监控状态
 */
interface SystemMonitorState {
  systemInfo: SystemInfo | null
  disks: DiskInfo[]
  processes: ProcessInfo[]
  isLoading: boolean
  error: string | null
  refreshInterval: number
  processSortBy: ProcessSortBy
  processSortOrder: 'asc' | 'desc'
  processFilter: string
}

/**
 * 格式化内存大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * 格式化运行时间
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)

  return parts.join(' ') || '刚刚启动'
}

/**
 * 默认状态
 */
const DEFAULT_STATE: SystemMonitorState = {
  systemInfo: null,
  disks: [],
  processes: [],
  isLoading: false,
  error: null,
  refreshInterval: 3000,
  processSortBy: 'cpu',
  processSortOrder: 'desc',
  processFilter: '',
}

/**
 * 系统监控 Hook
 */
export function useSystemMonitor() {
  const [state, setState] = useState<SystemMonitorState>(DEFAULT_STATE)
  const refreshTimerRef = useRef<number | null>(null)
  const isRefreshingRef = useRef(false)

  /**
   * 更新状态辅助函数
   */
  const updateState = useCallback((updates: Partial<SystemMonitorState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  /**
   * 获取系统信息
   */
  const fetchSystemInfo = useCallback(async (): Promise<SystemInfo | null> => {
    try {
      console.log('[useSystemMonitor] 获取系统信息')
      const info = await window.electronAPI.system.getInfo()
      return info as SystemInfo
    } catch (err) {
      console.error('[useSystemMonitor] 获取系统信息失败:', err)
      return null
    }
  }, [])

  /**
   * 获取磁盘信息
   */
  const fetchDiskInfo = useCallback(async (): Promise<DiskInfo[]> => {
    try {
      console.log('[useSystemMonitor] 获取磁盘信息')
      const disks = await window.electronAPI.system.getDiskInfo()
      return disks as DiskInfo[]
    } catch (err) {
      console.error('[useSystemMonitor] 获取磁盘信息失败:', err)
      return []
    }
  }, [])

  /**
   * 获取进程列表
   */
  const fetchProcesses = useCallback(async (): Promise<ProcessInfo[]> => {
    try {
      console.log('[useSystemMonitor] 获取进程列表')
      const processes = await window.electronAPI.system.getProcessList()
      return (processes as ProcessInfo[]).map((p) => ({
        ...p,
        startTime: p.startTime ? new Date(p.startTime) : undefined,
      }))
    } catch (err) {
      console.error('[useSystemMonitor] 获取进程列表失败:', err)
      return []
    }
  }, [])

  /**
   * 刷新所有数据
   */
  const refresh = useCallback(async () => {
    // 防止重复刷新
    if (isRefreshingRef.current) {
      console.log('[useSystemMonitor] 已有刷新任务进行中，跳过')
      return
    }

    isRefreshingRef.current = true
    updateState({ isLoading: true, error: null })

    try {
      console.log('[useSystemMonitor] 开始刷新系统信息')

      // 并行获取所有信息
      const [systemInfo, disks, processes] = await Promise.all([
        fetchSystemInfo(),
        fetchDiskInfo(),
        fetchProcesses(),
      ])

      updateState({
        systemInfo,
        disks,
        processes,
        isLoading: false,
      })

      console.log('[useSystemMonitor] 刷新完成')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取系统信息失败'
      console.error('[useSystemMonitor] 刷新失败:', err)
      updateState({ error: errorMessage, isLoading: false })
    } finally {
      isRefreshingRef.current = false
    }
  }, [fetchSystemInfo, fetchDiskInfo, fetchProcesses, updateState])

  /**
   * 设置刷新间隔
   */
  const setRefreshInterval = useCallback((interval: number) => {
    updateState({ refreshInterval: interval })
  }, [updateState])

  /**
   * 设置进程排序
   */
  const setProcessSorting = useCallback((sortBy: ProcessSortBy) => {
    setState((prev) => ({
      ...prev,
      processSortBy: sortBy,
      processSortOrder:
        prev.processSortBy === sortBy
          ? prev.processSortOrder === 'asc'
            ? 'desc'
            : 'asc'
          : 'desc',
    }))
  }, [])

  /**
   * 设置进程过滤器
   */
  const setProcessFilter = useCallback((filter: string) => {
    updateState({ processFilter: filter })
  }, [updateState])

  /**
   * 结束进程
   */
  const killProcess = useCallback(async (pid: number): Promise<boolean> => {
    try {
      console.log('[useSystemMonitor] 结束进程:', pid)
      await window.electronAPI.system.killProcess(pid)
      // 刷新进程列表
      const processes = await fetchProcesses()
      updateState({ processes })
      return true
    } catch (err) {
      console.error('[useSystemMonitor] 结束进程失败:', err)
      return false
    }
  }, [fetchProcesses, updateState])

  /**
   * 获取排序后的进程列表
   */
  const getSortedProcesses = useCallback((): ProcessInfo[] => {
    let result = [...state.processes]

    // 过滤
    if (state.processFilter) {
      const filterLower = state.processFilter.toLowerCase()
      result = result.filter((p) =>
        p.name.toLowerCase().includes(filterLower) ||
        p.pid.toString().includes(filterLower)
      )
    }

    // 排序
    result.sort((a, b) => {
      let comparison = 0
      switch (state.processSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'cpu':
          comparison = a.cpu - b.cpu
          break
        case 'memory':
          comparison = a.memoryBytes - b.memoryBytes
          break
        case 'pid':
          comparison = a.pid - b.pid
          break
      }
      return state.processSortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [state.processes, state.processFilter, state.processSortBy, state.processSortOrder])

  /**
   * 启动自动刷新
   */
  const startAutoRefresh = useCallback(() => {
    // 清除现有定时器
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current)
    }

    // 设置新定时器
    refreshTimerRef.current = window.setInterval(() => {
      refresh()
    }, state.refreshInterval)

    console.log('[useSystemMonitor] 启动自动刷新，间隔:', state.refreshInterval, 'ms')
  }, [state.refreshInterval, refresh])

  /**
   * 停止自动刷新
   */
  const stopAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
      console.log('[useSystemMonitor] 停止自动刷新')
    }
  }, [])

  /**
   * 初始化 - 首次获取数据
   */
  useEffect(() => {
    console.log('[useSystemMonitor] Hook 初始化')
    refresh()

    return () => {
      console.log('[useSystemMonitor] Hook 清理')
      stopAutoRefresh()
    }
  }, []) // 仅在挂载时执行

  /**
   * 刷新间隔变化时重新设置定时器
   */
  useEffect(() => {
    startAutoRefresh()
    return () => stopAutoRefresh()
  }, [state.refreshInterval, startAutoRefresh, stopAutoRefresh])

  return {
    // 状态
    systemInfo: state.systemInfo,
    disks: state.disks,
    processes: getSortedProcesses(),
    isLoading: state.isLoading,
    error: state.error,
    refreshInterval: state.refreshInterval,
    processSortBy: state.processSortBy,
    processSortOrder: state.processSortOrder,
    processFilter: state.processFilter,

    // 操作
    refresh,
    setRefreshInterval,
    setProcessSorting,
    setProcessFilter,
    killProcess,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
