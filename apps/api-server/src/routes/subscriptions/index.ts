/**
 * 用户订阅 REST API 路由
 *
 * POST   /api/subscriptions              - 创建订阅
 * POST   /api/subscriptions/:id/cancel   - 取消订阅
 * PUT    /api/subscriptions/:id          - 更新订阅
 * POST   /api/subscriptions/quota-check  - 检查配额
 * GET    /api/subscriptions/overview     - 获取订阅概览（订阅+计划+使用量）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getUserSubscription,
  getUserPlan,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  checkQuota,
  getUserDailyUsage,
  getUserMonthlyUsage,
  type BillingPeriod,
  type SubscriptionPlanId,
} from "../../../../../src/assistant/subscription/index.js";
import { getRequestUser } from "../../plugins/auth.js";

/**
 * 注册用户订阅路由
 */
export function registerSubscriptionsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/subscriptions/overview - 获取订阅概览
   *
   * 返回用户的订阅信息、当前计划和使用量统计
   */
  server.get(
    "/api/subscriptions/overview",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId: user.userId }, "[subscriptions] 获取订阅概览");

      const [subscription, plan, dailyUsage, monthlyUsage] = await Promise.all([
        getUserSubscription(user.userId),
        getUserPlan(user.userId),
        getUserDailyUsage(user.userId),
        getUserMonthlyUsage(user.userId),
      ]);

      /**
       * 计算使用百分比，limit 为 -1 表示无限制
       */
      const calcPercent = (used: number, limit: number): number => {
        if (limit <= 0) return 0;
        return Math.round((used / limit) * 100);
      };

      const { quotas } = plan;

      /**
       * 构建前端期望的扁平 usage 结构（conversations/aiCalls 必需，其余可选）
       */
      const usage: Record<string, { used: number; limit: number; percent: number; unit?: string }> = {
        conversations: {
          used: dailyUsage.conversations,
          limit: quotas.dailyConversations,
          percent: calcPercent(dailyUsage.conversations, quotas.dailyConversations),
        },
        aiCalls: {
          used: monthlyUsage.aiCalls,
          limit: quotas.monthlyAiCalls,
          percent: calcPercent(monthlyUsage.aiCalls, quotas.monthlyAiCalls),
        },
      };

      if (quotas.maxDevices > 0) {
        usage.devices = {
          used: 0, // TODO: 从设备服务获取实际设备数
          limit: quotas.maxDevices,
          percent: 0,
        };
      }

      if (quotas.maxSkills > 0) {
        usage.skills = {
          used: 0, // TODO: 从技能服务获取实际技能数
          limit: quotas.maxSkills,
          percent: 0,
        };
      }

      if (quotas.storageQuotaMb > 0) {
        usage.storage = {
          used: monthlyUsage.storageUsedMb || 0,
          limit: quotas.storageQuotaMb,
          percent: calcPercent(monthlyUsage.storageUsedMb || 0, quotas.storageQuotaMb),
          unit: "MB",
        };
      }

      /**
       * 构建已启用功能标记
       */
      const featureIds = new Set(plan.features.filter((f) => f.included).map((f) => f.id));
      const features = {
        premiumSkills: featureIds.has("premium_skills"),
        prioritySupport: featureIds.has("priority_support"),
        apiAccess: featureIds.has("api_access"),
      };

      return {
        success: true,
        data: {
          subscription,
          plan: {
            id: plan.id,
            name: plan.name,
          },
          usage,
          features,
        },
      };
    },
  );

  /**
   * POST /api/subscriptions - 创建订阅
   */
  server.post(
    "/api/subscriptions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        planId: SubscriptionPlanId;
        billingPeriod: BillingPeriod;
        paymentMethodId?: string;
        startTrial?: boolean;
      };

      // 参数验证
      if (!body.planId) {
        return reply.code(400).send({
          success: false,
          error: "planId is required",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.billingPeriod) {
        return reply.code(400).send({
          success: false,
          error: "billingPeriod is required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { userId: user.userId, planId: body.planId, billingPeriod: body.billingPeriod },
        "[subscriptions] 创建订阅",
      );

      try {
        const subscription = await createSubscription({
          userId: user.userId,
          planId: body.planId,
          billingPeriod: body.billingPeriod,
          paymentMethodId: body.paymentMethodId,
          startTrial: body.startTrial,
        });

        return {
          success: true,
          data: { subscription },
        };
      } catch (error) {
        request.log.error({ error }, "[subscriptions] 创建订阅失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "创建订阅失败",
          code: "CREATE_FAILED",
        });
      }
    },
  );

  /**
   * POST /api/subscriptions/:id/cancel - 取消订阅
   */
  server.post(
    "/api/subscriptions/:id/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        immediately?: boolean;
        reason?: string;
        feedback?: string;
      };

      request.log.info(
        { userId: user.userId, subscriptionId: id, immediately: body.immediately },
        "[subscriptions] 取消订阅",
      );

      try {
        const subscription = await cancelSubscription({
          subscriptionId: id,
          immediately: body.immediately,
          reason: body.reason,
          feedback: body.feedback,
        });

        return {
          success: true,
          data: { subscription },
        };
      } catch (error) {
        request.log.error({ error }, "[subscriptions] 取消订阅失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "取消订阅失败",
          code: "CANCEL_FAILED",
        });
      }
    },
  );

  /**
   * PUT /api/subscriptions/:id - 更新订阅
   */
  server.put(
    "/api/subscriptions/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        planId?: SubscriptionPlanId;
        billingPeriod?: BillingPeriod;
        cancelAtPeriodEnd?: boolean;
      };

      request.log.info(
        { userId: user.userId, subscriptionId: id, changes: body },
        "[subscriptions] 更新订阅",
      );

      try {
        const subscription = await updateSubscription({
          subscriptionId: id,
          planId: body.planId,
          billingPeriod: body.billingPeriod,
          cancelAtPeriodEnd: body.cancelAtPeriodEnd,
        });

        return {
          success: true,
          data: { subscription },
        };
      } catch (error) {
        request.log.error({ error }, "[subscriptions] 更新订阅失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "更新订阅失败",
          code: "UPDATE_FAILED",
        });
      }
    },
  );

  /**
   * POST /api/subscriptions/quota-check - 检查配额
   */
  server.post(
    "/api/subscriptions/quota-check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        quotaType: "conversations" | "aiCalls" | "skills" | "devices" | "storage";
      };

      if (!body.quotaType) {
        return reply.code(400).send({
          success: false,
          error: "quotaType is required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { userId: user.userId, quotaType: body.quotaType },
        "[subscriptions] 检查配额",
      );

      const result = await checkQuota(user.userId, body.quotaType);

      return {
        success: true,
        data: result,
      };
    },
  );
}
