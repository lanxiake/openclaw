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
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
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
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  result: "success" | "failure";
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
