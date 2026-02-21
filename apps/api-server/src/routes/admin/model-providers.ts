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

  /**
   * POST /api/admin/model-providers/:key/test - 测试提供商连接和模型可用性
   *
   * 发送轻量请求验证 API 连通性，再逐个检测已配置模型的可用性。
   * 返回连通状态、延迟（ms）和每个模型的测试结果。
   */
  server.post(
    "/api/admin/model-providers/:key/test",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };
      const query = request.query as { userId?: string };

      request.log.info(
        { adminId: admin.adminId, key },
        "[model-providers] 测试提供商连接"
      );

      // 获取完整的 provider 信息（含未脱敏 API Key）
      const provider = await repo.getProviderByKey(key, query.userId);
      if (!provider) {
        return reply.code(404).send({
          success: false,
          error: "Provider not found",
          code: "NOT_FOUND",
        });
      }

      if (!provider.apiKey) {
        return reply.code(400).send({
          success: false,
          error: "Provider has no API key configured",
          code: "NO_API_KEY",
        });
      }

      const apiType = provider.apiType ?? "openai-completions";
      const models = Array.isArray(provider.models) ? provider.models : [];
      const firstModel = models.length > 0 ? String(models[0]) : undefined;

      // 连通性测试
      const connectResult = await testProviderConnection(
        provider.baseUrl,
        provider.apiKey,
        apiType,
        firstModel
      );

      // 模型可用性测试（仅在连通的情况下测试）
      const modelResults: Array<{
        model: string;
        available: boolean;
        latencyMs: number;
        error?: string;
      }> = [];

      if (connectResult.connected && models.length > 0) {
        for (const model of models) {
          const modelStr = String(model);
          const result = await testModelAvailability(
            provider.baseUrl,
            provider.apiKey,
            apiType,
            modelStr
          );
          modelResults.push({
            model: modelStr,
            ...result,
          });
        }
      }

      return {
        success: true,
        data: {
          connected: connectResult.connected,
          latencyMs: connectResult.latencyMs,
          error: connectResult.error,
          models: modelResults,
        },
      };
    }
  );
}

// ---------------------------------------------------------------------------
// 模型测试辅助函数
// ---------------------------------------------------------------------------

/**
 * 构造各 API 类型的测试请求参数
 */
function buildTestRequest(
  baseUrl: string,
  apiKey: string,
  apiType: string,
  model: string
): { url: string; headers: Record<string, string>; body: string } {
  const trimmedUrl = baseUrl.replace(/\/+$/, "");

  if (apiType === "anthropic-messages" || apiType === "anthropic") {
    return {
      url: `${trimmedUrl}/v1/messages`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "Reply with exactly one word: ok" }],
          },
        ],
        metadata: { user_id: "admin_connection_test" },
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
              },
              required: ["reply"],
            },
          },
        },
        system: [
          {
            type: "text",
            text: "You are Claude Code, Anthropic's official CLI for Claude.",
          },
          {
            type: "text",
            text: 'This is a connection test. Reply with a JSON object: {"reply":"ok"}',
          },
        ],
        stream: true,
        temperature: 1,
        tools: [],
      }),
    };
  }

  if (apiType === "google-generative-ai" || apiType === "google-gemini") {
    return {
      url: `${trimmedUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    };
  }

  // 默认 openai-completions 格式（兼容 OpenAI / DeepSeek / 其他 OpenAI 兼容 API）
  return {
    url: `${trimmedUrl}/v1/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "hi" }],
      stream: false,
    }),
  };
}

/**
 * 测试 Provider 连通性
 *
 * 使用第一个配置的模型或默认模型发送轻量请求，
 * 验证 Base URL 和 API Key 是否有效。
 */
async function testProviderConnection(
  baseUrl: string,
  apiKey: string,
  apiType: string,
  firstModel?: string
): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  const model = firstModel ?? getDefaultModel(apiType);
  const { url, headers, body } = buildTestRequest(baseUrl, apiKey, apiType, model);

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    // 2xx 或 4xx(模型不存在等) 均表示连通成功
    // 仅 401/403 表示认证失败
    if (response.status === 401 || response.status === 403) {
      const errBody = await response.text().catch(() => "");
      const friendlyError = parseApiError(response.status, errBody);
      return {
        connected: false,
        latencyMs,
        error: `认证失败: ${friendlyError}`,
      };
    }

    // 主动关闭响应体，避免流式连接泄漏
    try {
      response.body?.cancel();
    } catch {
      // 忽略关闭错误
    }

    return { connected: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      latencyMs,
      error: msg.includes("abort")
        ? "连接超时（15秒）"
        : `连接失败: ${msg.slice(0, 200)}`,
    };
  }
}

/**
 * 测试单个模型的可用性
 *
 * 发送 max_tokens=10 的轻量请求，检测模型是否可调用。
 */
async function testModelAvailability(
  baseUrl: string,
  apiKey: string,
  apiType: string,
  model: string
): Promise<{ available: boolean; latencyMs: number; error?: string }> {
  const { url, headers, body } = buildTestRequest(baseUrl, apiKey, apiType, model);

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      // 主动关闭响应体，避免流式连接泄漏
      try {
        response.body?.cancel();
      } catch {
        // 忽略关闭错误
      }
      return { available: true, latencyMs };
    }

    const errBody = await response.text().catch(() => "");
    const friendlyError = parseApiError(response.status, errBody);
    return {
      available: false,
      latencyMs,
      error: friendlyError,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      latencyMs,
      error: msg.includes("abort") ? "请求超时（15秒）" : msg.slice(0, 200),
    };
  }
}

/**
 * 解析 API 响应错误体，提取用户可读的错误信息
 */
function parseApiError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    // Anthropic 格式: { error: { type, message } }
    if (parsed.error?.message) {
      return `[${status}] ${parsed.error.message}`;
    }
    // OpenAI 格式: { error: { message, type, code } }
    if (parsed.error && typeof parsed.error === "string") {
      return `[${status}] ${parsed.error}`;
    }
    // Google Gemini 格式: [{ error: { message, status } }]
    if (Array.isArray(parsed) && parsed[0]?.error?.message) {
      return `[${status}] ${parsed[0].error.message}`;
    }
    // 其他 { message } 格式
    if (parsed.message) {
      return `[${status}] ${parsed.message}`;
    }
  } catch {
    // JSON 解析失败，返回原始内容
  }
  return `HTTP ${status}: ${body.slice(0, 150)}`;
}

/**
 * 根据 API 类型返回一个默认的测试模型
 */
function getDefaultModel(apiType: string): string {
  switch (apiType) {
    case "anthropic-messages":
    case "anthropic":
      return "claude-3-haiku-20240307";
    case "google-generative-ai":
    case "google-gemini":
      return "gemini-1.5-flash";
    default:
      return "gpt-4o-mini";
  }
}
