/**
 * 用户 Workspace 文件数据访问层
 *
 * 管理用户个性化的 workspace 文件副本（SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, HEARTBEAT.md）。
 * 继承 TenantScopedRepository，自动实现多租户数据隔离。
 *
 * 核心行为：
 * - getByFileName: 获取指定文件，不存在返回 null
 * - upsert: 创建或更新文件，标记 isCustomized=true
 * - initializeForUser: 批量初始化默认模板（不覆盖已有文件）
 * - resetToDefault: 重置为默认模板内容，标记 isCustomized=false
 */

import { eq, and } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  userWorkspaceFiles,
  type UserWorkspaceFile,
  type WorkspaceFileName,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== UserWorkspaceFilesRepository ====================

/**
 * 用户 Workspace 文件仓库
 *
 * 管理用户的 workspace 文件副本，支持创建、更新、初始化、重置操作
 */
export class UserWorkspaceFilesRepository extends TenantScopedRepository {
  /**
   * 根据文件名获取用户的 workspace 文件
   *
   * @param fileName - workspace 文件名（如 SOUL.md, IDENTITY.md）
   * @returns 文件记录，不存在返回 null
   */
  async getByFileName(fileName: WorkspaceFileName): Promise<UserWorkspaceFile | null> {
    logger.debug(
      `[UserWorkspaceFilesRepository] 获取文件, fileName=${fileName}, userId=${this.tenantId}`,
    );

    const [file] = await this.db
      .select()
      .from(userWorkspaceFiles)
      .where(
        and(
          eq(userWorkspaceFiles.userId, this.tenantId),
          eq(userWorkspaceFiles.fileName, fileName),
        ),
      );

    return file ?? null;
  }

  /**
   * 获取用户的所有 workspace 文件
   *
   * @returns 用户的所有 workspace 文件记录数组
   */
  async getAllForUser(): Promise<UserWorkspaceFile[]> {
    logger.debug(`[UserWorkspaceFilesRepository] 获取所有文件, userId=${this.tenantId}`);

    const files = await this.db
      .select()
      .from(userWorkspaceFiles)
      .where(eq(userWorkspaceFiles.userId, this.tenantId));

    return files;
  }

  /**
   * 创建或更新 workspace 文件（标记为用户自定义）
   *
   * @param fileName - workspace 文件名
   * @param content - 文件内容
   * @returns 创建或更新后的文件记录
   */
  async upsert(fileName: WorkspaceFileName, content: string): Promise<UserWorkspaceFile> {
    logger.debug(
      `[UserWorkspaceFilesRepository] upsert 文件, fileName=${fileName}, userId=${this.tenantId}`,
    );

    const existing = await this.getByFileName(fileName);

    if (existing) {
      logger.debug(
        `[UserWorkspaceFilesRepository] 更新已有文件, id=${existing.id}, fileName=${fileName}`,
      );

      const [updated] = await this.db
        .update(userWorkspaceFiles)
        .set({
          content,
          isCustomized: true,
          updatedAt: new Date(),
        })
        .where(eq(userWorkspaceFiles.id, existing.id))
        .returning();

      return updated;
    }

    logger.debug(
      `[UserWorkspaceFilesRepository] 创建新文件, fileName=${fileName}, userId=${this.tenantId}`,
    );

    const id = generateId();
    const now = new Date();

    const [created] = await this.db
      .insert(userWorkspaceFiles)
      .values({
        id,
        userId: this.tenantId,
        fileName,
        content,
        isCustomized: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }

  /**
   * 批量初始化用户的 workspace 文件（不覆盖已有文件）
   *
   * @param defaults - 默认模板 Map<文件名, 内容>
   * @returns 实际初始化的文件数量
   */
  async initializeForUser(defaults: Map<string, string>): Promise<number> {
    logger.debug(
      `[UserWorkspaceFilesRepository] 初始化用户文件, userId=${this.tenantId}, 模板数=${defaults.size}`,
    );

    let count = 0;

    for (const [fileName, content] of defaults) {
      const existing = await this.getByFileName(fileName as WorkspaceFileName);

      if (existing) {
        logger.debug(
          `[UserWorkspaceFilesRepository] 跳过已有文件, fileName=${fileName}, userId=${this.tenantId}`,
        );
        continue;
      }

      const id = generateId();
      const now = new Date();

      await this.db.insert(userWorkspaceFiles).values({
        id,
        userId: this.tenantId,
        fileName,
        content,
        isCustomized: false,
        createdAt: now,
        updatedAt: now,
      });

      count++;
      logger.debug(
        `[UserWorkspaceFilesRepository] 初始化文件, fileName=${fileName}, userId=${this.tenantId}`,
      );
    }

    logger.debug(
      `[UserWorkspaceFilesRepository] 初始化完成, 新建=${count}, userId=${this.tenantId}`,
    );

    return count;
  }

  /**
   * 重置指定文件为默认模板内容
   *
   * @param fileName - workspace 文件名
   * @param defaultContent - 默认模板内容
   * @returns 重置后的文件记录，文件不存在则创建
   */
  async resetToDefault(
    fileName: WorkspaceFileName,
    defaultContent: string,
  ): Promise<UserWorkspaceFile | null> {
    logger.debug(
      `[UserWorkspaceFilesRepository] 重置文件, fileName=${fileName}, userId=${this.tenantId}`,
    );

    const existing = await this.getByFileName(fileName);

    if (existing) {
      const [updated] = await this.db
        .update(userWorkspaceFiles)
        .set({
          content: defaultContent,
          isCustomized: false,
          updatedAt: new Date(),
        })
        .where(eq(userWorkspaceFiles.id, existing.id))
        .returning();

      return updated;
    }

    // 文件不存在，创建默认文件
    const id = generateId();
    const now = new Date();

    const [created] = await this.db
      .insert(userWorkspaceFiles)
      .values({
        id,
        userId: this.tenantId,
        fileName,
        content: defaultContent,
        isCustomized: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }

  /**
   * 删除指定 workspace 文件
   *
   * @param fileName - workspace 文件名
   */
  async deleteByFileName(fileName: WorkspaceFileName): Promise<void> {
    logger.debug(
      `[UserWorkspaceFilesRepository] 删除文件, fileName=${fileName}, userId=${this.tenantId}`,
    );

    await this.db
      .delete(userWorkspaceFiles)
      .where(
        and(
          eq(userWorkspaceFiles.userId, this.tenantId),
          eq(userWorkspaceFiles.fileName, fileName),
        ),
      );
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 UserWorkspaceFilesRepository 实例
 *
 * @param db - Drizzle ORM 数据库实例
 * @param userId - 当前用户 ID
 * @returns UserWorkspaceFilesRepository 实例
 */
export function getUserWorkspaceFilesRepository(
  db: Database,
  userId: string,
): UserWorkspaceFilesRepository {
  logger.debug(`[getUserWorkspaceFilesRepository] 创建实例, userId=${userId}`);
  return new UserWorkspaceFilesRepository(db, userId);
}
