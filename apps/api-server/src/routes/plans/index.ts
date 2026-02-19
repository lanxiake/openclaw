/**
 * 订阅计划公开 API 路由
 *
 * GET /api/plans      - 获取所有订阅计划列表（公开，无需认证）
 * GET /api/plans/:id  - 获取指定计划详情（公开，无需认证）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getAllPlans,
  getPlan,
  type SubscriptionPlanId,
} from "../../../../../src/assistant/subscription/index.js";

/**
 * 注册订阅计划公开路由
 */
export function registerPlansRoutes(server: FastifyInstance): void {
  /**
   * GET /api/plans - 获取所有订阅计划列表
   *
   * 公开端点，无需认证。返回所有可用的订阅计划及其功能特性和配额。
   */
  server.get(
    "/api/plans",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      _request.log.info("[plans] 获取订阅计划列表");

      const plans = getAllPlans();

      return {
        success: true,
        data: {
          plans: plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            features: plan.features,
            quotas: plan.quotas,
            recommended: plan.recommended,
            sortOrder: plan.sortOrder,
          })),
        },
      };
    },
  );

  /**
   * GET /api/plans/:id - 获取指定计划详情
   *
   * 公开端点，无需认证。
   */
  server.get(
    "/api/plans/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      request.log.info({ planId: id }, "[plans] 获取计划详情");

      const plan = getPlan(id as SubscriptionPlanId);
      if (!plan) {
        return reply.code(404).send({
          success: false,
          error: "Plan not found",
          code: "PLAN_NOT_FOUND",
        });
      }

      return {
        success: true,
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            features: plan.features,
            quotas: plan.quotas,
            recommended: plan.recommended,
            sortOrder: plan.sortOrder,
          },
        },
      };
    },
  );
}
