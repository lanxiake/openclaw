/**
 * 对话管理 API 路由
 *
 * 提供用户对话的 CRUD 操作，所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import {
  getConversationRepository,
  getMessageRepository,
} from "../../../../../src/db/repositories/conversations.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册对话管理路由
 *
 * 所有路由需要用户认证，Repository 在请求处理时延迟初始化
 */
export function registerConversationsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/conversations - 获取对话列表
   */
  server.get(
    "/api/conversations",
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

      request.log.info(
        { userId: user.userId },
        "[conversations] 查询对话列表",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      const result = await repo.findAll({
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        status: query.status as "active" | "archived" | "deleted" | undefined,
      });

      return {
        success: true,
        data: result.conversations,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * GET /api/conversations/:id - 获取对话详情
   */
  server.get(
    "/api/conversations/:id",
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
        { userId: user.userId, conversationId: id },
        "[conversations] 查询对话详情",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      const conversation = await repo.findById(id);

      if (!conversation) {
        return reply.code(404).send({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: conversation };
    },
  );

  /**
   * POST /api/conversations - 创建对话
   */
  server.post(
    "/api/conversations",
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
        title?: string;
        type?: string;
        deviceId?: string;
        agentConfig?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, title: body.title },
        "[conversations] 创建对话",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      const conversation = await repo.create({
        title: body.title ?? "New Conversation",
        type: (body.type as "chat" | "task" | "agent") ?? "chat",
        deviceId: body.deviceId,
        agentConfig: body.agentConfig,
        metadata: body.metadata,
      });

      return reply.code(201).send({ success: true, data: conversation });
    },
  );

  /**
   * PUT /api/conversations/:id - 更新对话
   */
  server.put(
    "/api/conversations/:id",
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
        title?: string;
        agentConfig?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, conversationId: id },
        "[conversations] 更新对话",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      const conversation = await repo.update(id, body);

      if (!conversation) {
        return reply.code(404).send({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: conversation };
    },
  );

  /**
   * POST /api/conversations/:id/archive - 归档对话
   */
  server.post(
    "/api/conversations/:id/archive",
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
        { userId: user.userId, conversationId: id },
        "[conversations] 归档对话",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      const conversation = await repo.updateStatus(id, "archived");

      if (!conversation) {
        return reply.code(404).send({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: { message: "Conversation archived" } };
    },
  );

  /**
   * DELETE /api/conversations/:id - 删除对话（软删除）
   */
  server.delete(
    "/api/conversations/:id",
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
        { userId: user.userId, conversationId: id },
        "[conversations] 删除对话",
      );

      const db = getDatabase();
      const repo = getConversationRepository(db, user.userId);
      await repo.softDelete(id);

      return { success: true, data: { message: "Conversation deleted" } };
    },
  );

  /**
   * GET /api/conversations/:id/messages - 获取对话消息列表
   */
  server.get(
    "/api/conversations/:id/messages",
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
      const query = request.query as {
        limit?: string;
        offset?: string;
      };

      request.log.info(
        { userId: user.userId, conversationId: id },
        "[conversations] 查询对话消息",
      );

      const db = getDatabase();
      const msgRepo = getMessageRepository(db, user.userId);
      const result = await msgRepo.findByConversation(id, {
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return {
        success: true,
        data: result.messages,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 50,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * POST /api/conversations/:id/messages - 添加消息到对话
   */
  server.post(
    "/api/conversations/:id/messages",
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
        role: string;
        content: string;
        contentType?: string;
        toolCalls?: unknown[];
        toolResults?: unknown[];
        attachments?: unknown[];
        tokenCount?: number;
        modelId?: string;
        metadata?: Record<string, unknown>;
      };

      request.log.info(
        { userId: user.userId, conversationId: id, role: body.role },
        "[conversations] 添加消息",
      );

      const db = getDatabase();
      const convRepo = getConversationRepository(db, user.userId);
      const msgRepo = getMessageRepository(db, user.userId);

      // 验证对话存在
      const conversation = await convRepo.findById(id);
      if (!conversation) {
        return reply.code(404).send({
          success: false,
          error: "Conversation not found",
          code: "NOT_FOUND",
        });
      }

      // 创建消息
      const message = await msgRepo.create({
        conversationId: id,
        role: body.role as "user" | "assistant" | "system" | "tool",
        content: body.content,
        contentType: body.contentType,
        toolCalls: body.toolCalls,
        toolResults: body.toolResults,
        attachments: body.attachments,
        tokenCount: body.tokenCount,
        modelId: body.modelId,
        metadata: body.metadata,
      });

      // 更新对话消息计数
      await convRepo.incrementMessageCount(id);

      return reply.code(201).send({ success: true, data: message });
    },
  );
}
