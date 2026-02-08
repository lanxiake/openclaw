/**
 * 本地文件系统对象存储提供者
 *
 * 使用本地文件系统模拟对象存储，适用于开发和测试环境。
 * 不支持预签名 URL 等高级功能。
 *
 * @module memory/pluggable/providers/storage
 */

import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type {
  BucketInfo,
  IObjectStorageProvider,
  ListResult,
  MultipartUploadOptions,
  ObjectMetadata,
  StorageListOptions,
  StorageUsage,
  UploadOptions,
} from "../../interfaces/object-storage.js";
import { registerProvider } from "../factory.js";

/**
 * 本地存储配置
 */
export interface LocalStorageConfig extends ProviderConfig {
  options: {
    /** 基础存储路径 */
    basePath: string;
  };
}

/**
 * 本地文件系统对象存储提供者
 *
 * 特性:
 * - 使用本地文件系统存储
 * - 桶 = 子目录
 * - 对象键 = 文件路径
 * - 元数据存储在 `.meta.json` 文件中
 *
 * @example
 * ```typescript
 * const provider = new LocalObjectStorageProvider({
 *   provider: 'local',
 *   options: { basePath: './.storage' },
 * })
 * await provider.initialize()
 *
 * await provider.upload('documents', 'test.txt', Buffer.from('Hello'))
 * const data = await provider.download('documents', 'test.txt')
 *
 * await provider.shutdown()
 * ```
 */
export class LocalObjectStorageProvider implements IObjectStorageProvider {
  readonly name = "local-storage";
  readonly version = "1.0.0";

  /** 基础存储路径 */
  private basePath: string;

  /** 桶元数据 (bucketName -> createdAt) */
  private buckets = new Map<string, Date>();

  /**
   * 创建本地对象存储提供者
   *
   * @param config - 配置
   */
  constructor(config?: LocalStorageConfig) {
    this.basePath = config?.options?.basePath || "./.memory/storage";
  }

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    console.log(`[local-storage] 初始化本地对象存储提供者 (路径: ${this.basePath})`);

    // 确保基础目录存在
    await fs.mkdir(this.basePath, { recursive: true });

    // 扫描已存在的桶
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const stat = await fs.stat(path.join(this.basePath, entry.name));
          this.buckets.set(entry.name, stat.birthtime);
        }
      }
    } catch {
      // 忽略错误
    }

    console.log(`[local-storage] 初始化完成 (发现 ${this.buckets.size} 个桶)`);
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log("[local-storage] 关闭提供者");
    this.buckets.clear();
    console.log("[local-storage] 已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      // 检查基础目录是否可访问
      await fs.access(this.basePath);
      return {
        status: "healthy",
        latency: 0,
        details: {
          basePath: this.basePath,
          bucketCount: this.buckets.size,
        },
      };
    } catch {
      return {
        status: "unhealthy",
        latency: 0,
        details: {
          error: "基础目录不可访问",
        },
      };
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取对象的完整文件路径
   */
  private getObjectPath(bucket: string, key: string): string {
    return path.join(this.basePath, bucket, key);
  }

  /**
   * 获取元数据文件路径
   */
  private getMetadataPath(bucket: string, key: string): string {
    return path.join(this.basePath, bucket, `.meta`, `${key}.json`);
  }

  /**
   * 保存元数据
   */
  private async saveMetadata(
    bucket: string,
    key: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    const metaPath = this.getMetadataPath(bucket, key);
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  /**
   * 读取元数据
   */
  private async loadMetadata(bucket: string, key: string): Promise<Record<string, string>> {
    try {
      const metaPath = this.getMetadataPath(bucket, key);
      const content = await fs.readFile(metaPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * 计算 ETag (MD5)
   */
  private calculateEtag(data: Buffer): string {
    return createHash("md5").update(data).digest("hex");
  }

  // ==================== 上传下载 ====================

  /**
   * 上传文件
   */
  async upload(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    options?: UploadOptions,
  ): Promise<string> {
    console.log(`[local-storage] 上传: ${bucket}/${key}`);

    const objPath = this.getObjectPath(bucket, key);
    await fs.mkdir(path.dirname(objPath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(objPath, data);
    } else {
      const writeStream = createWriteStream(objPath);
      await pipeline(data, writeStream);
    }

    // 保存元数据
    if (options?.metadata) {
      await this.saveMetadata(bucket, key, {
        ...options.metadata,
        contentType: options.contentType || "application/octet-stream",
      });
    }

    return `${bucket}/${key}`;
  }

  /**
   * 分片上传（简化版：与普通上传相同）
   */
  async uploadMultipart(
    bucket: string,
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions,
  ): Promise<string> {
    return this.upload(bucket, key, stream, options);
  }

  /**
   * 下载文件
   */
  async download(bucket: string, key: string): Promise<Buffer> {
    console.log(`[local-storage] 下载: ${bucket}/${key}`);

    const objPath = this.getObjectPath(bucket, key);
    return fs.readFile(objPath);
  }

  /**
   * 获取文件流
   */
  async getStream(bucket: string, key: string): Promise<Readable> {
    console.log(`[local-storage] 获取流: ${bucket}/${key}`);

    const objPath = this.getObjectPath(bucket, key);
    return createReadStream(objPath);
  }

  /**
   * 获取预签名下载 URL（简化版：返回 file:// URL）
   */
  async getSignedUrl(bucket: string, key: string, _expiresIn?: number): Promise<string> {
    console.log(`[local-storage] 获取签名 URL: ${bucket}/${key} - 简化版返回 file:// URL`);

    const objPath = this.getObjectPath(bucket, key);
    return `file://${path.resolve(objPath)}`;
  }

  /**
   * 获取预签名上传 URL（简化版：返回临时 ID）
   */
  async getSignedUploadUrl(bucket: string, key: string, _expiresIn?: number): Promise<string> {
    console.log(`[local-storage] 获取上传签名 URL: ${bucket}/${key} - 简化版不支持`);

    // 返回一个临时标识，实际上传需要直接使用 upload 方法
    return `local://${bucket}/${key}?uploadId=${randomUUID()}`;
  }

  // ==================== 文件管理 ====================

  /**
   * 删除文件
   */
  async delete(bucket: string, key: string): Promise<void> {
    console.log(`[local-storage] 删除: ${bucket}/${key}`);

    const objPath = this.getObjectPath(bucket, key);
    const metaPath = this.getMetadataPath(bucket, key);

    try {
      await fs.unlink(objPath);
    } catch {
      // 忽略文件不存在的错误
    }

    try {
      await fs.unlink(metaPath);
    } catch {
      // 忽略元数据文件不存在的错误
    }
  }

  /**
   * 批量删除文件
   */
  async deleteMany(bucket: string, keys: string[]): Promise<void> {
    console.log(`[local-storage] 批量删除: ${bucket} (${keys.length} 个)`);

    await Promise.all(keys.map((key) => this.delete(bucket, key)));
  }

  /**
   * 复制文件
   */
  async copy(srcBucket: string, srcKey: string, dstBucket: string, dstKey: string): Promise<void> {
    console.log(`[local-storage] 复制: ${srcBucket}/${srcKey} -> ${dstBucket}/${dstKey}`);

    const srcPath = this.getObjectPath(srcBucket, srcKey);
    const dstPath = this.getObjectPath(dstBucket, dstKey);

    await fs.mkdir(path.dirname(dstPath), { recursive: true });
    await fs.copyFile(srcPath, dstPath);

    // 复制元数据
    const metadata = await this.loadMetadata(srcBucket, srcKey);
    if (Object.keys(metadata).length > 0) {
      await this.saveMetadata(dstBucket, dstKey, metadata);
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(bucket: string, key: string): Promise<boolean> {
    const objPath = this.getObjectPath(bucket, key);
    try {
      await fs.access(objPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件元数据
   */
  async getMetadata(bucket: string, key: string): Promise<ObjectMetadata> {
    const objPath = this.getObjectPath(bucket, key);
    const stat = await fs.stat(objPath);
    const content = await fs.readFile(objPath);
    const customMeta = await this.loadMetadata(bucket, key);

    return {
      size: stat.size,
      lastModified: stat.mtime,
      etag: this.calculateEtag(content),
      contentType: customMeta.contentType || "application/octet-stream",
      metadata: customMeta,
    };
  }

  /**
   * 列出文件
   */
  async list(bucket: string, prefix?: string, options?: StorageListOptions): Promise<ListResult> {
    console.log(`[local-storage] 列出: ${bucket}/${prefix || ""}`);

    const bucketPath = path.join(this.basePath, bucket);
    const objects: { key: string; size: number; lastModified: Date; etag: string }[] = [];
    const prefixes: string[] = [];

    try {
      await this.scanDirectory(bucketPath, "", prefix || "", options?.delimiter, objects, prefixes);
    } catch {
      // 桶不存在或无法访问
    }

    // 排序
    objects.sort((a, b) => a.key.localeCompare(b.key));

    // 分页
    const limit = options?.limit || 1000;
    const truncatedObjects = objects.slice(0, limit);

    return {
      objects: truncatedObjects,
      prefixes,
      isTruncated: objects.length > limit,
      continuationToken:
        objects.length > limit ? truncatedObjects[truncatedObjects.length - 1].key : undefined,
    };
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(
    basePath: string,
    relativePath: string,
    prefix: string,
    delimiter: string | undefined,
    objects: { key: string; size: number; lastModified: Date; etag: string }[],
    prefixes: string[],
  ): Promise<void> {
    const currentPath = path.join(basePath, relativePath);

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        // 跳过元数据目录
        if (entry.name === ".meta") continue;

        const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        // 检查前缀
        if (prefix && !entryRelPath.startsWith(prefix)) continue;

        if (entry.isDirectory()) {
          if (delimiter) {
            // 使用分隔符时，目录作为前缀返回
            prefixes.push(entryRelPath + "/");
          } else {
            // 递归扫描
            await this.scanDirectory(basePath, entryRelPath, prefix, delimiter, objects, prefixes);
          }
        } else {
          const filePath = path.join(currentPath, entry.name);
          const stat = await fs.stat(filePath);

          objects.push({
            key: entryRelPath,
            size: stat.size,
            lastModified: stat.mtime,
            etag: "", // 不计算 etag 以提高性能
          });
        }
      }
    } catch {
      // 目录不存在或无法访问
    }
  }

  // ==================== 存储桶管理 ====================

  /**
   * 创建存储桶
   */
  async createBucket(bucket: string): Promise<void> {
    console.log(`[local-storage] 创建桶: ${bucket}`);

    const bucketPath = path.join(this.basePath, bucket);
    await fs.mkdir(bucketPath, { recursive: true });
    this.buckets.set(bucket, new Date());
  }

  /**
   * 删除存储桶
   */
  async deleteBucket(bucket: string): Promise<void> {
    console.log(`[local-storage] 删除桶: ${bucket}`);

    const bucketPath = path.join(this.basePath, bucket);
    await fs.rm(bucketPath, { recursive: true, force: true });
    this.buckets.delete(bucket);
  }

  /**
   * 检查存储桶是否存在
   */
  async bucketExists(bucket: string): Promise<boolean> {
    const bucketPath = path.join(this.basePath, bucket);
    try {
      const stat = await fs.stat(bucketPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 列出所有存储桶
   */
  async listBuckets(): Promise<BucketInfo[]> {
    const buckets: BucketInfo[] = [];

    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const bucketPath = path.join(this.basePath, entry.name);
          const stat = await fs.stat(bucketPath);
          buckets.push({
            name: entry.name,
            createdAt: stat.birthtime,
          });
        }
      }
    } catch {
      // 忽略错误
    }

    return buckets;
  }

  // ==================== 统计 ====================

  /**
   * 获取存储用量
   */
  async getStorageUsage(bucket: string, prefix?: string): Promise<StorageUsage> {
    console.log(`[local-storage] 获取用量: ${bucket}/${prefix || ""}`);

    const result = await this.list(bucket, prefix, { limit: 100000 });

    let totalSize = 0;
    for (const obj of result.objects) {
      totalSize += obj.size;
    }

    return {
      totalSize,
      objectCount: result.objects.length,
    };
  }
}

// 自动注册提供者
registerProvider(
  "storage",
  "local",
  LocalObjectStorageProvider as unknown as new (
    options: Record<string, unknown>,
  ) => LocalObjectStorageProvider,
);
