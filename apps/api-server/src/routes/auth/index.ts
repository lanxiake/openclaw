/**
 * 用户认证 API 路由（公开路由）
 *
 * POST   /api/auth/register    - 用户注册
 * POST   /api/auth/login       - 用户登录
 * POST   /api/auth/refresh     - 刷新 Token
 * POST   /api/auth/send-code   - 发送验证码
 * POST   /api/auth/logout      - 用户登出
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  register,
  login,
  refreshToken,
  logout,
} from "../../../../../src/assistant/auth/auth-service.js";
import { getRequestUser } from "../../plugins/auth.js";
import { registerUserRegistrationRoutes } from "./registration.js";

/**
 * 从请求中提取客户端信息
 */
function getClientInfo(request: FastifyRequest): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    request.ip ||
    "unknown";
  const userAgent = (request.headers["user-agent"] as string) || "unknown";
  return { ipAddress, userAgent };
}

/**
 * 注册用户认证路由
 */
export function registerAuthRoutes(server: FastifyInstance): void {
  // 注册新版用户注册路由
  registerUserRegistrationRoutes(server);

  /**
   * POST /api/auth/register - 用户注册（旧版，保留兼容性）
   */
  server.post(
    "/api/auth/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        username?: string;
        email?: string;
        password?: string;
        phone?: string;
        verificationCode?: string;
      };

      // 参数校验
      if (!body.username || !body.password) {
        return reply.code(400).send({
          success: false,
          error: "Username and password are required",
          code: "VALIDATION_ERROR",
        });
      }

      if (body.password.length < 8) {
        return reply.code(400).send({
          success: false,
          error: "Password must be at least 8 characters",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { username: body.username, ipAddress },
        "[auth] 用户注册请求",
      );

      const result = await register({
        username: body.username,
        email: body.email,
        password: body.password,
        phone: body.phone,
        verificationCode: body.verificationCode,
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        request.log.warn(
          { username: body.username, error: result.error },
          "[auth] 用户注册失败",
        );
        return reply.code(400).send({
          success: false,
          error: result.error || "Registration failed",
          code: "REGISTER_FAILED",
        });
      }

      request.log.info(
        { username: body.username, userId: result.user?.id },
        "[auth] 用户注册成功",
      );

      return {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  /**
   * POST /api/auth/login - 用户登录
   */
  server.post(
    "/api/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        username?: string;
        email?: string;
        password?: string;
      };

      // 参数校验
      if ((!body.username && !body.email) || !body.password) {
        return reply.code(400).send({
          success: false,
          error: "Username/email and password are required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { username: body.username || body.email, ipAddress },
        "[auth] 用户登录请求",
      );

      const result = await login({
        identifier: body.username || body.email || "",
        password: body.password || "",
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        request.log.warn(
          { username: body.username || body.email, error: result.error },
          "[auth] 用户登录失败",
        );
        return reply.code(401).send({
          success: false,
          error: result.error || "Login failed",
          code: "LOGIN_FAILED",
        });
      }

      request.log.info(
        { username: body.username || body.email, userId: result.user?.id },
        "[auth] 用户登录成功",
      );

      return {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  /**
   * POST /api/auth/refresh - 刷新 Token
   */
  server.post(
    "/api/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { refreshToken?: string };

      if (!body.refreshToken) {
        return reply.code(400).send({
          success: false,
          error: "Refresh token is required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      const result = await refreshToken({
        refreshToken: body.refreshToken,
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        return reply.code(401).send({
          success: false,
          error: result.error || "Token refresh failed",
          code: "REFRESH_FAILED",
        });
      }

      return {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  /**
   * POST /api/auth/send-code - 发送验证码
   */
  server.post(
    "/api/auth/send-code",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        phone?: string;
        email?: string;
        type?: string;
      };

      if (!body.phone && !body.email) {
        return reply.code(400).send({
          success: false,
          error: "Phone or email is required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { phone: body.phone, email: body.email, type: body.type },
        "[auth] 发送验证码请求",
      );

      // TODO: 实现验证码发送逻辑
      // 目前返回成功，实际需要对接短信/邮件服务

      return {
        success: true,
        data: { message: "Verification code sent" },
      };
    },
  );

  /**
   * POST /api/auth/logout - 用户登出
   */
  server.post(
    "/api/auth/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      const body = request.body as { refreshToken?: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      if (body.refreshToken) {
        await logout(body.refreshToken, {
          ipAddress,
          userAgent,
          userId: user?.userId,
        });
      }

      request.log.info(
        { userId: user?.userId },
        "[auth] 用户登出",
      );

      return { success: true, data: { message: "Logged out successfully" } };
    },
  );
}
