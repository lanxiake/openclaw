/**
 * Windows 助理审计日志类型定义
 *
 * 定义审计日志的数据结构、事件类型和查询接口
 */

/**
 * 审计事件类型
 */
export type AuditEventType =
  // 会话事件
  | 'session.start'
  | 'session.end'
  | 'session.connect'
  | 'session.disconnect'
  // 聊天事件
  | 'chat.message.sent'
  | 'chat.message.received'
  | 'chat.abort'
  // 技能事件
  | 'skill.execute.start'
  | 'skill.execute.success'
  | 'skill.execute.error'
  | 'skill.install'
  | 'skill.uninstall'
  | 'skill.enable'
  | 'skill.disable'
  // 文件操作事件
  | 'file.read'
  | 'file.write'
  | 'file.delete'
  | 'file.move'
  | 'file.copy'
  // 系统操作事件
  | 'system.process.list'
  | 'system.process.kill'
  | 'system.app.launch'
  | 'system.command.execute'
  // 敏感操作确认事件
  | 'confirm.request'
  | 'confirm.approve'
  | 'confirm.reject'
  | 'confirm.timeout'
  // 设置变更事件
  | 'settings.change'
  // 认证事件
  | 'auth.pair.request'
  | 'auth.pair.success'
  | 'auth.pair.reject'
  | 'auth.token.refresh'

/**
 * 审计事件严重级别
 */
export type AuditSeverity = 'info' | 'warn' | 'critical'

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  /** 唯一标识符 */
  id: string
  /** 时间戳 (ISO 8601) */
  timestamp: string
  /** 事件类型 */
  eventType: AuditEventType
  /** 严重级别 */
  severity: AuditSeverity
  /** 事件标题 */
  title: string
  /** 事件详情 */
  detail: string
  /** 操作来源 */
  source: AuditSource
  /** 操作结果 */
  result: 'success' | 'failure' | 'pending'
  /** 关联数据 */
  metadata?: Record<string, unknown>
  /** 会话 ID */
  sessionId?: string
  /** 用户标识 */
  userId?: string
  /** 设备标识 */
  deviceId?: string
}

/**
 * 审计事件来源
 */
export interface AuditSource {
  /** 来源类型 */
  type: 'user' | 'system' | 'ai' | 'skill' | 'schedule'
  /** 来源名称 */
  name: string
  /** IP 地址 (如适用) */
  ip?: string
}

/**
 * 审计日志查询过滤条件
 */
export interface AuditLogFilters {
  /** 开始时间 (ISO 8601) */
  startTime?: string
  /** 结束时间 (ISO 8601) */
  endTime?: string
  /** 事件类型过滤 */
  eventTypes?: AuditEventType[]
  /** 严重级别过滤 */
  severities?: AuditSeverity[]
  /** 结果过滤 */
  results?: Array<'success' | 'failure' | 'pending'>
  /** 来源类型过滤 */
  sourceTypes?: Array<'user' | 'system' | 'ai' | 'skill' | 'schedule'>
  /** 搜索关键词 */
  search?: string
  /** 会话 ID 过滤 */
  sessionId?: string
  /** 分页偏移 */
  offset?: number
  /** 分页限制 */
  limit?: number
  /** 排序方式 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 审计日志查询结果
 */
export interface AuditLogQueryResult {
  /** 日志条目列表 */
  entries: AuditLogEntry[]
  /** 总数 */
  total: number
  /** 偏移量 */
  offset: number
  /** 限制 */
  limit: number
}

/**
 * 审计日志统计信息
 */
export interface AuditLogStats {
  /** 总条目数 */
  totalEntries: number
  /** 按事件类型统计 */
  byEventType: Record<string, number>
  /** 按严重级别统计 */
  bySeverity: Record<AuditSeverity, number>
  /** 按结果统计 */
  byResult: Record<string, number>
  /** 按来源类型统计 */
  bySourceType: Record<string, number>
  /** 时间范围 */
  timeRange: {
    earliest: string | null
    latest: string | null
  }
  /** 今日事件数 */
  todayCount: number
  /** 本周事件数 */
  weekCount: number
}

/**
 * 审计日志导出格式
 */
export type AuditExportFormat = 'json' | 'csv'

/**
 * 审计日志导出选项
 */
export interface AuditExportOptions {
  /** 导出格式 */
  format: AuditExportFormat
  /** 过滤条件 */
  filters?: AuditLogFilters
  /** 包含的字段 */
  fields?: Array<keyof AuditLogEntry>
}

/**
 * 创建审计日志条目的输入参数
 */
export interface CreateAuditLogInput {
  eventType: AuditEventType
  severity?: AuditSeverity
  title: string
  detail: string
  source: AuditSource
  result?: 'success' | 'failure' | 'pending'
  metadata?: Record<string, unknown>
  sessionId?: string
  userId?: string
  deviceId?: string
}

/**
 * 审计日志配置
 */
export interface AuditLogConfig {
  /** 是否启用审计日志 */
  enabled: boolean
  /** 日志保留天数 */
  retentionDays: number
  /** 最大日志条目数 */
  maxEntries: number
  /** 是否记录聊天消息内容 */
  logChatContent: boolean
  /** 是否记录文件操作路径 */
  logFilePaths: boolean
  /** 需要记录的事件类型 (空数组表示全部) */
  eventTypes: AuditEventType[]
  /** 最低严重级别 */
  minSeverity: AuditSeverity
}

/**
 * 默认审计日志配置
 */
export const DEFAULT_AUDIT_CONFIG: AuditLogConfig = {
  enabled: true,
  retentionDays: 30,
  maxEntries: 10000,
  logChatContent: false, // 默认不记录聊天内容以保护隐私
  logFilePaths: true,
  eventTypes: [], // 空数组表示记录所有类型
  minSeverity: 'info',
}

/**
 * 事件类型到严重级别的默认映射
 */
export const EVENT_SEVERITY_MAP: Record<AuditEventType, AuditSeverity> = {
  // 会话事件 - 信息级别
  'session.start': 'info',
  'session.end': 'info',
  'session.connect': 'info',
  'session.disconnect': 'info',
  // 聊天事件 - 信息级别
  'chat.message.sent': 'info',
  'chat.message.received': 'info',
  'chat.abort': 'info',
  // 技能事件 - 混合级别
  'skill.execute.start': 'info',
  'skill.execute.success': 'info',
  'skill.execute.error': 'warn',
  'skill.install': 'info',
  'skill.uninstall': 'warn',
  'skill.enable': 'info',
  'skill.disable': 'info',
  // 文件操作事件 - 混合级别
  'file.read': 'info',
  'file.write': 'warn',
  'file.delete': 'critical',
  'file.move': 'warn',
  'file.copy': 'info',
  // 系统操作事件 - 较高级别
  'system.process.list': 'info',
  'system.process.kill': 'critical',
  'system.app.launch': 'warn',
  'system.command.execute': 'critical',
  // 敏感操作确认事件 - 关键级别
  'confirm.request': 'warn',
  'confirm.approve': 'critical',
  'confirm.reject': 'info',
  'confirm.timeout': 'warn',
  // 设置变更事件
  'settings.change': 'warn',
  // 认证事件
  'auth.pair.request': 'info',
  'auth.pair.success': 'info',
  'auth.pair.reject': 'warn',
  'auth.token.refresh': 'info',
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
