/**
 * 系统监控 Hooks
 *
 * 提供系统监控相关的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type {
  MonitorStats,
  SystemHealth,
  ApiMonitorData,
  ResourceUsage,
  ResourceHistory,
  LogEntry,
  LogQuery,
  LogQueryResponse,
  Alert,
  AlertListResponse,
} from '@/types/monitor'

/**
 * 获取监控统计概览
 */
export function useMonitorStats() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'stats'],
    queryFn: async (): Promise<MonitorStats> => {
      const response = await gateway.call<{
        success: boolean
        data?: MonitorStats
        error?: string
      }>('admin.monitor.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取监控统计失败')
      }

      return response.data
    },
    staleTime: 10 * 1000, // 10 秒后过期
    refetchInterval: 30 * 1000, // 30 秒自动刷新
  })
}

/**
 * 获取系统健康状态
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'health'],
    queryFn: async (): Promise<SystemHealth> => {
      const response = await gateway.call<{
        success: boolean
        data?: SystemHealth
        error?: string
      }>('admin.monitor.health', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取系统健康状态失败')
      }

      return response.data
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/**
 * 获取 API 监控数据
 */
export function useApiMonitor(period: 'hour' | 'day' | 'week' = 'day') {
  return useQuery({
    queryKey: ['admin', 'monitor', 'api', period],
    queryFn: async (): Promise<ApiMonitorData> => {
      const response = await gateway.call<{
        success: boolean
        data?: ApiMonitorData
        error?: string
      }>('admin.monitor.api', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取 API 监控数据失败')
      }

      return response.data
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * 获取资源使用情况
 */
export function useResourceUsage() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'resources'],
    queryFn: async (): Promise<ResourceUsage> => {
      const response = await gateway.call<{
        success: boolean
        data?: ResourceUsage
        error?: string
      }>('admin.monitor.resources', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取资源使用情况失败')
      }

      return response.data
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

/**
 * 获取资源使用历史
 */
export function useResourceHistory(period: 'hour' | 'day' | 'week' = 'hour') {
  return useQuery({
    queryKey: ['admin', 'monitor', 'resources', 'history', period],
    queryFn: async (): Promise<ResourceHistory> => {
      const response = await gateway.call<{
        success: boolean
        data?: ResourceHistory
        error?: string
      }>('admin.monitor.resources.history', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取资源使用历史失败')
      }

      return response.data
    },
    staleTime: 60 * 1000,
  })
}

/**
 * 获取日志列表
 */
export function useLogs(query: LogQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'monitor', 'logs', query],
    queryFn: async (): Promise<LogQueryResponse> => {
      const response = await gateway.call<{
        success: boolean
        logs?: LogEntry[]
        total?: number
        hasMore?: boolean
        error?: string
      }>('admin.monitor.logs', {
        level: query.level,
        source: query.source,
        search: query.search,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      })

      if (!response.success) {
        throw new Error(response.error || '获取日志列表失败')
      }

      return {
        logs: response.logs ?? [],
        total: response.total ?? 0,
        hasMore: response.hasMore ?? false,
      }
    },
    staleTime: 10 * 1000,
  })
}

/**
 * 获取日志来源列表
 */
export function useLogSources() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'logs', 'sources'],
    queryFn: async (): Promise<string[]> => {
      const response = await gateway.call<{
        success: boolean
        sources?: string[]
        error?: string
      }>('admin.monitor.logs.sources', {})

      if (!response.success) {
        throw new Error(response.error || '获取日志来源列表失败')
      }

      return response.sources ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取告警列表
 */
export function useAlerts(filters: { acknowledged?: boolean; resolved?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin', 'monitor', 'alerts', filters],
    queryFn: async (): Promise<AlertListResponse> => {
      const response = await gateway.call<{
        success: boolean
        alerts?: Alert[]
        total?: number
        unacknowledged?: number
        error?: string
      }>('admin.monitor.alerts', filters)

      if (!response.success) {
        throw new Error(response.error || '获取告警列表失败')
      }

      return {
        alerts: response.alerts ?? [],
        total: response.total ?? 0,
        unacknowledged: response.unacknowledged ?? 0,
      }
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/**
 * 确认告警
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await gateway.call<{
        success: boolean
        alertId?: string
        message?: string
        error?: string
      }>('admin.monitor.alerts.acknowledge', { alertId })

      if (!response.success) {
        throw new Error(response.error || '确认告警失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] })
    },
  })
}

/**
 * 解决告警
 */
export function useResolveAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await gateway.call<{
        success: boolean
        alertId?: string
        message?: string
        error?: string
      }>('admin.monitor.alerts.resolve', { alertId })

      if (!response.success) {
        throw new Error(response.error || '解决告警失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] })
    },
  })
}
