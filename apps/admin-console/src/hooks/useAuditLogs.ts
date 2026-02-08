/**
 * 审计日志 Hooks
 *
 * 提供审计日志列表、详情、统计的 React Query Hooks
 */

import { useQuery } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type { AuditLog, AuditLogQuery, AuditLogListResponse, AuditLogStats } from '@/types/audit'

/**
 * 转换后端审计日志数据
 */
function transformAuditLog(backendLog: Record<string, unknown>): AuditLog {
  return {
    id: backendLog.id as string,
    adminId: backendLog.adminId as string | undefined,
    adminName: (backendLog.adminUsername as string) || '未知管理员',
    action: backendLog.action as string,
    targetType: backendLog.targetType as string | undefined,
    targetId: backendLog.targetId as string | undefined,
    targetName: backendLog.targetName as string | undefined,
    details: backendLog.details as Record<string, unknown> | undefined,
    ip: backendLog.ipAddress as string | undefined,
    userAgent: backendLog.userAgent as string | undefined,
    riskLevel: backendLog.riskLevel as 'low' | 'medium' | 'high' | 'critical',
    createdAt: formatDate(backendLog.createdAt),
  }
}

/**
 * 格式化日期
 */
function formatDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return ''
}

/**
 * 获取审计日志统计
 */
export function useAuditLogStats() {
  return useQuery({
    queryKey: ['admin', 'auditLogs', 'stats'],
    queryFn: async (): Promise<AuditLogStats> => {
      const response = await gateway.call<{
        success: boolean
        data?: AuditLogStats
        error?: string
      }>('admin.auditLogs.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取审计统计失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 获取审计日志列表
 */
export function useAuditLogList(query: AuditLogQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'auditLogs', 'list', query],
    queryFn: async (): Promise<AuditLogListResponse> => {
      const response = await gateway.call<{
        success: boolean
        logs?: Array<Record<string, unknown>>
        total?: number
        page?: number
        pageSize?: number
        error?: string
      }>('admin.auditLogs.list', {
        search: query.search,
        adminId: query.adminId,
        action: query.action,
        targetType: query.targetType,
        riskLevel: query.riskLevel,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
      })

      if (!response.success) {
        throw new Error(response.error || '获取审计日志列表失败')
      }

      return {
        logs: (response.logs ?? []).map(transformAuditLog),
        total: response.total ?? 0,
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 20,
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 获取审计日志详情
 */
export function useAuditLogDetail(logId: string) {
  return useQuery({
    queryKey: ['admin', 'auditLogs', 'detail', logId],
    queryFn: async (): Promise<AuditLog> => {
      const response = await gateway.call<{
        success: boolean
        log?: Record<string, unknown>
        error?: string
      }>('admin.auditLogs.get', { logId })

      if (!response.success || !response.log) {
        throw new Error(response.error || '获取审计日志详情失败')
      }

      return transformAuditLog(response.log)
    },
    enabled: !!logId,
    staleTime: 60 * 1000,
  })
}
