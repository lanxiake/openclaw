/**
 * 用户记忆管理 Admin API 路由
 *
 * 提供管理员查看和管理用户记忆数据的 REST 端点。
 *
 * GET    /api/admin/users/:userId/memory/overview         - 记忆概览
 * GET    /api/admin/users/:userId/memory/facts             - 事实列表
 * PUT    /api/admin/users/:userId/memory/facts/:id         - 更新事实
 * DELETE /api/admin/users/:userId/memory/facts/:id         - 删除事实
 * GET    /api/admin/users/:userId/memory/preferences       - 偏好设置
 * GET    /api/admin/users/:userId/memory/workspace-files   - Workspace 文件列表
 * PUT    /api/admin/users/:userId/memory/workspace-files/:fileName  - 更新文件
 * POST   /api/admin/users/:userId/memory/workspace-files/:fileName/reset - 重置文件
 * GET    /api/admin/users/:userId/memory/audit-logs        - 审计日志
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getDatabase } from "../../../../../src/db/connection.js";
import {
  getUserProfileRepository,
  getUserFactRepository,
  getUserPreferencesV2Repository,
} from "../../../../../src/db/repositories/profile-memory.js";
import { getUserWorkspaceFilesRepository } from "../../../../../src/db/repositories/user-workspace-files.js";
import { getMemoryAuditRepository } from "../../../../../src/db/repositories/memory-audit.js";
import type { WorkspaceFileName } from "../../../../../src/db/schema/index.js";
import { getMemoryDefaults, getFileNameFromConfigKey } from "../../../../../src/db/seed/memory-defaults.js";

/**
 * 注册用户记忆管理路由
 *
 * @param server - Fastify 实例
 */
export function registerAdminMemoryRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/users/:userId/memory/overview - 记忆概览
   */
  server.get(
    "/api/admin/users/:userId/memory/overview",
    { preHandler: requirePermission("user", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-memory] 获取用户记忆概览",
      );

      const db = getDatabase();
      const profileRepo = getUserProfileRepository(db, userId);
      const factRepo = getUserFactRepository(db, userId);
      const prefsRepo = getUserPreferencesV2Repository(db, userId);
      const wsRepo = getUserWorkspaceFilesRepository(db, userId);
      const auditRepo = getMemoryAuditRepository(db);

      const [profile, factsResult, prefs, wsFiles, auditResult] = await Promise.all([
        profileRepo.get(),
        factRepo.findAll({ activeOnly: true, limit: 1 }),
        prefsRepo.get(),
        wsRepo.getAllForUser(),
        auditRepo.findByUser(userId, { limit: 1 }),
      ]);

      return {
        success: true,
        data: {
          userId,
          hasProfile: !!profile,
          factsCount: factsResult.total,
          hasPreferences: !!prefs,
          workspaceFilesCount: wsFiles.length,
          auditLogsCount: auditResult.total,
        },
      };
    },
  );

  /**
   * GET /api/admin/users/:userId/memory/facts - 事实列表
   */
  server.get(
    "/api/admin/users/:userId/memory/facts",
    { preHandler: requirePermission("user", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };
      const query = request.query as {
        category?: string;
        activeOnly?: string;
        limit?: string;
        offset?: string;
      };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-memory] 获取用户事实列表",
      );

      const db = getDatabase();
      const repo = getUserFactRepository(db, userId);

      const result = await repo.findAll({
        category: query.category as Parameters<typeof repo.findAll>[0]["category"],
        activeOnly: query.activeOnly !== "false",
        limit: query.limit ? Number.parseInt(query.limit, 10) : 50,
        offset: query.offset ? Number.parseInt(query.offset, 10) : 0,
      });

      return {
        success: true,
        data: {
          facts: result.facts.map((f) => ({
            id: f.id,
            category: f.category,
            key: f.key,
            value: f.value,
            confidence: f.confidence,
            source: f.source,
            sensitive: f.sensitive,
            isActive: f.isActive,
            createdAt: f.createdAt?.toISOString(),
            updatedAt: f.updatedAt?.toISOString(),
          })),
          total: result.total,
        },
      };
    },
  );

  /**
   * PUT /api/admin/users/:userId/memory/facts/:id - 更新事实
   */
  server.put(
    "/api/admin/users/:userId/memory/facts/:id",
    { preHandler: requirePermission("user", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId, id } = request.params as { userId: string; id: string };
      const body = request.body as { value?: string; confidence?: number };

      request.log.info(
        { adminId: admin.adminId, userId, factId: id },
        "[admin-memory] 更新用户事实",
      );

      const db = getDatabase();
      const repo = getUserFactRepository(db, userId);

      const updated = await repo.update(id, {
        value: body.value,
        confidence: body.confidence,
      });

      if (!updated) {
        reply.status(404);
        return { success: false, error: `事实不存在: ${id}` };
      }

      // 记录审计日志
      const auditRepo = getMemoryAuditRepository(db);
      auditRepo
        .log({
          userId,
          action: "update_fact",
          source: "admin",
          targetId: id,
          adminId: admin.adminId,
          details: { value: body.value, confidence: body.confidence },
        })
        .catch(() => {});

      return {
        success: true,
        data: {
          id: updated.id,
          category: updated.category,
          key: updated.key,
          value: updated.value,
          confidence: updated.confidence,
          source: updated.source,
          sensitive: updated.sensitive,
          isActive: updated.isActive,
          createdAt: updated.createdAt?.toISOString(),
          updatedAt: updated.updatedAt?.toISOString(),
        },
      };
    },
  );

  /**
   * DELETE /api/admin/users/:userId/memory/facts/:id - 删除（停用）事实
   */
  server.delete(
    "/api/admin/users/:userId/memory/facts/:id",
    { preHandler: requirePermission("user", "edit") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId, id } = request.params as { userId: string; id: string };

      request.log.info(
        { adminId: admin.adminId, userId, factId: id },
        "[admin-memory] 删除用户事实",
      );

      const db = getDatabase();
      const repo = getUserFactRepository(db, userId);
      await repo.deactivate(id);

      // 记录审计日志
      const auditRepo = getMemoryAuditRepository(db);
      auditRepo
        .log({
          userId,
          action: "delete_fact",
          source: "admin",
          targetId: id,
          adminId: admin.adminId,
        })
        .catch(() => {});

      return { success: true };
    },
  );

  /**
   * GET /api/admin/users/:userId/memory/preferences - 偏好设置
   */
  server.get(
    "/api/admin/users/:userId/memory/preferences",
    { preHandler: requirePermission("user", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-memory] 获取用户偏好设置",
      );

      const db = getDatabase();
      const repo = getUserPreferencesV2Repository(db, userId);
      const prefs = await repo.get();

      return {
        success: true,
        data: prefs
          ? {
              language: prefs.language,
              timezone: prefs.timezone,
              responseStyle: prefs.responseStyle,
              confirmLevel: prefs.confirmLevel,
              thinkingLevel: prefs.thinkingLevel,
              verboseLevel: prefs.verboseLevel,
              favoriteSkills: prefs.favoriteSkills,
              disabledSkills: prefs.disabledSkills,
              notifications: prefs.notifications,
            }
          : null,
      };
    },
  );

  /**
   * GET /api/admin/users/:userId/memory/workspace-files - Workspace 文件列表
   */
  server.get(
    "/api/admin/users/:userId/memory/workspace-files",
    { preHandler: requirePermission("user", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-memory] 获取用户 Workspace 文件列表",
      );

      const db = getDatabase();
      const repo = getUserWorkspaceFilesRepository(db, userId);
      const files = await repo.getAllForUser();

      return {
        success: true,
        data: files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          content: f.content,
          isCustomized: f.isCustomized,
          createdAt: f.createdAt?.toISOString(),
          updatedAt: f.updatedAt?.toISOString(),
        })),
      };
    },
  );

  /**
   * PUT /api/admin/users/:userId/memory/workspace-files/:fileName - 更新文件
   */
  server.put(
    "/api/admin/users/:userId/memory/workspace-files/:fileName",
    { preHandler: requirePermission("user", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId, fileName } = request.params as { userId: string; fileName: string };
      const body = request.body as { content?: string };

      if (!body.content || typeof body.content !== "string") {
        reply.status(400);
        return { success: false, error: "请提供 content 字段" };
      }

      request.log.info(
        { adminId: admin.adminId, userId, fileName },
        "[admin-memory] 更新用户 Workspace 文件",
      );

      const db = getDatabase();
      const repo = getUserWorkspaceFilesRepository(db, userId);
      const file = await repo.upsert(fileName as WorkspaceFileName, body.content);

      // 记录审计日志
      const auditRepo = getMemoryAuditRepository(db);
      auditRepo
        .log({
          userId,
          action: "update_workspace_file",
          source: "admin",
          targetId: file.id,
          adminId: admin.adminId,
          details: { fileName, contentLength: body.content.length },
        })
        .catch(() => {});

      return {
        success: true,
        data: {
          id: file.id,
          fileName: file.fileName,
          content: file.content,
          isCustomized: file.isCustomized,
          createdAt: file.createdAt?.toISOString(),
          updatedAt: file.updatedAt?.toISOString(),
        },
      };
    },
  );

  /**
   * POST /api/admin/users/:userId/memory/workspace-files/:fileName/reset - 重置文件
   */
  server.post(
    "/api/admin/users/:userId/memory/workspace-files/:fileName/reset",
    { preHandler: requirePermission("user", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId, fileName } = request.params as { userId: string; fileName: string };

      request.log.info(
        { adminId: admin.adminId, userId, fileName },
        "[admin-memory] 重置用户 Workspace 文件为默认模板",
      );

      // 获取默认模板内容
      const defaults = await getMemoryDefaults();
      let defaultContent: string | undefined;

      for (const [key, content] of defaults) {
        if (getFileNameFromConfigKey(key) === fileName) {
          defaultContent = content;
          break;
        }
      }

      if (!defaultContent) {
        reply.status(404);
        return { success: false, error: `未找到文件 ${fileName} 的默认模板` };
      }

      const db = getDatabase();
      const repo = getUserWorkspaceFilesRepository(db, userId);
      const file = await repo.resetToDefault(fileName as WorkspaceFileName, defaultContent);

      // 记录审计日志
      const auditRepo = getMemoryAuditRepository(db);
      auditRepo
        .log({
          userId,
          action: "update_workspace_file",
          source: "admin",
          targetId: file?.id,
          adminId: admin.adminId,
          details: { fileName, action: "reset_to_default" },
        })
        .catch(() => {});

      return {
        success: true,
        data: file
          ? {
              id: file.id,
              fileName: file.fileName,
              content: file.content,
              isCustomized: file.isCustomized,
              createdAt: file.createdAt?.toISOString(),
              updatedAt: file.updatedAt?.toISOString(),
            }
          : null,
      };
    },
  );

  /**
   * GET /api/admin/users/:userId/memory/audit-logs - 审计日志
   */
  server.get(
    "/api/admin/users/:userId/memory/audit-logs",
    { preHandler: requirePermission("user", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { userId } = request.params as { userId: string };
      const query = request.query as {
        action?: string;
        source?: string;
        limit?: string;
        offset?: string;
      };

      request.log.info(
        { adminId: admin.adminId, userId },
        "[admin-memory] 获取用户记忆审计日志",
      );

      const db = getDatabase();
      const repo = getMemoryAuditRepository(db);

      const result = await repo.findByUser(userId, {
        action: query.action as Parameters<typeof repo.findByUser>[1]["action"],
        source: query.source as Parameters<typeof repo.findByUser>[1]["source"],
        limit: query.limit ? Number.parseInt(query.limit, 10) : 50,
        offset: query.offset ? Number.parseInt(query.offset, 10) : 0,
      });

      return {
        success: true,
        data: {
          logs: result.logs.map((l) => ({
            id: l.id,
            userId: l.userId,
            action: l.action,
            source: l.source,
            targetId: l.targetId,
            sessionId: l.sessionId,
            agentId: l.agentId,
            adminId: l.adminId,
            details: l.details,
            createdAt: l.createdAt?.toISOString(),
          })),
          total: result.total,
        },
      };
    },
  );
}
