/**
 * 仪表盘 API 路由
 *
 * GET    /api/admin/dashboard/stats        - 获取仪表盘统计概览
 * GET    /api/admin/dashboard/trends       - 获取趋势数据
 * GET    /api/admin/dashboard/distribution - 获取订阅分布
 * GET    /api/admin/dashboard/activities   - 获取最近活动
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getAdminDashboardService } from "../../../../../src/assistant/admin-console/admin-dashboard-service.js";
import { getRequestAdmin } from "../../plugins/admin-auth.js";

/**
 * 注册仪表盘路由
 */
export function registerAdminDashboardRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/dashboard/stats - 获取仪表盘统计概览
   */
  server.get(
    "/api/admin/dashboard/stats",
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
        "[admin-dashboard] 查询仪表盘统计概览",
      );

      const dashboardService = getAdminDashboardService();
      const stats = await dashboardService.getStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/dashboard/trends - 获取趋势数据
   */
  server.get(
    "/api/admin/dashboard/trends",
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
        type?: string;
        period?: string;
      };

      const type = (query.type || "users") as "users" | "revenue" | "subscriptions";
      const period = (query.period || "7d") as "7d" | "30d" | "90d";

      if (!["users", "revenue", "subscriptions"].includes(type)) {
        return reply.code(400).send({
          success: false,
          error: "Type must be 'users', 'revenue', or 'subscriptions'",
          code: "VALIDATION_ERROR",
        });
      }

      if (!["7d", "30d", "90d"].includes(period)) {
        return reply.code(400).send({
          success: false,
          error: "Period must be '7d', '30d', or '90d'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, type, period },
        "[admin-dashboard] 查询趋势数据",
      );

      const dashboardService = getAdminDashboardService();
      const trends = await dashboardService.getTrends(type, period);

      return { success: true, data: trends };
    },
  );

  /**
   * GET /api/admin/dashboard/distribution - 获取订阅分布
   */
  server.get(
    "/api/admin/dashboard/distribution",
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
        "[admin-dashboard] 查询订阅分布",
      );

      const dashboardService = getAdminDashboardService();
      const distribution = await dashboardService.getSubscriptionDistribution();

      return { success: true, data: distribution };
    },
  );

  /**
   * GET /api/admin/dashboard/activities - 获取最近活动
   */
  server.get(
    "/api/admin/dashboard/activities",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as { limit?: string };
      const limit = Math.min(50, Math.max(1, parseInt(query.limit || "10", 10)));

      request.log.info(
        { adminId: admin.adminId, limit },
        "[admin-dashboard] 查询最近活动",
      );

      const dashboardService = getAdminDashboardService();
      const activities = await dashboardService.getActivities(limit);

      return { success: true, data: activities };
    },
  );
}
