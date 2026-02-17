/**
 * 审计日志服务
 *
 * 封装审计日志相关的 API Server REST 调用
 */

import { apiClient } from '../lib/api-client'
import { STORAGE_KEYS } from '../lib/constants'

/**
 * 获取认证头
 */
function getAuthHeaders(): Record<string, string> {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

/**
 * 审计日志操作类型
 */
export type AuditAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'token.refresh'
  | 'skill.execute'
  | 'skill.install'
  | 'skill.uninstall'
  | 'skill.enable'
  | 'skill.disable'
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.cancel'
  | 'device.pair'
  | 'device.unpair'
  | 'config.update'
  | 'admin.user.update'
  | 'admin.user.delete'
  | string

/**
 * 审计日志
 */
export interface AuditLog {
  id: string
  userId?: string
  userName?: string
  action: AuditAction
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
  timestamp: string
}

/**
 * 审计日志查询参数
 */
export interface AuditLogQuery {
  userId?: string
  action?: AuditAction
  resource?: string
  success?: boolean
  startTime?: string
  endTime?: string
  offset?: number
  limit?: number
  [key: string]: string | number | boolean | undefined
}

/**
 * 审计统计
 */
export interface AuditStats {
  totalLogs: number
  todayLogs: number
  successRate: number
  byAction: Record<string, number>
  byResource: Record<string, number>
  recentActivity: {
    date: string
    count: number
  }[]
}

/**
 * 审计日志配置
 */
export interface AuditConfig {
  enabled: boolean
  retentionDays: number
  logLevel: 'all' | 'important' | 'errors'
  excludeActions: string[]
}

/**
 * 审计日志服务
 */
export const auditService = {
  /**
   * 查询审计日志
   */
  async query(params: AuditLogQuery = {}): Promise<{
    logs: AuditLog[]\n    total: number
    hasMore: boolean
  }> {
    console.log('[audit] 查询审计日志', params)

    try {
      // 构建查询参数
      const queryParams = new URLSearchParams()
      if (params.userId) queryParams.append('userId', params.userId)
      if (params.action) queryParams.append('action', params.action)
      if (params.resource) queryParams.append('resource', params.resource)
      if (params.success !== undefined) queryParams.append('success', String(params.success))
      if (params.startTime) queryParams.append('startDate', params.startTime)
      if (params.endTime) queryParams.append('endDate', params.endTime)
      if (params.offset) queryParams.append('page', String(Math.floor(params.offset / (params.limit || 20)) + 1))
      if (params.limit) queryParams.append('pageSize', String(params.limit))

      const response = await apiClient.get<{
        logs: AuditLog[]
        total: number
        page: number
        pageSize: number
      }>(`/api/admin/audit-logs?${queryParams.toString()}`, getAuthHeaders())

      if (!response.success || !response.data) {
        return { logs: [], total: 0, hasMore: false }
      }

      const { logs, total, page, pageSize } = response.data
      const hasMore = page * pageSize < total

      return { logs, total, hasMore }
    } catch (error) {
      console.error('[audit] 查询审计日志失败', error)
      return { logs: [], total: 0, hasMore: false }
    }
  },

  /**
   * 获取最近的审计日志
   */
  async getRecent(limit = 10): Promise<AuditLog[]> {
    console.log('[audit] 获取最近审计日志')

    try {
      const response = await apiClient.get<{
        logs: AuditLog[]
        total: number
      }>(`/api/admin/audit-logs?pageSize=${limit}&sortBy=createdAt&sortOrder=desc`, getAuthHeaders())

      if (!response.success || !response.data) {
        return []
      }

      return response.data.logs
    } catch (error) {
      console.error('[audit] 获取最近审计日志失败', error)
      return []
    }
  },

  /**
   * 获取审计统计信息
   */
  async getStats(): Promise<AuditStats | null> {
    console.log('[audit] 获取审计统计')

    try {
      const response = await apiClient.get<AuditStats>('/api/admin/audit-logs/stats', getAuthHeaders())

      if (!response.success || !response.data) {
        return null
      }

      return response.data
    } catch (error) {
      console.error('[audit] 获取审计统计失败', error)
      return null
    }
  },

  /**
   * 导出审计日志
   */
  async export(params: {
    format: 'json' | 'csv'
    startTime?: string
    endTime?: string
    actions?: AuditAction[]
  }): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    console.log('[audit] 导出审计日志', params)

    try {
      // 构建查询参数
      const queryParams = new URLSearchParams()
      queryParams.append('format', params.format)
      if (params.startTime) queryParams.append('startDate', params.startTime)
      if (params.endTime) queryParams.append('endDate', params.endTime)
      if (params.actions) queryParams.append('actions', params.actions.join(','))

      const response = await apiClient.get<{ downloadUrl: string }>(
        `/api/admin/audit-logs/export?${queryParams.toString()}`,
        getAuthHeaders()
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '导出失败',
        }
      }

      return {
        success: true,
        downloadUrl: response.data.downloadUrl,
      }
    } catch (error) {
      console.error('[audit] 导出审计日志失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败',
      }
    }
  },

  /**
   * 清理审计日志
   * TODO: API Server 暂未实现此接口
   */
  async clear(params: {
    beforeDate?: string
    retainDays?: number
  }): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    console.log('[audit] 清理审计日志 (暂未实现)', params)
    return {
      success: false,
      error: 'API Server 暂未实现此接口',
    }
  },

  /**
   * 获取审计配置
   * TODO: API Server 暂未实现此接口
   */
  async getConfig(): Promise<AuditConfig | null> {
    console.log('[audit] 获取审计配置 (暂未实现)')
    return null
  },

  /**
   * 设置审计配置
   * TODO: API Server 暂未实现此接口
   */
  async setConfig(config: Partial<AuditConfig>): Promise<{ success: boolean; error?: string }> {
    console.log('[audit] 设置审计配置 (暂未实现)', config)
    return {
      success: false,
      error: 'API Server 暂未实现此接口',
    }
  },
}
