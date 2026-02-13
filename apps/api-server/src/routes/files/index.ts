/**
 * 文件管理 API 路由
 *
 * 提供用户文件元数据的 CRUD 操作，所有操作自动限定在当前用户范围内
 * 注意：实际文件上传/下载功能在 Sprint 11 MinIO 引入后实现
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDb } from "../../../../../src/db/connection.js";
import { getFileRepository } from "../../../../../src/db/repositories/files.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册文件管理路由
 */
export function registerFilesRoutes(server: FastifyInstance): void {
  /**
   * GET /api/files - 获取文件列表
   */
  server.get(
    "/api/files",
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
        category?: string;
      };

      request.log.info({ userId: user.userId }, "[files] 查询文件列表");

      const db = getDb();
      const repo = getFileRepository(db, user.userId);
      const result = await repo.findAll({
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        category: query.category as
          | "attachment"
          | "avatar"
          | "skill_package"
          | "document"
          | undefined,
      });

      return {
        success: true,
        data: result.files,
        meta: {
          total: result.total,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        },
      };
    },
  );

  /**
   * GET /api/files/:id - 获取文件详情
   */
  server.get(
    "/api/files/:id",
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
        { userId: user.userId, fileId: id },
        "[files] 查询文件详情",
      );

      const db = getDb();
      const repo = getFileRepository(db, user.userId);
      const file = await repo.findById(id);

      if (!file) {
        return reply.code(404).send({
          success: false,
          error: "File not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: file };
    },
  );

  /**
   * POST /api/files - 创建文件记录（元数据）
   *
   * 注意：实际文件上传在 Sprint 11 MinIO 引入后实现
   * 当前仅创建元数据记录，storageKey 为占位符
   */
  server.post(
    "/api/files",
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
        fileName: string;
        fileSize: number;
        mimeType: string;
        storageKey?: string;
        storageBucket?: string;
        category?: string;
        sourceType?: string;
        sourceId?: string;
        thumbnailKey?: string;
        checksum?: string;
        metadata?: Record<string, unknown>;
        isPublic?: boolean;
        expiresAt?: string;
      };

      request.log.info(
        { userId: user.userId, fileName: body.fileName },
        "[files] 创建文件记录",
      );

      const db = getDb();
      const repo = getFileRepository(db, user.userId);
      const file = await repo.create({
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        storageKey: body.storageKey ?? `pending/${user.userId}/${Date.now()}`,
        storageBucket: body.storageBucket ?? "user-files",
        category: (body.category as "attachment" | "avatar" | "skill_package" | "document") ?? "attachment",
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        thumbnailKey: body.thumbnailKey,
        checksum: body.checksum,
        metadata: body.metadata,
        isPublic: body.isPublic ?? false,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      return reply.code(201).send({ success: true, data: file });
    },
  );

  /**
   * DELETE /api/files/:id - 删除文件
   *
   * 注意：当前仅删除元数据记录，实际文件删除在 Sprint 11 MinIO 引入后实现
   */
  server.delete(
    "/api/files/:id",
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
        { userId: user.userId, fileId: id },
        "[files] 删除文件",
      );

      const db = getDb();
      const repo = getFileRepository(db, user.userId);
      await repo.delete(id);

      return { success: true, data: { message: "File deleted" } };
    },
  );
}
