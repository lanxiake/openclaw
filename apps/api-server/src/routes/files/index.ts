/**
 * 文件管理 API 路由
 *
 * 提供用户文件的 CRUD 操作，包括实际文件上传、下载
 * 所有操作自动限定在当前用户范围内
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getDatabase } from "../../../../../src/db/connection.js";
import { getFileRepository } from "../../../../../src/db/repositories/files.js";
import {
  BUCKETS,
  generateStorageKey,
  uploadFile,
  downloadFile,
  deleteFile as deleteMinioFile,
  getUploadUrl,
  getDownloadUrl,
  type FileMetadata,
} from "../../../../../src/infrastructure/minio/index.js";

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

      const db = getDatabase();
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

      const db = getDatabase();
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

      const db = getDatabase();
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
   * 同时删除 MinIO 中的实际文件和数据库元数据记录
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

      const db = getDatabase();
      const repo = getFileRepository(db, user.userId);

      // 先获取文件信息      const file = await repo.findById(id);
      if (!file) {
        return reply.code(404).send({
          success: false,
          error: "File not found",
          code: "NOT_FOUND",
        });
      }

      // 删除 MinIO 中的实际文件
      try {
        const bucket = file.storageBucket === "openclaw-media" ? BUCKETS.MEDIA : BUCKETS.FILES;
        await deleteMinioFile(bucket, file.storageKey);
        request.log.info(
          { bucket, storageKey: file.storageKey },
          "[files] MinIO 文件已删除",
        );
      } catch (minioError) {
        // MinIO 删除失败不阻止元数据删除，只记录警告
        request.log.warn(
          { error: minioError instanceof Error ? minioError.message : String(minioError) },
          "[files] MinIO 文件删除失败",
        );
      }

      // 删除数据库记录      await repo.delete(id);

      return { success: true, data: { message: "File deleted" } };
    },
  );

  /**
   * POST /api/files/upload - 上传文件
   *
   * 接收 multipart/form-data 格式的文件上传
   */
  server.post(
    "/api/files/upload",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      // 获取上传的文件数据      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          success: false,
          error: "No file uploaded",
          code: "BAD_REQUEST",
        });
      }

      const { filename, mimetype } = data;
      const chunks: Buffer[] = [];

      // 读取文件内容
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      request.log.info(
        { userId: user.userId, filename, size: fileBuffer.length, mimetype },
        "[files] 上传文件",
      );

      // 确定存储桶（图片/视频等媒体文件使用公开桶）
      const isMedia = mimetype.startsWith("image/") || mimetype.startsWith("video/");
      const bucket = isMedia ? BUCKETS.MEDIA : BUCKETS.FILES;
      const category = isMedia ? "attachment" : "document";

      // 生成存储键
      const storageKey = generateStorageKey(user.userId, filename, category);

      // 构建元数据
      const metadata: FileMetadata = {
        originalName: filename,
        contentType: mimetype,
        size: fileBuffer.length,
        userId: user.userId,
        uploadedAt: new Date().toISOString(),
      };

      // 上传到 MinIO
      const uploadResult = await uploadFile(bucket, storageKey, fileBuffer, metadata);

      // 创建数据库记录      const db = getDatabase();
      const repo = getFileRepository(db, user.userId);
      const file = await repo.create({
        fileName: filename,
        fileSize: fileBuffer.length,
        mimeType: mimetype,
        storageKey,
        storageBucket: bucket,
        category: category as "attachment" | "document",
        isPublic: isMedia,
      });

      return reply.code(201).send({
        success: true,
        data: {
          ...file,
          url: uploadResult.url,
        },
      });
    },
  );

  /**
   * GET /api/files/:id/download - 下载文件
   *
   * 返回文件内容或预签名下载 URL
   */
  server.get(
    "/api/files/:id/download",
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
      const query = request.query as { redirect?: string };

      request.log.info(
        { userId: user.userId, fileId: id },
        "[files] 下载文件",
      );

      const db = getDatabase();
      const repo = getFileRepository(db, user.userId);
      const file = await repo.findById(id);

      if (!file) {
        return reply.code(404).send({
          success: false,
          error: "File not found",
          code: "NOT_FOUND",
        });
      }

      const bucket = file.storageBucket === "openclaw-media" ? BUCKETS.MEDIA : BUCKETS.FILES;

      // 如果请求重定向，返回预签名 URL
      if (query.redirect === "true") {
        const url = await getDownloadUrl(bucket, file.storageKey, 3600);
        return reply.redirect(url);
      }

      // 直接返回文件内容
      const fileBuffer = await downloadFile(bucket, file.storageKey);

      return reply
        .header("Content-Type", file.mimeType)
        .header("Content-Disposition", `attachment; filename="${file.fileName}"`)
        .header("Content-Length", fileBuffer.length)
        .send(fileBuffer);
    },
  );

  /**
   * GET /api/files/upload-url - 获取预签名上传 URL
   *
   * 用于客户端直接上传到 MinIO
   */
  server.get(
    "/api/files/upload-url",
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
        filename: string;
        contentType?: string;
        category?: string;
      };

      if (!query.filename) {
        return reply.code(400).send({
          success: false,
          error: "filename is required",
          code: "BAD_REQUEST",
        });
      }

      const isMedia = query.contentType?.startsWith("image/") || query.contentType?.startsWith("video/");
      const bucket = isMedia ? BUCKETS.MEDIA : BUCKETS.FILES;
      const category = query.category || (isMedia ? "attachment" : "document");

      const storageKey = generateStorageKey(user.userId, query.filename, category);
      const uploadUrl = await getUploadUrl(bucket, storageKey, 3600);

      return {
        success: true,
        data: {
          uploadUrl,
          storageKey,
          bucket,
          expiresIn: 3600,
        },
      };
    },
  );
}
