/**
 * 对象存储接口
 *
 * 对象存储管理用户上传的文档、图片、音频、视频等文件，
 * 使用 MinIO 或 S3 兼容的对象存储服务。
 *
 * @module memory/pluggable/interfaces
 */

import type { Readable } from 'node:stream'
import type { IMemoryProvider } from './memory-provider.js'

// ==================== 上传选项 ====================

/**
 * 上传选项
 */
export interface UploadOptions {
  /** Content-Type */
  contentType?: string
  /** 自定义元数据 */
  metadata?: Record<string, string>
  /** Cache-Control 头 */
  cacheControl?: string
}

/**
 * 分片上传选项
 */
export interface MultipartUploadOptions extends UploadOptions {
  /** 分片大小（字节），默认 5MB */
  partSize?: number
  /** 并发上传数，默认 4 */
  concurrency?: number
}

// ==================== 列表选项 ====================

/**
 * 列表选项
 */
export interface StorageListOptions {
  /** 最大返回数量 */
  limit?: number
  /** 分页 Token */
  continuationToken?: string
  /** 分隔符（用于模拟目录） */
  delimiter?: string
}

/**
 * 列表结果
 */
export interface ListResult {
  /** 对象列表 */
  objects: ObjectInfo[]
  /** 公共前缀（虚拟目录） */
  prefixes: string[]
  /** 下一页 Token */
  continuationToken?: string
  /** 是否还有更多 */
  isTruncated: boolean
}

// ==================== 对象信息 ====================

/**
 * 对象元数据
 */
export interface ObjectMetadata {
  /** 文件大小（字节） */
  size: number
  /** 最后修改时间 */
  lastModified: Date
  /** ETag */
  etag: string
  /** Content-Type */
  contentType: string
  /** 自定义元数据 */
  metadata: Record<string, string>
}

/**
 * 对象信息
 */
export interface ObjectInfo {
  /** 对象键 */
  key: string
  /** 文件大小（字节） */
  size: number
  /** 最后修改时间 */
  lastModified: Date
  /** ETag */
  etag: string
}

/**
 * 存储桶信息
 */
export interface BucketInfo {
  /** 桶名称 */
  name: string
  /** 创建时间 */
  createdAt: Date
}

/**
 * 存储用量
 */
export interface StorageUsage {
  /** 总大小（字节） */
  totalSize: number
  /** 对象数量 */
  objectCount: number
}

// ==================== 提供者接口 ====================

/**
 * 对象存储提供者接口
 *
 * 管理文件的上传、下载、删除等操作。
 *
 * @example
 * ```typescript
 * const provider = new MinIOStorageProvider({
 *   endpoint: 'localhost',
 *   port: 9000,
 *   accessKey: 'minioadmin',
 *   secretKey: 'minioadmin',
 * })
 * await provider.initialize()
 *
 * // 上传文件
 * const path = await provider.upload('documents', 'doc.pdf', pdfBuffer, {
 *   contentType: 'application/pdf',
 * })
 *
 * // 获取预签名 URL
 * const url = await provider.getSignedUrl('documents', 'doc.pdf', 3600)
 *
 * // 下载文件
 * const buffer = await provider.download('documents', 'doc.pdf')
 *
 * await provider.shutdown()
 * ```
 */
export interface IObjectStorageProvider extends IMemoryProvider {
  // ==================== 上传下载 ====================

  /**
   * 上传文件
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @param data - 文件内容
   * @param options - 上传选项
   * @returns 完整路径 (bucket/key)
   */
  upload(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    options?: UploadOptions
  ): Promise<string>

  /**
   * 分片上传（大文件）
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @param stream - 文件流
   * @param options - 上传选项
   * @returns 完整路径 (bucket/key)
   */
  uploadMultipart(
    bucket: string,
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<string>

  /**
   * 下载文件
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @returns 文件内容
   */
  download(bucket: string, key: string): Promise<Buffer>

  /**
   * 获取文件流
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @returns 可读流
   */
  getStream(bucket: string, key: string): Promise<Readable>

  /**
   * 获取预签名下载 URL
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @param expiresIn - 过期时间（秒），默认 3600
   * @returns 预签名 URL
   */
  getSignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string>

  /**
   * 获取预签名上传 URL
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @param expiresIn - 过期时间（秒），默认 3600
   * @returns 预签名 URL
   */
  getSignedUploadUrl(bucket: string, key: string, expiresIn?: number): Promise<string>

  // ==================== 文件管理 ====================

  /**
   * 删除文件
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   */
  delete(bucket: string, key: string): Promise<void>

  /**
   * 批量删除文件
   *
   * @param bucket - 存储桶名称
   * @param keys - 对象键列表
   */
  deleteMany(bucket: string, keys: string[]): Promise<void>

  /**
   * 复制文件
   *
   * @param srcBucket - 源存储桶
   * @param srcKey - 源对象键
   * @param dstBucket - 目标存储桶
   * @param dstKey - 目标对象键
   */
  copy(srcBucket: string, srcKey: string, dstBucket: string, dstKey: string): Promise<void>

  /**
   * 检查文件是否存在
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @returns 是否存在
   */
  exists(bucket: string, key: string): Promise<boolean>

  /**
   * 获取文件元数据
   *
   * @param bucket - 存储桶名称
   * @param key - 对象键
   * @returns 元数据
   */
  getMetadata(bucket: string, key: string): Promise<ObjectMetadata>

  /**
   * 列出文件
   *
   * @param bucket - 存储桶名称
   * @param prefix - 前缀过滤
   * @param options - 列表选项
   * @returns 列表结果
   */
  list(bucket: string, prefix?: string, options?: StorageListOptions): Promise<ListResult>

  // ==================== 存储桶管理 ====================

  /**
   * 创建存储桶
   *
   * @param bucket - 存储桶名称
   */
  createBucket(bucket: string): Promise<void>

  /**
   * 删除存储桶
   *
   * 必须先清空桶内所有对象
   *
   * @param bucket - 存储桶名称
   */
  deleteBucket(bucket: string): Promise<void>

  /**
   * 检查存储桶是否存在
   *
   * @param bucket - 存储桶名称
   * @returns 是否存在
   */
  bucketExists(bucket: string): Promise<boolean>

  /**
   * 列出所有存储桶
   *
   * @returns 存储桶列表
   */
  listBuckets(): Promise<BucketInfo[]>

  // ==================== 统计 ====================

  /**
   * 获取存储用量
   *
   * @param bucket - 存储桶名称
   * @param prefix - 前缀过滤
   * @returns 存储用量
   */
  getStorageUsage(bucket: string, prefix?: string): Promise<StorageUsage>
}
