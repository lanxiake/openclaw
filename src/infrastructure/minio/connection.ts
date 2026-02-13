/**
 * MinIO 连接模块
 *
 * 基于 MinIO SDK
 * 提供 S3 兼容的对象存储连接管理
 */

import * as Minio from "minio";

import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// MinIO 配置接口
export interface MinioConfig {
  /** MinIO 服务端点 */
  endPoint: string;
  /** MinIO 端口 */
  port: number;
  /** 是否使用 SSL */
  useSSL: boolean;
  /** Access Key */
  accessKey: string;
  /** Secret Key */
  secretKey: string;
  /** 区域（可选） */
  region?: string;
}

// 预定义的存储桶
export const BUCKETS = {
  /** 用户文件存储桶 */
  FILES: "openclaw-files",
  /** 媒体文件存储桶（公开访问） */
  MEDIA: "openclaw-media",
  /** 临时文件存储桶 */
  TEMP: "openclaw-temp",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// 模块级变量，用于存储单例连接
let minioClient: Minio.Client | null = null;

/**
 * 从环境变量获取 MinIO 配置
 *
 * @returns MinioConfig 对象
 */
export function getMinioConfigFromEnv(): MinioConfig {
  return {
    endPoint: process.env["MINIO_ENDPOINT"] || "localhost",
    port: parseInt(process.env["MINIO_PORT"] || "9000", 10),
    useSSL: process.env["MINIO_USE_SSL"] === "true",
    accessKey: process.env["MINIO_ACCESS_KEY"] || "openclaw",
    secretKey: process.env["MINIO_SECRET_KEY"] || "openclaw_dev",
    region: process.env["MINIO_REGION"],
  };
}

/**
 * 创建 MinIO 客户端
 *
 * @param config MinIO 配置
 * @returns MinIO 客户端实例
 */
export function createMinioClient(config: MinioConfig): Minio.Client {
  logger.info("[minio] Creating MinIO client", {
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    region: config.region,
  });

  const client = new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
  });

  logger.info("[minio] MinIO client created successfully");

  return client;
}

/**
 * 获取单例 MinIO 客户端
 *
 * 首次调用时会从环境变量读取配置并创建客户端
 * 当 Mock 模式启用时（通过全局标志），返回 Mock 客户端
 *
 * @returns MinIO 客户端实例
 */
export function getMinio(): Minio.Client {
  // 检查是否处于 Mock 模式（用于单元测试）
  const g = globalThis as Record<string, unknown>;
  if (g.__OPENCLAW_MOCK_ENABLED__ && g.__OPENCLAW_MOCK_MINIO__) {
    return g.__OPENCLAW_MOCK_MINIO__ as Minio.Client;
  }

  if (!minioClient) {
    const config = getMinioConfigFromEnv();
    minioClient = createMinioClient(config);
  }
  return minioClient;
}

/**
 * MinIO 健康检查
 *
 * @returns 检查结果
 */
export async function minioHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = getMinio();
    // 列出存储桶来检查连接
    await client.listBuckets();

    const latencyMs = Date.now() - startTime;
    logger.debug("[minio] Health check passed", { latencyMs });

    return { healthy: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logger.error("[minio] Health check failed", { error: errorMessage, latencyMs });

    return { healthy: false, latencyMs, error: errorMessage };
  }
}

/**
 * 确保存储桶存在
 *
 * @param bucketName 存储桶名称
 * @param region 区域（可选）
 */
export async function ensureBucketExists(bucketName: string, region?: string): Promise<void> {
  const client = getMinio();

  try {
    const exists = await client.bucketExists(bucketName);

    if (!exists) {
      logger.info("[minio] Creating bucket", { bucketName, region });
      await client.makeBucket(bucketName, region || "");
      logger.info("[minio] Bucket created successfully", { bucketName });
    } else {
      logger.debug("[minio] Bucket already exists", { bucketName });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[minio] Failed to ensure bucket exists", {
      bucketName,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * 初始化所有预定义存储桶
 */
export async function initializeBuckets(): Promise<void> {
  logger.info("[minio] Initializing buckets...");

  for (const bucketName of Object.values(BUCKETS)) {
    await ensureBucketExists(bucketName);
  }

  // 设置 MEDIA 桶为公开访问
  try {
    const client = getMinio();
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKETS.MEDIA}/*`],
        },
      ],
    };
    await client.setBucketPolicy(BUCKETS.MEDIA, JSON.stringify(policy));
    logger.info("[minio] Set public read policy for media bucket");
  } catch (error) {
    logger.warn("[minio] Failed to set bucket policy", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info("[minio] Buckets initialized successfully");
}

/**
 * 重置连接（用于测试）
 */
export function resetMinioConnection(): void {
  minioClient = null;
}

/**
 * 生成预签名 URL（用于上传）
 *
 * @param bucketName 存储桶名称
 * @param objectName 对象名称
 * @param expirySeconds 过期时间（秒）
 * @returns 预签名 URL
 */
export async function getPresignedPutUrl(
  bucketName: string,
  objectName: string,
  expirySeconds: number = 3600,
): Promise<string> {
  const client = getMinio();
  return client.presignedPutObject(bucketName, objectName, expirySeconds);
}

/**
 * 生成预签名 URL（用于下载）
 *
 * @param bucketName 存储桶名称
 * @param objectName 对象名称
 * @param expirySeconds 过期时间（秒）
 * @returns 预签名 URL
 */
export async function getPresignedGetUrl(
  bucketName: string,
  objectName: string,
  expirySeconds: number = 3600,
): Promise<string> {
  const client = getMinio();
  return client.presignedGetObject(bucketName, objectName, expirySeconds);
}
