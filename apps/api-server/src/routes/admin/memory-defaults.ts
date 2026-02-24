/**
 * 记忆默认模板管理 API 路由
 *
 * GET  /api/admin/memory/defaults         - 获取所有默认模板
 * GET  /api/admin/memory/defaults/:key    - 获取单个模板
 * PUT  /api/admin/memory/defaults/:key    - 更新模板内容
 * POST /api/admin/memory/defaults/reset   - 重置为原始文件模板
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import {
  getMemoryDefaults,
  getFileNameFromConfigKey,
  resetMemoryDefaultsFromFiles,
} from "../../../../../src/db/seed/memory-defaults.js";
import {
  getConfigByKey,
  setConfigValue,
} from "../../../../../src/assistant/config/config-service.js";

/**
 * 注册记忆默认模板管理路由
 *
 * @param server - Fastify 实例
 */
export function registerAdminMemoryDefaultsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/memory/defaults - 获取所有默认模板
   */
  server.get(
    "/api/admin/memory/defaults",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info({ adminId: admin.adminId }, "[admin-memory-defaults] 查询所有默认模板");

      const defaults = await getMemoryDefaults();

      /** 将 Map 转换为数组格式 */
      const templates = Array.from(defaults.entries()).map(([key, content]) => ({
        key,
        fileName: getFileNameFromConfigKey(key),
        content,
        contentLength: content.length,
      }));

      return {
        success: true,
        data: templates,
        meta: {
          total: templates.length,
        },
      };
    },
  );

  /**
   * GET /api/admin/memory/defaults/:key - 获取单个模板
   */
  server.get(
    "/api/admin/memory/defaults/:key",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };

      request.log.info(
        { adminId: admin.adminId, key },
        "[admin-memory-defaults] 查询单个模板",
      );

      const config = await getConfigByKey(key, { includeSensitive: false });

      if (!config) {
        reply.status(404);
        return {
          success: false,
          error: `模板不存在: ${key}`,
        };
      }

      const content = typeof config.value === "string" ? config.value : String(config.value);

      return {
        success: true,
        data: {
          key: config.key,
          fileName: getFileNameFromConfigKey(config.key),
          content,
          contentLength: content.length,
          updatedAt: config.updatedAt,
        },
      };
    },
  );

  /**
   * PUT /api/admin/memory/defaults/:key - 更新模板内容
   */
  server.put(
    "/api/admin/memory/defaults/:key",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { key } = request.params as { key: string };
      const body = request.body as { content?: string };

      if (!body.content || typeof body.content !== "string") {
        reply.status(400);
        return {
          success: false,
          error: "请提供 content 字段",
        };
      }

      request.log.info(
        { adminId: admin.adminId, key, contentLength: body.content.length },
        "[admin-memory-defaults] 更新模板内容",
      );

      const fileName = getFileNameFromConfigKey(key);
      if (!fileName) {
        reply.status(404);
        return {
          success: false,
          error: `无效的模板键: ${key}`,
        };
      }

      const updated = await setConfigValue(key, body.content, {
        enableHistory: true,
        adminId: admin.adminId,
        adminName: admin.username,
      });

      return {
        success: true,
        data: {
          key: updated.key,
          fileName,
          content: typeof updated.value === "string" ? updated.value : String(updated.value),
          contentLength: body.content.length,
          updatedAt: updated.updatedAt,
        },
      };
    },
  );

  /**
   * POST /api/admin/memory/defaults/reset - 重置为原始文件模板
   */
  server.post(
    "/api/admin/memory/defaults/reset",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as { key?: string } | null;

      request.log.info(
        { adminId: admin.adminId, key: body?.key ?? "all" },
        "[admin-memory-defaults] 重置模板为原始文件",
      );

      const resetCount = await resetMemoryDefaultsFromFiles(body?.key);

      return {
        success: true,
        data: {
          resetCount,
          message: body?.key
            ? `已重置模板: ${body.key}`
            : `已重置所有 ${resetCount} 个模板`,
        },
      };
    },
  );
}
