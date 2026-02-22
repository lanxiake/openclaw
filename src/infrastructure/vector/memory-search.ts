/**
 * 语义搜索服务模块
 *
 * 基于 Milvus 向量数据库提供相似度搜索功能。
 * 向量数据存 Milvus，元数据存 PostgreSQL，通过 id 关联。
 *
 * 架构:
 *   searchMemories() → Milvus search → id 列表 → PostgreSQL 批量查询元数据
 *   storeMemoryWithEmbedding() → PostgreSQL insert + Milvus upsert
 */

import { eq, and, inArray } from "drizzle-orm";

import { getDatabase, getSqlClient } from "../../db/connection.js";
import { userMemories, type UserMemory } from "../../db/schema/memories.js";
import { getLogger } from "../../logging/logger.js";
import {
  search as milvusSearch,
  upsertVector,
  batchUpsert,
  ensureCollection,
} from "../milvus/vector-store.js";
import { isMilvusConnected } from "../milvus/connection.js";

const logger = getLogger();

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 记忆记录 */
  memory: UserMemory;
  /** 相似度分数 (0-1，越高越相似) */
  similarity: number;
  /** 距离 (越小越相似) */
  distance: number;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 用户 ID */
  userId: string;
  /** 返回结果数量 (默认 10) */
  limit?: number;
  /** 最小相似度阈值 (默认 0.5) */
  minSimilarity?: number;
  /** 记忆类型过滤 */
  type?: "episodic" | "profile" | "preference" | "fact";
  /** 分类过滤 */
  category?: string;
  /** 是否只返回有效记忆 (默认 true) */
  activeOnly?: boolean;
}

/**
 * 向量化文本（占位实现）
 *
 * 实际使用时需要调用 OpenAI/Anthropic 等 API 生成嵌入向量
 *
 * @param text 文本内容
 * @returns 1024 维向量
 */
export async function embedText(text: string): Promise<number[]> {
  // TODO: 集成实际的嵌入 API（如 OpenAI text-embedding-3-small）
  // 当前返回占位向量用于测试
  logger.warn("[memory-search] Using placeholder embedding, integrate real API for production");

  // 生成基于文本哈希的伪随机向量（仅用于测试）
  const hash = simpleHash(text);
  const vector: number[] = [];
  for (let i = 0; i < 1024; i++) {
    const seed = hash + i;
    vector.push(Math.sin(seed) * 0.5 + 0.5);
  }

  // 归一化向量
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / magnitude);
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 语义搜索记忆 (Milvus + PostgreSQL)
 *
 * 1. 在 Milvus 中执行向量相似度搜索，获取 id + score
 * 2. 用 id 批量回查 PostgreSQL 获取完整元数据
 * 3. 按 Milvus 返回的相似度排序
 *
 * 当 Milvus 不可用时，降级为 pgvector SQL 查询。
 *
 * @param queryVector 查询向量
 * @param options 搜索选项
 * @returns 搜索结果列表
 */
export async function searchMemories(
  queryVector: number[],
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { userId, limit = 10, minSimilarity = 0.5, type, category, activeOnly = true } = options;

  logger.debug("[memory-search] Searching memories", {
    userId,
    limit,
    minSimilarity,
    type,
    category,
  });

  // 优先使用 Milvus
  if (isMilvusConnected()) {
    try {
      return await searchViaMilvus(queryVector, {
        userId,
        limit,
        minSimilarity,
        type,
        category,
        activeOnly,
      });
    } catch (error) {
      logger.warn("[memory-search] Milvus search failed, falling back to pgvector", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 降级：pgvector SQL 查询
  return await searchViaPgvector(queryVector, {
    userId,
    limit,
    minSimilarity,
    type,
    category,
    activeOnly,
  });
}

/**
 * 通过 Milvus 执行向量搜索 + PostgreSQL 元数据回查
 */
async function searchViaMilvus(
  queryVector: number[],
  options: {
    userId: string;
    limit: number;
    minSimilarity: number;
    type?: string;
    category?: string;
    activeOnly: boolean;
  },
): Promise<SearchResult[]> {
  const { userId, limit, minSimilarity, type, activeOnly } = options;

  // Step 1: Milvus 向量搜索
  const milvusResults = await milvusSearch(queryVector, userId, {
    limit,
    minScore: minSimilarity,
    memoryType: type,
    activeOnly,
  });

  if (milvusResults.length === 0) {
    return [];
  }

  // Step 2: 用 id 批量回查 PostgreSQL 元数据
  const ids = milvusResults.map((r) => r.id);
  const db = getDatabase();

  const conditions = [inArray(userMemories.id, ids), eq(userMemories.userId, userId)];

  // 分类过滤在 PostgreSQL 侧执行（Milvus 不存储 category）
  if (options.category) {
    conditions.push(eq(userMemories.category, options.category));
  }

  const pgRows = await db
    .select()
    .from(userMemories)
    .where(and(...conditions));

  // Step 3: 按 Milvus 的相似度排序关联元数据
  const pgMap = new Map(pgRows.map((r) => [r.id, r]));
  const results: SearchResult[] = [];

  for (const hit of milvusResults) {
    const memory = pgMap.get(hit.id);
    if (memory) {
      results.push({
        memory,
        similarity: hit.score,
        distance: hit.distance,
      });
    }
  }

  logger.debug("[memory-search] Milvus search completed", {
    userId,
    milvusHits: milvusResults.length,
    pgMatches: results.length,
  });

  return results;
}

/**
 * pgvector 降级搜索（Milvus 不可用时使用）
 */
async function searchViaPgvector(
  queryVector: number[],
  options: {
    userId: string;
    limit: number;
    minSimilarity: number;
    type?: string;
    category?: string;
    activeOnly: boolean;
  },
): Promise<SearchResult[]> {
  const { userId, limit, minSimilarity, type, category, activeOnly } = options;

  logger.debug("[memory-search] Using pgvector fallback", { userId });

  const sqlClient = getSqlClient();

  const vectorStr = `[${queryVector.join(",")}]`;

  const conditions: string[] = [`user_id = '${userId}'`];
  if (activeOnly) conditions.push("is_active = true");
  if (type) conditions.push(`type = '${type}'`);
  if (category) conditions.push(`category = '${category}'`);
  conditions.push("(expires_at IS NULL OR expires_at > NOW())");
  conditions.push("embedding IS NOT NULL");

  const whereClause = conditions.join(" AND ");

  const query = `
    SELECT
      *,
      1 - (embedding <=> '${vectorStr}'::vector) as similarity,
      embedding <=> '${vectorStr}'::vector as distance
    FROM user_memories
    WHERE ${whereClause}
      AND 1 - (embedding <=> '${vectorStr}'::vector) >= ${minSimilarity}
    ORDER BY embedding <=> '${vectorStr}'::vector
    LIMIT ${limit}
  `;

  const rows = await sqlClient.unsafe(query);

  logger.debug("[memory-search] pgvector fallback completed", {
    userId,
    resultCount: rows.length,
  });

  return rows.map((row) => ({
    memory: {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      category: row.category,
      content: row.content,
      summary: row.summary,
      embedding: row.embedding,
      importance: row.importance,
      sourceType: row.source_type,
      sourceId: row.source_id,
      metadata: row.metadata,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as UserMemory,
    similarity: parseFloat(row.similarity),
    distance: parseFloat(row.distance),
  }));
}

/**
 * 文本语义搜索
 *
 * 先将文本转换为向量，再执行搜索
 *
 * @param query 查询文本
 * @param options 搜索选项
 * @returns 搜索结果列表
 */
export async function searchMemoriesByText(
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  logger.debug("[memory-search] Text search", { query, userId: options.userId });
  const queryVector = await embedText(query);
  return searchMemories(queryVector, options);
}

/**
 * 存储记忆并生成嵌入 (PostgreSQL + Milvus 双写)
 *
 * 1. 生成嵌入向量
 * 2. 写入 PostgreSQL (含 embedding 字段)
 * 3. 同步写入 Milvus (向量索引)
 *
 * @param memory 记忆数据（不含 embedding）
 * @returns 包含 embedding 的完整记忆
 */
export async function storeMemoryWithEmbedding(
  memory: Omit<UserMemory, "id" | "embedding" | "createdAt" | "updatedAt"> & { id: string },
): Promise<UserMemory> {
  const db = getDatabase();

  logger.debug("[memory-search] Storing memory with embedding", {
    userId: memory.userId,
    type: memory.type,
  });

  // 生成嵌入向量
  const embedding = await embedText(memory.content);

  // 写入 PostgreSQL
  const [result] = await db
    .insert(userMemories)
    .values({
      ...memory,
      embedding,
    })
    .returning();

  if (!result) {
    throw new Error("Failed to insert memory");
  }

  // 同步写入 Milvus（异步容错，失败不阻塞主流程）
  try {
    if (isMilvusConnected()) {
      await upsertVector({
        id: result.id,
        userId: result.userId,
        embedding,
        memoryType: result.type,
        isActive: result.isActive ?? true,
      });
      logger.debug("[memory-search] Memory synced to Milvus", { memoryId: result.id });
    }
  } catch (error) {
    logger.warn("[memory-search] Failed to sync memory to Milvus", {
      memoryId: result.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info("[memory-search] Memory stored with embedding", {
    memoryId: result.id,
    userId: memory.userId,
  });

  return result;
}

/**
 * 更新记忆的嵌入向量 (PostgreSQL + Milvus 双写)
 *
 * @param memoryId 记忆 ID
 * @param content 新的内容（用于生成新嵌入）
 */
export async function updateMemoryEmbedding(memoryId: string, content: string): Promise<void> {
  const sqlClient = getSqlClient();

  logger.debug("[memory-search] Updating memory embedding", { memoryId });

  // 生成新的嵌入向量
  const embedding = await embedText(content);
  const vectorStr = `[${embedding.join(",")}]`;

  // 更新 PostgreSQL
  await sqlClient`
    UPDATE user_memories
    SET embedding = ${vectorStr}::vector, updated_at = NOW()
    WHERE id = ${memoryId}
  `;

  // 同步更新 Milvus
  try {
    if (isMilvusConnected()) {
      // 回查 userId 和 type 用于 Milvus upsert
      const [row] = await sqlClient`
        SELECT user_id, type, is_active FROM user_memories WHERE id = ${memoryId}
      `;
      if (row) {
        await upsertVector({
          id: memoryId,
          userId: row.user_id as string,
          embedding,
          memoryType: row.type as string,
          isActive: (row.is_active as boolean) ?? true,
        });
        logger.debug("[memory-search] Embedding synced to Milvus", { memoryId });
      }
    }
  } catch (error) {
    logger.warn("[memory-search] Failed to sync embedding to Milvus", {
      memoryId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info("[memory-search] Memory embedding updated", { memoryId });
}

/**
 * 批量重建用户记忆嵌入 (PostgreSQL + Milvus 同步)
 *
 * @param userId 用户 ID
 * @param batchSize 批次大小 (默认 100)
 */
export async function rebuildUserMemoryEmbeddings(
  userId: string,
  batchSize: number = 100,
): Promise<{ processed: number; failed: number }> {
  const sqlClient = getSqlClient();

  logger.info("[memory-search] Rebuilding user memory embeddings", { userId, batchSize });

  // 确保 Milvus Collection 存在
  if (isMilvusConnected()) {
    try {
      await ensureCollection();
    } catch (error) {
      logger.warn("[memory-search] Failed to ensure Milvus collection", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let processed = 0;
  let failed = 0;
  let offset = 0;
  const milvusBatch: Array<{
    id: string;
    userId: string;
    embedding: number[];
    memoryType: string;
    isActive: boolean;
  }> = [];

  while (true) {
    const memories = await sqlClient`
      SELECT id, content, type, is_active
      FROM user_memories
      WHERE user_id = ${userId}
      ORDER BY created_at
      LIMIT ${batchSize}
      OFFSET ${offset}
    `;

    if (memories.length === 0) break;

    for (const memory of memories) {
      try {
        const embedding = await embedText(memory.content as string);
        const vectorStr = `[${embedding.join(",")}]`;

        // 更新 PostgreSQL
        await sqlClient`
          UPDATE user_memories
          SET embedding = ${vectorStr}::vector, updated_at = NOW()
          WHERE id = ${memory.id}
        `;

        // 收集 Milvus 批量数据
        milvusBatch.push({
          id: memory.id as string,
          userId,
          embedding,
          memoryType: memory.type as string,
          isActive: (memory.is_active as boolean) ?? true,
        });

        processed++;
      } catch (error) {
        logger.error("[memory-search] Failed to update embedding", {
          memoryId: memory.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    // 每个批次结束后同步 Milvus
    if (milvusBatch.length > 0 && isMilvusConnected()) {
      try {
        await batchUpsert(milvusBatch);
        logger.debug("[memory-search] Batch synced to Milvus", { count: milvusBatch.length });
      } catch (error) {
        logger.warn("[memory-search] Failed to batch sync to Milvus", {
          count: milvusBatch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      milvusBatch.length = 0;
    }

    offset += batchSize;
    logger.debug("[memory-search] Batch processed", { processed, failed, offset });
  }

  logger.info("[memory-search] Rebuild completed", { userId, processed, failed });
  return { processed, failed };
}

/**
 * 获取相似记忆（去重）
 *
 * 用于检测重复记忆
 *
 * @param content 内容
 * @param userId 用户 ID
 * @param threshold 相似度阈值 (默认 0.95)
 * @returns 相似记忆列表
 */
export async function findSimilarMemories(
  content: string,
  userId: string,
  threshold: number = 0.95,
): Promise<SearchResult[]> {
  return searchMemoriesByText(content, {
    userId,
    limit: 5,
    minSimilarity: threshold,
  });
}
