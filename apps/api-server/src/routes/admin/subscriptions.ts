/**
 * 订阅管理 API 路由
 *
 * GET    /api/admin/subscriptions              - 获取订阅列表
 * GET    /api/admin/subscriptions/stats        - 获取订阅统计
 * GET    /api/admin/subscriptions/:id          - 获取订阅详情
 * POST   /api/admin/subscriptions/:id/cancel   - 取消订阅
 * POST   /api/admin/subscriptions/:id/extend   - 延长订阅
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getAdminSubscriptionService } from "../../../../../src/assistant/admin-console/admin-subscription-service.js";
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
 * 注册订阅管理路由
 *
 * 注意：Service 在请求处理时延迟初始化，避免模块加载时连接数据库
 */
export function registerAdminSubscriptionsRoutes(
  server: FastifyInstance,
): void {
  /**
   * GET /api/admin/subscriptions - 获取订阅列表
   */
  server.get(
    "/api/admin/subscriptions",
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
        userId?: string;
        planId?: string;
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
        { adminId: admin.adminId, page, pageSize },
        "[admin-subscriptions] 查询订阅列表",
      );

      const subscriptionService = getAdminSubscriptionService();
      const result = await subscriptionService.listSubscriptions({
        page,
        pageSize,
        userId: query.userId,
        planId: query.planId,
        status: query.status as
          | "active"
          | "cancelled"
          | "expired"
          | "trial"
          | undefined,
        sortBy: query.sortBy as "createdAt" | "endDate" | undefined,
        sortOrder: query.sortOrder as "asc" | "desc" | undefined,
      });

      return {
        success: true,
        data: result.subscriptions,
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
   * GET /api/admin/subscriptions/stats - 获取订阅统计
   */
  server.get(
    "/api/admin/subscriptions/stats",
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
        "[admin-subscriptions] 查询订阅统计",
      );

      const subscriptionService = getAdminSubscriptionService();
      const stats = await subscriptionService.getSubscriptionStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/subscriptions/:id - 获取订阅详情
   */
  server.get(
    "/api/admin/subscriptions/:id",
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
        { adminId: admin.adminId, subscriptionId: id },
        "[admin-subscriptions] 查询订阅详情",
      );

      const subscriptionService = getAdminSubscriptionService();
      const subscription = await subscriptionService.getSubscriptionDetail(id);
      if (!subscription) {
        return reply.code(404).send({
          success: false,
          error: "Subscription not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: subscription };
    },
  );

  /**
   * POST /api/admin/subscriptions/:id/cancel - 取消订阅
   */
  server.post(
    "/api/admin/subscriptions/:id/cancel",
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
        { adminId: admin.adminId, subscriptionId: id, reason },
        "[admin-subscriptions] 取消订阅",
      );

      const subscriptionService = getAdminSubscriptionService();
      const result = await subscriptionService.cancelSubscription(
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
          error: result.error || "Failed to cancel subscription",
          code: "CANCEL_FAILED",
        });
      }

      return {
        success: true,
        data: { message: "Subscription cancelled successfully" },
      };
    },
  );

  /**
   * POST /api/admin/subscriptions/:id/extend - 延长订阅
   */
  server.post(
    "/api/admin/subscriptions/:id/extend",
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
      const { days } = request.body as { days?: number };
      const { ipAddress, userAgent } = getClientInfo(request);

      if (!days || days <= 0) {
        return reply.code(400).send({
          success: false,
          error: "Days must be a positive number",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, subscriptionId: id, days },
        "[admin-subscriptions] 延长订阅",
      );

      const subscriptionService = getAdminSubscriptionService();
      const result = await subscriptionService.extendSubscription(
        id,
        days,
        admin.adminId,
        admin.adminId, // adminUsername 暂用 adminId
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to extend subscription",
          code: "EXTEND_FAILED",
        });
      }

      return {
        success: true,
        data: {
          message: "Subscription extended successfully",
          newEndDate: result.newEndDate,
        },
      };
    },
  );
}
