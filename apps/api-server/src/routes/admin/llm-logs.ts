/**
 * LLM 调用日志 Admin API 路由
 *
 * GET    /api/admin/llm-logs               - 分页查询 LLM 调用日志
 * GET    /api/admin/llm-logs/stats         - 获取聚合统计
 * GET    /api/admin/llm-logs/models        - 获取模型使用分布
 * GET    /api/admin/llm-logs/performance   - 获取性能指标
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getLlmCallLogRepository } from "../../../../../src/db/repositories/llm-call-logs.js";
import type { LlmCallStatus } from "../../../../../src/db/schema/llm-call-logs.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";

/**
 * 注册 LLM 调用日志路由
 */
export function registerAdminLlmLogRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/llm-logs - 分页查询 LLM 调用日志
   *
   * 查询参数: userId, provider, model, status, channel, startTime, endTime, limit, offset
   */
  server.get(
    "/api/admin/llm-logs",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as Record<string, string | undefined>;

      request.log.info(
        { adminId: admin.adminId },
        "[admin-llm-logs] 查询 LLM 调用日志",
      );

      const repo = getLlmCallLogRepository();
      const result = await repo.query({
        userId: query.userId,
        provider: query.provider,
        model: query.model,
        status: query.status as LlmCallStatus | undefined,
        channel: query.channel,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return {
        success: true,
        data: {
          logs: result.logs,
          total: result.total,
          hasMore: result.hasMore,
        },
      };
    },
  );

  /**
   * GET /api/admin/llm-logs/stats - 获取 LLM 调用聚合统计
   *
   * 查询参数: startTime, endTime
   */
  server.get(
    "/api/admin/llm-logs/stats",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as Record<string, string | undefined>;

      request.log.info(
        { adminId: admin.adminId },
        "[admin-llm-logs] 查询 LLM 调用统计",
      );

      const repo = getLlmCallLogRepository();
      const stats = await repo.getStats({
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      });

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/llm-logs/models - 获取模型使用分布
   *
   * 查询参数: startTime, endTime
   */
  server.get(
    "/api/admin/llm-logs/models",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as Record<string, string | undefined>;

      request.log.info(
        { adminId: admin.adminId },
        "[admin-llm-logs] 查询模型使用分布",
      );

      const repo = getLlmCallLogRepository();
      const stats = await repo.getStats({
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      });

      return {
        success: true,
        data: {
          byModel: stats.byModel,
          byProvider: stats.byProvider,
          totalCalls: stats.totalCalls,
        },
      };
    },
  );

  /**
   * GET /api/admin/llm-logs/performance - 获取性能指标
   *
   * 查询参数: startTime, endTime
   */
  server.get(
    "/api/admin/llm-logs/performance",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as Record<string, string | undefined>;

      request.log.info(
        { adminId: admin.adminId },
        "[admin-llm-logs] 查询 LLM 性能指标",
      );

      const repo = getLlmCallLogRepository();
      const stats = await repo.getStats({
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      });

      return {
        success: true,
        data: {
          totalCalls: stats.totalCalls,
          successCalls: stats.successCalls,
          errorCalls: stats.errorCalls,
          errorRate: stats.totalCalls > 0
            ? Math.round((stats.errorCalls / stats.totalCalls) * 10000) / 100
            : 0,
          avgDurationMs: stats.avgDurationMs,
          totalInputTokens: stats.totalInputTokens,
          totalOutputTokens: stats.totalOutputTokens,
        },
      };
    },
  );
}
