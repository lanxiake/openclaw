/**
 * 用户 JWT 认证 Fastify 插件
 *
 * 从 Authorization header 提取 Bearer Token，校验 JWT，
 * 将用户信息注入 request.user。
 *
 * 复用 src/assistant/auth/jwt.ts 的 verifyAccessToken 函数。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  verifyAccessToken,
  extractBearerToken,
  type UserAccessTokenPayload,
} from "../../../../src/assistant/auth/jwt.js";
import { type AppConfig } from "../config.js";

/** 不需要认证的公开路由 */
const PUBLIC_ROUTES = new Set([
  "/api/health",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/send-code",
]);

/**
 * 检查是否为公开路由
 */
function isPublicRoute(url: string): boolean {
  // 移除 query string
  const path = url.split("?")[0];
  return PUBLIC_ROUTES.has(path);
}

/**
 * 检查是否为管理员路由（由 admin-auth 插件处理）
 */
function isAdminRoute(url: string): boolean {
  return url.startsWith("/api/admin");
}

/** request.user 类型 */
export interface RequestUser {
  userId: string;
  type: "user";
}

/**
 * 注册用户认证插件
 *
 * 在 onRequest 钩子中校验 JWT Token
 * 公开路由和管理员路由不做校验
 */
export function registerAuthPlugin(
  server: FastifyInstance,
  _config: AppConfig,
): void {
  // 装饰 request 对象
  server.decorateRequest("user", null);

  server.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 公开路由跳过认证
      if (isPublicRoute(request.url)) return;

      // 管理员路由由 admin-auth 插件处理
      if (isAdminRoute(request.url)) return;

      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        reply.code(401).send({
          success: false,
          error: "Missing or invalid authorization token",
          code: "UNAUTHORIZED",
        });
        return;
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        reply.code(401).send({
          success: false,
          error: "Invalid or expired token",
          code: "TOKEN_INVALID",
        });
        return;
      }

      // 注入用户信息到 request
      (request as FastifyRequest & { user: RequestUser }).user = {
        userId: payload.sub,
        type: "user",
      };
    },
  );
}

/**
 * 从 request 中获取已认证的用户信息
 *
 * 用于路由处理器中获取当前用户
 */
export function getRequestUser(request: FastifyRequest): RequestUser | null {
  return (request as FastifyRequest & { user: RequestUser | null }).user;
}

/**
 * 要求用户认证的路由守卫
 *
 * 在具体路由的 preHandler 中使用
 */
export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = getRequestUser(request);
  if (!user) {
    reply.code(401).send({
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }
}
