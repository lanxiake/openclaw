/**
 * 审计日志 Hooks
 *
 * 提供审计日志列表、详情、统计的 React Query Hooks
 * 使用 API Server REST API
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AuditLog, AuditLogQuery, AuditLogListResponse, AuditLogStats } from '@/types/audit'

/**
 * 获取审计日志统计
 */
export function useAuditLogStats() {
  return useQuery({
    queryKey: ['admin', 'auditLogs', 'stats'],
    queryFn: async (): Promise<AuditLogStats> => {
      console.log('[useAuditLogs] 获取审计统计')
      // TODO: API Server 需要实现 /api/admin/audit/stats 路由
      return {
        totalActions: 0,
        todayActions: 0,
        weekActions: 0,
        highRiskActions: 0,
        actionDistribution: [],
        adminDistribution: [],
        riskDistribution: [],
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取审计日志列表
 */
export function useAuditLogList(query: AuditLogQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'auditLogs', 'list', query],
    queryFn: async (): Promise<AuditLogListResponse> => {
      console.log('[useAuditLogs] 获取审计日志列表:', query)

      const response = await apiClient.instance.getAuditLogs({
        adminId: query.adminId,
        action: query.action,
        targetType: query.targetType,
        riskLevel: query.riskLevel,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
      })

      // 转换 API 返回的数据格式为本地 AuditLog 类型
      const logs: AuditLog[] = response.data.map((item) => ({
        id: item.id,
        adminId: item.adminId,
        adminName: item.adminUsername || '未知管理员',
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        targetName: item.targetName,
        details: item.details as Record<string, unknown> | undefined,
        ip: item.ipAddress,
        userAgent: item.userAgent,
        riskLevel: item.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        createdAt: item.createdAt,
      }))

      return {
        logs,
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
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
      console.log('[useAuditLogs] 获取审计日志详情:', logId)
      // TODO: API Server 需要实现 /api/admin/audit/:id 路由
      throw new Error('审计日志详情 API 尚未实现')
    },
    enabled: !!logId,
    staleTime: 60 * 1000,
  })
}
