/**
 * 监控 API 路由
 *
 * GET    /api/admin/monitor/stats     - 获取监控统计概览
 * GET    /api/admin/monitor/resources - 获取系统资源信息
 * GET    /api/admin/monitor/health    - 获取服务健康状态
 * GET    /api/admin/monitor/api       - 获取 API 监控数据
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getMonitorStats,
  getSystemResources,
  getAllServicesHealth,
  getApiMonitorStats,
} from "../../../../../src/assistant/monitor/monitor-service.js";
import { getRequestAdmin } from "../../plugins/admin-auth.js";

/**
 * 注册监控路由
 */
export function registerAdminMonitorRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/monitor/stats - 获取监控统计概览
   */
  server.get(
    "/api/admin/monitor/stats",
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
        "[admin-monitor] 查询监控统计概览",
      );

      const stats = await getMonitorStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/monitor/resources - 获取系统资源信息
   */
  server.get(
    "/api/admin/monitor/resources",
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
        "[admin-monitor] 查询系统资源信息",
      );

      const resources = await getSystemResources();

      return { success: true, data: resources };
    },
  );

  /**
   * GET /api/admin/monitor/health - 获取服务健康状态
   */
  server.get(
    "/api/admin/monitor/health",
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
        "[admin-monitor] 查询服务健康状态",
      );

      const health = await getAllServicesHealth();

      return { success: true, data: health };
    },
  );

  /**
   * GET /api/admin/monitor/api - 获取 API 监控数据
   */
  server.get(
    "/api/admin/monitor/api",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as { hours?: string };
      const hours = Math.min(168, Math.max(1, parseInt(query.hours || "24", 10)));

      request.log.info(
        { adminId: admin.adminId, hours },
        "[admin-monitor] 查询 API 监控数据",
      );

      const apiStats = await getApiMonitorStats(hours);

      return { success: true, data: apiStats };
    },
  );
}
