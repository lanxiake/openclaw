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
  subscriptionLevel: "free" | "basic" | "pro" | "enterprise";
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
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

/**
 * 订阅分布
 */
export interface SubscriptionDistribution {
  planName: string;
  count: number;
  percentage: number;
}

/**
 * 最近活动
 */
export interface Activity {
  id: string;
  type: string;
  description: string;
  adminName?: string;
  createdAt: string;
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
 * 创建/更新模型提供商请求
 */
export interface UpsertModelProviderRequest {
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
  users: {
    total: number;
    active: number;
    newToday: number;
    newWeek: number;
  };
  subscriptions: {
    total: number;
    active: number;
    revenue: number;
  };
  skills: {
    total: number;
    published: number;
    pending: number;
  };
  system: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
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
