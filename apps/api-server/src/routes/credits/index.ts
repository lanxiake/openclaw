/**
 * 用户积分 REST API 路由
 *
 * GET   /api/credits/balance        - 当前用户积分余额
 * GET   /api/credits/history        - 当前用户积分流水
 * POST  /api/credits/calculate-cost - 模型调用成本估算
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getCreditService } from "../../../../../src/assistant/credits/index.js";
import { getRequestUser, requireUser } from "../../plugins/auth.js";

/**
 * 注册用户积分路由
 */
export function registerCreditsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/credits/balance - 当前用户积分余额
   */
  server.get(
    "/api/credits/balance",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      request.log.info({ userId: user.userId }, "[credits] 查询积分余额");

      const svc = getCreditService();
      const account = await svc.getBalance(user.userId);

      return { success: true, data: account };
    },
  );

  /**
   * GET /api/credits/history - 当前用户积分流水
   */
  server.get(
    "/api/credits/history",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      const query = request.query as {
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(100, Math.max(1, parseInt(query.limit || "50", 10)));
      const offset = Math.max(0, parseInt(query.offset || "0", 10));

      request.log.info(
        { userId: user.userId, limit, offset },
        "[credits] 查询积分流水",
      );

      const svc = getCreditService();
      const transactions = await svc.getTransactionHistory(user.userId, { limit, offset });

      return {
        success: true,
        data: transactions,
        meta: {
          limit,
          offset,
          count: transactions.length,
          hasMore: transactions.length === limit,
        },
      };
    },
  );

  /**
   * POST /api/credits/calculate-cost - 模型调用成本估算
   */
  server.post(
    "/api/credits/calculate-cost",
    { preHandler: requireUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      const body = request.body as {
        modelId?: string;
        inputTokens?: number;
        outputTokens?: number;
      };

      // 参数验证
      if (!body.modelId) {
        return reply.code(400).send({
          success: false,
          error: "modelId is required",
          code: "VALIDATION_ERROR",
        });
      }

      if (body.inputTokens === undefined || body.outputTokens === undefined) {
        return reply.code(400).send({
          success: false,
          error: "inputTokens and outputTokens are required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        {
          userId: user.userId,
          modelId: body.modelId,
          inputTokens: body.inputTokens,
          outputTokens: body.outputTokens,
        },
        "[credits] 估算模型调用成本",
      );

      const svc = getCreditService();
      const cost = await svc.calculateModelCallCost(
        body.modelId,
        body.inputTokens,
        body.outputTokens,
      );

      return {
        success: true,
        data: {
          cost,
          modelId: body.modelId,
          inputTokens: body.inputTokens,
          outputTokens: body.outputTokens,
        },
      };
    },
  );
}
