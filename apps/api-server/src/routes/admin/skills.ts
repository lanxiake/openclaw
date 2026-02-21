/**
 * 技能管理 API 路由
 *
 * GET    /api/admin/skills              - 获取技能列表
 * GET    /api/admin/skills/stats        - 获取技能统计
 * GET    /api/admin/skills/featured     - 获取推荐技能
 * GET    /api/admin/skills/categories   - 获取分类列表
 * GET    /api/admin/skills/:id          - 获取技能详情
 * POST   /api/admin/skills              - 创建系统技能
 * PUT    /api/admin/skills/:id          - 编辑系统技能
 * DELETE /api/admin/skills/:id          - 删除系统技能
 * POST   /api/admin/skills/:id/upload-package - 上传技能包
 * POST   /api/admin/skills/:id/review   - 审核技能
 * POST   /api/admin/skills/:id/publish  - 发布技能
 * POST   /api/admin/skills/:id/unpublish - 下架技能
 * POST   /api/admin/skills/:id/featured - 设置推荐
 */

import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getSkillStats,
  getSkillList,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  getCategoryList,
  getFeaturedSkills,
  setFeatured,
} from "../../../../../src/assistant/skills/skill-service.js";
import {
  approveSkill,
  rejectSkill,
  publishSkill,
  unpublishSkill,
} from "../../../../../src/assistant/skills/skill-review-service.js";
import {
  uploadSkillFile,
  deleteAllSkillFiles,
} from "../../../../../src/assistant/skills/skill-storage-service.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";

/**
 * 注册技能管理路由
 */
export function registerAdminSkillsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/skills - 获取技能列表
   */
  server.get(
    "/api/admin/skills",
    { preHandler: requirePermission("skills", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        status?: string;
        categoryId?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(query.pageSize || "20", 10)),
      );

      request.log.info(
        { adminId: admin.adminId, page, pageSize },
        "[admin-skills] 查询技能列表",
      );

      try {
        const result = await getSkillList({
          page,
          pageSize,
          search: query.search,
          status: query.status as "published" | "pending" | "unpublished" | "rejected" | undefined,
          categoryId: query.categoryId,
          sortBy: query.sortBy as "createdAt" | "downloadCount" | "ratingAvg" | "name" | undefined,
          sortOrder: query.sortOrder as "asc" | "desc" | undefined,
        });

        return {
          success: true,
          data: result.items,
          meta: {
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: Math.ceil(result.total / result.pageSize),
          },
        };
      } catch (error) {
        request.log.error(
          { err: error },
          "[admin-skills] 查询技能列表失败",
        );
        throw error;
      }
    },
  );

  /**
   * GET /api/admin/skills/stats - 获取技能统计
   */
  server.get(
    "/api/admin/skills/stats",
    { preHandler: requirePermission("skills", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询技能统计",
      );

      const stats = await getSkillStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/skills/featured - 获取推荐技能
   */
  server.get(
    "/api/admin/skills/featured",
    { preHandler: requirePermission("skills", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询推荐技能",
      );

      const skills = await getFeaturedSkills();

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/admin/skills/categories - 获取分类列表
   */
  server.get(
    "/api/admin/skills/categories",
    { preHandler: requirePermission("skills", "view") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询分类列表",
      );

      const result = await getCategoryList();

      return { success: true, data: result.items };
    },
  );

  /**
   * GET /api/admin/skills/:id - 获取技能详情
   */
  server.get(
    "/api/admin/skills/:id",
    { preHandler: requirePermission("skills", "view") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 查询技能详情",
      );

      const skill = await getSkill(id);
      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: skill };
    },
  );

  /**
   * POST /api/admin/skills - 创建系统技能
   */
  server.post(
    "/api/admin/skills",
    { preHandler: requirePermission("skills", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const body = request.body as {
        name?: string;
        description?: string;
        readme?: string;
        version?: string;
        categoryId?: string;
        tags?: string[];
        subscriptionLevel?: string;
        iconUrl?: string;
        config?: Record<string, unknown>;
      };

      if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          error: "Name is required",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, name: body.name },
        "[admin-skills] 创建系统技能",
      );

      const skill = await createSkill({
        name: body.name.trim(),
        description: body.description,
        readme: body.readme,
        version: body.version || "1.0.0",
        categoryId: body.categoryId,
        tags: body.tags,
        subscriptionLevel: (body.subscriptionLevel as "free" | "pro" | "team" | "enterprise") || "free",
        iconUrl: body.iconUrl,
        config: body.config,
        sourceType: "system",
        isSystem: true,
        createdByAdminId: admin.adminId,
        status: "pending",
      });

      return { success: true, data: skill };
    },
  );

  /**
   * PUT /api/admin/skills/:id - 编辑系统技能
   */
  server.put(
    "/api/admin/skills/:id",
    { preHandler: requirePermission("skills", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      const body = request.body as {
        name?: string;
        description?: string;
        readme?: string;
        version?: string;
        categoryId?: string;
        tags?: string[];
        subscriptionLevel?: string;
        iconUrl?: string;
        config?: Record<string, unknown>;
      };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 编辑系统技能",
      );

      /** 确认技能存在 */
      const existing = await getSkill(id);
      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      /** 构建更新数据，只包含传入的字段 */
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.description !== undefined) updateData.description = body.description;
      if (body.readme !== undefined) updateData.readme = body.readme;
      if (body.version !== undefined) updateData.version = body.version;
      if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
      if (body.tags !== undefined) updateData.tags = body.tags;
      if (body.subscriptionLevel !== undefined) updateData.subscriptionLevel = body.subscriptionLevel;
      if (body.iconUrl !== undefined) updateData.iconUrl = body.iconUrl;
      if (body.config !== undefined) updateData.config = body.config;

      const updated = await updateSkill(id, updateData);

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/admin/skills/:id - 删除系统技能
   */
  server.delete(
    "/api/admin/skills/:id",
    { preHandler: requirePermission("skills", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 删除系统技能",
      );

      /** 确认技能存在 */
      const existing = await getSkill(id);
      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      /** 删除 MinIO 中的文件 */
      try {
        await deleteAllSkillFiles(id);
      } catch (error) {
        request.log.warn(
          { skillId: id, error },
          "[admin-skills] 删除技能文件失败（忽略）",
        );
      }

      /** 删除数据库记录 */
      const deleted = await deleteSkill(id);
      if (!deleted) {
        return reply.code(500).send({
          success: false,
          error: "Failed to delete skill",
          code: "DELETE_FAILED",
        });
      }

      return { success: true, data: { message: "Skill deleted successfully" } };
    },
  );

  /**
   * POST /api/admin/skills/:id/upload-package - 上传技能包
   *
   * 接收 application/octet-stream 格式的文件上传
   * 文件名通过 X-Filename 请求头传递
   */
  server.post(
    "/api/admin/skills/:id/upload-package",
    {
      preHandler: requirePermission("skills", "edit"),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 上传技能包",
      );

      /** 确认技能存在 */
      const existing = await getSkill(id);
      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      /** 获取上传的文件数据 */
      const body = request.body;
      if (!body || !Buffer.isBuffer(body)) {
        return reply.code(400).send({
          success: false,
          error: "No file data received. Send file as application/octet-stream body.",
          code: "BAD_REQUEST",
        });
      }

      const fileBuffer = body as Buffer;
      const filename = (request.headers["x-filename"] as string) || "package.zip";

      /** 文件大小限制 50MB */
      const MAX_SIZE = 50 * 1024 * 1024;
      if (fileBuffer.length > MAX_SIZE) {
        return reply.code(413).send({
          success: false,
          error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB`,
          code: "FILE_TOO_LARGE",
        });
      }

      /** 计算 SHA-256 哈希 */
      const hash = createHash("sha256").update(fileBuffer).digest("hex");

      request.log.info(
        { skillId: id, filename, size: fileBuffer.length, hash },
        "[admin-skills] 上传技能包到 MinIO",
      );

      /** 上传到 MinIO */
      const uploadResult = await uploadSkillFile({
        skillId: id,
        fileType: "package",
        data: fileBuffer,
        originalName: filename,
        contentType: "application/octet-stream",
        userId: admin.adminId,
      });

      /** 更新数据库记录 */
      await updateSkill(id, {
        packageStorageKey: uploadResult.key,
        packageHash: hash,
        packageSize: fileBuffer.length,
        packageUrl: uploadResult.url,
      });

      return {
        success: true,
        data: {
          key: uploadResult.key,
          hash,
          size: fileBuffer.length,
          url: uploadResult.url,
        },
      };
    },
  );

  /**
   * POST /api/admin/skills/:id/review - 审核技能
   */
  server.post(
    "/api/admin/skills/:id/review",
    { preHandler: requirePermission("skills", "review") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const { id } = request.params as { id: string };
      const { action, note, reason } = request.body as {
        action: "approve" | "reject";
        note?: string;
        reason?: string;
      };

      if (!action || !["approve", "reject"].includes(action)) {
        return reply.code(400).send({
          success: false,
          error: "Action must be 'approve' or 'reject'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, skillId: id, action },
        "[admin-skills] 审核技能",
      );

      let result;
      if (action === "approve") {
        result = await approveSkill(id, admin.adminId, note);
      } else {
        if (!reason) {
          return reply.code(400).send({
            success: false,
            error: "Reason is required for rejection",
            code: "VALIDATION_ERROR",
          });
        }
        result = await rejectSkill(id, admin.adminId, reason);
      }

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Review failed",
          code: "REVIEW_FAILED",
        });
      }

      return { success: true, data: { message: `Skill ${action}d successfully` } };
    },
  );

  /**
   * POST /api/admin/skills/:id/publish - 发布技能
   */
  server.post(
    "/api/admin/skills/:id/publish",
    { preHandler: requirePermission("skills", "publish") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 发布技能",
      );

      const result = await publishSkill(id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Publish failed",
          code: "PUBLISH_FAILED",
        });
      }

      return { success: true, data: { message: "Skill published successfully" } };
    },
  );

  /**
   * POST /api/admin/skills/:id/unpublish - 下架技能
   */
  server.post(
    "/api/admin/skills/:id/unpublish",
    { preHandler: requirePermission("skills", "publish") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 下架技能",
      );

      const result = await unpublishSkill(id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Unpublish failed",
          code: "UNPUBLISH_FAILED",
        });
      }

      return { success: true, data: { message: "Skill unpublished successfully" } };
    },
  );

  /**
   * POST /api/admin/skills/:id/featured - 设置推荐
   */
  server.post(
    "/api/admin/skills/:id/featured",
    { preHandler: requirePermission("skills", "edit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const { id } = request.params as { id: string };
      const { featured, order } = request.body as {
        featured: boolean;
        order?: number;
      };

      if (typeof featured !== "boolean") {
        return reply.code(400).send({
          success: false,
          error: "Featured must be a boolean",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, skillId: id, featured, order },
        "[admin-skills] 设置推荐",
      );

      const skill = await setFeatured(id, featured, order);

      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: skill };
    },
  );
}
