/**
 * 仪表盘统计概览数据
 */
export interface DashboardStats {
  /** 总用户数 */
  totalUsers: number
  /** 今日新增用户 */
  newUsersToday: number
  /** 活跃用户数 (7天内有登录) */
  activeUsers7d: number
  /** 付费用户数 (有有效订阅) */
  paidUsers: number
  /** 本月收入 (分) */
  revenueThisMonth: number
  /** 在线设备数 */
  onlineDevices: number
  /** 今日 API 调用次数 */
  apiCallsToday: number
  /** 较上周变化百分比 */
  changes: {
    users: number
    revenue: number
    subscriptions: number
  }
}

/**
 * 趋势数据
 */
export interface TrendData {
  /** 日期标签 */
  labels: string[]
  /** 数据值 */
  values: number[]
}

/**
 * 趋势数据点 (用于图表)
 */
export interface TrendDataPoint {
  date: string
  value: number
  label?: string
}

/**
 * 订阅分布数据
 */
export interface SubscriptionDistribution {
  /** 计划名称 */
  name: string
  /** 计划代码 */
  code: string
  /** 订阅数量 */
  count: number
  /** 百分比 */
  percentage: number
}

/**
 * 活动类型
 */
export type ActivityType =
  | 'user_register'
  | 'subscription_created'
  | 'subscription_canceled'
  | 'payment_success'
  | 'payment_refund'

/**
 * 实时活动
 */
export interface Activity {
  /** 活动类型 */
  type: ActivityType
  /** 用户 ID */
  userId?: string
  /** 用户名/手机号 (脱敏) */
  userName?: string
  /** 相关金额 (分) */
  amount?: number
  /** 计划名称 */
  planName?: string
  /** 时间戳 */
  timestamp: string
}

/**
 * 仪表盘完整数据
 */
export interface DashboardData {
  stats: DashboardStats
  trends: {
    users: TrendData
    revenue: TrendData
    subscriptions: TrendData
  }
  activities: Activity[]
  subscriptionDistribution: SubscriptionDistribution[]
}
