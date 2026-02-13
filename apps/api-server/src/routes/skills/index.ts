/**
 * 用户自建技能 API 路由
 *
 * 提供用户自建技能的 CRUD 操作，所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDb } from "../../../../../src/db/connection.js";
import { getCustomSkillRepository } from "../../../../../src/db/repositories/custom-skills.js";

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

      const db = getDb();
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

      const db = getDb();
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

      const db = getDb();
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

      const db = getDb();
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

      const db = getDb();
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

      const db = getDb();
      const repo = getCustomSkillRepository(db, user.userId);
      await repo.delete(id);

      return { success: true, data: { message: "Skill deleted" } };
    },
  );
}
