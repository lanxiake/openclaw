/**
 * 管理员 Gateway 配置管理 API 路由
 *
 * 提供 Gateway 系统配置和租户配置的 CRUD 操作。
 *
 * 端点概览：
 *   GET    /api/admin/gateway-config                   - 获取系统 Gateway 配置
 *   PUT    /api/admin/gateway-config                   - 更新系统 Gateway 配置
 *   GET    /api/admin/gateway-config/tenants           - 列出所有租户 Gateway 配置
 *   GET    /api/admin/gateway-config/tenant/:userId    - 获取指定租户 Gateway 配置
 *   PUT    /api/admin/gateway-config/tenant/:userId    - 更新指定租户 Gateway 配置
 *   DELETE /api/admin/gateway-config/tenant/:userId    - 删除指定租户 Gateway 配置
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import { GatewayConfigRepository } from "../../../../../src/db/repositories/gateway-configs.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";
import { adminAudit } from "../../../../../src/db/repositories/admins.js";

// ---------------------------------------------------------------------------
// Helpers (导出用于测试)
// ---------------------------------------------------------------------------

/** 认证相关的高风险字段 */
const HIGH_RISK_FIELDS = new Set([
  "authMode",
  "authToken",
  "authPassword",
  "authAllowTailscale",
]);

/** 网络/基础设施相关的中等风险字段 */
const MEDIUM_RISK_FIELDS = new Set([
  "gatewayMode",
  "gatewayPort",
  "gatewayBind",
  "tailscaleMode",
  "tailscaleResetOnExit",
]);

/**
 * 脱敏 Gateway 配置中的敏感字段
 *
 * 非 super_admin 只能看到 authToken / authPassword 的最后 4 位
 *
 * @param config - 原始配置对象
 * @param isSuperAdmin - 是否为超级管理员
 * @returns 脱敏后的配置对象（新对象，不修改原始）
 */
export function sanitizeGatewayConfig(
  config: Record<string, unknown>,
  isSuperAdmin = false,
): Record<string, unknown> {
  if (isSuperAdmin) {
    return { ...config };
  }

  return {
    ...config,
    authToken:
      typeof config.authToken === "string"
        ? "***" + config.authToken.slice(-4)
        : null,
    authPassword:
      typeof config.authPassword === "string"
        ? "***" + config.authPassword.slice(-4)
        : null,
  };
}

/**
 * 评估配置变更的风险等级
 *
 * 根据变更的字段类型确定审计日志的风险等级：
 * - high: 认证相关（authMode, authToken, authPassword）
 * - medium: 网络/基础设施（port, bind, tailscale）
 * - low: UI 配置、扩展配置等
 *
 * @param changes - 变更的字段集合
 * @returns 风险等级
 */
export function assessConfigRisk(
  changes: Record<string, unknown>,
): "high" | "medium" | "low" {
  const changedKeys = Object.keys(changes);

  if (changedKeys.some((k) => HIGH_RISK_FIELDS.has(k))) {
    return "high";
  }

  if (changedKeys.some((k) => MEDIUM_RISK_FIELDS.has(k))) {
    return "medium";
  }

  return "low";
}

// ---------------------------------------------------------------------------
// Gateway 配置变更请求体类型
// ---------------------------------------------------------------------------

interface GatewayConfigUpdateBody {
  gatewayMode?: string;
  gatewayPort?: number;
  gatewayBind?: string;
  authMode?: string;
  authToken?: string;
  authPassword?: string;
  authAllowTailscale?: boolean;
  controlUiEnabled?: boolean;
  controlUiAllowInsecureAuth?: boolean;
  tailscaleMode?: string;
  tailscaleResetOnExit?: boolean;
  extraConfig?: unknown;
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

/**
 * 注册管理员 Gateway 配置路由（6 个端点）
 */
export function registerGatewayConfigRoutes(server: FastifyInstance): void {
  // =========================================================================
  // 1. GET /api/admin/gateway-config - 获取系统 Gateway 配置
  // =========================================================================
  server.get(
    "/api/admin/gateway-config",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[gateway-config] 查询系统 Gateway 配置",
      );

      const db = getDatabase();
      const repo = new GatewayConfigRepository(db);
      const config = await repo.getSystemConfig();

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "System gateway config not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: sanitizeGatewayConfig(
          config as unknown as Record<string, unknown>,
          admin.role === "super_admin",
        ),
      };
    },
  );

  // =========================================================================
  // 2. PUT /api/admin/gateway-config - 更新系统 Gateway 配置
  // =========================================================================
  server.put(
    "/api/admin/gateway-config",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as GatewayConfigUpdateBody;
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, changes: Object.keys(body) },
        "[gateway-config] 更新系统 Gateway 配置",
      );

      try {
        const db = getDatabase();
        const repo = new GatewayConfigRepository(db);
        const config = await repo.upsertSystemConfig(body, admin.adminId);

        /** 记录审计日志 */
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "gateway_config.update_system",
          targetType: "gateway_config",
          targetId: config.id,
          targetName: "system",
          details: { changes: Object.keys(body) },
          ipAddress,
          userAgent,
          riskLevel: assessConfigRisk(body),
        });

        return {
          success: true,
          data: sanitizeGatewayConfig(
            config as unknown as Record<string, unknown>,
            admin.role === "super_admin",
          ),
        };
      } catch (error) {
        request.log.error(error, "[gateway-config] 更新系统配置失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update system config",
          code: "UPDATE_FAILED",
        });
      }
    },
  );

  // =========================================================================
  // 3. GET /api/admin/gateway-config/tenants - 列出所有租户 Gateway 配置
  // =========================================================================
  server.get(
    "/api/admin/gateway-config/tenants",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[gateway-config] 列出所有租户 Gateway 配置",
      );

      const db = getDatabase();
      const repo = new GatewayConfigRepository(db);
      const tenantConfigs = await repo.listTenantConfigs();

      const sanitized = tenantConfigs.map((c) =>
        sanitizeGatewayConfig(
          c as unknown as Record<string, unknown>,
          admin.role === "super_admin",
        ),
      );

      return {
        success: true,
        data: sanitized,
        meta: { total: sanitized.length },
      };
    },
  );

  // =========================================================================
  // 4. GET /api/admin/gateway-config/tenant/:userId - 获取指定租户配置
  // =========================================================================
  server.get(
    "/api/admin/gateway-config/tenant/:userId",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[gateway-config] 查询指定租户 Gateway 配置",
      );

      const db = getDatabase();
      const repo = new GatewayConfigRepository(db);
      const config = await repo.getTenantConfig(userId);

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Tenant gateway config not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: sanitizeGatewayConfig(
          config as unknown as Record<string, unknown>,
          admin.role === "super_admin",
        ),
      };
    },
  );

  // =========================================================================
  // 5. PUT /api/admin/gateway-config/tenant/:userId - 更新指定租户配置
  // =========================================================================
  server.put(
    "/api/admin/gateway-config/tenant/:userId",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };
      const body = request.body as GatewayConfigUpdateBody;
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId, changes: Object.keys(body) },
        "[gateway-config] 更新租户 Gateway 配置",
      );

      try {
        const db = getDatabase();
        const repo = new GatewayConfigRepository(db);
        const config = await repo.upsertTenantConfig(
          userId,
          body,
          admin.adminId,
        );

        /** 记录审计日志 */
        await adminAudit({
          adminId: admin.adminId,
          adminUsername: admin.adminId,
          action: "gateway_config.update_tenant",
          targetType: "gateway_config",
          targetId: config.id,
          targetName: `tenant:${userId}`,
          details: { userId, changes: Object.keys(body) },
          ipAddress,
          userAgent,
          riskLevel: assessConfigRisk(body),
        });

        return {
          success: true,
          data: sanitizeGatewayConfig(
            config as unknown as Record<string, unknown>,
            admin.role === "super_admin",
          ),
        };
      } catch (error) {
        request.log.error(error, "[gateway-config] 更新租户配置失败");
        return reply.code(500).send({
          success: false,
          error: (error as Error).message || "Failed to update tenant config",
          code: "UPDATE_FAILED",
        });
      }
    },
  );

  // =========================================================================
  // 6. DELETE /api/admin/gateway-config/tenant/:userId - 删除指定租户配置
  // =========================================================================
  server.delete(
    "/api/admin/gateway-config/tenant/:userId",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };
      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, userId },
        "[gateway-config] 删除租户 Gateway 配置",
      );

      const db = getDatabase();
      const repo = new GatewayConfigRepository(db);

      /** 先检查是否存在 */
      const existing = await repo.getTenantConfig(userId);
      if (!existing) {
        return {
          success: true,
          data: { message: "No tenant config found, nothing to delete" },
        };
      }

      await repo.deleteTenantConfig(userId);

      /** 记录审计日志 */
      await adminAudit({
        adminId: admin.adminId,
        adminUsername: admin.adminId,
        action: "gateway_config.delete_tenant",
        targetType: "gateway_config",
        targetId: existing.id,
        targetName: `tenant:${userId}`,
        details: { userId },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      return {
        success: true,
        data: {
          message:
            "Tenant gateway config deleted, user will use system defaults",
        },
      };
    },
  );
}
