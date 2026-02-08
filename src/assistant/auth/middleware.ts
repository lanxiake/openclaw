/**
 * 认证中间件
 *
 * 用于验证请求中的 JWT Token
 */

import type { Request, Response, NextFunction } from "express";

import { getLogger } from "../../logging/logger.js";
import { getUserRepository } from "../../db/index.js";
import { verifyAccessToken, extractBearerToken, type UserAccessTokenPayload } from "./jwt.js";

const logger = getLogger();

/**
 * 认证后的请求对象
 */
export interface AuthenticatedRequest extends Request {
  /** 认证用户信息 */
  user?: {
    id: string;
    phone?: string | null;
    email?: string | null;
    displayName?: string | null;
  };
  /** Token 负载 */
  tokenPayload?: UserAccessTokenPayload;
}

/**
 * 认证中间件选项
 */
export interface AuthMiddlewareOptions {
  /** 是否必须认证 (默认 true) */
  required?: boolean;
  /** 是否验证用户存在 (默认 true) */
  verifyUser?: boolean;
}

/**
 * 创建认证中间件
 */
export function authMiddleware(options: AuthMiddlewareOptions = {}) {
  const { required = true, verifyUser = true } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. 提取 Token
      const token = extractBearerToken(req.headers.authorization);

      if (!token) {
        if (required) {
          res.status(401).json({
            error: "未提供认证令牌",
            errorCode: "MISSING_TOKEN",
          });
          return;
        }
        return next();
      }

      // 2. 验证 Token
      const payload = verifyAccessToken(token);

      if (!payload) {
        if (required) {
          res.status(401).json({
            error: "无效或过期的令牌",
            errorCode: "INVALID_TOKEN",
          });
          return;
        }
        return next();
      }

      // 3. 验证用户存在
      if (verifyUser) {
        const userRepo = getUserRepository();
        const user = await userRepo.findById(payload.sub);

        if (!user) {
          logger.warn("[auth-middleware] User not found", {
            userId: payload.sub,
          });
          res.status(401).json({
            error: "用户不存在",
            errorCode: "USER_NOT_FOUND",
          });
          return;
        }

        if (!user.isActive) {
          logger.warn("[auth-middleware] User is inactive", {
            userId: payload.sub,
          });
          res.status(401).json({
            error: "账户已被停用",
            errorCode: "USER_INACTIVE",
          });
          return;
        }

        // 设置用户信息到请求对象
        req.user = {
          id: user.id,
          phone: user.phone,
          email: user.email,
          displayName: user.displayName,
        };
      } else {
        req.user = {
          id: payload.sub,
        };
      }

      req.tokenPayload = payload;

      return next();
    } catch (error) {
      logger.error("[auth-middleware] Error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      res.status(500).json({
        error: "认证服务错误",
        errorCode: "AUTH_ERROR",
      });
    }
  };
}

/**
 * 必须认证的中间件
 */
export const requireAuth = authMiddleware({ required: true, verifyUser: true });

/**
 * 可选认证的中间件
 */
export const optionalAuth = authMiddleware({
  required: false,
  verifyUser: true,
});

/**
 * 仅验证 Token 的中间件 (不查询数据库)
 */
export const tokenOnlyAuth = authMiddleware({
  required: true,
  verifyUser: false,
});
