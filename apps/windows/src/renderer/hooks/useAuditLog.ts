/**
 * useAuditLog Hook - 审计日志管理
 *
 * 提供审计日志的查询、统计、导出和配置管理功能
 * 通过 Gateway RPC 方法与后端交互
 */

import { useState, useCallback, useEffect } from 'react'

/**
 * 审计事件类型
 */
export type AuditEventType =
  | 'session.start'
  | 'session.end'
  | 'session.connect'
  | 'session.disconnect'
  | 'chat.message.sent'
  | 'chat.message.received'
  | 'chat.abort'
  | 'skill.execute.start'
  | 'skill.execute.success'
  | 'skill.execute.error'
  | 'skill.install'
  | 'skill.uninstall'
  | 'skill.enable'
  | 'skill.disable'
  | 'file.read'
  | 'file.write'
  | 'file.delete'
  | 'file.move'
  | 'file.copy'
  | 'system.process.list'
  | 'system.process.kill'
  | 'system.app.launch'
  | 'system.command.execute'
  | 'confirm.request'
  | 'confirm.approve'
  | 'confirm.reject'
  | 'confirm.timeout'
  | 'settings.change'
  | 'auth.pair.request'
  | 'auth.pair.success'
  | 'auth.pair.reject'
  | 'auth.token.refresh'

/**
 * 审计事件严重级别
 */
export type AuditSeverity = 'info' | 'warn' | 'critical'

/**
 * 审计事件来源
 */
export interface AuditSource {
  type: 'user' | 'system' | 'ai' | 'skill' | 'schedule'
  name: string
  ip?: string
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string
  timestamp: string
  eventType: AuditEventType
  severity: AuditSeverity
  title: string
  detail: string
  source: AuditSource
  result: 'success' | 'failure' | 'pending'
  metadata?: Record<string, unknown>
  sessionId?: string
  userId?: string
  deviceId?: string
}

/**
 * 审计日志查询过滤条件
 */
export interface AuditLogFilters {
  startTime?: string
  endTime?: string
  eventTypes?: AuditEventType[]
  severities?: AuditSeverity[]
  results?: Array<'success' | 'failure' | 'pending'>
  sourceTypes?: Array<'user' | 'system' | 'ai' | 'skill' | 'schedule'>
  search?: string
  sessionId?: string
  offset?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

/**
 * 审计日志查询结果
 */
export interface AuditLogQueryResult {
  entries: AuditLogEntry[]
  total: number
  offset: number
  limit: number
}

/**
 * 审计日志统计信息
 */
export interface AuditLogStats {
  totalEntries: number
  byEventType: Record<string, number>
  bySeverity: Record<AuditSeverity, number>
  byResult: Record<string, number>
  bySourceType: Record<string, number>
  timeRange: {
    earliest: string | null
    latest: string | null
  }
  todayCount: number
  weekCount: number
}

/**
 * 审计日志配置
 */
export interface AuditLogConfig {
  enabled: boolean
  retentionDays: number
  maxEntries: number
  logChatContent: boolean
  logFilePaths: boolean
  eventTypes: AuditEventType[]
  minSeverity: AuditSeverity
}

/**
 * 事件类型的中文标签
 */
export const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  'session.start': '会话开始',
  'session.end': '会话结束',
  'session.connect': '连接建立',
  'session.disconnect': '连接断开',
  'chat.message.sent': '发送消息',
  'chat.message.received': '接收消息',
  'chat.abort': '中止对话',
  'skill.execute.start': '技能执行开始',
  'skill.execute.success': '技能执行成功',
  'skill.execute.error': '技能执行失败',
  'skill.install': '安装技能',
  'skill.uninstall': '卸载技能',
  'skill.enable': '启用技能',
  'skill.disable': '禁用技能',
  'file.read': '读取文件',
  'file.write': '写入文件',
  'file.delete': '删除文件',
  'file.move': '移动文件',
  'file.copy': '复制文件',
  'system.process.list': '列出进程',
  'system.process.kill': '结束进程',
  'system.app.launch': '启动应用',
  'system.command.execute': '执行命令',
  'confirm.request': '请求确认',
  'confirm.approve': '批准操作',
  'confirm.reject': '拒绝操作',
  'confirm.timeout': '确认超时',
  'settings.change': '设置变更',
  'auth.pair.request': '配对请求',
  'auth.pair.success': '配对成功',
  'auth.pair.reject': '配对拒绝',
  'auth.token.refresh': '令牌刷新',
}

/**
 * 严重级别的中文标签
 */
export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: '信息',
  warn: '警告',
  critical: '严重',
}

/**
 * 来源类型的中文标签
 */
export const SOURCE_TYPE_LABELS: Record<AuditSource['type'], string> = {
  user: '用户',
  system: '系统',
  ai: 'AI',
  skill: '技能',
  schedule: '定时任务',
}

interface UseAuditLogReturn {
  /** 日志条目列表 */
  entries: AuditLogEntry[]
  /** 总条目数 */
  total: number
  /** 统计信息 */
  stats: AuditLogStats | null
  /** 配置 */
  config: AuditLogConfig | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 当前筛选条件 */
  filters: AuditLogFilters

  /** 查询审计日志 */
  queryLogs: (filters?: AuditLogFilters) => Promise<void>
  /** 获取最近的日志 */
  getRecentLogs: (limit?: number) => Promise<AuditLogEntry[]>
  /** 获取统计信息 */
  getStats: () => Promise<void>
  /** 获取配置 */
  getConfig: () => Promise<void>
  /** 更新配置 */
  updateConfig: (config: Partial<AuditLogConfig>) => Promise<void>
  /** 导出日志 */
  exportLogs: (format: 'json' | 'csv', filters?: AuditLogFilters) => Promise<string>
  /** 清除日志 */
  clearLogs: (beforeDate?: string) => Promise<{ deletedCount: number }>
  /** 设置筛选条件 */
  setFilters: (filters: AuditLogFilters) => void
  /** 刷新日志 */
  refresh: () => Promise<void>
  /** 加载下一页 */
  loadMore: () => Promise<void>
}

/**
 * 审计日志 Hook
 */
export function useAuditLog(): UseAuditLogReturn {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [config, setConfig] = useState<AuditLogConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    sortOrder: 'desc',
  })

  /**
   * 查询审计日志
   */
  const queryLogs = useCallback(async (newFilters?: AuditLogFilters) => {
    console.log('[useAuditLog] 查询审计日志', newFilters)
    setIsLoading(true)
    setError(null)

    const currentFilters = newFilters || filters
    if (newFilters) {
      setFilters(currentFilters)
    }

    try {
      const result = await window.electronAPI.gateway.call<AuditLogQueryResult>(
        'assistant.audit.query',
        {
          ...currentFilters,
        }
      )

      setEntries(result.entries)
      setTotal(result.total)
      console.log('[useAuditLog] 查询成功，共', result.total, '条记录')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查询审计日志失败'
      console.error('[useAuditLog] 查询失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  /**
   * 获取最近的日志
   */
  const getRecentLogs = useCallback(async (limit: number = 20): Promise<AuditLogEntry[]> => {
    console.log('[useAuditLog] 获取最近日志', { limit })
    try {
      const result = await window.electronAPI.gateway.call<{ entries: AuditLogEntry[]; total: number }>(
        'assistant.audit.recent',
        { limit }
      )
      return result.entries
    } catch (err) {
      console.error('[useAuditLog] 获取最近日志失败:', err)
      return []
    }
  }, [])

  /**
   * 获取统计信息
   */
  const getStats = useCallback(async () => {
    console.log('[useAuditLog] 获取统计信息')
    try {
      const result = await window.electronAPI.gateway.call<AuditLogStats>(
        'assistant.audit.stats',
        {}
      )
      setStats(result)
      console.log('[useAuditLog] 统计信息:', result)
    } catch (err) {
      console.error('[useAuditLog] 获取统计失败:', err)
    }
  }, [])

  /**
   * 获取配置
   */
  const getConfig = useCallback(async () => {
    console.log('[useAuditLog] 获取配置')
    try {
      const result = await window.electronAPI.gateway.call<{ config: AuditLogConfig }>(
        'assistant.audit.config.get',
        {}
      )
      setConfig(result.config)
      console.log('[useAuditLog] 配置:', result.config)
    } catch (err) {
      console.error('[useAuditLog] 获取配置失败:', err)
    }
  }, [])

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (newConfig: Partial<AuditLogConfig>) => {
    console.log('[useAuditLog] 更新配置', newConfig)
    try {
      const result = await window.electronAPI.gateway.call<{ config: AuditLogConfig }>(
        'assistant.audit.config.set',
        newConfig
      )
      setConfig(result.config)
      console.log('[useAuditLog] 配置已更新:', result.config)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新配置失败'
      console.error('[useAuditLog] 更新配置失败:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  /**
   * 导出日志
   */
  const exportLogs = useCallback(async (format: 'json' | 'csv', exportFilters?: AuditLogFilters): Promise<string> => {
    console.log('[useAuditLog] 导出日志', { format, filters: exportFilters })
    try {
      const result = await window.electronAPI.gateway.call<{ content: string; format: string }>(
        'assistant.audit.export',
        {
          format,
          filters: exportFilters || filters,
        }
      )
      return result.content
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导出失败'
      console.error('[useAuditLog] 导出失败:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [filters])

  /**
   * 清除日志
   */
  const clearLogs = useCallback(async (beforeDate?: string): Promise<{ deletedCount: number }> => {
    console.log('[useAuditLog] 清除日志', { beforeDate })
    try {
      const result = await window.electronAPI.gateway.call<{ deletedCount: number }>(
        'assistant.audit.clear',
        { beforeDate }
      )
      // 刷新列表
      await queryLogs()
      await getStats()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '清除失败'
      console.error('[useAuditLog] 清除失败:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [queryLogs, getStats])

  /**
   * 刷新日志
   */
  const refresh = useCallback(async () => {
    console.log('[useAuditLog] 刷新日志')
    await Promise.all([
      queryLogs({ ...filters, offset: 0 }),
      getStats(),
    ])
  }, [filters, queryLogs, getStats])

  /**
   * 加载下一页
   */
  const loadMore = useCallback(async () => {
    const currentOffset = filters.offset || 0
    const currentLimit = filters.limit || 50
    const newOffset = currentOffset + currentLimit

    if (newOffset >= total) {
      console.log('[useAuditLog] 已加载全部')
      return
    }

    console.log('[useAuditLog] 加载下一页', { newOffset })
    setIsLoading(true)

    try {
      const result = await window.electronAPI.gateway.call<AuditLogQueryResult>(
        'assistant.audit.query',
        {
          ...filters,
          offset: newOffset,
        }
      )

      setEntries(prev => [...prev, ...result.entries])
      setFilters(prev => ({ ...prev, offset: newOffset }))
    } catch (err) {
      console.error('[useAuditLog] 加载更多失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filters, total])

  /**
   * 初始化时加载配置
   */
  useEffect(() => {
    getConfig()
  }, [getConfig])

  return {
    // 状态
    entries,
    total,
    stats,
    config,
    isLoading,
    error,
    filters,

    // 方法
    queryLogs,
    getRecentLogs,
    getStats,
    getConfig,
    updateConfig,
    exportLogs,
    clearLogs,
    setFilters,
    refresh,
    loadMore,
  }
}
