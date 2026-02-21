/**
 * 用户配置 API 路由
 *
 * 提供租户私有配置的 CRUD 操作（9 个端点），所有操作自动限定在当前用户范围内。
 * 用户只能管理自己的租户覆盖配置，删除覆盖后回退到系统默认。
 *
 * 端点概览：
 *   GET    /api/config/effective           - 获取当前用户的有效合并配置
 *   GET    /api/config/models              - 获取用户有效的模型提供商列表
 *   PUT    /api/config/models/:key         - 覆盖/新增用户私有模型提供商
 *   DELETE /api/config/models/:key         - 删除用户私有模型提供商覆盖
 *   GET    /api/config/agent               - 获取用户有效的 Agent 配置
 *   PUT    /api/config/agent               - 覆盖用户 Agent 配置
 *   GET    /api/config/auth-profiles       - 获取用户有效认证配置列表
 *   PUT    /api/config/auth-profiles/:id   - 覆盖/新增用户认证配置
 *   DELETE /api/config/auth-profiles/:id   - 删除用户私有认证配置覆盖
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import {
  ModelProviderRepository,
  AgentDefaultConfigRepository,
} from "../../../../../src/db/repositories/model-configs.js";
import {
  AuthProfileRepository,
  AuthProfileOrderRepository,
} from "../../../../../src/db/repositories/auth-profile-configs.js";

// ---------------------------------------------------------------------------
// 租户字段白名单（§5.2.3 安全边界）
// ---------------------------------------------------------------------------

/**
 * 模型提供商：租户可覆盖的字段白名单
 *
 * 租户用户只能修改这些字段，基础设施级字段（configType, userId, id 等）
 * 由系统自动管理，不接受用户输入。
 */
export const TENANT_MODEL_PROVIDER_FIELDS: ReadonlySet<string> = new Set([
  "providerName",
  "baseUrl",
  "apiKey",
  "apiType",
  "models",
  "enabled",
  "priority",
]);

/**
 * Agent 默认配置：租户可覆盖的字段白名单
 *
 * 租户只能调整模型选择和基本运行参数，
 * workspacePath、subagentsMaxConcurrent 等系统级字段仅管理员可改。
 */
export const TENANT_AGENT_CONFIG_FIELDS: ReadonlySet<string> = new Set([
  "primaryModel",
  "compactionMode",
  "maxConcurrent",
]);

/**
 * Auth Profile：租户允许完整 CRUD，无字段级限制
 *
 * 但 configType / userId / id 等内部字段仍由系统管理，
 * 下面定义 auth profile 用户可提交的字段白名单。
 */
export const TENANT_AUTH_PROFILE_FIELDS: ReadonlySet<string> = new Set([
  "provider",
  "credentialMode",
  "apiKey",
  "token",
  "tokenExpires",
  "oauthCredentials",
  "email",
  "enabled",
  "priority",
  "modelBindings",
  "cooldownConfig",
  "extraConfig",
]);

/**
 * 验证请求体是否只包含白名单中的字段
 *
 * @param body - 请求体对象
 * @param allowedFields - 允许的字段集合
 * @returns 验证结果，包含是否通过和非法字段列表
 */
export function validateTenantFields(
  body: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): { valid: boolean; forbiddenFields: string[] } {
  const forbiddenFields = Object.keys(body).filter(
    (key) => !allowedFields.has(key),
  );

  return {
    valid: forbiddenFields.length === 0,
    forbiddenFields,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 返回 401 未认证响应
 */
function replyUnauthorized(reply: FastifyReply): FastifyReply {
  return reply.code(401).send({
    success: false,
    error: "Authentication required",
    code: "UNAUTHORIZED",
  });
}

/**
 * 脱敏模型提供商中的 API Key
 *
 * 仅保留最后 4 位字符，前面以 *** 代替
 */
export function sanitizeModelProvider(
  provider: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...provider,
    apiKey:
      typeof provider.apiKey === "string"
        ? "***" + provider.apiKey.slice(-4)
        : null,
  };
}

/**
 * 脱敏 auth profile 中的敏感字段
 *
 * 用户只能看到 API Key / Token 的最后 4 位
 */
export function sanitizeAuthProfile(
  profile: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...profile,
    apiKey:
      typeof profile.apiKey === "string"
        ? "***" + profile.apiKey.slice(-4)
        : null,
    token:
      typeof profile.token === "string"
        ? "***" + profile.token.slice(-4)
        : null,
    oauthCredentials: profile.oauthCredentials
      ? { "***": "redacted" }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

/**
 * 注册用户配置路由（9 个端点）
 *
 * 所有端点均需用户 JWT 认证，自动从 token 中获取 userId 作为租户标识。
 */
export function registerUserConfigRoutes(server: FastifyInstance): void {
  // =========================================================================
  // 1. GET /api/config/effective - 获取当前用户的有效合并配置
  // =========================================================================
  server.get(
    "/api/config/effective",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      request.log.info(
        { userId: user.userId },
        "[user-config] 查询有效合并配置",
      );

      const db = getDatabase();
      const mpRepo = new ModelProviderRepository(db);
      const acRepo = new AgentDefaultConfigRepository(db);
      const apRepo = new AuthProfileRepository(db);
      const apoRepo = new AuthProfileOrderRepository(db);

      /** 并行查询所有配置维度 */
      const [modelProviders, agentConfig, authProfiles, authProfileOrders] =
        await Promise.all([
          mpRepo.listEffectiveProviders(user.userId),
          acRepo.getEffectiveConfig(user.userId),
          apRepo.listEffectiveProfiles(user.userId),
          apoRepo.listEffectiveOrders(user.userId),
        ]);

      return {
        success: true,
        data: {
          modelProviders: modelProviders.map((p) =>
            sanitizeModelProvider(p as unknown as Record<string, unknown>),
          ),
          agentConfig,
          authProfiles: authProfiles.map((p) =>
            sanitizeAuthProfile(p as unknown as Record<string, unknown>),
          ),
          authProfileOrders,
        },
      };
    },
  );

  // =========================================================================
  // 2. GET /api/config/models - 获取用户有效的模型提供商列表
  // =========================================================================
  server.get(
    "/api/config/models",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      request.log.info(
        { userId: user.userId },
        "[user-config] 查询有效模型提供商列表",
      );

      const db = getDatabase();
      const repo = new ModelProviderRepository(db);
      const providers = await repo.listEffectiveProviders(user.userId);

      return {
        success: true,
        data: providers.map((p) =>
          sanitizeModelProvider(p as unknown as Record<string, unknown>),
        ),
      };
    },
  );

  // =========================================================================
  // 3. PUT /api/config/models/:key - 覆盖/新增用户私有模型提供商
  // =========================================================================
  server.put(
    "/api/config/models/:key",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      const { key } = request.params as { key: string };
      const body = request.body as {
        providerName?: string;
        baseUrl: string;
        apiKey: string;
        apiType?: string;
        models: unknown;
        enabled?: boolean;
        priority?: number;
      };

      /** 校验必填字段 */
      if (!body.baseUrl || !body.apiKey || !body.models) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: baseUrl, apiKey, models",
          code: "VALIDATION_ERROR",
        });
      }

      /** 租户安全边界：只允许白名单字段 */
      const fieldCheck = validateTenantFields(
        body as Record<string, unknown>,
        TENANT_MODEL_PROVIDER_FIELDS,
      );
      if (!fieldCheck.valid) {
        request.log.warn(
          { userId: user.userId, forbiddenFields: fieldCheck.forbiddenFields },
          "[user-config] 租户尝试修改受限字段",
        );
        return reply.code(403).send({
          success: false,
          error: `Forbidden fields for tenant override: ${fieldCheck.forbiddenFields.join(", ")}`,
          code: "FORBIDDEN_FIELDS",
        });
      }

      request.log.info(
        { userId: user.userId, providerKey: key },
        "[user-config] 覆盖用户模型提供商配置",
      );

      const db = getDatabase();
      const repo = new ModelProviderRepository(db);
      const provider = await repo.upsertTenantProvider(
        user.userId,
        key,
        {
          providerName: body.providerName,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
          apiType: body.apiType,
          models: body.models,
          enabled: body.enabled,
          priority: body.priority,
        },
        user.userId,
      );

      return {
        success: true,
        data: sanitizeModelProvider(
          provider as unknown as Record<string, unknown>,
        ),
      };
    },
  );

  // =========================================================================
  // 4. DELETE /api/config/models/:key - 删除用户私有模型提供商覆盖
  // =========================================================================
  server.delete(
    "/api/config/models/:key",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      const { key } = request.params as { key: string };

      request.log.info(
        { userId: user.userId, providerKey: key },
        "[user-config] 删除用户模型提供商覆盖",
      );

      const db = getDatabase();
      const repo = new ModelProviderRepository(db);
      const deleted = await repo.deleteTenantProvider(user.userId, key);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: "Tenant provider override not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: { message: "Provider override deleted, system default restored" },
      };
    },
  );

  // =========================================================================
  // 5. GET /api/config/agent - 获取用户有效的 Agent 配置
  // =========================================================================
  server.get(
    "/api/config/agent",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      request.log.info(
        { userId: user.userId },
        "[user-config] 查询有效 Agent 配置",
      );

      const db = getDatabase();
      const repo = new AgentDefaultConfigRepository(db);
      const config = await repo.getEffectiveConfig(user.userId);

      return {
        success: true,
        data: config,
      };
    },
  );

  // =========================================================================
  // 6. PUT /api/config/agent - 覆盖用户 Agent 配置
  // =========================================================================
  server.put(
    "/api/config/agent",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      const body = request.body as {
        primaryModel?: string;
        compactionMode?: string;
        maxConcurrent?: number;
      };

      /** 租户安全边界：只允许白名单字段 */
      const fieldCheck = validateTenantFields(
        body as Record<string, unknown>,
        TENANT_AGENT_CONFIG_FIELDS,
      );
      if (!fieldCheck.valid) {
        request.log.warn(
          { userId: user.userId, forbiddenFields: fieldCheck.forbiddenFields },
          "[user-config] 租户尝试修改受限 Agent 配置字段",
        );
        return reply.code(403).send({
          success: false,
          error: `Forbidden fields for tenant override: ${fieldCheck.forbiddenFields.join(", ")}`,
          code: "FORBIDDEN_FIELDS",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[user-config] 覆盖用户 Agent 配置",
      );

      const db = getDatabase();
      const repo = new AgentDefaultConfigRepository(db);
      const config = await repo.upsertTenantConfig(
        user.userId,
        body,
        user.userId,
      );

      return {
        success: true,
        data: config,
      };
    },
  );

  // =========================================================================
  // 7. GET /api/config/auth-profiles - 获取用户有效认证配置列表
  // =========================================================================
  server.get(
    "/api/config/auth-profiles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      request.log.info(
        { userId: user.userId },
        "[user-config] 查询有效认证配置列表",
      );

      const db = getDatabase();
      const repo = new AuthProfileRepository(db);
      const profiles = await repo.listEffectiveProfiles(user.userId);

      return {
        success: true,
        data: profiles.map((p) =>
          sanitizeAuthProfile(p as unknown as Record<string, unknown>),
        ),
      };
    },
  );

  // =========================================================================
  // 8. PUT /api/config/auth-profiles/:id - 覆盖/新增用户认证配置
  // =========================================================================
  server.put(
    "/api/config/auth-profiles/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      const { id: profileId } = request.params as { id: string };
      const body = request.body as {
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

      /** 校验必填字段 */
      if (!body.provider || !body.credentialMode) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: provider, credentialMode",
          code: "VALIDATION_ERROR",
        });
      }

      /** 租户安全边界：只允许白名单字段 */
      const fieldCheck = validateTenantFields(
        body as Record<string, unknown>,
        TENANT_AUTH_PROFILE_FIELDS,
      );
      if (!fieldCheck.valid) {
        request.log.warn(
          { userId: user.userId, profileId, forbiddenFields: fieldCheck.forbiddenFields },
          "[user-config] 租户尝试修改受限 Auth Profile 字段",
        );
        return reply.code(403).send({
          success: false,
          error: `Forbidden fields for tenant override: ${fieldCheck.forbiddenFields.join(", ")}`,
          code: "FORBIDDEN_FIELDS",
        });
      }

      request.log.info(
        { userId: user.userId, profileId },
        "[user-config] 覆盖用户认证配置",
      );

      const db = getDatabase();
      const repo = new AuthProfileRepository(db);
      const profile = await repo.upsertTenantProfile(
        user.userId,
        profileId,
        {
          provider: body.provider,
          credentialMode: body.credentialMode,
          apiKey: body.apiKey,
          token: body.token,
          tokenExpires: body.tokenExpires
            ? new Date(body.tokenExpires)
            : undefined,
          oauthCredentials: body.oauthCredentials,
          email: body.email,
          enabled: body.enabled,
          priority: body.priority,
          modelBindings: body.modelBindings,
          cooldownConfig: body.cooldownConfig,
          extraConfig: body.extraConfig,
        },
        user.userId,
      );

      return {
        success: true,
        data: sanitizeAuthProfile(
          profile as unknown as Record<string, unknown>,
        ),
      };
    },
  );

  // =========================================================================
  // 9. DELETE /api/config/auth-profiles/:id - 删除用户私有认证配置覆盖
  // =========================================================================
  server.delete(
    "/api/config/auth-profiles/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) return replyUnauthorized(reply);

      const { id: profileId } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, profileId },
        "[user-config] 删除用户认证配置覆盖",
      );

      const db = getDatabase();
      const repo = new AuthProfileRepository(db);
      const deleted = await repo.deleteTenantProfile(user.userId, profileId);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: "Tenant auth profile override not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: {
          message: "Auth profile override deleted, system default restored",
        },
      };
    },
  );
}
