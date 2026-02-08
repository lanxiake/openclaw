/**
 * 审计日志操作类型
 */
export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password-change'
  | 'device.link'
  | 'device.unlink'
  | 'skill.subscribe'
  | 'skill.unsubscribe'
  | 'user.update'
  | 'user.suspend'
  | 'config.update'

/**
 * 审计日志
 */
export interface AuditLog {
  id: string
  userId?: string
  userName?: string
  deviceId?: string
  deviceName?: string
  action: AuditAction
  resource: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

/**
 * 审计日志查询参数
 */
export interface AuditLogQuery {
  page?: number
  limit?: number
  userId?: string
  deviceId?: string
  action?: AuditAction
  startTime?: string
  endTime?: string
}
