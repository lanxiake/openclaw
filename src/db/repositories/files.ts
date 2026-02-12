/**
 * 用户文件元数据数据访问层
 *
 * FileRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import { userFiles, type UserFile, type NewUserFile } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== FileRepository ====================

/**
 * 用户文件仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class FileRepository extends TenantScopedRepository {
  /**
   * 创建文件记录
   *
   * userId 由基类自动注入，调用方无需传入
   */
  async create(data: Omit<NewUserFile, "id" | "userId" | "createdAt">): Promise<UserFile> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[FileRepository] 创建文件记录, id=${id}, userId=${this.tenantId}, fileName=${data.fileName}`,
    );

    const [file] = await this.db
      .insert(userFiles)
      .values({
        id,
        userId: this.tenantId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        storageKey: data.storageKey,
        storageBucket: data.storageBucket,
        category: data.category ?? "attachment",
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        thumbnailKey: data.thumbnailKey,
        checksum: data.checksum,
        metadata: data.metadata,
        isPublic: data.isPublic ?? false,
        expiresAt: data.expiresAt,
        createdAt: now,
      })
      .returning();

    logger.debug(`[FileRepository] 文件记录创建成功, id=${id}`);
    return file;
  }

  /**
   * 根据 ID 查找文件（自动过滤 userId）
   */
  async findById(id: string): Promise<UserFile | null> {
    logger.debug(`[FileRepository] 查找文件, id=${id}, userId=${this.tenantId}`);

    const [file] = await this.db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.id, id), eq(userFiles.userId, this.tenantId)));

    return file ?? null;
  }

  /**
   * 根据 storageKey 查找文件（自动过滤 userId）
   */
  async findByStorageKey(storageKey: string): Promise<UserFile | null> {
    logger.debug(
      `[FileRepository] 根据 storageKey 查找文件, key=${storageKey}, userId=${this.tenantId}`,
    );

    const [file] = await this.db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.storageKey, storageKey), eq(userFiles.userId, this.tenantId)));

    return file ?? null;
  }

  /**
   * 查询当前用户的文件列表
   *
   * @param options - 查询选项（分页、分类过滤）
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    category?: "attachment" | "avatar" | "skill_package" | "document";
  }): Promise<{ files: UserFile[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[FileRepository] 查询文件列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(userFiles.userId, this.tenantId)];

    if (options?.category) {
      conditions.push(eq(userFiles.category, options.category));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFiles)
      .where(whereClause);

    // 获取数据（按创建时间倒序）
    const result = await this.db
      .select()
      .from(userFiles)
      .where(whereClause)
      .orderBy(desc(userFiles.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      files: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 删除文件记录（硬删除）
   *
   * 注意：调用方需自行删除 MinIO 中的实际文件
   */
  async delete(id: string): Promise<void> {
    logger.debug(`[FileRepository] 删除文件记录, id=${id}, userId=${this.tenantId}`);

    await this.db
      .delete(userFiles)
      .where(and(eq(userFiles.id, id), eq(userFiles.userId, this.tenantId)));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 FileRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getFileRepository(db: Database, userId: string): FileRepository {
  return new FileRepository(db, userId);
}
