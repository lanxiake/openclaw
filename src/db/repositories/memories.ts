/**
 * 用户记忆数据访问层
 *
 * MemoryRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql, inArray } from "drizzle-orm";

import { type Database } from "../connection.js";
import { userMemories, type UserMemory, type NewUserMemory } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";
import {
  search as milvusSearch,
  upsertVector as milvusUpsert,
  deleteVector as milvusDelete,
} from "../../infrastructure/milvus/vector-store.js";
import { isMilvusConnected } from "../../infrastructure/milvus/connection.js";

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

    // 同步写入 Milvus（如有 embedding 且 Milvus 可用）
    if (mem.embedding && isMilvusConnected()) {
      try {
        await milvusUpsert({
          id: mem.id,
          userId: this.tenantId,
          embedding: mem.embedding,
          memoryType: mem.type,
          isActive: mem.isActive ?? true,
        });
        logger.debug(`[MemoryRepository] 记忆已同步到 Milvus, id=${id}`);
      } catch (error) {
        logger.warn(`[MemoryRepository] Milvus 同步失败, id=${id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

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
    type?: "episodic" | "profile" | "preference" | "fact" | "knowledge";
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
   *
   * 更新 PostgreSQL 后，如 embedding 有变化则同步到 Milvus
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

    if (!mem) {
      return null;
    }

    // 如果更新了 embedding，同步到 Milvus
    if (data.embedding && isMilvusConnected()) {
      try {
        await milvusUpsert({
          id: mem.id,
          userId: this.tenantId,
          embedding: mem.embedding!,
          memoryType: mem.type,
          isActive: mem.isActive ?? true,
        });
        logger.debug(`[MemoryRepository] embedding 已同步到 Milvus, id=${id}`);
      } catch (error) {
        logger.warn(`[MemoryRepository] Milvus embedding 同步失败, id=${id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return mem;
  }

  /**
   * 停用记忆（设置 isActive = false）
   *
   * 同步更新 Milvus 中的 is_active 标记，使向量搜索自动排除该记忆
   */
  async deactivate(id: string): Promise<void> {
    logger.debug(`[MemoryRepository] 停用记忆, id=${id}, userId=${this.tenantId}`);

    // 先查出记忆数据（需要 embedding 用于 Milvus upsert）
    const [mem] = await this.db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.id, id), eq(userMemories.userId, this.tenantId)));

    if (!mem) {
      logger.debug(`[MemoryRepository] 停用目标不存在, id=${id}`);
      return;
    }

    // 更新 PostgreSQL
    await this.db
      .update(userMemories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(userMemories.id, id), eq(userMemories.userId, this.tenantId)));

    // 同步到 Milvus（更新 is_active = false）
    if (mem.embedding && isMilvusConnected()) {
      try {
        await milvusUpsert({
          id: mem.id,
          userId: this.tenantId,
          embedding: mem.embedding,
          memoryType: mem.type,
          isActive: false,
        });
        logger.debug(`[MemoryRepository] Milvus is_active 已更新为 false, id=${id}`);
      } catch (error) {
        logger.warn(`[MemoryRepository] Milvus 停用同步失败, id=${id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 向量相似度搜索
   *
   * 优先使用 Milvus 向量搜索（HNSW + COSINE），
   * Milvus 不可用时降级为 pgvector 的 <=> 操作符。
   *
   * @param embedding - 查询向量（1024 维）
   * @param options - 搜索选项
   * @returns 按相似度降序排列的记忆列表（附带 score 字段）
   */
  async searchByVector(
    embedding: number[],
    options?: {
      type?: "episodic" | "profile" | "preference" | "fact" | "knowledge";
      category?: string;
      limit?: number;
      minScore?: number;
    },
  ): Promise<Array<UserMemory & { score: number }>> {
    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0;

    logger.debug(
      `[MemoryRepository] 向量搜索, userId=${this.tenantId}, limit=${limit}, minScore=${minScore}`,
    );

    // 优先使用 Milvus
    if (isMilvusConnected()) {
      try {
        return await this.searchViaMilvus(embedding, { ...options, limit, minScore });
      } catch (error) {
        logger.warn(`[MemoryRepository] Milvus 搜索失败，降级到 pgvector`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 降级：pgvector SQL 查询
    return this.searchViaPgvector(embedding, { ...options, limit, minScore });
  }

  /**
   * 通过 Milvus 执行向量搜索，然后用 id 批量回查 PostgreSQL 获取完整元数据
   */
  private async searchViaMilvus(
    embedding: number[],
    options: {
      type?: string;
      category?: string;
      limit: number;
      minScore: number;
    },
  ): Promise<Array<UserMemory & { score: number }>> {
    // Step 1: Milvus 向量搜索（返回 id + score）
    const milvusResults = await milvusSearch(embedding, this.tenantId, {
      limit: options.limit,
      minScore: options.minScore,
      memoryType: options.type,
      activeOnly: true,
    });

    if (milvusResults.length === 0) {
      logger.debug(`[MemoryRepository] Milvus 搜索无结果, userId=${this.tenantId}`);
      return [];
    }

    // Step 2: 用 id 批量回查 PostgreSQL 获取完整元数据
    const ids = milvusResults.map((r) => r.id);
    const conditions = [inArray(userMemories.id, ids), eq(userMemories.userId, this.tenantId)];

    // category 在 PostgreSQL 侧过滤（Milvus 不存储 category）
    if (options.category) {
      conditions.push(eq(userMemories.category, options.category));
    }

    const pgRows = await this.db
      .select()
      .from(userMemories)
      .where(and(...conditions));

    // Step 3: 按 Milvus 返回的相似度排序关联元数据
    const pgMap = new Map(pgRows.map((r) => [r.id, r]));
    const results: Array<UserMemory & { score: number }> = [];

    for (const hit of milvusResults) {
      const memory = pgMap.get(hit.id);
      if (memory) {
        results.push({ ...memory, score: hit.score });
      }
    }

    logger.debug(`[MemoryRepository] Milvus 搜索完成`, {
      userId: this.tenantId,
      milvusHits: milvusResults.length,
      pgMatches: results.length,
    });

    return results;
  }

  /**
   * pgvector 降级搜索（Milvus 不可用时使用）
   */
  private async searchViaPgvector(
    embedding: number[],
    options: {
      type?: string;
      category?: string;
      limit: number;
      minScore: number;
    },
  ): Promise<Array<UserMemory & { score: number }>> {
    logger.debug(`[MemoryRepository] 使用 pgvector 降级搜索, userId=${this.tenantId}`);

    const vectorStr = `[${embedding.join(",")}]`;

    // 构建条件
    const conditions = [
      eq(userMemories.userId, this.tenantId),
      eq(userMemories.isActive, true),
      sql`${userMemories.embedding} IS NOT NULL`,
    ];

    if (options.type) {
      conditions.push(eq(userMemories.type, options.type as UserMemory["type"]));
    }

    if (options.category) {
      conditions.push(eq(userMemories.category, options.category));
    }

    // 使用 pgvector 余弦距离，score = 1 - distance
    const results = await this.db
      .select({
        id: userMemories.id,
        userId: userMemories.userId,
        type: userMemories.type,
        category: userMemories.category,
        content: userMemories.content,
        summary: userMemories.summary,
        embedding: userMemories.embedding,
        importance: userMemories.importance,
        sourceType: userMemories.sourceType,
        sourceId: userMemories.sourceId,
        metadata: userMemories.metadata,
        expiresAt: userMemories.expiresAt,
        isActive: userMemories.isActive,
        createdAt: userMemories.createdAt,
        updatedAt: userMemories.updatedAt,
        score: sql<number>`1 - (${userMemories.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(userMemories)
      .where(and(...conditions))
      .orderBy(sql`${userMemories.embedding} <=> ${vectorStr}::vector`)
      .limit(options.limit);

    // 过滤低于 minScore 的结果
    return results.filter((r) => r.score >= options.minScore) as Array<
      UserMemory & { score: number }
    >;
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
