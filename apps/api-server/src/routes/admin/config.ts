/**
 * 系统配置 API 路由
 *
 * GET    /api/admin/config         - 获取配置列表
 * GET    /api/admin/config/groups  - 获取配置分组
 * GET    /api/admin/config/:key    - 获取单个配置
 * PUT    /api/admin/config/:key    - 更新配置
 * GET    /api/admin/config/:key/history - 获取配置变更历史
 * POST   /api/admin/config/:key/reset   - 重置配置为默认值
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getAllConfigs,
  getConfigByKey,
  setConfigValue,
  getConfigHistory,
  getConfigGroups,
  resetConfigToDefault,
} from "../../../../../src/assistant/config/config-service.js";
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
 * 注册系统配置路由
 */
export function registerAdminConfigRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/config - 获取配置列表
   */
  server.get(
    "/api/admin/config",
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
        group?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(query.pageSize || "50", 10)),
      );

      request.log.info(
        { adminId: admin.adminId, page, pageSize, group: query.group },
        "[admin-config] 查询配置列表",
      );

      const result = await getAllConfigs({
        page,
        pageSize,
        search: query.search,
        group: query.group,
      });

      return {
        success: true,
        data: result.configs,
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
   * GET /api/admin/config/groups - 获取配置分组
   */
  server.get(
    "/api/admin/config/groups",
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
        "[admin-config] 查询配置分组",
      );

      const groups = await getConfigGroups();

      return { success: true, data: groups };
    },
  );

  /**
   * GET /api/admin/config/:key - 获取单个配置
   */
  server.get(
    "/api/admin/config/:key",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { key } = request.params as { key: string };

      request.log.info(
        { adminId: admin.adminId, key },
        "[admin-config] 查询单个配置",
      );

      // super_admin 可以查看敏感配置
      const includeSensitive = admin.role === "super_admin";
      const config = await getConfigByKey(key, { includeSensitive });

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Config not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    },
  );

  /**
   * PUT /api/admin/config/:key - 更新配置
   */
  server.put(
    "/api/admin/config/:key",
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

      const { key } = request.params as { key: string };
      const { value } = request.body as { value: unknown };

      if (value === undefined) {
        return reply.code(400).send({
          success: false,
          error: "Value is required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, key },
        "[admin-config] 更新配置",
      );

      try {
        const config = await setConfigValue(key, value, {
          adminId: admin.adminId,
          ipAddress,
          userAgent,
        });

        return { success: true, data: config };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: (error as Error).message || "Failed to update config",
          code: "UPDATE_FAILED",
        });
      }
    },
  );

  /**
   * GET /api/admin/config/:key/history - 获取配置变更历史
   */
  server.get(
    "/api/admin/config/:key/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { key } = request.params as { key: string };
      const query = request.query as {
        page?: string;
        pageSize?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        50,
        Math.max(1, parseInt(query.pageSize || "20", 10)),
      );

      request.log.info(
        { adminId: admin.adminId, key },
        "[admin-config] 查询配置变更历史",
      );

      const result = await getConfigHistory({ key, page, pageSize });

      return {
        success: true,
        data: result.history,
        meta: {
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
        },
      };
    },
  );

  /**
   * POST /api/admin/config/:key/reset - 重置配置为默认值
   */
  server.post(
    "/api/admin/config/:key/reset",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      // 需要 super_admin 角色
      if (admin.role !== "super_admin") {
        return reply.code(403).send({
          success: false,
          error: "Super admin permission required",
          code: "FORBIDDEN",
        });
      }

      const { key } = request.params as { key: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, key },
        "[admin-config] 重置配置为默认值",
      );

      const config = await resetConfigToDefault(key, {
        adminId: admin.adminId,
        ipAddress,
        userAgent,
      });

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Config not found or has no default value",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    },
  );
}
