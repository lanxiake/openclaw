/**
 * 模型提供商配置 API 路由
 *
 * GET    /api/admin/model-providers           - 获取提供商列表
 * GET    /api/admin/model-providers/:key      - 获取单个提供商
 * POST   /api/admin/model-providers           - 创建提供商
 * PUT    /api/admin/model-providers/:key      - 更新提供商
 * DELETE /api/admin/model-providers/:key      - 删除提供商
 * POST   /api/admin/model-providers/:key/test - 测试提供商连接
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { getDatabase } from "../../../../../src/db/connection.js";
import { ModelProviderRepository } from "../../../../../src/db/repositories/model-configs.js";
import { modelProviders } from "../../../../../src/db/schema/model-configs.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";
import { adminAudit } from "../../../../../src/db/repositories/admins.js";

/**
 * 注册模型提供商配置路由
 */
export function registerModelProviderRoutes(server: FastifyInstance): void {
  const db = getDatabase();
  const repo = new ModelProviderRepository(db);

  /**
   * GET /api/admin/model-providers - 获取提供商列表
   */
  server.get(
    "/api/admin/model-providers",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        userId?: string;
        includeDisabled?: string;
      };

      request.log.info(
        { adminId: admin.adminId, userId: query.userId },
        "[model-providers] 查询提供商列表"
      );

      const providers = await repo.listEffectiveProviders(query.userId);

      // 过滤禁用的提供商(除非明确要求包含)
      const filtered =
        query.includeDisabled === "true"
          ? providers
          : providers.filter((p) => p.enabled);

      // 脱敏 API Key
      const sanitized = filtered.map((p) => ({
        ...p,
        apiKey: p.apiKey ? "***" + p.apiKey.slice(-4) : null,
      }));

      return {
        success: true,
        data: sanitized,
      };
    }
  );

  /**
   * GET /api/admin/model-providers/:key - 获取单个提供商
   */
  server.get(
    "/api/admin/model-providers/:key",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };
      const query = request.query as { userId?: string };

      request.log.info(
        { adminId: admin.adminId, key, userId: query.userId },
        "[model-providers] 查询单个提供商"
      );

      const provider = await repo.getProviderByKey(key, query.userId);

      if (!provider) {
        return reply.code(404).send({
          success: false,
          error: "Provider not found",
          code: "NOT_FOUND",
        });
      }

      // super_admin 可以查看完整 API Key
      const sanitized =
        admin.role === "super_admin"
          ? provider
          : {
              ...provider,
              apiKey: provider.apiKey ? "***" + provider.apiKey.slice(-4) : null,
            };

      return { success: true, data: sanitized };
    }
  );

  /**
   * POST /api/admin/model-providers - 创建提供商
   */
  server.post(
    "/api/admin/model-providers",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as {
        userId?: string;
        providerKey: string;
        providerName?: string;
        baseUrl: string;
        apiKey: string;
        apiType?: string;
        models: unknown;
        enabled?: boolean;
        priority?: number;
      };

      // 验证必填字段
      if (!body.providerKey || !body.baseUrl || !body.apiKey || !body.models) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: providerKey, baseUrl, apiKey, models",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, providerKey: body.providerKey },
        "[model-providers] 创建提供商"
      );

      try {
        const provider = body.userId
          ? await repo.upsertTenantProvider(
              body.userId,
              body.providerKey,
              {
                providerName: body.providerName,
                baseUrl: body.baseUrl,
                apiKey: body.apiKey,
                apiType: body.apiType,
                models: body.models,
                enabled: body.enabled,
                priority: body.priority,
              },
              admin.adminId
            )
          : await repo.upsertSystemProvider(
              body.providerKey,
              {
                providerName: body.providerName,
                baseUrl: body.baseUrl,
                apiKey: body.apiKey,
                apiType: body.apiType,
                models: body.models,
                enabled: body.enabled,
                priority: body.priority,
              },
              admin.adminId
            );

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId, // 临时使用 adminId,后续优化为真实 username
          action: "model_provider.create",
          targetType: "model_provider",
          targetId: provider.id,
          targetName: provider.providerKey,
          details: {
            providerKey: body.providerKey,
            configType: body.userId ? "tenant" : "system",
          },
          ipAddress,
          userAgent,
          riskLevel: "low",
        });

        return { success: true, data: provider };
      } catch (error) {
        request.log.error(error, "[model-providers] 创建提供商失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to create provider",
          code: "CREATE_FAILED",
        });
      }
    }
  );

  /**
   * PUT /api/admin/model-providers/:key - 更新提供商
   */
  server.put(
    "/api/admin/model-providers/:key",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };
      const body = request.body as {
        userId?: string;
        providerName?: string;
        baseUrl?: string;
        apiKey?: string;
        apiType?: string;
        models?: unknown;
        enabled?: boolean;
        priority?: number;
      };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, key },
        "[model-providers] 更新提供商"
      );

      try {
        // 检查提供商是否存在
        const existing = await repo.getProviderByKey(key, body.userId);
        if (!existing) {
          return reply.code(404).send({
            success: false,
            error: "Provider not found",
            code: "NOT_FOUND",
          });
        }

        // 构建更新配置(只包含提供的字段)
        const config: {
          providerName?: string;
          baseUrl: string;
          apiKey: string;
          apiType?: string;
          models: unknown;
          enabled?: boolean;
          priority?: number;
        } = {
          baseUrl: body.baseUrl ?? existing.baseUrl,
          apiKey: body.apiKey ?? existing.apiKey,
          models: body.models ?? existing.models,
        };

        if (body.providerName !== undefined) config.providerName = body.providerName;
        if (body.apiType !== undefined) config.apiType = body.apiType;
        if (body.enabled !== undefined) config.enabled = body.enabled;
        if (body.priority !== undefined) config.priority = body.priority;

        const provider =
          existing.configType === "tenant" && existing.userId
            ? await repo.upsertTenantProvider(
                existing.userId,
                key,
                config,
                admin.adminId
              )
            : await repo.upsertSystemProvider(key, config, admin.adminId);

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "model_provider.update",
          targetType: "model_provider",
          targetId: provider.id,
          targetName: provider.providerKey,
          details: {
            changes: body,
          },
          ipAddress,
          userAgent,
          riskLevel: "low",
        });

        return { success: true, data: provider };
      } catch (error) {
        request.log.error(error, "[model-providers] 更新提供商失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update provider",
          code: "UPDATE_FAILED",
        });
      }
    }
  );

  /**
   * DELETE /api/admin/model-providers/:key - 删除提供商
   */
  server.delete(
    "/api/admin/model-providers/:key",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };
      const query = request.query as { userId?: string };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, key, userId: query.userId },
        "[model-providers] 删除提供商"
      );

      try {
        // 检查提供商是否存在
        const existing = await repo.getProviderByKey(key, query.userId);
        if (!existing) {
          return reply.code(404).send({
            success: false,
            error: "Provider not found",
            code: "NOT_FOUND",
          });
        }

        // 删除提供商
        await db
          .delete(modelProviders)
          .where(
            and(
              eq(modelProviders.providerKey, key),
              query.userId
                ? eq(modelProviders.userId, query.userId)
                : isNull(modelProviders.userId)
            )
          );

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "model_provider.delete",
          targetType: "model_provider",
          targetId: existing.id,
          targetName: existing.providerKey,
          ipAddress,
          userAgent,
          riskLevel: "medium",
        });

        return { success: true };
      } catch (error) {
        request.log.error(error, "[model-providers] 删除提供商失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to delete provider",
          code: "DELETE_FAILED",
        });
      }
    }
  );
}
