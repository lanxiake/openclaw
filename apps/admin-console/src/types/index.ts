/**
 * 类型定义统一导出
 */

export type { Admin, AdminLoginRequest, AdminLoginResponse, RefreshTokenResponse } from './admin'

export type {
  User,
  UserDetail,
  UserDevice,
  UserSubscription,
  UserUsageStats,
  UserAuditLog,
  UserListQuery,
  UserListResponse,
} from './user'

export type {
  SubscriptionPlan,
  PlanFeature,
  PlanQuota,
  Subscription,
  Order,
  SubscriptionListQuery,
  SubscriptionListResponse,
  OrderListQuery,
  OrderListResponse,
} from './subscription'

export type { AuditLog, AuditLogQuery, AuditLogListResponse, AuditLogStats } from './audit'

export type {
  Skill,
  SkillDetail,
  SkillCategory,
  SkillStatus,
  SkillSubscription,
  SkillRunMode,
  SkillListQuery,
  SkillListResponse,
  SkillStats,
  SkillReviewAction,
  SkillPublishAction,
  SkillFeaturedAction,
  CategoryCreateInput,
  CategoryUpdateInput,
} from './skill'

export type {
  ServiceStatus,
  ServiceInfo,
  SystemHealth,
  ApiMetrics,
  ApiEndpointStats,
  ApiMonitorData,
  ResourceUsage,
  ResourceHistory,
  LogLevel,
  LogEntry,
  LogQuery,
  LogQueryResponse,
  MonitorStats,
  Alert,
  AlertSeverity,
  AlertListResponse,
} from './monitor'

export type {
  SiteConfig,
  FeatureFlags,
  SecurityConfig,
  NotificationChannel,
  NotificationTemplate,
  NotificationTemplateList,
  ConfigUpdateRequest,
  ConfigResponse,
  TemplateUpdateRequest,
  SystemConfig,
  ConfigGroup,
  ConfigChangeLog,
} from './config'

export type {
  AnalyticsPeriod,
  UserGrowthDataPoint,
  UserGrowthTrend,
  RetentionData,
  RetentionAnalysis,
  UserDemographics,
  RevenueDataPoint,
  RevenueTrend,
  RevenueBySource,
  UserValueMetrics,
  SkillUsageStats,
  SkillAnalytics,
  FunnelStep,
  FunnelAnalysis,
  ReportField,
  CustomReportConfig,
  CustomReportResult,
  AnalyticsOverview,
} from './analytics'

export type {
  DashboardStats,
  TrendData,
  TrendDataPoint,
  SubscriptionDistribution,
  Activity,
  ActivityType,
  DashboardData,
} from './dashboard'

/**
 * API 响应通用结构
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: number
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: PaginationInfo
}
