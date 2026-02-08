/**
 * 数据分析类型定义
 */

/**
 * 时间范围
 */
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * 用户增长数据点
 */
export interface UserGrowthDataPoint {
  date: string
  newUsers: number
  activeUsers: number
  totalUsers: number
}

/**
 * 用户增长趋势
 */
export interface UserGrowthTrend {
  period: AnalyticsPeriod
  data: UserGrowthDataPoint[]
  summary: {
    totalNewUsers: number
    averageDailyActive: number
    growthRate: number
  }
}

/**
 * 用户留存数据
 */
export interface RetentionData {
  cohort: string // 队列日期
  day1: number
  day3: number
  day7: number
  day14: number
  day30: number
}

/**
 * 用户留存分析
 */
export interface RetentionAnalysis {
  period: AnalyticsPeriod
  cohorts: RetentionData[]
  averageRetention: {
    day1: number
    day3: number
    day7: number
    day14: number
    day30: number
  }
}

/**
 * 用户画像分布
 */
export interface UserDemographics {
  /** 订阅计划分布 */
  byPlan: Array<{
    plan: string
    count: number
    percentage: number
  }>
  /** 设备类型分布 */
  byDevice: Array<{
    device: string
    count: number
    percentage: number
  }>
  /** 地区分布 */
  byRegion: Array<{
    region: string
    count: number
    percentage: number
  }>
  /** 活跃时段分布 */
  byActiveHour: Array<{
    hour: number
    count: number
  }>
}

/**
 * 收入数据点
 */
export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
  refunds: number
  netRevenue: number
}

/**
 * 收入趋势
 */
export interface RevenueTrend {
  period: AnalyticsPeriod
  data: RevenueDataPoint[]
  summary: {
    totalRevenue: number
    totalOrders: number
    totalRefunds: number
    netRevenue: number
    averageOrderValue: number
    growthRate: number
  }
}

/**
 * 收入来源分布
 */
export interface RevenueBySource {
  /** 按计划分布 */
  byPlan: Array<{
    plan: string
    revenue: number
    percentage: number
    orders: number
  }>
  /** 按支付渠道分布 */
  byPaymentMethod: Array<{
    method: string
    revenue: number
    percentage: number
    orders: number
  }>
}

/**
 * ARPU/LTV 数据
 */
export interface UserValueMetrics {
  /** 每用户平均收入 (月) */
  arpu: number
  /** 用户生命周期价值 */
  ltv: number
  /** 付费用户占比 */
  payingUserRate: number
  /** 付费用户 ARPU */
  payingArpu: number
  /** 趋势数据 */
  trend: Array<{
    date: string
    arpu: number
    ltv: number
  }>
}

/**
 * 技能使用统计
 */
export interface SkillUsageStats {
  skillId: string
  skillName: string
  category: string
  totalExecutions: number
  uniqueUsers: number
  successRate: number
  averageExecutionTime: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}

/**
 * 技能分析
 */
export interface SkillAnalytics {
  period: AnalyticsPeriod
  topSkills: SkillUsageStats[]
  categoryDistribution: Array<{
    category: string
    executions: number
    percentage: number
  }>
  usageTrend: Array<{
    date: string
    executions: number
    uniqueUsers: number
  }>
  summary: {
    totalExecutions: number
    totalUniqueUsers: number
    averageExecutionsPerUser: number
    activeSkillsCount: number
  }
}

/**
 * 漏斗步骤
 */
export interface FunnelStep {
  name: string
  count: number
  percentage: number
  dropoffRate: number
}

/**
 * 漏斗分析
 */
export interface FunnelAnalysis {
  name: string
  period: AnalyticsPeriod
  steps: FunnelStep[]
  overallConversionRate: number
}

/**
 * 自定义报表字段
 */
export interface ReportField {
  id: string
  name: string
  type: 'metric' | 'dimension'
  category: string
}

/**
 * 自定义报表配置
 */
export interface CustomReportConfig {
  id: string
  name: string
  description: string
  dimensions: string[]
  metrics: string[]
  filters: Array<{
    field: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
    value: string | number
  }>
  sortBy: string
  sortOrder: 'asc' | 'desc'
  limit: number
  createdAt: string
  updatedAt: string
}

/**
 * 自定义报表结果
 */
export interface CustomReportResult {
  config: CustomReportConfig
  data: Array<Record<string, unknown>>
  total: number
  generatedAt: string
}

/**
 * 分析概览统计
 */
export interface AnalyticsOverview {
  users: {
    total: number
    active: number
    new: number
    churnRate: number
  }
  revenue: {
    total: number
    today: number
    mtd: number
    ytd: number
  }
  skills: {
    total: number
    active: number
    executions: number
    averageRating: number
  }
  engagement: {
    dau: number
    wau: number
    mau: number
    avgSessionDuration: number
  }
}
