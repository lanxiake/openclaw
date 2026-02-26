/**
 * 管理员 JWT 工具模块
 *
 * 处理管理员访问令牌的生成和验证
 */

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from "jsonwebtoken";
import { z } from "zod";

import type { AdminPermissions } from "../../db/schema/admins.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * JWT 中嵌入的 AdminPermissions 运行时验证 Schema
 *
 * 防止 JWT 被篡改时注入非法权限字段
 */
const boolRecord = z.record(z.string(), z.boolean()).optional();
const adminPermissionsSchema = z
  .object({
    users: boolRecord,
    subscriptions: boolRecord,
    skills: boolRecord,
    system: boolRecord,
    admins: boolRecord,
  })
  .strict()
  .optional();

/**
 * 验证并提取 JWT 中的 permissions 字段
 *
 * @returns 经过 schema 验证的 permissions，验证失败返回 undefined
 */
function parsePermissions(raw: unknown): AdminPermissions | undefined {
  const result = adminPermissionsSchema.safeParse(raw);
  if (!result.success) {
    logger.warn("[admin-jwt] Invalid permissions in JWT, ignoring", {
      errors: result.error.issues,
    });
    return undefined;
  }
  return result.data as AdminPermissions | undefined;
}

// 管理员 Token 配置
export const ADMIN_TOKEN_CONFIG = {
  /** Access Token 有效期 (30 分钟) */
  accessTokenExpiresIn: "30m",
  /** Refresh Token 有效期 (24 小时) */
  refreshTokenExpiresIn: 24 * 60 * 60 * 1000, // 毫秒
  /** Refresh Token 轮转阈值 (剩余 4 小时时自动轮转) */
  refreshRotateThreshold: 4 * 60 * 60 * 1000, // 毫秒
  /** 每个管理员最多活跃会话数 */
  maxSessionsPerAdmin: 3,
  /** 令牌签发者 */
  issuer: "mtbot-admin",
  /** 令牌受众 */
  audience: "mtbot-admin-api",
};

/**
 * Admin Access Token 负载结构
 */
export interface AdminAccessTokenPayload {
  /** 管理员 ID */
  sub: string;
  /** Token 类型 */
  type: "admin";
  /** 管理员角色 */
  role: string;
  /** 自定义权限（覆盖角色默认权限） */
  permissions?: AdminPermissions;
  /** 受众 */
  aud: string;
  /** 签发时间 (Unix 时间戳) */
  iat: number;
  /** 过期时间 (Unix 时间戳) */
  exp: number;
  /** 签发者 */
  iss: string;
}

/**
 * Token 对
 */
export interface AdminTokenPair {
  /** 访问令牌 */
  accessToken: string;
  /** 过期时间 (秒) */
  expiresIn: number;
}

/**
 * 从环境变量获取管理员 JWT 密钥
 */
export function getAdminJwtSecret(): string {
  // 优先使用专用的管理员密钥，否则回退到通用密钥
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error(
      "ADMIN_JWT_SECRET or JWT_SECRET environment variable is not set. " +
        "Please configure a secure random string for JWT signing.",
    );
  }
  if (secret.length < 32) {
    logger.warn("[admin-jwt] JWT secret is too short, recommend at least 32 characters");
  }
  return secret;
}

/**
 * 生成管理员 Access Token
 *
 * @param adminId 管理员 ID
 * @param role 管理员角色
 * @param options 可选配置
 * @returns Token 对 (accessToken + expiresIn)
 */
export function generateAdminAccessToken(
  adminId: string,
  role: string,
  options?: { expiresIn?: string; permissions?: AdminPermissions },
): AdminTokenPair {
  const secret = getAdminJwtSecret();
  const expiresIn = options?.expiresIn || ADMIN_TOKEN_CONFIG.accessTokenExpiresIn;

  const signOptions: SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    issuer: ADMIN_TOKEN_CONFIG.issuer,
    audience: ADMIN_TOKEN_CONFIG.audience,
  };

  const payload: Record<string, unknown> = {
    sub: adminId,
    type: "admin" as const,
    role,
  };

  // 仅当有自定义权限时才添加到 JWT（减少 token 大小）
  if (options?.permissions && Object.keys(options.permissions).length > 0) {
    payload.permissions = options.permissions;
  }

  const accessToken = jwt.sign(payload, secret, signOptions);

  // JWT 体积监控：超过 2KB 时发出警告
  const tokenBytes = Buffer.byteLength(accessToken, "utf8");
  if (tokenBytes > 2048) {
    logger.warn("[admin-jwt] JWT token 体积过大，可能影响请求性能", {
      adminId,
      tokenBytes,
      hasPermissions: !!options?.permissions,
    });
  }

  // 计算过期秒数
  const expiresInSeconds = parseExpiresIn(expiresIn);

  logger.debug("[admin-jwt] Access token generated", { adminId, role, expiresIn });

  return {
    accessToken,
    expiresIn: expiresInSeconds,
  };
}

/**
 * 验证管理员 Access Token
 *
 * @param token JWT 字符串
 * @returns 验证后的负载，验证失败返回 null
 */
export function verifyAdminAccessToken(token: string): AdminAccessTokenPayload | null {
  try {
    const secret = getAdminJwtSecret();

    const verifyOptions: VerifyOptions = {
      issuer: ADMIN_TOKEN_CONFIG.issuer,
      audience: ADMIN_TOKEN_CONFIG.audience,
    };

    const decoded = jwt.verify(token, secret, verifyOptions) as JwtPayload;

    // 验证 token 类型
    if (decoded.type !== "admin") {
      logger.warn("[admin-jwt] Invalid token type", { type: decoded.type });
      return null;
    }

    return {
      sub: decoded.sub as string,
      type: "admin",
      role: decoded.role as string,
      permissions: parsePermissions(decoded.permissions),
      aud: decoded.aud as string,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
      iss: decoded.iss as string,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug("[admin-jwt] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn("[admin-jwt] Invalid token", {
        error: error.message,
      });
    } else {
      logger.error("[admin-jwt] Token verification error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return null;
  }
}

/**
 * 解码管理员 Token (不验证)
 *
 * @param token JWT 字符串
 * @returns 解码后的负载
 */
export function decodeAdminToken(token: string): AdminAccessTokenPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded) return null;

    return {
      sub: decoded.sub as string,
      type: decoded.type as "admin",
      role: decoded.role as string,
      permissions: parsePermissions(decoded.permissions),
      aud: decoded.aud as string,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
      iss: decoded.iss as string,
    };
  } catch {
    return null;
  }
}

/**
 * 检查管理员 Token 是否即将过期
 *
 * @param token JWT 字符串
 * @param thresholdSeconds 阈值秒数 (默认 5 分钟)
 * @returns 是否即将过期
 */
export function isAdminTokenExpiringSoon(
  token: string,
  thresholdSeconds: number = 5 * 60,
): boolean {
  const decoded = decodeAdminToken(token);
  if (!decoded) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded.exp - now;

  return timeLeft <= thresholdSeconds;
}

/**
 * 从 Authorization header 提取 Token
 *
 * @param authHeader Authorization header 值
 * @returns Token 字符串，格式不正确返回 null
 */
export function extractAdminBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * 检查管理员角色权限
 *
 * @param requiredRole 所需角色
 * @param actualRole 实际角色
 * @returns 是否有权限
 */
export function hasAdminRole(requiredRole: string, actualRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    operator: 1,
    admin: 2,
    super_admin: 3,
  };

  const required = roleHierarchy[requiredRole] || 0;
  const actual = roleHierarchy[actualRole] || 0;

  return actual >= required;
}

/**
 * 解析过期时间字符串为秒数
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    // 默认返回 30 分钟
    return 1800;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      return 1800;
  }
}
