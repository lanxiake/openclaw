/**
 * 管理员 JWT 认证 Fastify 插件
 *
 * 从 Authorization header 提取 Bearer Token，校验管理员 JWT，
 * 将管理员信息注入 request.admin。
 *
 * 复用 src/assistant/admin-auth/admin-jwt.ts 的 verifyAdminAccessToken 函数。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  verifyAdminAccessToken,
  hasAdminRole,
} from "../../../../src/assistant/admin-auth/admin-jwt.js";
import { extractBearerToken } from "../../../../src/assistant/auth/jwt.js";
import { type AppConfig } from "../config.js";

/** 管理员公开路由（无需认证） */
const ADMIN_PUBLIC_ROUTES = new Set([
  "/api/admin/auth/login",
  "/api/admin/auth/refresh",
]);

/** request.admin 类型 */
export interface RequestAdmin {
  adminId: string;
  role: string;
  type: "admin";
}

/**
 * 注册管理员认证插件
 *
 * 仅处理 /api/admin/* 路径下的请求
 */
export function registerAdminAuthPlugin(
  server: FastifyInstance,
  _config: AppConfig,
): void {
  // 装饰 request 对象
  server.decorateRequest("admin", null);

  server.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 仅处理管理员路由
      if (!request.url.startsWith("/api/admin")) return;

      // 管理员公开路由跳过认证
      const path = request.url.split("?")[0];
      if (ADMIN_PUBLIC_ROUTES.has(path)) return;

      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        reply.code(401).send({
          success: false,
          error: "Missing or invalid admin authorization token",
          code: "ADMIN_UNAUTHORIZED",
        });
        return;
      }

      const payload = verifyAdminAccessToken(token);
      if (!payload) {
        reply.code(401).send({
          success: false,
          error: "Invalid or expired admin token",
          code: "ADMIN_TOKEN_INVALID",
        });
        return;
      }

      // 注入管理员信息到 request
      (request as FastifyRequest & { admin: RequestAdmin }).admin = {
        adminId: payload.sub,
        role: payload.role,
        type: "admin",
      };
    },
  );
}

/**
 * 从 request 中获取已认证的管理员信息
 */
export function getRequestAdmin(request: FastifyRequest): RequestAdmin | null {
  return (request as FastifyRequest & { admin: RequestAdmin | null }).admin;
}

/**
 * 要求管理员认证的路由守卫
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const admin = getRequestAdmin(request);
  if (!admin) {
    reply.code(401).send({
      success: false,
      error: "Admin authentication required",
      code: "ADMIN_UNAUTHORIZED",
    });
  }
}

/**
 * 要求指定管理员角色的路由守卫工厂
 *
 * @param requiredRole - 最低要求角色 (operator < admin < super_admin)
 */
export function requireAdminRole(requiredRole: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const admin = getRequestAdmin(request);
    if (!admin) {
      reply.code(401).send({
        success: false,
        error: "Admin authentication required",
        code: "ADMIN_UNAUTHORIZED",
      });
      return;
    }

    if (!hasAdminRole(requiredRole, admin.role)) {
      reply.code(403).send({
        success: false,
        error: `Insufficient permissions, requires ${requiredRole} or higher`,
        code: "FORBIDDEN",
      });
    }
  };
}
