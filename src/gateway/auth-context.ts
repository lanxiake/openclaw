/**
 * 认证上下文提取工具
 *
 * 从 RPC 请求参数中提取用户或管理员的认证上下文，
 * 提供统一的 userId/adminId 供 TenantScopedRepository 使用。
 *
 * 支持两种认证方式：
 * - 用户端：Bearer Token（优先）或 userId 参数（向后兼容）
 * - 管理员端：Bearer Token
 */

import { getLogger } from "../logging/logger.js";
import { verifyAccessToken, extractBearerToken } from "../assistant/auth/jwt.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../assistant/admin-auth/admin-jwt.js";

const logger = getLogger();

/**
 * 用户认证上下文
 */
export interface UserAuthContext {
  /** 用户 ID（即租户 ID） */
  userId: string;
  /** 认证类型 */
  type: "user";
}

/**
 * 管理员认证上下文
 */
export interface AdminAuthContext {
  /** 管理员 ID */
  adminId: string;
  /** 管理员角色 */
  role: string;
  /** 认证类型 */
  type: "admin";
}

/**
 * 从 RPC 请求参数中提取用户认证上下文
 *
 * 提取优先级：
 * 1. Bearer Token 中的 userId（通过 JWT 验证）
 * 2. params.userId 参数（向后兼容，无 Token 时使用）
 *
 * @param params - RPC 请求参数对象
 * @returns 用户认证上下文，提取失败返回 null
 */
export function extractUserContext(params: Record<string, unknown>): UserAuthContext | null {
  logger.debug("[extractUserContext] 开始提取用户认证上下文");

  // 优先尝试从 Bearer Token 提取
  const authHeader = params["authorization"] as string | undefined;
  const token = extractBearerToken(authHeader);

  if (token) {
    logger.debug("[extractUserContext] 发现 Bearer Token, 验证中...");

    const payload = verifyAccessToken(token);
    if (payload) {
      logger.debug(`[extractUserContext] Token 验证成功, userId=${payload.sub}`);
      return {
        userId: payload.sub,
        type: "user",
      };
    }

    logger.warn("[extractUserContext] Bearer Token 验证失败");
  }

  // 向后兼容：从 userId 参数提取
  const userId = params["userId"] as string | undefined;
  if (userId && typeof userId === "string" && userId.trim().length > 0) {
    logger.debug(`[extractUserContext] 从 userId 参数提取, userId=${userId}`);
    return {
      userId,
      type: "user",
    };
  }

  logger.debug("[extractUserContext] 未找到有效的用户认证信息");
  return null;
}

/**
 * 从 RPC 请求参数中提取管理员认证上下文
 *
 * 仅支持 Bearer Token 认证方式。
 *
 * @param params - RPC 请求参数对象
 * @returns 管理员认证上下文，提取失败返回 null
 */
export function extractAdminContext(params: Record<string, unknown>): AdminAuthContext | null {
  logger.debug("[extractAdminContext] 开始提取管理员认证上下文");

  const authHeader = params["authorization"] as string | undefined;
  const token = extractAdminBearerToken(authHeader);

  if (!token) {
    logger.debug("[extractAdminContext] 未找到管理员 Bearer Token");
    return null;
  }

  logger.debug("[extractAdminContext] 发现管理员 Bearer Token, 验证中...");

  const payload = verifyAdminAccessToken(token);
  if (!payload) {
    logger.warn("[extractAdminContext] 管理员 Token 验证失败");
    return null;
  }

  logger.debug(
    `[extractAdminContext] Token 验证成功, adminId=${payload.sub}, role=${payload.role}`,
  );

  return {
    adminId: payload.sub,
    role: payload.role,
    type: "admin",
  };
}
