/**
 * 管理员 API 类型定义
 *
 * 定义管理员相关的请求/响应类型
 */

import type { PaginationMeta, PaginationParams, SortParams } from "../types.js";

// ============ 认证相关 ============

/**
 * 管理员信息
 */
export interface Admin {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: "super_admin" | "admin" | "operator";
  status: "active" | "suspended" | "locked";
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
  mfaCode?: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  admin: Admin;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 刷新令牌请求
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * 更新资料请求
 */
export interface UpdateProfileRequest {
  displayName?: string;
  email?: string;
}

// ============ 用户管理 ============

/**
 * 用户信息
 */
export interface User {
  id: string;
  phone?: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  deviceCount: number;
  subscription?: {
    planId: string;
    planName: string;
    status: string;
  };
}

/**
 * 用户详情
 */
export interface UserDetail extends User {
  devices: Array<{
    id: string;
    deviceId: string;
    alias?: string;
    lastActiveAt?: string;
  }>;
  subscriptionDetail?: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    startDate: string;
    endDate?: string;
    autoRenew: boolean;
  };
  usageStats?: {
    totalMessages: number;
    totalTokens: number;
    monthlyMessages: number;
    monthlyTokens: number;
  };
}

/**
 * 用户列表查询参数
 */
export interface UserListParams extends PaginationParams, SortParams {
  search?: string;
  status?: "active" | "suspended";
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  data: User[];
  meta: PaginationMeta;
}

/**
 * 用户统计
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  newUsersMonth: number;
}

// ============ 套餐管理 ============

/**
 * 套餐信息
 */
export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  tokensPerMonth: number;
  storageMb: number;
  maxDevices: number;
  features?: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建套餐请求
 */
export interface CreatePlanRequest {
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  tokensPerMonth?: number;
  storageMb?: number;
  maxDevices?: number;
  features?: Record<string, unknown>;
  sortOrder?: number;
}

/**
 * 更新套餐请求
 */
export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  tokensPerMonth?: number;
  storageMb?: number;
  maxDevices?: number;
  features?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
}

// ============ 订阅管理 ============

/**
 * 订阅信息
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  status: "active" | "expired" | "cancelled" | "pending";
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  createdAt: string;
}

/**
 * 订阅列表查询参数
 */
export interface SubscriptionListParams extends PaginationParams, SortParams {
  search?: string;
  status?: string;
  planId?: string;
}

/**
 * 订阅列表响应
 */
export interface SubscriptionListResponse {
  data: Subscription[];
  meta: PaginationMeta;
}

// ============ 技能管理 ============

/**
 * 技能信息
 */
export interface Skill {
  id: string;
  name: string;
  description?: string;
  version: string;
  categoryId?: string;
  categoryName?: string;
  authorId?: string;
  authorName?: string;
  status: "draft" | "pending" | "published" | "rejected";
  subscriptionLevel: "free" | "monthly" | "yearly";
  iconUrl?: string;
  downloadCount: number;
  rating: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 技能列表查询参数
 */
export interface SkillListParams extends PaginationParams, SortParams {
  search?: string;
  status?: string;
  categoryId?: string;
}

/**
 * 技能列表响应
 */
export interface SkillListResponse {
  data: Skill[];
  meta: PaginationMeta;
}

/**
 * 技能分类
 */
export interface SkillCategory {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  sortOrder: number;
  skillCount: number;
}

/**
 * 技能统计
 */
export interface SkillStats {
  total: number;
  published: number;
  pending: number;
  unpublished: number;
  rejected: number;
  featured: number;
}

/**
 * 创建技能请求
 */
export interface CreateSkillRequest {
  name: string;
  description?: string;
  readme?: string;
  version?: string;
  categoryId?: string;
  tags?: string[];
  subscriptionLevel?: "free" | "monthly" | "yearly";
  iconUrl?: string;
  config?: Record<string, unknown>;
}

/**
 * 更新技能请求
 */
export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  readme?: string;
  version?: string;
  categoryId?: string;
  tags?: string[];
  subscriptionLevel?: "free" | "monthly" | "yearly";
  iconUrl?: string;
  config?: Record<string, unknown>;
}

/**
 * 技能包上传结果
 */
export interface SkillPackageUploadResult {
  key: string;
  hash: string;
  size: number;
  url?: string;
}

// ============ 审计日志 ============

/**
 * 审计日志
 */
export interface AuditLog {
  id: string;
  adminId?: string;
  adminUsername?: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  result?: "success" | "failure";
  riskLevel?: "low" | "medium" | "high" | "critical";
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

/**
 * 审计日志查询参数
 */
export interface AuditLogListParams extends PaginationParams {
  adminId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  targetType?: string;
  riskLevel?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 审计日志列表响应
 */
export interface AuditLogListResponse {
  data: AuditLog[];
  meta: PaginationMeta;
}

// ============ 系统配置 ============

/**
 * 系统配置项
 */
export interface SystemConfig {
  key: string;
  value: unknown;
  description?: string;
  category: string;
  updatedAt: string;
  updatedBy?: string;
}

// ============ 管理员管理 ============

/**
 * 管理员列表项
 */
export interface AdminItem {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role: "super_admin" | "admin" | "operator";
  status: "active" | "suspended" | "locked";
  mfaEnabled: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
}

/**
 * 管理员列表查询参数
 */
export interface AdminListParams extends PaginationParams, SortParams {
  search?: string;
  role?: string;
  status?: string;
}

/**
 * 管理员列表响应
 */
export interface AdminListResponse {
  data: AdminItem[];
  meta: PaginationMeta;
}

/**
 * 创建管理员请求
 */
export interface CreateAdminRequest {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: "admin" | "operator";
}

/**
 * 更新管理员请求
 */
export interface UpdateAdminRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "operator";
}

// ============ 订阅统计 ============

/**
 * 订阅统计
 */
export interface SubscriptionStats {
  total: number;
  active: number;
  expired: number;
  cancelled: number;
  revenue: number;
}

// ============ 审计日志扩展 ============

/**
 * 审计日志统计
 */
export interface AuditLogStats {
  total: number;
  today: number;
  highRisk: number;
  byAction: Record<string, number>;
}

// ============ 系统配置扩展 ============

/**
 * 配置分组
 */
export interface ConfigGroup {
  key: string;
  name: string;
  description?: string;
  configCount: number;
}

/**
 * 配置变更历史
 */
export interface ConfigHistory {
  id: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
}

// ============ 仪表盘扩展 ============

/**
 * 趋势数据
 */
export interface TrendData {
  labels: string[];
  values: number[];
}

/**
 * 订阅分布
 */
export interface SubscriptionDistribution {
  name: string;
  code: string;
  count: number;
  percentage: number;
}

/**
 * 最近活动
 */
export interface Activity {
  type:
    | "user_register"
    | "subscription_created"
    | "subscription_canceled"
    | "payment_success"
    | "payment_refund";
  userId?: string;
  userName?: string;
  amount?: number;
  planName?: string;
  timestamp: string;
}

// ============ 监控扩展 ============

/**
 * 监控统计
 */
export interface MonitorStats {
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  services: Array<{
    name: string;
    status: "up" | "down" | "degraded";
    latency?: number;
    message?: string;
  }>;
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percentage: number };
  disk: { used: number; total: number; percentage: number };
}

/**
 * 资源使用历史
 */
export interface ResourceHistory {
  labels: string[];
  cpu: number[];
  memory: number[];
  disk: number[];
}

// ============ 模型提供商 ============

/**
 * 模型提供商
 */
export interface ModelProvider {
  id: string;
  configType: string;
  userId?: string;
  providerKey: string;
  providerName?: string;
  baseUrl: string;
  apiKey: string;
  apiType?: string;
  models: string[];
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建模型提供商请求
 */
export interface CreateModelProviderRequest {
  providerKey: string;
  providerName?: string;
  baseUrl: string;
  apiKey: string;
  apiType?: string;
  models: string[];
  enabled?: boolean;
  priority?: number;
  userId?: string;
}

/**
 * 更新模型提供商请求（apiKey 可选，留空保持原值）
 */
export interface UpdateModelProviderRequest {
  providerName?: string;
  baseUrl?: string;
  apiKey?: string;
  apiType?: string;
  models?: string[];
  enabled?: boolean;
  priority?: number;
  userId?: string;
}

/**
 * 创建/更新模型提供商请求（兼容旧代码）
 * @deprecated 请使用 CreateModelProviderRequest 或 UpdateModelProviderRequest
 */
export type UpsertModelProviderRequest = CreateModelProviderRequest;

/**
 * 单个模型的测试结果
 */
export interface ModelTestResult {
  model: string;
  available: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * 模型提供商测试结果（连通性 + 模型可用性）
 */
export interface ModelProviderTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
  models: ModelTestResult[];
}

// ============ Agent 配置 ============

/**
 * Agent 配置
 */
export interface AgentConfig {
  id?: string;
  configType: string;
  primaryModel?: string;
  workspacePath?: string;
  compactionMode?: string;
  maxConcurrent?: number;
  subagentsMaxConcurrent?: number;
  extraConfig?: Record<string, unknown>;
}

/**
 * 更新 Agent 配置请求
 */
export interface UpdateAgentConfigRequest {
  primaryModel?: string;
  workspacePath?: string;
  compactionMode?: string;
  maxConcurrent?: number;
  subagentsMaxConcurrent?: number;
  extraConfig?: Record<string, unknown>;
  userId?: string;
}

// ============ 监控数据 ============

/**
 * 仪表盘统计
 */
export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  activeUsers7d: number;
  paidUsers: number;
  revenueThisMonth: number;
  onlineDevices: number;
  apiCallsToday: number;
  changes: {
    users: number;
    revenue: number;
    subscriptions: number;
  };
}

/**
 * API 监控数据
 */
export interface ApiMonitorData {
  summary: {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    requestsPerSecond: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    method: string;
    count: number;
    avgTime: number;
    errorRate: number;
  }>;
  byStatusCode: Record<string, number>;
  timeline: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    avgTime: number;
  }>;
}

// ============ Auth Profile ============

/**
 * Auth Profile 凭证配置
 *
 * 存储 AI 提供商的认证凭据（API Key / Token / OAuth）
 */
export interface AuthProfile {
  id: string;
  configType: string;
  userId?: string;
  /** Profile 标识，如 "anthropic-main", "openai-backup" */
  profileId: string;
  /** 提供商标识，如 "anthropic", "openai", "google" */
  provider: string;
  /** 凭据类型 */
  credentialMode: "api_key" | "token" | "oauth";
  /** API Key（脱敏后仅显示最后 4 位） */
  apiKey?: string;
  /** 静态 Token（脱敏后仅显示最后 4 位） */
  token?: string;
  /** Token 过期时间 */
  tokenExpires?: string;
  /** OAuth 凭据（脱敏后显示为 { "***": "redacted" }） */
  oauthCredentials?: Record<string, unknown>;
  /** 关联邮箱 */
  email?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数值越小越优先） */
  priority: number;
  /** 模型绑定列表 */
  modelBindings?: unknown;
  /** 冷却配置 */
  cooldownConfig?: unknown;
  /** 扩展配置 */
  extraConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建 Auth Profile 请求
 */
export interface UpsertAuthProfileRequest {
  profileId: string;
  provider: string;
  credentialMode: "api_key" | "token" | "oauth";
  apiKey?: string;
  token?: string;
  tokenExpires?: string;
  oauthCredentials?: Record<string, unknown>;
  email?: string;
  enabled?: boolean;
  priority?: number;
  modelBindings?: unknown;
  cooldownConfig?: unknown;
  extraConfig?: Record<string, unknown>;
}

/**
 * 更新 Auth Profile 请求
 */
export interface UpdateAuthProfileRequest {
  apiKey?: string;
  token?: string;
  tokenExpires?: string;
  oauthCredentials?: Record<string, unknown>;
  email?: string;
  enabled?: boolean;
  priority?: number;
  modelBindings?: unknown;
  cooldownConfig?: unknown;
  extraConfig?: Record<string, unknown>;
}

/**
 * Auth Profile 优先级排序记录
 */
export interface AuthProfileOrder {
  id: string;
  configType: string;
  /** Agent 标识，"default" 代表全局默认 */
  agentKey: string;
  /** 有序的 profileId 列表 */
  profileIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ============ Gateway 配置 ============

/**
 * Gateway 配置
 *
 * 包含网关基础配置、认证配置、Control UI、Tailscale 等
 */
export interface GatewayConfig {
  id: string;
  configType: string;
  /** 网关模式 */
  gatewayMode: string;
  /** 网关端口 */
  gatewayPort: number;
  /** 绑定地址 */
  gatewayBind: string;
  /** 认证模式 */
  authMode: string;
  /** 认证令牌（脱敏后仅显示最后 4 位） */
  authToken?: string;
  /** 认证密码（脱敏后仅显示最后 4 位） */
  authPassword?: string;
  /** 是否允许 Tailscale 认证 */
  authAllowTailscale: boolean;
  /** 是否启用 Control UI */
  controlUiEnabled: boolean;
  /** 是否允许不安全认证 */
  controlUiAllowInsecureAuth: boolean;
  /** Tailscale 模式 */
  tailscaleMode: string;
  /** 退出时重置 Tailscale */
  tailscaleResetOnExit: boolean;
  /** 扩展配置 */
  extraConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 更新 Gateway 配置请求
 */
export interface UpdateGatewayConfigRequest {
  gatewayMode?: string;
  gatewayPort?: number;
  gatewayBind?: string;
  authMode?: string;
  authToken?: string;
  authPassword?: string;
  authAllowTailscale?: boolean;
  controlUiEnabled?: boolean;
  controlUiAllowInsecureAuth?: boolean;
  tailscaleMode?: string;
  tailscaleResetOnExit?: boolean;
  extraConfig?: Record<string, unknown>;
}

// ============ 监控日志和告警 ============

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志条目
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * 日志查询参数
 */
export interface LogQueryParams {
  level?: LogLevel;
  source?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

/**
 * 日志查询响应
 */
export interface LogQueryResponse {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * 日志统计
 */
export interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
}

/**
 * 告警严重级别
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * 告警
 */
export interface Alert {
  id: string;
  type: "cpu" | "memory" | "disk" | "api_error" | "service_down" | "custom";
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 告警列表查询参数
 */
export interface AlertListParams {
  acknowledged?: boolean;
  resolved?: boolean;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}

/**
 * 告警列表响应
 */
export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  unacknowledged: number;
}

// ============ 数据分析 ============

/**
 * 分析概览
 */
export interface AnalyticsOverview {
  users: {
    total: number;
    active: number;
    newToday: number;
    growthRate: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growthRate: number;
  };
  skills: {
    total: number;
    active: number;
    newThisWeek: number;
  };
  subscriptions: {
    active: number;
    conversionRate: number;
  };
}

/**
 * 用户增长趋势数据点
 */
export interface GrowthDataPoint {
  date: string;
  total: number;
  new: number;
  active: number;
}

/**
 * 趋势摘要
 */
export interface GrowthSummary {
  totalUsers: number;
  newUsers: number;
  growthRate: number;
  avgDailyGrowth: number;
}

/**
 * 用户增长趋势响应
 */
export interface UserGrowthTrendResponse {
  period: string;
  data: GrowthDataPoint[];
  summary: GrowthSummary;
}

/**
 * 留存队列
 */
export interface RetentionCohort {
  cohort: string;
  cohortSize: number;
  day1: number;
  day3: number;
  day7: number;
  day14: number;
  day30: number;
}

/**
 * 留存分析响应
 */
export interface RetentionAnalysisResponse {
  period: string;
  cohorts: RetentionCohort[];
  averageRetention: {
    day1: number;
    day3: number;
    day7: number;
    day14: number;
    day30: number;
  };
}

/**
 * 活跃时段分布
 */
export interface HourDistribution {
  hour: number;
  count: number;
}

/**
 * 用户画像响应
 */
export interface UserDemographicsResponse {
  byPlan: Array<{ name: string; count: number; percentage: number }>;
  byDevice: Array<{ name: string; count: number; percentage: number }>;
  byRegion: Array<{ region: string; count: number; percentage: number }>;
  byActiveHour: HourDistribution[];
}

/**
 * 收入趋势数据点
 */
export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * 收入趋势响应
 */
export interface RevenueTrendResponse {
  period: string;
  data: RevenueDataPoint[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    growthRate: number;
    avgDailyRevenue: number;
  };
}

/**
 * 收入来源分布
 */
export interface RevenueSourcesResponse {
  byPlan: Array<{ plan: string; revenue: number; percentage: number; orders: number }>;
  byPaymentMethod: Array<{
    method: string;
    revenue: number;
    percentage: number;
    orders: number;
  }>;
}

/**
 * 用户价值指标
 */
export interface UserValueMetricsResponse {
  arpu: number;
  arppu: number;
  ltv: number;
  payingUserRate: number;
}

/**
 * 技能使用趋势数据点
 */
export interface SkillUsageTrendPoint {
  date: string;
  executions: number;
  uniqueUsers: number;
}

/**
 * 技能使用分析响应
 */
export interface SkillUsageAnalyticsResponse {
  period: string;
  topSkills: Array<{
    id: string;
    name: string;
    installCount: number;
    activeUsers: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  usageTrend: SkillUsageTrendPoint[];
  summary: {
    totalSkills: number;
    activeSkills: number;
    totalInstalls: number;
    avgInstallsPerSkill: number;
  };
}

/**
 * 漏斗步骤
 */
export interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  dropoffRate: number;
}

/**
 * 漏斗分析响应
 */
export interface FunnelAnalysisResponse {
  name: string;
  steps: FunnelStep[];
  overallConversionRate: number;
  period: string;
}

/**
 * 漏斗类型
 */
export interface FunnelType {
  id: string;
  name: string;
  description: string;
}

// ============ 积分管理 ============

/**
 * 积分账户余额
 */
export interface CreditBalance {
  id: string;
  userId: string;
  totalBalance: number;
  totalEarned: number;
  totalConsumed: number;
  totalExpired: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 积分流水记录
 */
export interface CreditTransaction {
  id: string;
  userId: string;
  batchId?: string;
  type: "earn" | "consume" | "expire" | "refund" | "admin_adjust";
  amount: number;
  balanceAfter: number;
  source: string;
  sourceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * 积分流水查询参数
 */
export interface CreditHistoryParams {
  limit?: number;
  offset?: number;
}

/**
 * 管理员发放积分请求
 */
export interface GrantCreditsRequest {
  amount: number;
  expiryMonths?: number;
  description?: string;
  adminNote?: string;
}

/**
 * 积分操作结果
 */
export interface CreditOperationResult {
  success: boolean;
  creditsGranted: number;
  newBalance: number;
  reason?: string;
}

/**
 * 模型定价
 */
export interface ModelPricing {
  id: string;
  modelId: string;
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  multiplier: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建/更新模型定价请求
 */
export interface UpsertModelPricingRequest {
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  multiplier?: string;
}

/**
 * 过期清理结果
 */
export interface CleanupResult {
  batchesCleaned: number;
  creditsExpired: number;
}

// ============ Embedding 测试 ============

/**
 * Embedding 连接测试请求参数
 */
export interface TestEmbeddingRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions?: number;
}

/**
 * Embedding 连接测试结果
 */
export interface EmbeddingTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
  /** 实际返回的向量维度 */
  dimensions?: number;
}

// ============ LLM 调用日志 ============

/**
 * LLM 调用状态
 */
export type LlmCallStatus = "success" | "error" | "timeout" | "rate_limited" | "auth_error";

/**
 * LLM 调用日志记录
 */
export interface LlmCallLog {
  id: string;
  userId?: string;
  userName?: string;
  sessionId?: string;
  runId?: string;
  channel?: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  status: LlmCallStatus;
  errorMessage?: string;
  inputContent?: string;
  outputContent?: string;
  creditsConsumed?: number;
  metadata?: Record<string, unknown>;
  calledAt: string;
  createdAt: string;
}

/**
 * LLM 日志查询参数
 */
export interface LlmLogQueryParams {
  userId?: string;
  userName?: string;
  provider?: string;
  model?: string;
  status?: LlmCallStatus;
  channel?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

/**
 * LLM 日志列表响应
 */
export interface LlmLogListResponse {
  logs: LlmCallLog[];
  total: number;
  hasMore: boolean;
}

/**
 * LLM 调用统计
 */
export interface LlmLogStats {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * LLM 模型使用分布
 */
export interface LlmModelDistribution {
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  totalCalls: number;
}

/**
 * LLM 性能指标
 */
export interface LlmPerformanceStats {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  errorRate: number;
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ============ 用户记忆管理 ============

/**
 * 用户记忆概览
 */
export interface UserMemoryOverview {
  userId: string;
  hasProfile: boolean;
  factsCount: number;
  hasPreferences: boolean;
  workspaceFilesCount: number;
  auditLogsCount: number;
}

/**
 * 用户记忆事实
 */
export interface UserMemoryFact {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  sensitive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户记忆事实查询参数
 */
export interface UserMemoryFactsParams {
  category?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 用户记忆事实列表响应
 */
export interface UserMemoryFactsResponse {
  facts: UserMemoryFact[];
  total: number;
}

/**
 * 用户偏好
 */
export interface UserMemoryPreferences {
  language?: string;
  timezone?: string;
  responseStyle?: string;
  confirmLevel?: string;
  thinkingLevel?: string;
  verboseLevel?: string;
  favoriteSkills?: string[];
  disabledSkills?: string[];
  notifications?: Record<string, unknown>;
}

/**
 * 用户 Workspace 文件
 */
export interface UserWorkspaceFileInfo {
  id: string;
  fileName: string;
  content: string;
  isCustomized: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 记忆审计日志
 */
export interface MemoryAuditLogEntry {
  id: string;
  userId: string;
  action: string;
  source: string;
  targetId?: string;
  sessionId?: string;
  agentId?: string;
  adminId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

/**
 * 记忆审计日志查询参数
 */
export interface MemoryAuditLogParams {
  action?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

/**
 * 记忆审计日志列表响应
 */
export interface MemoryAuditLogResponse {
  logs: MemoryAuditLogEntry[];
  total: number;
}

/**
 * 默认模板信息
 */
export interface MemoryDefaultTemplate {
  key: string;
  fileName: string;
  content: string;
  updatedAt?: string;
}

/**
 * 更新默认模板请求
 */
export interface UpdateMemoryDefaultRequest {
  content: string;
}

// ============ Bundled 技能管理 ============

/**
 * Bundled 技能信息
 */
export interface BundledSkillInfo {
  /** 技能名称（目录名） */
  name: string;
  /** 技能描述 */
  description: string;
  /** 是否被管理员禁用 */
  isDisabled: boolean;
  /** 技能元数据 */
  metadata: Record<string, unknown>;
}

/**
 * Bundled 技能列表响应
 */
export interface BundledSkillsResponse {
  data: BundledSkillInfo[];
  meta: {
    total: number;
    disabledCount: number;
  };
}

/**
 * 批量更新禁用列表请求
 */
export interface BatchUpdateBundledSkillsRequest {
  disabled: string[];
}
