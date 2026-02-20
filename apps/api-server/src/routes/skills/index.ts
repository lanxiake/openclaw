/**
 * 用户自建技能 API 路由
 *
 * 提供用户自建技能的 CRUD 操作和文件上传，所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import { getCustomSkillRepository } from "../../../../../src/db/repositories/custom-skills.js";
import {
  getSkill,
  updateSkill,
} from "../../../../../src/assistant/skills/skill-service.js";
import {
  uploadSkillFile,
  type SkillFileUploadParams,
} from "../../../../../src/assistant/skills/skill-storage-service.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册用户自建技能路由
 */
export function registerSkillsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/skills - 获取技能列表
   */
  server.get(
    "/api/skills",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
      };

      request.log.info({ userId: user.userId }, "[skills] 查询技能列表");

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);
      const result = await repo.findAll({
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        status: query.status as
          | "draft"
          | "testing"
          | "ready"
          | "published"
          | "disabled"
          | undefined,
      });

      return {
        success: true,
        data: result.skills,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * GET /api/skills/:id - 获取技能详情
   */
  server.get(
    "/api/skills/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[skills] 查询技能详情",
      );

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);
      const skill = await repo.findById(id);

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
   * POST /api/skills - 创建技能
   */
  server.post(
    "/api/skills",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        name: string;
        description?: string;
        version?: string;
        code?: string;
        packageFileId?: string;
        manifest?: Record<string, unknown>;
        status?: string;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, name: body.name },
        "[skills] 创建技能",
      );

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);
      const skill = await repo.create({
        name: body.name,
        description: body.description,
        version: body.version ?? "1.0.0",
        code: body.code,
        packageFileId: body.packageFileId,
        manifest: body.manifest,
        status: (body.status as "draft" | "testing" | "ready" | "published" | "disabled") ?? "draft",
        metadata: body.metadata,
      });

      return reply.code(201).send({ success: true, data: skill });
    },
  );

  /**
   * PUT /api/skills/:id - 更新技能
   */
  server.put(
    "/api/skills/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        description?: string;
        version?: string;
        code?: string;
        manifest?: Record<string, unknown>;
        status?: string;
        testResults?: Record<string, unknown>;
        syncedDevices?: string[];
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[skills] 更新技能",
      );

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);
      const skill = await repo.update(id, body);

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
   * POST /api/skills/:id/test - 测试技能
   */
  server.post(
    "/api/skills/:id/test",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[skills] 测试技能",
      );

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);

      // 更新状态为 testing
      const skill = await repo.update(id, {
        status: "testing",
        testResults: {
          startedAt: new Date().toISOString(),
          status: "running",
        },
      });

      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      // 实际测试逻辑在 Sprint 11 MinIO 引入后实现
      return { success: true, data: { message: "Test started", skillId: id } };
    },
  );

  /**
   * DELETE /api/skills/:id - 删除技能
   */
  server.delete(
    "/api/skills/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[skills] 删除技能",
      );

      const db = getDatabase();
      const repo = getCustomSkillRepository(db, user.userId);
      await repo.delete(id);

      return { success: true, data: { message: "Skill deleted" } };
    },
  );

  /**
   * POST /api/skills/:id/upload - 上传技能文件（Base64）
   *
   * 接收 JSON 格式的 Base64 文件数据，上传到 MinIO 并更新技能记录
   * 支持的文件类型: package, icon, manifest
   */
  server.post(
    "/api/skills/:id/upload",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        fileType: string;
        originalName: string;
        contentType: string;
        data: string;
      };

      request.log.info(
        { userId: user.userId, skillId: id, fileType: body.fileType, originalName: body.originalName },
        "[skills] 上传技能文件",
      );

      // 验证必需参数
      if (!body.fileType || !body.originalName || !body.contentType || !body.data) {
        return reply.code(400).send({
          success: false,
          error: "缺少必需参数: fileType, originalName, contentType, data",
          code: "BAD_REQUEST",
        });
      }

      // 验证文件类型
      if (!["package", "icon", "manifest"].includes(body.fileType)) {
        return reply.code(400).send({
          success: false,
          error: "无效的文件类型，必须是 package, icon 或 manifest",
          code: "BAD_REQUEST",
        });
      }

      // 检查技能是否存在且属于当前用户
      const existingSkill = await getSkill(id);
      if (!existingSkill) {
        return reply.code(404).send({
          success: false,
          error: "技能不存在",
          code: "NOT_FOUND",
        });
      }

      if (existingSkill.authorId !== user.userId) {
        return reply.code(403).send({
          success: false,
          error: "无权限上传此技能的文件",
          code: "FORBIDDEN",
        });
      }

      // 解码 Base64 数据
      const fileBuffer = Buffer.from(body.data, "base64");

      request.log.info(
        { skillId: id, fileType: body.fileType, size: fileBuffer.length },
        "[skills] 开始上传文件到存储",
      );

      // 上传文件
      const uploadParams: SkillFileUploadParams = {
        skillId: id,
        fileType: body.fileType as "package" | "icon" | "manifest",
        data: fileBuffer,
        originalName: body.originalName,
        contentType: body.contentType,
        userId: user.userId,
      };

      const result = await uploadSkillFile(uploadParams);

      // 更新技能记录中的文件 URL
      const updates: Record<string, string> = {};
      if (body.fileType === "package") {
        updates.packageUrl = result.url;
      } else if (body.fileType === "icon") {
        updates.iconUrl = result.url;
      } else if (body.fileType === "manifest") {
        updates.manifestUrl = result.url;
      }

      await updateSkill(id, updates);

      request.log.info(
        { skillId: id, fileType: body.fileType, size: result.size, url: result.url },
        "[skills] 技能文件上传成功",
      );

      return reply.code(201).send({
        success: true,
        data: {
          bucket: result.bucket,
          key: result.key,
          url: result.url,
          size: result.size,
          etag: result.etag,
        },
      });
    },
  );
}
