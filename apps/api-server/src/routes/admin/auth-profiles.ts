/**
 * Auth Profile 配置 API 路由（管理员）
 *
 * GET    /api/admin/auth-profiles              - 获取 profile 列表
 * GET    /api/admin/auth-profiles/:profileId   - 获取单个 profile
 * POST   /api/admin/auth-profiles              - 创建/更新 profile
 * PUT    /api/admin/auth-profiles/:profileId   - 更新 profile
 * DELETE /api/admin/auth-profiles/:profileId   - 删除 profile
 * GET    /api/admin/auth-profiles/orders        - 获取 order 列表
 * PUT    /api/admin/auth-profiles/orders/:agentKey - 更新 order
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import {
  AuthProfileRepository,
  AuthProfileOrderRepository,
} from "../../../../../src/db/repositories/auth-profile-configs.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";
import { adminAudit } from "../../../../../src/db/repositories/admins.js";

/**
 * 注册 Auth Profile 管理员路由
 */
export function registerAuthProfileRoutes(server: FastifyInstance): void {
  const db = getDatabase();
  const profileRepo = new AuthProfileRepository(db);
  const orderRepo = new AuthProfileOrderRepository(db);

  /**
   * GET /api/admin/auth-profiles - 获取 profile 列表
   */
  server.get(
    "/api/admin/auth-profiles",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        userId?: string;
        includeDisabled?: string;
      };

      request.log.info(
        { adminId: admin.adminId, userId: query.userId },
        "[auth-profiles] 查询 profile 列表",
      );

      const profiles = await profileRepo.listEffectiveProfiles(query.userId);

      // 过滤禁用的 profile（除非明确要求包含）
      const filtered =
        query.includeDisabled === "true" ? profiles : profiles.filter((p) => p.enabled);

      // 脱敏 API Key 和 Token（非 super_admin）
      const sanitized = filtered.map((p) => sanitizeProfile(p, admin.role === "super_admin"));

      return {
        success: true,
        data: sanitized,
      };
    },
  );

  /**
   * GET /api/admin/auth-profiles/:profileId - 获取单个 profile
   */
  server.get(
    "/api/admin/auth-profiles/:profileId",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { profileId } = request.params as { profileId: string };
      const query = request.query as { userId?: string };

      request.log.info(
        { adminId: admin.adminId, profileId, userId: query.userId },
        "[auth-profiles] 查询单个 profile",
      );

      const profile = await profileRepo.getByProfileId(profileId, query.userId);

      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: "Auth profile not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: sanitizeProfile(profile, admin.role === "super_admin"),
      };
    },
  );

  /**
   * POST /api/admin/auth-profiles - 创建/更新 profile
   */
  server.post(
    "/api/admin/auth-profiles",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as {
        userId?: string;
        profileId: string;
        provider: string;
        credentialMode: string;
        apiKey?: string;
        token?: string;
        tokenExpires?: string;
        oauthCredentials?: unknown;
        email?: string;
        enabled?: boolean;
        priority?: number;
        modelBindings?: unknown;
        cooldownConfig?: unknown;
        extraConfig?: unknown;
      };

      // 验证必填字段
      if (!body.profileId || !body.provider || !body.credentialMode) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: profileId, provider, credentialMode",
          code: "VALIDATION_ERROR",
        });
      }

      // 验证 credentialMode
      if (!["api_key", "token", "oauth"].includes(body.credentialMode)) {
        return reply.code(400).send({
          success: false,
          error: "Invalid credentialMode. Must be: api_key, token, or oauth",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, profileId: body.profileId, provider: body.provider },
        "[auth-profiles] 创建/更新 profile",
      );

      try {
        const config = {
          provider: body.provider,
          credentialMode: body.credentialMode,
          apiKey: body.apiKey,
          token: body.token,
          tokenExpires: body.tokenExpires ? new Date(body.tokenExpires) : undefined,
          oauthCredentials: body.oauthCredentials,
          email: body.email,
          enabled: body.enabled,
          priority: body.priority,
          modelBindings: body.modelBindings,
          cooldownConfig: body.cooldownConfig,
          extraConfig: body.extraConfig,
        };

        const profile = body.userId
          ? await profileRepo.upsertTenantProfile(
              body.userId,
              body.profileId,
              config,
              admin.adminId,
            )
          : await profileRepo.upsertSystemProfile(body.profileId, config, admin.adminId);

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "auth_profile.upsert",
          targetType: "auth_profile",
          targetId: profile.id,
          targetName: profile.profileId,
          details: {
            profileId: body.profileId,
            provider: body.provider,
            configType: body.userId ? "tenant" : "system",
          },
          ipAddress,
          userAgent,
          riskLevel: "medium",
        });

        return { success: true, data: sanitizeProfile(profile, admin.role === "super_admin") };
      } catch (error) {
        request.log.error(error, "[auth-profiles] 创建/更新 profile 失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to upsert auth profile",
          code: "UPSERT_FAILED",
        });
      }
    },
  );

  /**
   * PUT /api/admin/auth-profiles/:profileId - 更新 profile 字段
   */
  server.put(
    "/api/admin/auth-profiles/:profileId",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { profileId } = request.params as { profileId: string };
      const query = request.query as { userId?: string };
      const body = request.body as {
        apiKey?: string;
        token?: string;
        tokenExpires?: string;
        oauthCredentials?: unknown;
        email?: string;
        enabled?: boolean;
        priority?: number;
        modelBindings?: unknown;
        cooldownConfig?: unknown;
        extraConfig?: unknown;
      };

      request.log.info(
        { adminId: admin.adminId, profileId },
        "[auth-profiles] 更新 profile",
      );

      try {
        const existing = await profileRepo.getByProfileId(profileId, query.userId);
        if (!existing) {
          return reply.code(404).send({
            success: false,
            error: "Auth profile not found",
            code: "NOT_FOUND",
          });
        }

        const { ipAddress, userAgent } = getClientInfo(request);

        const updated = await profileRepo.update(existing.id, {
          apiKey: body.apiKey,
          token: body.token,
          tokenExpires: body.tokenExpires ? new Date(body.tokenExpires) : undefined,
          oauthCredentials: body.oauthCredentials,
          email: body.email,
          enabled: body.enabled,
          priority: body.priority,
          modelBindings: body.modelBindings,
          cooldownConfig: body.cooldownConfig,
          extraConfig: body.extraConfig,
          updatedBy: admin.adminId,
        });

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "auth_profile.update",
          targetType: "auth_profile",
          targetId: existing.id,
          targetName: existing.profileId,
          details: { changes: body },
          ipAddress,
          userAgent,
          riskLevel: "low",
        });

        return {
          success: true,
          data: updated ? sanitizeProfile(updated, admin.role === "super_admin") : null,
        };
      } catch (error) {
        request.log.error(error, "[auth-profiles] 更新 profile 失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update auth profile",
          code: "UPDATE_FAILED",
        });
      }
    },
  );

  /**
   * DELETE /api/admin/auth-profiles/:profileId - 删除 profile
   */
  server.delete(
    "/api/admin/auth-profiles/:profileId",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { profileId } = request.params as { profileId: string };
      const query = request.query as { userId?: string };

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, profileId, userId: query.userId },
        "[auth-profiles] 删除 profile",
      );

      try {
        const existing = await profileRepo.getByProfileId(profileId, query.userId);
        if (!existing) {
          return reply.code(404).send({
            success: false,
            error: "Auth profile not found",
            code: "NOT_FOUND",
          });
        }

        const deleted = await profileRepo.delete(existing.id);

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "auth_profile.delete",
          targetType: "auth_profile",
          targetId: existing.id,
          targetName: existing.profileId,
          ipAddress,
          userAgent,
          riskLevel: "medium",
        });

        return { success: true, data: { deleted } };
      } catch (error) {
        request.log.error(error, "[auth-profiles] 删除 profile 失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to delete auth profile",
          code: "DELETE_FAILED",
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // Auth Profile Order 路由
  // -----------------------------------------------------------------------

  /**
   * GET /api/admin/auth-profiles/orders - 获取所有 order 列表
   */
  server.get(
    "/api/admin/auth-profiles/orders",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { userId?: string };

      request.log.info(
        { adminId: admin.adminId, userId: query.userId },
        "[auth-profiles] 查询 order 列表",
      );

      const orders = await orderRepo.listEffectiveOrders(query.userId);

      return { success: true, data: orders };
    },
  );

  /**
   * PUT /api/admin/auth-profiles/orders/:agentKey - 更新 order
   */
  server.put(
    "/api/admin/auth-profiles/orders/:agentKey",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { agentKey } = request.params as { agentKey: string };
      const body = request.body as {
        userId?: string;
        profileIds: string[];
      };

      if (!Array.isArray(body.profileIds) || body.profileIds.length === 0) {
        return reply.code(400).send({
          success: false,
          error: "profileIds must be a non-empty array",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, agentKey, profileIds: body.profileIds },
        "[auth-profiles] 更新 order",
      );

      try {
        const order = body.userId
          ? await orderRepo.upsertTenantOrder(
              body.userId,
              agentKey,
              body.profileIds,
              admin.adminId,
            )
          : await orderRepo.upsertSystemOrder(agentKey, body.profileIds, admin.adminId);

        // 记录审计日志
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "auth_profile_order.update",
          targetType: "auth_profile_order",
          targetId: order.id,
          targetName: agentKey,
          details: {
            agentKey,
            profileIds: body.profileIds,
            configType: body.userId ? "tenant" : "system",
          },
          ipAddress,
          userAgent,
          riskLevel: "low",
        });

        return { success: true, data: order };
      } catch (error) {
        request.log.error(error, "[auth-profiles] 更新 order 失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update auth profile order",
          code: "UPDATE_FAILED",
        });
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 脱敏 auth profile 中的敏感字段
 *
 * 非 super_admin 只能看到 API Key / Token 的最后 4 位
 */
function sanitizeProfile(
  profile: Record<string, unknown>,
  isSuperAdmin: boolean,
): Record<string, unknown> {
  if (isSuperAdmin) {
    return profile;
  }

  return {
    ...profile,
    apiKey: typeof profile.apiKey === "string" ? "***" + profile.apiKey.slice(-4) : null,
    token: typeof profile.token === "string" ? "***" + profile.token.slice(-4) : null,
    oauthCredentials: profile.oauthCredentials ? { "***": "redacted" } : null,
  };
}
