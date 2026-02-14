/**
 * AI 助手配置 API 路由
 *
 * 提供用户助手配置的 CRUD 操作，所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import { getAssistantConfigRepository } from "../../../../../src/db/repositories/assistant-configs.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册助手配置路由
 */
export function registerAssistantConfigRoutes(server: FastifyInstance): void {
  /**
   * GET /api/assistant-configs - 获取配置列表
   */
  server.get(
    "/api/assistant-configs",
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
      };

      request.log.info(
        { userId: user.userId },
        "[assistant-config] 查询配置列表",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      const result = await repo.findAll({
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return {
        success: true,
        data: result.configs,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * GET /api/assistant-configs/default - 获取默认配置
   */
  server.get(
    "/api/assistant-configs/default",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[assistant-config] 查询默认配置",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      const config = await repo.findDefault();

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "No default config found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    },
  );

  /**
   * GET /api/assistant-configs/:id - 获取配置详情
   */
  server.get(
    "/api/assistant-configs/:id",
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
        { userId: user.userId, configId: id },
        "[assistant-config] 查询配置详情",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      const config = await repo.findById(id);

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Config not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    },
  );

  /**
   * POST /api/assistant-configs - 创建配置
   */
  server.post(
    "/api/assistant-configs",
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
        isDefault?: boolean;
        personality?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        modelConfig?: Record<string, unknown>;
        devicePermissions?: Record<string, unknown>;
        systemPrompt?: string;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, name: body.name },
        "[assistant-config] 创建配置",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      const config = await repo.create({
        name: body.name,
        isDefault: body.isDefault ?? false,
        personality: body.personality,
        preferences: body.preferences,
        modelConfig: body.modelConfig,
        devicePermissions: body.devicePermissions,
        systemPrompt: body.systemPrompt,
        metadata: body.metadata,
      });

      return reply.code(201).send({ success: true, data: config });
    },
  );

  /**
   * PUT /api/assistant-configs/:id - 更新配置
   */
  server.put(
    "/api/assistant-configs/:id",
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
        isDefault?: boolean;
        personality?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        modelConfig?: Record<string, unknown>;
        devicePermissions?: Record<string, unknown>;
        systemPrompt?: string;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, configId: id },
        "[assistant-config] 更新配置",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      const config = await repo.update(id, body);

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Config not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: config };
    },
  );

  /**
   * POST /api/assistant-configs/:id/activate - 设为默认配置
   */
  server.post(
    "/api/assistant-configs/:id/activate",
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
        { userId: user.userId, configId: id },
        "[assistant-config] 设为默认配置",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);

      // 先取消当前默认配置      const currentDefault = await repo.findDefault();
      if (currentDefault && currentDefault.id !== id) {
        await repo.update(currentDefault.id, { isDefault: false });
      }

      // 设置新的默认配置
      const config = await repo.update(id, { isDefault: true });

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: "Config not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: { message: "Config activated as default" } };
    },
  );

  /**
   * DELETE /api/assistant-configs/:id - 删除配置
   */
  server.delete(
    "/api/assistant-configs/:id",
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
        { userId: user.userId, configId: id },
        "[assistant-config] 删除配置",
      );

      const db = getDatabase();
      const repo = getAssistantConfigRepository(db, user.userId);
      await repo.delete(id);

      return { success: true, data: { message: "Config deleted" } };
    },
  );
}
