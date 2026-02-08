/**
 * 审计日志服务
 *
 * 封装审计日志相关的 Gateway RPC 调用
 */

import { gateway } from '../lib/gateway-client'

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
    logs: AuditLog[]
    total: number
    hasMore: boolean
  }> {
    console.log('[audit] 查询审计日志', params)

    try {
      const result = await gateway.call<{
        logs: AuditLog[]
        total: number
        hasMore: boolean
      }>('assistant.audit.query', params)
      return result
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
      const result = await gateway.call<{ logs: AuditLog[] }>('assistant.audit.recent', { limit })
      return result.logs
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
      const result = await gateway.call<AuditStats>('assistant.audit.stats')
      return result
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
      const result = await gateway.call<{ success: boolean; downloadUrl?: string }>('assistant.audit.export', params)
      return result
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
   */
  async clear(params: {
    beforeDate?: string
    retainDays?: number
  }): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    console.log('[audit] 清理审计日志', params)

    try {
      const result = await gateway.call<{ success: boolean; deletedCount?: number }>('assistant.audit.clear', params)
      return result
    } catch (error) {
      console.error('[audit] 清理审计日志失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理失败',
      }
    }
  },

  /**
   * 获取审计配置
   */
  async getConfig(): Promise<AuditConfig | null> {
    console.log('[audit] 获取审计配置')

    try {
      const result = await gateway.call<AuditConfig>('assistant.audit.config.get')
      return result
    } catch (error) {
      console.error('[audit] 获取审计配置失败', error)
      return null
    }
  },

  /**
   * 设置审计配置
   */
  async setConfig(config: Partial<AuditConfig>): Promise<{ success: boolean; error?: string }> {
    console.log('[audit] 设置审计配置', config)

    try {
      const result = await gateway.call<{ success: boolean }>('assistant.audit.config.set', config)
      return result
    } catch (error) {
      console.error('[audit] 设置审计配置失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '设置失败',
      }
    }
  },
}
