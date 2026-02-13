/**
 * MinIO 文件服务模块
 *
 * 提供文件上传、下载、删除等高级操作
 * 支持多租户文件隔离、元数据管理等功能
 */

import { Readable } from "node:stream";

import type { BucketItem, ItemBucketMetadata } from "minio";

import { getLogger } from "../../logging/logger.js";
import {
  getMinio,
  BUCKETS,
  type BucketName,
  getPresignedPutUrl,
  getPresignedGetUrl,
} from "./connection.js";

const logger = getLogger();

/**
 * 文件元数据
 */
export interface FileMetadata {
  /** 原始文件名 */
  originalName: string;
  /** MIME 类型 */
  contentType: string;
  /** 文件大小（字节） */
  size: number;
  /** 上传用户 ID */
  userId: string;
  /** 上传时间 */
  uploadedAt: string;
  /** 自定义元数据 */
  custom?: Record<string, string>;
}

/**
 * 上传结果
 */
export interface UploadResult {
  /** 存储桶名称 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** ETag */
  etag: string;
  /** 文件大小 */
  size: number;
  /** 访问 URL（如果是公开桶） */
  url?: string;
}

/**
 * 文件信息
 */
export interface FileInfo {
  /** 对象键 */
  key: string;
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: Date;
  /** ETag */
  etag: string;
  /** 元数据 */
  metadata?: FileMetadata;
}

/**
 * 生成用户文件的存储键
 *
 * @param userId 用户 ID
 * @param filename 文件名
 * @param category 文件分类（可选）
 * @returns 存储键
 */
export function generateStorageKey(userId: string, filename: string, category?: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (category) {
    return `${userId}/${category}/${timestamp}-${randomSuffix}-${safeFilename}`;
  }
  return `${userId}/${timestamp}-${randomSuffix}-${safeFilename}`;
}

/**
 * 上传文件（从 Buffer）
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @param data 文件数据
 * @param metadata 文件元数据
 * @returns 上传结果
 */
export async function uploadFile(
  bucket: BucketName,
  key: string,
  data: Buffer,
  metadata: FileMetadata,
): Promise<UploadResult> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Uploading file", {
      bucket,
      key,
      size: data.length,
      contentType: metadata.contentType,
    });

    // 构建 MinIO 元数据（所有值必须是字符串）
    const minioMetadata: ItemBucketMetadata = {
      "x-amz-meta-original-name": metadata.originalName,
      "x-amz-meta-user-id": metadata.userId,
      "x-amz-meta-uploaded-at": metadata.uploadedAt,
      "Content-Type": metadata.contentType,
    };

    // 添加自定义元数据
    if (metadata.custom) {
      for (const [k, v] of Object.entries(metadata.custom)) {
        minioMetadata[`x-amz-meta-${k}`] = v;
      }
    }

    const result = await client.putObject(bucket, key, data, data.length, minioMetadata);

    logger.info("[file-service] File uploaded successfully", {
      bucket,
      key,
      etag: result.etag,
      size: data.length,
    });

    const uploadResult: UploadResult = {
      bucket,
      key,
      etag: result.etag,
      size: data.length,
    };

    // 如果是公开桶，生成访问 URL
    if (bucket === BUCKETS.MEDIA) {
      const config = {
        endPoint: process.env["MINIO_ENDPOINT"] || "localhost",
        port: process.env["MINIO_PORT"] || "9000",
        useSSL: process.env["MINIO_USE_SSL"] === "true",
      };
      const protocol = config.useSSL ? "https" : "http";
      uploadResult.url = `${protocol}://${config.endPoint}:${config.port}/${bucket}/${key}`;
    }

    return uploadResult;
  } catch (error) {
    logger.error("[file-service] Failed to upload file", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 上传文件（从 Stream）
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @param stream 文件流
 * @param size 文件大小
 * @param metadata 文件元数据
 * @returns 上传结果
 */
export async function uploadFileFromStream(
  bucket: BucketName,
  key: string,
  stream: Readable,
  size: number,
  metadata: FileMetadata,
): Promise<UploadResult> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Uploading file from stream", {
      bucket,
      key,
      size,
      contentType: metadata.contentType,
    });

    const minioMetadata: ItemBucketMetadata = {
      "x-amz-meta-original-name": metadata.originalName,
      "x-amz-meta-user-id": metadata.userId,
      "x-amz-meta-uploaded-at": metadata.uploadedAt,
      "Content-Type": metadata.contentType,
    };

    if (metadata.custom) {
      for (const [k, v] of Object.entries(metadata.custom)) {
        minioMetadata[`x-amz-meta-${k}`] = v;
      }
    }

    const result = await client.putObject(bucket, key, stream, size, minioMetadata);

    logger.info("[file-service] File uploaded from stream successfully", {
      bucket,
      key,
      etag: result.etag,
    });

    return {
      bucket,
      key,
      etag: result.etag,
      size,
    };
  } catch (error) {
    logger.error("[file-service] Failed to upload file from stream", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 下载文件（返回 Buffer）
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @returns 文件数据
 */
export async function downloadFile(bucket: BucketName, key: string): Promise<Buffer> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Downloading file", { bucket, key });

    const stream = await client.getObject(bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        logger.debug("[file-service] File downloaded", {
          bucket,
          key,
          size: buffer.length,
        });
        resolve(buffer);
      });
      stream.on("error", reject);
    });
  } catch (error) {
    logger.error("[file-service] Failed to download file", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 下载文件（返回 Stream）
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @returns 文件流
 */
export async function downloadFileAsStream(bucket: BucketName, key: string): Promise<Readable> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Getting file stream", { bucket, key });
    return await client.getObject(bucket, key);
  } catch (error) {
    logger.error("[file-service] Failed to get file stream", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 删除文件
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 */
export async function deleteFile(bucket: BucketName, key: string): Promise<void> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Deleting file", { bucket, key });
    await client.removeObject(bucket, key);
    logger.info("[file-service] File deleted", { bucket, key });
  } catch (error) {
    logger.error("[file-service] Failed to delete file", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 批量删除文件
 *
 * @param bucket 存储桶名称
 * @param keys 对象键列表
 */
export async function deleteFiles(bucket: BucketName, keys: string[]): Promise<void> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Deleting files", { bucket, count: keys.length });
    await client.removeObjects(bucket, keys);
    logger.info("[file-service] Files deleted", { bucket, count: keys.length });
  } catch (error) {
    logger.error("[file-service] Failed to delete files", {
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 获取文件信息
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @returns 文件信息
 */
export async function getFileInfo(bucket: BucketName, key: string): Promise<FileInfo | null> {
  const client = getMinio();

  try {
    const stat = await client.statObject(bucket, key);

    return {
      key,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      metadata: stat.metaData
        ? {
            originalName: stat.metaData["x-amz-meta-original-name"] || key,
            contentType: stat.metaData["content-type"] || "application/octet-stream",
            size: stat.size,
            userId: stat.metaData["x-amz-meta-user-id"] || "",
            uploadedAt: stat.metaData["x-amz-meta-uploaded-at"] || "",
          }
        : undefined,
    };
  } catch (error) {
    // 文件不存在
    if ((error as { code?: string }).code === "NotFound") {
      return null;
    }
    logger.error("[file-service] Failed to get file info", {
      bucket,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 检查文件是否存在
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @returns 是否存在
 */
export async function fileExists(bucket: BucketName, key: string): Promise<boolean> {
  const info = await getFileInfo(bucket, key);
  return info !== null;
}

/**
 * 列出用户的文件
 *
 * @param bucket 存储桶名称
 * @param userId 用户 ID
 * @param prefix 额外前缀（可选）
 * @returns 文件列表
 */
export async function listUserFiles(
  bucket: BucketName,
  userId: string,
  prefix?: string,
): Promise<FileInfo[]> {
  const client = getMinio();
  const fullPrefix = prefix ? `${userId}/${prefix}` : `${userId}/`;

  try {
    logger.debug("[file-service] Listing user files", { bucket, userId, prefix });

    const files: FileInfo[] = [];
    const stream = client.listObjects(bucket, fullPrefix, true);

    return new Promise((resolve, reject) => {
      stream.on("data", (obj: BucketItem) => {
        if (obj.name) {
          files.push({
            key: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
          });
        }
      });
      stream.on("end", () => {
        logger.debug("[file-service] Listed user files", {
          bucket,
          userId,
          count: files.length,
        });
        resolve(files);
      });
      stream.on("error", reject);
    });
  } catch (error) {
    logger.error("[file-service] Failed to list user files", {
      bucket,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 复制文件
 *
 * @param sourceBucket 源存储桶
 * @param sourceKey 源对象键
 * @param destBucket 目标存储桶
 * @param destKey 目标对象键
 */
export async function copyFile(
  sourceBucket: BucketName,
  sourceKey: string,
  destBucket: BucketName,
  destKey: string,
): Promise<void> {
  const client = getMinio();

  try {
    logger.debug("[file-service] Copying file", {
      source: `${sourceBucket}/${sourceKey}`,
      dest: `${destBucket}/${destKey}`,
    });

    await client.copyObject(
      destBucket,
      destKey,
      `/${sourceBucket}/${sourceKey}`,
      new (await import("minio")).CopyConditions(),
    );

    logger.info("[file-service] File copied", {
      source: `${sourceBucket}/${sourceKey}`,
      dest: `${destBucket}/${destKey}`,
    });
  } catch (error) {
    logger.error("[file-service] Failed to copy file", {
      source: `${sourceBucket}/${sourceKey}`,
      dest: `${destBucket}/${destKey}`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 获取上传预签名 URL
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @param expirySeconds 过期时间（秒）
 * @returns 预签名 URL
 */
export async function getUploadUrl(
  bucket: BucketName,
  key: string,
  expirySeconds: number = 3600,
): Promise<string> {
  return getPresignedPutUrl(bucket, key, expirySeconds);
}

/**
 * 获取下载预签名 URL
 *
 * @param bucket 存储桶名称
 * @param key 对象键
 * @param expirySeconds 过期时间（秒）
 * @returns 预签名 URL
 */
export async function getDownloadUrl(
  bucket: BucketName,
  key: string,
  expirySeconds: number = 3600,
): Promise<string> {
  return getPresignedGetUrl(bucket, key, expirySeconds);
}

/**
 * 删除用户的所有文件
 *
 * @param bucket 存储桶名称
 * @param userId 用户 ID
 * @returns 删除的文件数量
 */
export async function deleteAllUserFiles(bucket: BucketName, userId: string): Promise<number> {
  const files = await listUserFiles(bucket, userId);

  if (files.length === 0) {
    return 0;
  }

  const keys = files.map((f) => f.key);
  await deleteFiles(bucket, keys);

  logger.info("[file-service] Deleted all user files", {
    bucket,
    userId,
    count: keys.length,
  });

  return keys.length;
}
