/**
 * 积分管理 REST API 路由
 *
 * GET    /api/admin/credits/users/:userId/balance  - 查询用户积分余额
 * GET    /api/admin/credits/users/:userId/history   - 查询用户积分流水
 * POST   /api/admin/credits/users/:userId/grant     - 管理员手动发放积分
 * GET    /api/admin/credits/pricing                 - 模型定价列表
 * GET    /api/admin/credits/pricing/:modelId        - 模型定价详情
 * PUT    /api/admin/credits/pricing/:modelId        - 创建/更新模型定价
 * DELETE /api/admin/credits/pricing/:modelId        - 删除模型定价
 * POST   /api/admin/credits/cleanup                 - 过期批次清理
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getCreditService } from "../../../../../src/assistant/credits/index.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";

/**
 * 注册管理员积分路由
 */
export function registerAdminCreditsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/credits/users/:userId/balance - 查询用户积分余额
   */
  server.get(
    "/api/admin/credits/users/:userId/balance",
    { preHandler: requirePermission("credits", "view") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-credits] 查询用户积分余额",
      );

      const svc = getCreditService();
      const account = await svc.getBalance(userId);

      if (!account) {
        return reply.code(404).send({
          success: false,
          error: "Credit account not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: account };
    },
  );

  /**
   * GET /api/admin/credits/users/:userId/history - 查询用户积分流水
   */
  server.get(
    "/api/admin/credits/users/:userId/history",
    { preHandler: requirePermission("credits", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      const query = request.query as {
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(100, Math.max(1, parseInt(query.limit || "50", 10)));
      const offset = Math.max(0, parseInt(query.offset || "0", 10));

      request.log.info(
        { adminId: admin.adminId, userId, limit, offset },
        "[admin-credits] 查询用户积分流水",
      );

      const svc = getCreditService();
      const transactions = await svc.getTransactionHistory(userId, { limit, offset });

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
   * POST /api/admin/credits/users/:userId/grant - 管理员手动发放积分
   */
  server.post(
    "/api/admin/credits/users/:userId/grant",
    { preHandler: requirePermission("credits", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };
      const body = request.body as {
        amount?: number;
        expiryMonths?: number;
        description?: string;
        adminNote?: string;
      };

      // 参数验证
      if (!body.amount || body.amount <= 0) {
        return reply.code(400).send({
          success: false,
          error: "amount must be a positive number",
          code: "VALIDATION_ERROR",
        });
      }

      const expiryMonths = body.expiryMonths ?? 3;
      if (expiryMonths <= 0) {
        return reply.code(400).send({
          success: false,
          error: "expiryMonths must be a positive number",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, userId, amount: body.amount, expiryMonths },
        "[admin-credits] 管理员发放积分",
      );

      const svc = getCreditService();
      const result = await svc.adminGrantCredits(
        userId,
        {
          amount: body.amount,
          expiryMonths,
          description: body.description,
        },
        admin.adminId,
        body.adminNote,
      );

      return { success: true, data: result };
    },
  );

  /**
   * GET /api/admin/credits/pricing - 模型定价列表
   */
  server.get(
    "/api/admin/credits/pricing",
    { preHandler: requirePermission("credits", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as { activeOnly?: string };
      const activeOnly = query.activeOnly !== "false";

      request.log.info(
        { adminId: admin.adminId, activeOnly },
        "[admin-credits] 查询模型定价列表",
      );

      const svc = getCreditService();
      const pricings = await svc.getAllModelPricings(activeOnly);

      return { success: true, data: pricings };
    },
  );

  /**
   * GET /api/admin/credits/pricing/:modelId - 模型定价详情
   */
  server.get(
    "/api/admin/credits/pricing/:modelId",
    { preHandler: requirePermission("credits", "view") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { modelId } = request.params as { modelId: string };

      request.log.info(
        { adminId: admin.adminId, modelId },
        "[admin-credits] 查询模型定价详情",
      );

      const svc = getCreditService();
      const pricing = await svc.getModelPricing(modelId);

      if (!pricing) {
        return reply.code(404).send({
          success: false,
          error: "Model pricing not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: pricing };
    },
  );

  /**
   * PUT /api/admin/credits/pricing/:modelId - 创建/更新模型定价
   */
  server.put(
    "/api/admin/credits/pricing/:modelId",
    { preHandler: requirePermission("credits", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { modelId } = request.params as { modelId: string };
      const body = request.body as {
        modelName?: string;
        inputPrice?: number;
        outputPrice?: number;
        multiplier?: string;
      };

      // 参数验证
      if (!body.modelName) {
        return reply.code(400).send({
          success: false,
          error: "modelName is required",
          code: "VALIDATION_ERROR",
        });
      }

      if (body.inputPrice === undefined || body.outputPrice === undefined) {
        return reply.code(400).send({
          success: false,
          error: "inputPrice and outputPrice are required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, modelId, modelName: body.modelName },
        "[admin-credits] 设置模型定价",
      );

      const svc = getCreditService();
      await svc.setModelPricing({
        modelId,
        modelName: body.modelName,
        inputPrice: body.inputPrice,
        outputPrice: body.outputPrice,
        multiplier: body.multiplier,
      });

      return { success: true, message: `Model pricing for ${modelId} updated` };
    },
  );

  /**
   * DELETE /api/admin/credits/pricing/:modelId - 删除模型定价
   */
  server.delete(
    "/api/admin/credits/pricing/:modelId",
    { preHandler: requirePermission("credits", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { modelId } = request.params as { modelId: string };

      request.log.info(
        { adminId: admin.adminId, modelId },
        "[admin-credits] 删除模型定价",
      );

      const svc = getCreditService();
      const deleted = await svc.deleteModelPricing(modelId);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: "Model pricing not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, message: `Model pricing for ${modelId} deleted` };
    },
  );

  /**
   * POST /api/admin/credits/cleanup - 过期批次清理
   */
  server.post(
    "/api/admin/credits/cleanup",
    { preHandler: requirePermission("credits", "edit") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-credits] 触发过期批次清理",
      );

      const svc = getCreditService();
      const result = await svc.cleanupExpiredBatches();

      return { success: true, data: result };
    },
  );
}
