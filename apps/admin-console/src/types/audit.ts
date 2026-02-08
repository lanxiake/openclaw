/**
 * 操作日志
 */
export interface AuditLog {
  id: string
  adminId?: string
  adminName: string
  action: string
  actionLabel?: string
  targetType?: string
  targetId?: string
  targetName?: string
  details?: Record<string, unknown>
  ip?: string
  userAgent?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

/**
 * 操作日志查询参数
 */
export interface AuditLogQuery {
  page?: number
  pageSize?: number
  search?: string
  adminId?: string
  action?: string
  targetType?: string
  riskLevel?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 操作日志列表响应
 */
export interface AuditLogListResponse {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
}

/**
 * 操作日志统计
 */
export interface AuditLogStats {
  totalActions: number
  todayActions: number
  weekActions: number
  highRiskActions: number
  actionDistribution: Array<{
    action: string
    count: number
  }>
  adminDistribution: Array<{
    adminUsername: string
    count: number
  }>
  riskDistribution: Array<{
    riskLevel: string
    count: number
  }>
}
