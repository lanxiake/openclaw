/**
 * 用户积分 REST API 路由
 *
 * GET   /api/credits/balance        - 当前用户积分余额
 * GET   /api/credits/batches        - 当前用户有效积分批次
 * GET   /api/credits/history        - 当前用户积分流水
 * POST  /api/credits/calculate-cost - 模型调用成本估算
 * GET   /api/credits/invite-stats   - 邀请统计（邀请人数 + 已发放积分 + 上限）
 * GET   /api/credits/invites        - 邀请记录列表
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getCreditService } from "../../../../../src/assistant/credits/index.js";
import { getInviteRepository } from "../../../../../src/db/repositories/credits.js";
import { getRequestUser, requireUser } from "../../plugins/auth.js";

/**
 * 注册用户积分路由
 */
export function registerCreditsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/credits/balance - 当前用户积分余额
   *
   * 如果用户没有积分账户（新用户或老用户未初始化），自动赠送注册积分。
   */
  server.get(
    "/api/credits/balance",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      request.log.info({ userId: user.userId }, "[credits] 查询积分余额");

      const svc = getCreditService();
      let account = await svc.getBalance(user.userId);

      // 用户无积分账户时自动初始化（兼容注册时未赠送积分的老用户）
      if (!account) {
        request.log.info(
          { userId: user.userId },
          "[credits] 用户无积分账户，自动赠送注册积分",
        );

        try {
          const result = await svc.grantRegistrationBonus(user.userId);
          if (result.success) {
            account = await svc.getBalance(user.userId);
          }
        } catch (err) {
          request.log.error(
            { userId: user.userId, error: err },
            "[credits] 自动初始化积分账户失败",
          );
        }

        // 如果初始化失败（如并发导致唯一约束冲突），再查一次
        if (!account) {
          account = await svc.getBalance(user.userId);
        }
      }

      return { success: true, data: account };
    },
  );

  /**
   * GET /api/credits/batches - 当前用户有效积分批次
   */
  server.get(
    "/api/credits/batches",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      request.log.info({ userId: user.userId }, "[credits] 查询有效积分批次");

      const svc = getCreditService();
      const batches = await svc.getActiveBatches(user.userId);

      return { success: true, data: { batches } };
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

  /**
   * GET /api/credits/invite-stats - 邀请统计
   *
   * 返回用户的邀请人数、已获得邀请积分、邀请积分上限。
   */
  server.get(
    "/api/credits/invite-stats",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      request.log.info({ userId: user.userId }, "[credits] 查询邀请统计");

      const inviteRepo = getInviteRepository();
      const [count, totalCredits] = await Promise.all([
        inviteRepo.getInviteCount(user.userId),
        inviteRepo.getTotalAwardedCredits(user.userId),
      ]);

      /** 邀请积分上限（可通过配置调整） */
      const maxCredits = 2000;

      return {
        success: true,
        data: {
          count,
          totalCredits,
          maxCredits,
        },
      };
    },
  );

  /**
   * GET /api/credits/invites - 邀请记录列表
   *
   * 返回用户的所有邀请记录。
   */
  server.get(
    "/api/credits/invites",
    { preHandler: requireUser },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = getRequestUser(request)!;

      request.log.info({ userId: user.userId }, "[credits] 查询邀请记录");

      const inviteRepo = getInviteRepository();
      const invites = await inviteRepo.findByInviterId(user.userId);

      return {
        success: true,
        data: {
          invites,
        },
      };
    },
  );
}
