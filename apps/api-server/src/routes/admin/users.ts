/**
 * 用户管理 API 路由
 *
 * GET    /api/admin/users              - 获取用户列表
 * GET    /api/admin/users/stats        - 获取用户统计
 * GET    /api/admin/users/:id          - 获取用户详情
 * POST   /api/admin/users/:id/suspend  - 停用用户
 * POST   /api/admin/users/:id/activate - 激活用户
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getAdminUserService } from "../../../../../src/assistant/admin-console/admin-user-service.js";
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
 * 注册用户管理路由
 *
 * 注意：Service 在请求处理时延迟初始化，避免模块加载时连接数据库
 */
export function registerAdminUsersRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/users - 获取用户列表
   */
  server.get(
    "/api/admin/users",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
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
        { adminId: admin.adminId, page, pageSize, search: query.search },
        "[admin-users] 查询用户列表",
      );

      const userService = getAdminUserService();
      const result = await userService.listUsers({
        page,
        pageSize,
        search: query.search,
        status: query.status as "active" | "suspended" | undefined,
        sortBy: query.sortBy as
          | "createdAt"
          | "lastLoginAt"
          | "username"
          | undefined,
        sortOrder: query.sortOrder as "asc" | "desc" | undefined,
      });

      return {
        success: true,
        data: result.users,
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      };
    },
  );

  /**
   * GET /api/admin/users/stats - 获取用户统计
   */
  server.get(
    "/api/admin/users/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-users] 查询用户统计",
      );

      const userService = getAdminUserService();
      const stats = await userService.getUserStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/users/:id - 获取用户详情
   */
  server.get(
    "/api/admin/users/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, userId: id },
        "[admin-users] 查询用户详情",
      );

      const userService = getAdminUserService();
      const user = await userService.getUserDetail(id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: user };
    },
  );

  /**
   * POST /api/admin/users/:id/suspend - 停用用户
   */
  server.post(
    "/api/admin/users/:id/suspend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      // 需要 admin 或 super_admin 角色
      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId: id, reason },
        "[admin-users] 停用用户",
      );

      const userService = getAdminUserService();
      const result = await userService.suspendUser(
        id,
        admin.adminId,
        admin.adminId, // adminUsername 暂用 adminId
        reason,
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to suspend user",
          code: "SUSPEND_FAILED",
        });
      }

      return {
        success: true,
        data: { message: "User suspended successfully" },
      };
    },
  );

  /**
   * POST /api/admin/users/:id/activate - 激活用户
   */
  server.post(
    "/api/admin/users/:id/activate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      // 需要 admin 或 super_admin 角色
      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId: id },
        "[admin-users] 激活用户",
      );

      const userService = getAdminUserService();
      const result = await userService.activateUser(
        id,
        admin.adminId,
        admin.adminId, // adminUsername 暂用 adminId
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to activate user",
          code: "ACTIVATE_FAILED",
        });
      }

      return {
        success: true,
        data: { message: "User activated successfully" },
      };
    },
  );
}
