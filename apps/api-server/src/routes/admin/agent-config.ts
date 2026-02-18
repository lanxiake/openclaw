/**
 * Agent 配置 API 路由
 *
 * GET    /api/admin/agent-config        - 获取 Agent 配置
 * PUT    /api/admin/agent-config        - 更新 Agent 配置
 * POST   /api/admin/agent-config/reset  - 重置为默认配置
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { getDatabase } from "../../../../../src/db/connection.js";
import { AgentDefaultConfigRepository } from "../../../../../src/db/repositories/model-configs.js";
import { agentConfigs } from "../../../../../src/db/schema/model-configs.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";
import { adminAudit } from "../../../../../src/db/repositories/admins.js";

/**
 * 注册 Agent 配置路由
 */
export function registerAgentConfigRoutes(server: FastifyInstance): void {
  const db = getDatabase();
  const repo = new AgentDefaultConfigRepository(db);

  /**
   * GET /api/admin/agent-config - 获取 Agent 配置
   */
  server.get(
    "/api/admin/agent-config",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { userId?: string };

      request.log.info(
        { adminId: admin.adminId, userId: query.userId },
        "[agent-config] 查询 Agent 配置"
      );

      const config = await repo.getEffectiveConfig(query.userId);

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Agent config not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    }
  );

  /**
   * PUT /api/admin/agent-config - 更新 Agent 配置
   */
  server.put(
    "/api/admin/agent-config",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as {
        userId?: string;
        primaryModel?: string;
        workspacePath?: string;
        compactionMode?: string;
        maxConcurrent?: number;
        subagentsMaxConcurrent?: number;
        extraConfig?: unknown;
      };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId: body.userId },
        "[agent-config] 更新 Agent 配置"
      );

      try {
        const config = body.userId
          ? await repo.upsertTenantConfig(
              body.userId,
              {
                primaryModel: body.primaryModel,
                workspacePath: body.workspacePath,
                compactionMode: body.compactionMode,
                maxConcurrent: body.maxConcurrent,
                subagentsMaxConcurrent: body.subagentsMaxConcurrent,
                extraConfig: body.extraConfig,
              },
              admin.adminId
            )
          : await repo.upsertSystemConfig(
              {
                primaryModel: body.primaryModel,
                workspacePath: body.workspacePath,
                compactionMode: body.compactionMode,
                maxConcurrent: body.maxConcurrent,
                subagentsMaxConcurrent: body.subagentsMaxConcurrent,
                extraConfig: body.extraConfig,
              },
              admin.adminId
            );

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "agent_config.update",
          targetType: "agent_config",
          targetId: config.id,
          targetName: body.userId ? `tenant:${body.userId}` : "system",
          details: {
            changes: body,
          },
          ipAddress,
          userAgent,
          riskLevel: "low",
        });

        return { success: true, data: config };
      } catch (error) {
        request.log.error(error, "[agent-config] 更新配置失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update config",
          code: "UPDATE_FAILED",
        });
      }
    }
  );

  /**
   * POST /api/admin/agent-config/reset - 重置为默认配置
   */
  server.post(
    "/api/admin/agent-config/reset",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as { userId?: string };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId: body.userId },
        "[agent-config] 重置 Agent 配置"
      );

      try {
        // 删除配置(将回退到系统默认值)
        if (body.userId) {
          await db
            .delete(agentConfigs)
            .where(
              and(
                eq(agentConfigs.configType, "tenant"),
                eq(agentConfigs.userId, body.userId)
              )
            );
        } else {
          // 重置系统配置为默认值
          await repo.upsertSystemConfig(
            {
              primaryModel: "claude-opus-4-5-20251101",
              compactionMode: "safeguard",
              maxConcurrent: 4,
              subagentsMaxConcurrent: 8,
            },
            admin.adminId
          );
        }

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "agent_config.reset",
          targetType: "agent_config",
          targetName: body.userId ? `tenant:${body.userId}` : "system",
          ipAddress,
          userAgent,
          riskLevel: "medium",
        });

        // 返回重置后的配置
        const config = await repo.getEffectiveConfig(body.userId);

        return { success: true, data: config };
      } catch (error) {
        request.log.error(error, "[agent-config] 重置配置失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to reset config",
          code: "RESET_FAILED",
        });
      }
    }
  );
}
