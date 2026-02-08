/**
 * 用户信息
 */
export interface User {
  id: string
  phone?: string
  email?: string
  displayName: string
  avatar?: string
  status: 'active' | 'suspended' | 'deleted'
  isPhoneVerified: boolean
  isEmailVerified: boolean
  timezone: string
  locale: string
  createdAt: string
  lastLoginAt?: string
  deviceCount: number
  subscriptionPlan?: string
  subscriptionStatus?: 'active' | 'canceled' | 'expired' | 'trial'
}

/**
 * 用户详情（包含更多信息）
 */
export interface UserDetail extends User {
  devices: UserDevice[]
  subscription?: UserSubscription
  usageStats: UserUsageStats
  auditLogs: UserAuditLog[]
}

/**
 * 用户设备
 */
export interface UserDevice {
  id: string
  deviceId: string
  deviceName: string
  platform: string
  lastActiveAt: string
  isOnline: boolean
}

/**
 * 用户订阅
 */
export interface UserSubscription {
  id: string
  planId: string
  planName: string
  status: 'active' | 'canceled' | 'expired' | 'trial'
  startDate: string
  endDate: string
  autoRenew: boolean
}

/**
 * 用户使用统计
 */
export interface UserUsageStats {
  totalMessages: number
  totalTokens: number
  totalSkillExecutions: number
  monthlyMessages: number
  monthlyTokens: number
}

/**
 * 用户操作日志（简化版）
 */
export interface UserAuditLog {
  id: string
  action: string
  details: string
  ip?: string
  createdAt: string
}

/**
 * 用户列表查询参数
 */
export interface UserListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  subscriptionStatus?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  users: User[]
  total: number
  page: number
  pageSize: number
}
