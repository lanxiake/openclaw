/**
 * 管理员认证 API 路由
 *
 * POST /api/admin/auth/login    - 管理员登录
 * POST /api/admin/auth/refresh  - 刷新 Token
 * POST /api/admin/auth/logout   - 管理员登出
 * POST /api/admin/auth/password - 修改密码
 * GET  /api/admin/auth/profile  - 获取当前管理员信息
 * PUT  /api/admin/auth/profile  - 更新管理员资料
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  getAdminProfile,
  changeAdminPassword,
  updateAdminProfile,
} from "../../../../../src/assistant/admin-auth/admin-auth-service.js";
import { getRequestAdmin } from "../../plugins/admin-auth.js";

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
 * 注册管理员认证路由
 */
export function registerAdminAuthRoutes(server: FastifyInstance): void {
  /**
   * POST /api/admin/auth/login - 管理员登录
   */
  server.post(
    "/api/admin/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { username, password, mfaCode } = request.body as {
        username?: string;
        password?: string;
        mfaCode?: string;
      };

      // 参数校验
      if (!username || !password) {
        return reply.code(400).send({
          success: false,
          error: "Username and password are required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info({ username, ipAddress }, "[admin-auth] 管理员登录请求");

      const result = await adminLogin({
        username,
        password,
        mfaCode,
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        request.log.warn(
          { username, error: result.error },
          "[admin-auth] 管理员登录失败",
        );
        return reply.code(401).send({
          success: false,
          error: result.error || "Login failed",
          code: "LOGIN_FAILED",
        });
      }

      request.log.info(
        { username, adminId: result.admin?.id },
        "[admin-auth] 管理员登录成功",
      );

      return {
        success: true,
        data: {
          admin: result.admin,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  /**
   * POST /api/admin/auth/refresh - 刷新 Token
   */
  server.post(
    "/api/admin/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { refreshToken } = request.body as { refreshToken?: string };

      if (!refreshToken) {
        return reply.code(400).send({
          success: false,
          error: "Refresh token is required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      const result = await adminRefreshToken({
        refreshToken,
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
          admin: result.admin,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  /**
   * POST /api/admin/auth/logout - 管理员登出
   */
  server.post(
    "/api/admin/auth/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { refreshToken } = request.body as { refreshToken?: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      if (refreshToken) {
        // 登出指定会话
        await adminLogout(refreshToken, {
          ipAddress,
          userAgent,
          adminId: admin.adminId,
        });
      }

      request.log.info({ adminId: admin.adminId }, "[admin-auth] 管理员登出");

      return { success: true, data: { message: "Logged out successfully" } };
    },
  );

  /**
   * POST /api/admin/auth/password - 修改密码
   */
  server.post(
    "/api/admin/auth/password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { currentPassword, newPassword } = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        return reply.code(400).send({
          success: false,
          error: "Current password and new password are required",
          code: "VALIDATION_ERROR",
        });
      }

      // 密码强度校验
      if (newPassword.length < 8) {
        return reply.code(400).send({
          success: false,
          error: "New password must be at least 8 characters",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      const result = await changeAdminPassword({
        adminId: admin.adminId,
        currentPassword,
        newPassword,
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Password change failed",
          code: "PASSWORD_CHANGE_FAILED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-auth] 管理员密码修改成功",
      );

      return {
        success: true,
        data: { message: "Password changed successfully" },
      };
    },
  );

  /**
   * GET /api/admin/auth/profile - 获取当前管理员信息
   */
  server.get(
    "/api/admin/auth/profile",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const profile = await getAdminProfile(admin.adminId);
      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: "Admin not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: profile };
    },
  );

  /**
   * PUT /api/admin/auth/profile - 更新管理员资料
   */
  server.put(
    "/api/admin/auth/profile",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { displayName, email } = request.body as {
        displayName?: string;
        email?: string;
      };

      if (!displayName && !email) {
        return reply.code(400).send({
          success: false,
          error: "At least one field (displayName or email) is required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      const result = await updateAdminProfile({
        adminId: admin.adminId,
        displayName,
        email,
        ipAddress,
        userAgent,
      });

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Profile update failed",
          code: "UPDATE_FAILED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-auth] 管理员资料更新成功",
      );

      return { success: true, data: result.admin };
    },
  );
}
