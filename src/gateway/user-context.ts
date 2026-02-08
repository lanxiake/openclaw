/**
 * 网关用户上下文模块
 *
 * 定义多租户网关中的用户身份和上下文类型
 * 用于在 WebSocket 连接和 RPC 请求中传递用户信息
 */

// ============================================================================
// 用户身份类型
// ============================================================================

/**
 * 已认证用户信息
 *
 * 附加到 WebSocket 连接上，表示当前连接的用户身份
 */
export interface AuthenticatedUser {
  /** 用户 ID */
  userId: string;
  /** 用户显示名称 */
  displayName?: string;
  /** 用户邮箱 */
  email?: string;
  /** 用户手机号 */
  phone?: string;
  /** 当前订阅套餐 ID */
  subscriptionPlanId?: string;
  /** 订阅套餐代码 (free/pro/enterprise) */
  subscriptionPlanCode?: string;
  /** 订阅状态 */
  subscriptionStatus?: "active" | "expired" | "canceled" | "trial";
  /** 认证时间 */
  authenticatedAt: Date;
  /** Token 过期时间 */
  tokenExpiresAt?: Date;
}

/**
 * 用户认证参数
 *
 * 在 WebSocket 握手时传递
 */
export interface UserAuthParams {
  /** JWT Access Token */
  accessToken: string;
}

/**
 * JWT Token 载荷
 *
 * 从 Access Token 解析出的用户信息
 */
export interface UserTokenPayload {
  /** 用户 ID (subject) */
  sub: string;
  /** 用户邮箱 */
  email?: string;
  /** 用户手机号 */
  phone?: string;
  /** 用户显示名称 */
  name?: string;
  /** 订阅套餐 ID */
  planId?: string;
  /** 订阅套餐代码 */
  planCode?: string;
  /** Token 签发时间 */
  iat: number;
  /** Token 过期时间 */
  exp: number;
  /** Token 签发者 */
  iss?: string;
  /** Token 受众 */
  aud?: string;
}

// ============================================================================
// 请求上下文类型
// ============================================================================

/**
 * 网关请求上下文
 *
 * 在 RPC 方法处理器中可用的上下文信息
 */
export interface GatewayRequestContext {
  /** 当前用户 ID (如果已认证) */
  currentUserId?: string;
  /** 当前用户完整信息 */
  currentUser?: AuthenticatedUser;
  /** 请求 ID */
  requestId: string;
  /** 请求时间戳 */
  timestamp: Date;
  /** 客户端 IP */
  clientIp?: string;
  /** 设备 ID */
  deviceId?: string;
}

// ============================================================================
// 配额相关类型
// ============================================================================

/**
 * 配额类型
 */
export type QuotaType =
  | "aiCalls" // AI 调用次数
  | "tokens" // Token 使用量
  | "storage" // 存储空间
  | "devices" // 设备数量
  | "agents" // Agent 数量
  | "skills"; // 技能数量

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  /** 是否允许 */
  allowed: boolean;
  /** 配额类型 */
  quotaType: QuotaType;
  /** 已使用量 */
  used: number;
  /** 总配额 (-1 表示无限制) */
  limit: number;
  /** 剩余量 */
  remaining: number;
  /** 拒绝原因 (如果不允许) */
  reason?: string;
  /** 配额重置时间 */
  resetsAt?: Date;
}

/**
 * 配额使用记录
 */
export interface QuotaUsageRecord {
  /** 用户 ID */
  userId: string;
  /** 配额类型 */
  quotaType: QuotaType;
  /** 使用量 */
  amount: number;
  /** 记录时间 */
  timestamp: Date;
  /** 关联的请求 ID */
  requestId?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 认证错误类型
// ============================================================================

/**
 * 认证错误代码
 */
export type AuthErrorCode =
  | "TOKEN_MISSING" // Token 缺失
  | "TOKEN_INVALID" // Token 无效
  | "TOKEN_EXPIRED" // Token 过期
  | "TOKEN_REVOKED" // Token 已撤销
  | "USER_NOT_FOUND" // 用户不存在
  | "USER_DISABLED" // 用户已禁用
  | "SUBSCRIPTION_EXPIRED" // 订阅已过期
  | "QUOTA_EXCEEDED" // 配额超限
  | "PERMISSION_DENIED"; // 权限不足

/**
 * 认证错误
 */
export interface AuthError {
  /** 错误代码 */
  code: AuthErrorCode;
  /** 错误消息 */
  message: string;
  /** 额外详情 */
  details?: Record<string, unknown>;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建空的请求上下文
 */
export function createEmptyRequestContext(requestId: string): GatewayRequestContext {
  return {
    requestId,
    timestamp: new Date(),
  };
}

/**
 * 创建带用户的请求上下文
 */
export function createUserRequestContext(
  requestId: string,
  user: AuthenticatedUser,
  clientIp?: string,
  deviceId?: string,
): GatewayRequestContext {
  return {
    currentUserId: user.userId,
    currentUser: user,
    requestId,
    timestamp: new Date(),
    clientIp,
    deviceId,
  };
}

/**
 * 检查用户是否已认证
 */
export function isAuthenticated(context: GatewayRequestContext): boolean {
  return !!context.currentUserId && !!context.currentUser;
}

/**
 * 检查用户订阅是否有效
 */
export function hasActiveSubscription(user: AuthenticatedUser): boolean {
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trial";
}

/**
 * 创建认证错误
 */
export function createAuthError(code: AuthErrorCode, message: string): AuthError {
  return { code, message };
}

/**
 * 格式化配额信息
 */
export function formatQuotaInfo(result: QuotaCheckResult): string {
  if (result.limit === -1) {
    return `${result.quotaType}: ${result.used} used (unlimited)`;
  }
  return `${result.quotaType}: ${result.used}/${result.limit} (${result.remaining} remaining)`;
}
