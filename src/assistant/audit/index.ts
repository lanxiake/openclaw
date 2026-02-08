/**
 * Windows 助理审计日志模块
 *
 * 提供审计日志的完整功能入口
 * 包括:
 * - 基于 JSON Lines 的文件审计日志 (service.ts)
 * - 基于 PostgreSQL 的增强版审计服务 (enhanced-service.ts)
 * - 风险自动评估和告警 (risk-evaluator.ts)
 */

// 导出类型 (基于 JSON Lines 的本地审计)
export {
  type AuditEventType,
  type AuditSeverity,
  type AuditLogEntry,
  type AuditSource,
  type AuditLogFilters,
  type AuditLogQueryResult,
  type AuditLogStats,
  type AuditExportFormat,
  type AuditExportOptions,
  type CreateAuditLogInput,
  type AuditLogConfig,
  DEFAULT_AUDIT_CONFIG,
  EVENT_SEVERITY_MAP,
  EVENT_TYPE_LABELS,
} from './types.js'

// 导出服务函数 (基于 JSON Lines 的本地审计)
export {
  initAuditLog,
  writeAuditLog,
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  getAuditConfig,
  updateAuditConfig,
  getRecentAuditLogs,
} from './service.js'

// 导出风险评估器
export {
  evaluateRisk,
  registerAlertHandler,
  unregisterAlertHandler,
  sendRiskAlert,
  generateAlertId,
  type RiskEvaluationInput,
  type RiskEvaluationResult,
  type RiskAlert,
  type AlertHandler,
} from './risk-evaluator.js'

// 导出增强版审计服务 (基于 PostgreSQL)
export {
  EnhancedAuditService,
  getEnhancedAuditService,
  auditEnhanced,
  type AuditLogRequest,
  type AuditLogQueryParams,
  type PaginatedResult,
  type ExportRequest,
  type ExportResult,
} from './enhanced-service.js'

// 导出清理调度器
export {
  AuditCleanupScheduler,
  getCleanupScheduler,
  startCleanupScheduler,
  stopCleanupScheduler,
  executeCleanup,
  type CleanupTaskConfig,
  type CleanupResult,
} from './cleanup-scheduler.js'
