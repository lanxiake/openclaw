/**
 * 用户记忆数据访问层
 *
 * MemoryRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import { userMemories, type UserMemory, type NewUserMemory } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== MemoryRepository ====================

/**
 * 用户记忆仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class MemoryRepository extends TenantScopedRepository {
  /**
   * 创建记忆
   *
   * userId 由基类自动注入，调用方无需传入
   */
  async create(
    data: Omit<NewUserMemory, "id" | "userId" | "createdAt" | "updatedAt" | "isActive"> & {
      isActive?: boolean;
    },
  ): Promise<UserMemory> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[MemoryRepository] 创建记忆, id=${id}, userId=${this.tenantId}, type=${data.type}`,
    );

    const [mem] = await this.db
      .insert(userMemories)
      .values({
        id,
        userId: this.tenantId,
        type: data.type,
        category: data.category,
        content: data.content,
        summary: data.summary,
        embedding: data.embedding,
        importance: data.importance ?? 5,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        metadata: data.metadata,
        expiresAt: data.expiresAt,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[MemoryRepository] 记忆创建成功, id=${id}`);
    return mem;
  }

  /**
   * 根据 ID 查找记忆（自动过滤 userId）
   */
  async findById(id: string): Promise<UserMemory | null> {
    logger.debug(`[MemoryRepository] 查找记忆, id=${id}, userId=${this.tenantId}`);

    const [mem] = await this.db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.id, id), eq(userMemories.userId, this.tenantId)));

    return mem ?? null;
  }

  /**
   * 查询当前用户的记忆列表
   *
   * @param options - 查询选项（分页、类型过滤、分类过滤、重要性排序）
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    type?: "episodic" | "profile" | "preference" | "fact";
    category?: string;
    activeOnly?: boolean;
    orderByImportance?: boolean;
  }): Promise<{ memories: UserMemory[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[MemoryRepository] 查询记忆列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(userMemories.userId, this.tenantId)];

    if (options?.type) {
      conditions.push(eq(userMemories.type, options.type));
    }

    if (options?.category) {
      conditions.push(eq(userMemories.category, options.category));
    }

    if (options?.activeOnly !== false) {
      // 默认只查活跃记忆
      conditions.push(eq(userMemories.isActive, true));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userMemories)
      .where(whereClause);

    // 获取数据
    const query = this.db
      .select()
      .from(userMemories)
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    // 按重要性降序或按更新时间降序
    const result = options?.orderByImportance
      ? await query.orderBy(desc(userMemories.importance))
      : await query.orderBy(desc(userMemories.updatedAt));

    return {
      memories: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 更新记忆
   */
  async update(
    id: string,
    data: Partial<
      Pick<UserMemory, "content" | "summary" | "category" | "importance" | "embedding" | "metadata">
    >,
  ): Promise<UserMemory | null> {
    logger.debug(`[MemoryRepository] 更新记忆, id=${id}, userId=${this.tenantId}`);

    const [mem] = await this.db
      .update(userMemories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(userMemories.id, id), eq(userMemories.userId, this.tenantId)))
      .returning();

    return mem ?? null;
  }

  /**
   * 停用记忆（设置 isActive = false）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug(`[MemoryRepository] 停用记忆, id=${id}, userId=${this.tenantId}`);

    await this.db
      .update(userMemories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(userMemories.id, id), eq(userMemories.userId, this.tenantId)));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 MemoryRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getMemoryRepository(db: Database, userId: string): MemoryRepository {
  return new MemoryRepository(db, userId);
}
