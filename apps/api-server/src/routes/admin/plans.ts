/**
 * 套餐管理 API 路由
 *
 * GET    /api/admin/plans      - 获取套餐列表
 * GET    /api/admin/plans/:id  - 获取套餐详情
 * POST   /api/admin/plans      - 创建套餐
 * PUT    /api/admin/plans/:id  - 更新套餐
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
 * 注册套餐管理路由
 *
 * 注意：Service 在请求处理时延迟初始化，避免模块加载时连接数据库
 */
export function registerAdminPlansRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/plans - 获取套餐列表
   */
  server.get(
    "/api/admin/plans",
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
        "[admin-plans] 查询套餐列表",
      );

      const subscriptionService = getAdminSubscriptionService();
      const plans = await subscriptionService.listPlans();

      return { success: true, data: plans };
    },
  );

  /**
   * GET /api/admin/plans/:id - 获取套餐详情
   */
  server.get(
    "/api/admin/plans/:id",
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
        { adminId: admin.adminId, planId: id },
        "[admin-plans] 查询套餐详情",
      );

      const subscriptionService = getAdminSubscriptionService();
      const plan = await subscriptionService.getPlanDetail(id);
      if (!plan) {
        return reply.code(404).send({
          success: false,
          error: "Plan not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: plan };
    },
  );

  /**
   * POST /api/admin/plans - 创建套餐
   */
  server.post(
    "/api/admin/plans",
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

      const body = request.body as {
        code?: string;
        name?: string;
        description?: string;
        priceMonthly?: number;
        priceYearly?: number;
        tokensPerMonth?: number;
        storageMb?: number;
        maxDevices?: number;
        features?: Record<string, unknown>;
        sortOrder?: number;
      };

      // 参数校验
      if (!body.code || !body.name) {
        return reply.code(400).send({
          success: false,
          error: "Code and name are required",
          code: "VALIDATION_ERROR",
        });
      }

      if (body.priceMonthly === undefined || body.priceYearly === undefined) {
        return reply.code(400).send({
          success: false,
          error: "Price monthly and yearly are required",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, code: body.code, name: body.name },
        "[admin-plans] 创建套餐",
      );

      const subscriptionService = getAdminSubscriptionService();
      const result = await subscriptionService.createPlan(
        {
          code: body.code,
          name: body.name,
          description: body.description,
          priceMonthly: body.priceMonthly,
          priceYearly: body.priceYearly,
          tokensPerMonth: body.tokensPerMonth || 0,
          storageMb: body.storageMb || 0,
          maxDevices: body.maxDevices || 1,
          features: body.features,
          sortOrder: body.sortOrder,
        },
        admin.adminId,
        admin.adminId, // adminUsername 暂用 adminId
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to create plan",
          code: "CREATE_FAILED",
        });
      }

      return {
        success: true,
        data: result.plan,
      };
    },
  );

  /**
   * PUT /api/admin/plans/:id - 更新套餐
   */
  server.put(
    "/api/admin/plans/:id",
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
      const body = request.body as {
        name?: string;
        description?: string;
        priceMonthly?: number;
        priceYearly?: number;
        tokensPerMonth?: number;
        storageMb?: number;
        maxDevices?: number;
        features?: Record<string, unknown>;
        sortOrder?: number;
        isActive?: boolean;
      };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, planId: id },
        "[admin-plans] 更新套餐",
      );

      const subscriptionService = getAdminSubscriptionService();
      const result = await subscriptionService.updatePlan(
        id,
        body,
        admin.adminId,
        admin.adminId, // adminUsername 暂用 adminId
        ipAddress,
        userAgent,
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Failed to update plan",
          code: "UPDATE_FAILED",
        });
      }

      return {
        success: true,
        data: { message: "Plan updated successfully" },
      };
    },
  );
}
