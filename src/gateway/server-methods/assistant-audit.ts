/**
 * 审计日志 Gateway RPC 方法
 *
 * 提供审计日志的查询、统计、导出等 RPC 方法
 * 包括:
 * - 基于 JSON Lines 的本地审计日志 (assistant.audit.*)
 * - 基于 PostgreSQL 的增强版审计服务 (audit.*)
 */

import {
  initAuditLog,
  writeAuditLog,
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  getAuditConfig,
  updateAuditConfig,
  getRecentAuditLogs,
  type AuditLogFilters,
  type AuditExportOptions,
  type AuditLogConfig,
  type CreateAuditLogInput,
  // 增强版审计服务
  getEnhancedAuditService,
  type AuditLogQueryParams,
} from '../../assistant/audit/index.js'
import type { AuditCategory, AuditRiskLevel } from '../../db/schema/audit.js'
import { ErrorCodes, errorShape } from '../protocol/index.js'
import type { GatewayRequestHandlers } from './types.js'

// 日志标签
const LOG_TAG = 'assistant-audit-rpc'

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required: boolean = false
): string | undefined {
  const value = params[key]
  if (value === undefined || value === null) {
    if (required) {
      return undefined
    }
    return undefined
  }
  if (typeof value !== 'string') {
    return undefined
  }
  return value.trim() || undefined
}

/**
 * 审计日志 RPC 方法定义
 */
export const assistantAuditMethods: GatewayRequestHandlers = {
  /**
   * 初始化审计日志系统
   */
  'assistant.audit.init': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 初始化审计日志系统`)

      const config: Partial<AuditLogConfig> = {}

      if (typeof params.enabled === 'boolean') {
        config.enabled = params.enabled
      }
      if (typeof params.retentionDays === 'number') {
        config.retentionDays = params.retentionDays
      }
      if (typeof params.maxEntries === 'number') {
        config.maxEntries = params.maxEntries
      }
      if (typeof params.logChatContent === 'boolean') {
        config.logChatContent = params.logChatContent
      }
      if (typeof params.logFilePaths === 'boolean') {
        config.logFilePaths = params.logFilePaths
      }

      await initAuditLog(config)

      respond(true, { initialized: true, config: getAuditConfig() }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 初始化失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 写入审计日志
   */
  'assistant.audit.write': async ({ params, respond, context }) => {
    try {
      const eventType = validateStringParam(params, 'eventType', true)
      const title = validateStringParam(params, 'title', true)
      const detail = validateStringParam(params, 'detail', true)

      if (!eventType || !title || !detail) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'Missing required fields: eventType, title, detail'))
        return
      }

      const sourceType = validateStringParam(params, 'sourceType') || 'user'
      const sourceName = validateStringParam(params, 'sourceName') || 'unknown'

      const input: CreateAuditLogInput = {
        eventType: eventType as CreateAuditLogInput['eventType'],
        title,
        detail,
        source: {
          type: sourceType as CreateAuditLogInput['source']['type'],
          name: sourceName,
          ip: validateStringParam(params, 'sourceIp'),
        },
        severity: validateStringParam(params, 'severity') as CreateAuditLogInput['severity'],
        result: validateStringParam(params, 'result') as CreateAuditLogInput['result'],
        metadata: params.metadata as Record<string, unknown> | undefined,
        sessionId: validateStringParam(params, 'sessionId'),
        userId: validateStringParam(params, 'userId'),
        deviceId: validateStringParam(params, 'deviceId'),
      }

      context.logGateway.debug(`[${LOG_TAG}] 写入审计日志`, { eventType, title })

      const entry = await writeAuditLog(input)

      respond(true, { entry }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 写入审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 查询审计日志
   */
  'assistant.audit.query': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 查询审计日志`)

      const filters: AuditLogFilters = {
        startTime: validateStringParam(params, 'startTime'),
        endTime: validateStringParam(params, 'endTime'),
        search: validateStringParam(params, 'search'),
        sessionId: validateStringParam(params, 'sessionId'),
        offset: typeof params.offset === 'number' ? params.offset : 0,
        limit: typeof params.limit === 'number' ? params.limit : 50,
        sortOrder: validateStringParam(params, 'sortOrder') as AuditLogFilters['sortOrder'],
      }

      // 处理数组参数
      if (Array.isArray(params.eventTypes)) {
        filters.eventTypes = params.eventTypes as AuditLogFilters['eventTypes']
      }
      if (Array.isArray(params.severities)) {
        filters.severities = params.severities as AuditLogFilters['severities']
      }
      if (Array.isArray(params.results)) {
        filters.results = params.results as AuditLogFilters['results']
      }
      if (Array.isArray(params.sourceTypes)) {
        filters.sourceTypes = params.sourceTypes as AuditLogFilters['sourceTypes']
      }

      const result = await queryAuditLogs(filters)

      respond(true, result, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 查询审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取最近的审计日志
   */
  'assistant.audit.recent': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取最近审计日志`)

      const limit = typeof params.limit === 'number' ? params.limit : 20

      const entries = await getRecentAuditLogs(limit)

      respond(true, { entries, total: entries.length }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取最近审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取审计日志统计
   */
  'assistant.audit.stats': async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取审计日志统计`)

      const stats = await getAuditStats()

      respond(true, stats, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取统计失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 导出审计日志
   */
  'assistant.audit.export': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 导出审计日志`)

      const format = validateStringParam(params, 'format') || 'json'

      const options: AuditExportOptions = {
        format: format as AuditExportOptions['format'],
        filters: {},
      }

      // 解析过滤条件
      if (params.filters && typeof params.filters === 'object') {
        const filterParams = params.filters as Record<string, unknown>
        options.filters = {
          startTime: validateStringParam(filterParams, 'startTime'),
          endTime: validateStringParam(filterParams, 'endTime'),
          search: validateStringParam(filterParams, 'search'),
        }

        if (Array.isArray(filterParams.eventTypes)) {
          options.filters.eventTypes = filterParams.eventTypes as AuditLogFilters['eventTypes']
        }
        if (Array.isArray(filterParams.severities)) {
          options.filters.severities = filterParams.severities as AuditLogFilters['severities']
        }
      }

      // 解析导出字段
      if (Array.isArray(params.fields)) {
        options.fields = params.fields as AuditExportOptions['fields']
      }

      const content = await exportAuditLogs(options)

      respond(true, { content, format }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 导出审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 清除审计日志
   */
  'assistant.audit.clear': async ({ params, respond, context }) => {
    try {
      context.logGateway.warn(`[${LOG_TAG}] 清除审计日志`)

      const beforeDate = validateStringParam(params, 'beforeDate')

      const result = await clearAuditLogs({ beforeDate })

      respond(true, result, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 清除审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取审计日志配置
   */
  'assistant.audit.config.get': async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取审计日志配置`)

      const config = getAuditConfig()

      respond(true, { config }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取配置失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 更新审计日志配置
   */
  'assistant.audit.config.set': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 更新审计日志配置`)

      const config: Partial<AuditLogConfig> = {}

      if (typeof params.enabled === 'boolean') {
        config.enabled = params.enabled
      }
      if (typeof params.retentionDays === 'number') {
        config.retentionDays = params.retentionDays
      }
      if (typeof params.maxEntries === 'number') {
        config.maxEntries = params.maxEntries
      }
      if (typeof params.logChatContent === 'boolean') {
        config.logChatContent = params.logChatContent
      }
      if (typeof params.logFilePaths === 'boolean') {
        config.logFilePaths = params.logFilePaths
      }
      if (Array.isArray(params.eventTypes)) {
        config.eventTypes = params.eventTypes as AuditLogConfig['eventTypes']
      }
      if (validateStringParam(params, 'minSeverity')) {
        config.minSeverity = validateStringParam(params, 'minSeverity') as AuditLogConfig['minSeverity']
      }

      const updatedConfig = await updateAuditConfig(config)

      respond(true, { config: updatedConfig }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 更新配置失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  // ============================================================================
  // 增强版审计服务 (基于 PostgreSQL, 带风险评估和告警)
  // ============================================================================

  /**
   * 写入审计日志 (增强版，自动风险评估)
   */
  'audit.log': async ({ params, respond, context }) => {
    try {
      const category = validateStringParam(params, 'category', true)
      const action = validateStringParam(params, 'action', true)
      const result = validateStringParam(params, 'result', true)

      if (!category || !action || !result) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'Missing required fields: category, action, result'))
        return
      }

      const service = getEnhancedAuditService()
      const auditLog = await service.log({
        userId: validateStringParam(params, 'userId'),
        deviceId: validateStringParam(params, 'deviceId'),
        category: category as AuditCategory,
        action,
        resourceType: validateStringParam(params, 'resourceType'),
        resourceId: validateStringParam(params, 'resourceId'),
        riskLevel: validateStringParam(params, 'riskLevel') as AuditRiskLevel | undefined,
        ipAddress: validateStringParam(params, 'ipAddress'),
        userAgent: validateStringParam(params, 'userAgent'),
        details: params.details as Record<string, unknown> | undefined,
        beforeState: params.beforeState as Record<string, unknown> | undefined,
        afterState: params.afterState as Record<string, unknown> | undefined,
        result: result as 'success' | 'failure' | 'partial',
        errorMessage: validateStringParam(params, 'errorMessage'),
        skipRiskEvaluation: params.skipRiskEvaluation === true,
      })

      context.logGateway.debug(`[${LOG_TAG}] 写入增强版审计日志`, {
        id: auditLog.id,
        category,
        action,
      })

      respond(true, { log: auditLog }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 写入增强版审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 查询审计日志 (分页)
   */
  'audit.query': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 查询增强版审计日志`)

      const queryParams: AuditLogQueryParams = {
        userId: validateStringParam(params, 'userId'),
        deviceId: validateStringParam(params, 'deviceId'),
        category: validateStringParam(params, 'category') as AuditCategory | undefined,
        action: validateStringParam(params, 'action'),
        riskLevel: validateStringParam(params, 'riskLevel') as AuditRiskLevel | undefined,
        startDate: params.startDate ? new Date(params.startDate as string) : undefined,
        endDate: params.endDate ? new Date(params.endDate as string) : undefined,
        page: typeof params.page === 'number' ? params.page : 1,
        pageSize: typeof params.pageSize === 'number' ? params.pageSize : 20,
      }

      const service = getEnhancedAuditService()
      const result = await service.query(queryParams)

      respond(true, result, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 查询增强版审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取用户最近的审计日志
   */
  'audit.user.recent': async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, 'userId', true)

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'Missing required field: userId'))
        return
      }

      const limit = typeof params.limit === 'number' ? params.limit : 20

      context.logGateway.debug(`[${LOG_TAG}] 获取用户最近审计日志`, { userId, limit })

      const service = getEnhancedAuditService()
      const logs = await service.getRecentByUser(userId, limit)

      respond(true, { logs, total: logs.length }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取用户最近审计日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取高风险操作日志
   */
  'audit.highrisk': async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取高风险操作日志`)

      // 默认获取过去24小时的高风险操作
      const hoursAgo = typeof params.hoursAgo === 'number' ? params.hoursAgo : 24
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
      const limit = typeof params.limit === 'number' ? params.limit : 100

      const service = getEnhancedAuditService()
      const logs = await service.getHighRiskLogs(since, limit)

      respond(true, { logs, total: logs.length, since: since.toISOString() }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取高风险操作日志失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 请求数据导出 (带频率限制)
   */
  'audit.export.request': async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, 'userId', true)
      const exportType = validateStringParam(params, 'exportType', true)
      const format = validateStringParam(params, 'format', true)

      if (!userId || !exportType || !format) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'Missing required fields: userId, exportType, format'))
        return
      }

      context.logGateway.info(`[${LOG_TAG}] 请求数据导出`, { userId, exportType, format })

      const service = getEnhancedAuditService()
      const result = await service.requestExport({
        userId,
        exportType: exportType as 'user_data' | 'audit_logs' | 'chat_history' | 'files',
        format: format as 'json' | 'csv' | 'zip',
        startDate: validateStringParam(params, 'startDate'),
        endDate: validateStringParam(params, 'endDate'),
        filters: params.filters as Record<string, unknown> | undefined,
        ipAddress: validateStringParam(params, 'ipAddress'),
        userAgent: validateStringParam(params, 'userAgent'),
      })

      if (result.success) {
        respond(true, { exportId: result.exportId }, undefined)
      } else {
        // 计算 retryAfterMs (如果有 retryAfter)
        let retryAfterMs: number | undefined
        if (result.retryAfter) {
          const retryDate = new Date(result.retryAfter)
          retryAfterMs = Math.max(0, retryDate.getTime() - Date.now())
        }

        respond(false, undefined, errorShape(
          result.errorCode === 'RATE_LIMITED' ? ErrorCodes.RESOURCE_EXHAUSTED : ErrorCodes.UNAVAILABLE,
          result.error || '导出请求失败',
          retryAfterMs ? { retryAfterMs, retryable: true } : undefined
        ))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 请求数据导出失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 获取用户导出历史
   */
  'audit.export.history': async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, 'userId', true)

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'Missing required field: userId'))
        return
      }

      const limit = typeof params.limit === 'number' ? params.limit : 20

      context.logGateway.debug(`[${LOG_TAG}] 获取导出历史`, { userId, limit })

      const service = getEnhancedAuditService()
      const exports = await service.getExportHistory(userId, limit)

      respond(true, { exports, total: exports.length }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 获取导出历史失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },

  /**
   * 清理过期日志和导出
   */
  'audit.cleanup': async ({ params, respond, context }) => {
    try {
      context.logGateway.warn(`[${LOG_TAG}] 执行清理任务`)

      const retentionDays = typeof params.retentionDays === 'number' ? params.retentionDays : 365

      const service = getEnhancedAuditService()

      // 清理过期审计日志
      const deletedLogs = await service.cleanupOldLogs(retentionDays)

      // 清理过期导出
      const deletedExports = await service.cleanupExpiredExports()

      respond(true, {
        deletedLogs,
        deletedExports,
        retentionDays,
      }, undefined)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      context.logGateway.error(`[${LOG_TAG}] 执行清理任务失败`, { error: errorMessage })
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage))
    }
  },
}
