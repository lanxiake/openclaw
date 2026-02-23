/**
 * 管理员管理 API 路由
 *
 * GET    /api/admin/admins                       - 获取管理员列表
 * GET    /api/admin/admins/:id                   - 获取管理员详情
 * POST   /api/admin/admins                       - 创建管理员
 * PUT    /api/admin/admins/:id                   - 更新管理员信息
 * POST   /api/admin/admins/:id/reset-password    - 重置管理员密码
 * PUT    /api/admin/admins/:id/status            - 更新管理员状态
 * POST   /api/admin/admins/:id/force-logout      - 强制管理员登出
 */

import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getAdminAdminService } from "../../../../../src/assistant/admin-console/admin-admin-service.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";

/**
 * 注册管理员管理路由
 *
 * 注意：Service 在请求处理时延迟初始化，避免模块加载时连接数据库
 */
export function registerAdminAdminsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/admins - 获取管理员列表
   */
  server.get(
    "/api/admin/admins",
    { preHandler: requirePermission("admins", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        role?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(query.pageSize || "20", 10)),
      );

      request.log.info(
        {
          adminId: admin.adminId,
          page,
          pageSize,
          search: query.search,
          role: query.role,
          status: query.status,
        },
        "[admin-admins] 查询管理员列表",
      );

      const service = getAdminAdminService();
      const result = await service.listAdmins({
        page,
        pageSize,
        search: query.search,
        role: query.role as "super_admin" | "admin" | "operator" | "all" | undefined,
        status: query.status as "active" | "suspended" | "locked" | "all" | undefined,
        orderBy: query.sortBy as "createdAt" | "username" | "lastLoginAt" | undefined,
        orderDir: query.sortOrder as "asc" | "desc" | undefined,
      });

      return {
        success: true,
        data: result.admins,
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          limit: result.pageSize,
        },
      };
    },
  );

  /**
   * GET /api/admin/admins/:id - 获取管理员详情
   */
  server.get(
    "/api/admin/admins/:id",
    { preHandler: requirePermission("admins", "view") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, targetId: id },
        "[admin-admins] 查询管理员详情",
      );

      const service = getAdminAdminService();
      const detail = await service.getAdminDetail(id);

      if (!detail) {
        return reply.code(404).send({
          success: false,
          error: "Admin not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: detail };
    },
  );

  /**
   * POST /api/admin/admins - 创建管理员
   */
  server.post(
    "/api/admin/admins",
    { preHandler: requirePermission("admins", "create") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as {
        username?: string;
        password?: string;
        displayName?: string;
        email?: string;
        phone?: string;
        role?: string;
      };
      const { ipAddress, userAgent } = getClientInfo(request);

      /** 参数验证 */
      if (!body.username || body.username.length < 3 || body.username.length > 50) {
        return reply.code(400).send({
          success: false,
          error: "Username must be 3-50 characters",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.password || body.password.length < 8) {
        return reply.code(400).send({
          success: false,
          error: "Password must be at least 8 characters",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.displayName || body.displayName.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          error: "Display name is required",
          code: "VALIDATION_ERROR",
        });
      }

      const validRoles = ["admin", "operator"];
      if (!body.role || !validRoles.includes(body.role)) {
        return reply.code(400).send({
          success: false,
          error: "Role must be 'admin' or 'operator'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        {
          adminId: admin.adminId,
          newUsername: body.username,
          newRole: body.role,
        },
        "[admin-admins] 创建管理员",
      );

      const service = getAdminAdminService();
      const result = await service.createAdmin(
        {
          username: body.username,
          password: body.password,
          displayName: body.displayName.trim(),
          email: body.email?.trim() || undefined,
          phone: body.phone?.trim() || undefined,
          role: body.role as "admin" | "operator",
        },
        admin.adminId,
        admin.adminId,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to create admin",
          code: "CREATE_FAILED",
        });
      }

      return { success: true, data: result.admin };
    },
  );

  /**
   * PUT /api/admin/admins/:id - 更新管理员信息
   */
  server.put(
    "/api/admin/admins/:id",
    { preHandler: requirePermission("admins", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };
      const body = request.body as {
        displayName?: string;
        email?: string;
        phone?: string;
        role?: string;
      };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, targetId: id, changes: Object.keys(body) },
        "[admin-admins] 更新管理员信息",
      );

      const service = getAdminAdminService();
      const result = await service.updateAdmin(
        id,
        {
          displayName: body.displayName?.trim(),
          email: body.email?.trim(),
          phone: body.phone?.trim(),
          role: body.role as "admin" | "operator" | undefined,
        },
        admin.adminId,
        admin.adminId,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to update admin",
          code: "UPDATE_FAILED",
        });
      }

      return { success: true, data: result.admin };
    },
  );

  /**
   * POST /api/admin/admins/:id/reset-password - 重置管理员密码
   *
   * 生成随机临时密码，返回给操作者
   */
  server.post(
    "/api/admin/admins/:id/reset-password",
    { preHandler: requirePermission("admins", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      /** 生成 12 位随机临时密码 */
      const tempPassword = crypto.randomBytes(9).toString("base64url").slice(0, 12);

      request.log.info(
        { adminId: admin.adminId, targetId: id },
        "[admin-admins] 重置管理员密码",
      );

      const service = getAdminAdminService();
      const result = await service.resetAdminPassword(
        id,
        tempPassword,
        admin.adminId,
        admin.adminId,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to reset password",
          code: "RESET_PASSWORD_FAILED",
        });
      }

      return { success: true, data: { tempPassword } };
    },
  );

  /**
   * PUT /api/admin/admins/:id/status - 更新管理员状态
   */
  server.put(
    "/api/admin/admins/:id/status",
    { preHandler: requirePermission("admins", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string; reason?: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      const validStatuses = ["active", "suspended"];
      if (!body.status || !validStatuses.includes(body.status)) {
        return reply.code(400).send({
          success: false,
          error: "Status must be 'active' or 'suspended'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, targetId: id, newStatus: body.status, reason: body.reason },
        "[admin-admins] 更新管理员状态",
      );

      const service = getAdminAdminService();
      const result = await service.updateAdminStatus(
        id,
        body.status as "active" | "suspended",
        admin.adminId,
        admin.adminId,
        body.reason,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to update admin status",
          code: "STATUS_UPDATE_FAILED",
        });
      }

      return {
        success: true,
        data: { message: `Admin status updated to ${body.status}` },
      };
    },
  );

  /**
   * POST /api/admin/admins/:id/force-logout - 强制管理员登出
   */
  server.post(
    "/api/admin/admins/:id/force-logout",
    { preHandler: requirePermission("admins", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, targetId: id },
        "[admin-admins] 强制管理员登出",
      );

      const service = getAdminAdminService();
      const result = await service.forceLogoutAdmin(
        id,
        admin.adminId,
        admin.adminId,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to force logout",
          code: "FORCE_LOGOUT_FAILED",
        });
      }

      return {
        success: true,
        data: { message: "Admin force logged out successfully" },
      };
    },
  );
}
