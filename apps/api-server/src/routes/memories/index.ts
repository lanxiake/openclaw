/**
 * 记忆管理 API 路由
 *
 * 提供用户记忆的 CRUD 操作，所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import { getMemoryRepository } from "../../../../../src/db/repositories/memories.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册记忆管理路由
 */
export function registerMemoriesRoutes(server: FastifyInstance): void {
  /**
   * GET /api/memories - 获取记忆列表
   */
  server.get(
    "/api/memories",
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
        type?: string;
        category?: string;
        activeOnly?: string;
        orderByImportance?: string;
      };

      request.log.info({ userId: user.userId }, "[memories] 查询记忆列表");

      const db = getDatabase();
      const repo = getMemoryRepository(db, user.userId);
      const result = await repo.findAll({
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        type: query.type as "episodic" | "profile" | "preference" | "fact" | undefined,
        category: query.category,
        activeOnly: query.activeOnly !== "false",
        orderByImportance: query.orderByImportance === "true",
      });

      return {
        success: true,
        data: result.memories,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * GET /api/memories/:id - 获取记忆详情
   */
  server.get(
    "/api/memories/:id",
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
        { userId: user.userId, memoryId: id },
        "[memories] 查询记忆详情",
      );

      const db = getDatabase();
      const repo = getMemoryRepository(db, user.userId);
      const memory = await repo.findById(id);

      if (!memory) {
        return reply.code(404).send({
          success: false,
          error: "Memory not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: memory };
    },
  );

  /**
   * POST /api/memories - 创建记忆
   */
  server.post(
    "/api/memories",
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
        type: string;
        category?: string;
        content: string;
        summary?: string;
        importance?: number;
        sourceType?: string;
        sourceId?: string;
        metadata?: Record<string, unknown>;
        expiresAt?: string;
      };

      request.log.info(
        { userId: user.userId, type: body.type },
        "[memories] 创建记忆",
      );

      const db = getDatabase();
      const repo = getMemoryRepository(db, user.userId);
      const memory = await repo.create({
        type: body.type as "episodic" | "profile" | "preference" | "fact",
        category: body.category,
        content: body.content,
        summary: body.summary,
        importance: body.importance ?? 5,
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        metadata: body.metadata,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      return reply.code(201).send({ success: true, data: memory });
    },
  );

  /**
   * PUT /api/memories/:id - 更新记忆
   */
  server.put(
    "/api/memories/:id",
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
        content?: string;
        summary?: string;
        category?: string;
        importance?: number;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, memoryId: id },
        "[memories] 更新记忆",
      );

      const db = getDatabase();
      const repo = getMemoryRepository(db, user.userId);
      const memory = await repo.update(id, body);

      if (!memory) {
        return reply.code(404).send({
          success: false,
          error: "Memory not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: memory };
    },
  );

  /**
   * DELETE /api/memories/:id - 停用记忆
   */
  server.delete(
    "/api/memories/:id",
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
        { userId: user.userId, memoryId: id },
        "[memories] 停用记忆",
      );

      const db = getDatabase();
      const repo = getMemoryRepository(db, user.userId);
      await repo.deactivate(id);

      return { success: true, data: { message: "Memory deactivated" } };
    },
  );
}
