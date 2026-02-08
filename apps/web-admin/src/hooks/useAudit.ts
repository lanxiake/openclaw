/**
 * 审计日志相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auditService } from '../services'
import type { AuditAction } from '../services'

// 查询键
export const auditKeys = {
  all: ['audit'] as const,
  logs: (params?: Record<string, unknown>) => [...auditKeys.all, 'logs', params] as const,
  recent: (limit?: number) => [...auditKeys.all, 'recent', limit] as const,
  stats: () => [...auditKeys.all, 'stats'] as const,
  config: () => [...auditKeys.all, 'config'] as const,
}

/**
 * 查询审计日志
 */
export function useAuditLogs(params: {
  userId?: string
  action?: string
  resource?: string
  success?: boolean
  startTime?: string
  endTime?: string
  offset?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: auditKeys.logs(params),
    queryFn: () => auditService.query(params),
  })
}

/**
 * 获取最近的审计日志
 */
export function useRecentAuditLogs(limit = 10) {
  return useQuery({
    queryKey: auditKeys.recent(limit),
    queryFn: () => auditService.getRecent(limit),
  })
}

/**
 * 获取审计统计信息
 */
export function useAuditStats() {
  return useQuery({
    queryKey: auditKeys.stats(),
    queryFn: () => auditService.getStats(),
  })
}

/**
 * 获取审计配置
 */
export function useAuditConfig() {
  return useQuery({
    queryKey: auditKeys.config(),
    queryFn: () => auditService.getConfig(),
  })
}

/**
 * 设置审计配置
 */
export function useSetAuditConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: Parameters<typeof auditService.setConfig>[0]) =>
      auditService.setConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.config() })
    },
  })
}

/**
 * 导出审计日志
 */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (params: {
      format: 'json' | 'csv'
      startTime?: string
      endTime?: string
      actions?: AuditAction[]
    }) => auditService.export(params),
  })
}

/**
 * 清理审计日志
 */
export function useClearAuditLogs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { beforeDate?: string; retainDays?: number }) =>
      auditService.clear(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.all })
    },
  })
}
