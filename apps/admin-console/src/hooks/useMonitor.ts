/**
 * 系统监控 Hooks
 *
 * 提供系统监控相关的 React Query Hooks
 * 使用 API Server REST API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  MonitorStats,
  SystemHealth,
  ApiMonitorData,
  ResourceUsage,
  ResourceHistory,
  LogQuery,
  LogQueryResponse,
  LogStats,
  AlertListResponse,
} from '@/types/monitor'

/**
 * 获取监控统计概览
 */
export function useMonitorStats() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'stats'],
    queryFn: async (): Promise<MonitorStats> => {
      console.log('[useMonitor] 获取监控统计')
      return apiClient.instance.getMonitorStats()
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
      console.log('[useMonitor] 获取系统健康状态')
      return apiClient.instance.getSystemHealth()
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/**
 * 获取 API 监控数据
 */
export function useApiMonitor(period: 'hour' | 'day' | 'week' = 'day') {
  const hoursMap = { hour: 1, day: 24, week: 168 }

  return useQuery({
    queryKey: ['admin', 'monitor', 'api', period],
    queryFn: async (): Promise<ApiMonitorData> => {
      console.log('[useMonitor] 获取 API 监控数据:', period)
      return apiClient.instance.getApiMonitor(hoursMap[period])
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
      console.log('[useMonitor] 获取资源使用情况')
      return apiClient.instance.getResourceUsage()
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

/**
 * 获取资源使用历史（从 system_metrics 表查询真实数据）
 */
export function useResourceHistory(period: 'hour' | 'day' | 'week' = 'hour') {
  return useQuery({
    queryKey: ['admin', 'monitor', 'resources', 'history', period],
    queryFn: async (): Promise<ResourceHistory> => {
      try {
        return await apiClient.instance.getResourceHistory(period)
      } catch {
        /** API 不可用时返回空数据 */
      }

      return {
        labels: [],
        cpu: [],
        memory: [],
        disk: [],
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * 获取日志列表（从 system_logs 表查询应用日志）
 */
export function useLogs(query: LogQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'monitor', 'logs', query],
    queryFn: async (): Promise<LogQueryResponse> => {
      return apiClient.instance.getMonitorLogs(query)
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/**
 * 获取日志来源列表（从 system_logs 表查询去重 source）
 */
export function useLogSources() {
  return useQuery({
    queryKey: ['admin', 'monitor', 'logs', 'sources'],
    queryFn: async (): Promise<string[]> => {
      return apiClient.instance.getMonitorLogSources()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取日志统计（按级别、来源分组计数）
 */
export function useLogStats(params?: { startTime?: string; endTime?: string }) {
  return useQuery({
    queryKey: ['admin', 'monitor', 'logs', 'stats', params],
    queryFn: async (): Promise<LogStats> => {
      return apiClient.instance.getLogStats(params)
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * 获取告警列表（从 system_alerts 表查询真实数据）
 */
export function useAlerts(filters: { acknowledged?: boolean; resolved?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin', 'monitor', 'alerts', filters],
    queryFn: async (): Promise<AlertListResponse> => {
      console.log('[useMonitor] 获取告警列表:', filters)
      return apiClient.instance.getMonitorAlerts(filters)
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
      console.log('[useMonitor] 确认告警:', alertId)
      await apiClient.instance.acknowledgeAlert(alertId)
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
      console.log('[useMonitor] 解决告警:', alertId)
      await apiClient.instance.resolveAlert(alertId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] })
    },
  })
}
