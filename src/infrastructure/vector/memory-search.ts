/**
 * 语义搜索服务模块
 *
 * 基于 Milvus 向量数据库提供相似度搜索功能。
 * 向量数据存 Milvus，元数据存 PostgreSQL，通过 id 关联。
 *
 * 架构:
 *   searchMemories() → Milvus search → id 列表 → PostgreSQL 批量查询元数据
 *   storeMemoryWithEmbedding() → PostgreSQL insert (元数据) + Milvus upsert (向量)
 */

import { eq, and, inArray } from "drizzle-orm";

import { getDatabase, getSqlClient } from "../../db/connection.js";
import { userMemories, type UserMemory } from "../../db/schema/memories.js";
import { getLogger } from "../../logging/logger.js";
import {
  search as milvusSearch,
  upsertVector,
  batchUpsert,
  deleteVector,
  ensureCollection,
} from "../milvus/vector-store.js";

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
 * @param queryVector 查询向量
 * @param options 搜索选项
 * @returns 搜索结果列表
 */
export async function searchMemories(
  queryVector: number[],
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { userId, limit = 10, minSimilarity = 0.5, type, category, activeOnly = true } = options;

  logger.debug("[memory-search] Searching memories via Milvus", {
    userId,
    limit,
    minSimilarity,
    type,
    category,
  });

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
  if (category) {
    conditions.push(eq(userMemories.category, category));
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
 * 存储记忆并生成嵌入 (PostgreSQL 元数据 + Milvus 向量)
 *
 * 1. 生成嵌入向量
 * 2. 写入 PostgreSQL (元数据，不含 embedding)
 * 3. 写入 Milvus (向量索引)
 *
 * @param memory 记忆数据（不含 embedding）
 * @returns 完整记忆记录
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

  // 写入 PostgreSQL（元数据）
  const [result] = await db.insert(userMemories).values(memory).returning();

  if (!result) {
    throw new Error("Failed to insert memory");
  }

  // 写入 Milvus 向量索引
  await upsertVector({
    id: result.id,
    userId: result.userId,
    embedding,
    memoryType: result.type,
    isActive: result.isActive ?? true,
  });

  logger.info("[memory-search] Memory stored", {
    memoryId: result.id,
    userId: memory.userId,
  });

  return result;
}

/**
 * 更新记忆的嵌入向量
 *
 * 生成新的嵌入向量并写入 Milvus
 *
 * @param memoryId 记忆 ID
 * @param content 新的内容（用于生成新嵌入）
 */
export async function updateMemoryEmbedding(memoryId: string, content: string): Promise<void> {
  const sqlClient = getSqlClient();

  logger.debug("[memory-search] Updating memory embedding", { memoryId });

  // 生成新的嵌入向量
  const embedding = await embedText(content);

  // 更新 PostgreSQL 的 updated_at（不写 embedding）
  await sqlClient`
    UPDATE user_memories
    SET updated_at = NOW()
    WHERE id = ${memoryId}
  `;

  // 回查 userId 和 type 用于 Milvus upsert
  const [row] = await sqlClient`
    SELECT user_id, type, is_active FROM user_memories WHERE id = ${memoryId}
  `;

  if (!row) {
    throw new Error(`Memory not found: ${memoryId}`);
  }

  // 写入 Milvus
  await upsertVector({
    id: memoryId,
    userId: row.user_id as string,
    embedding,
    memoryType: row.type as string,
    isActive: (row.is_active as boolean) ?? true,
  });

  logger.info("[memory-search] Memory embedding updated in Milvus", { memoryId });
}

/**
 * 批量重建用户记忆嵌入 (Milvus)
 *
 * 从 PostgreSQL 读取记忆内容，生成嵌入向量，批量写入 Milvus
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
  await ensureCollection();

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
        logger.error("[memory-search] Failed to generate embedding", {
          memoryId: memory.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    // 每个批次结束后写入 Milvus
    if (milvusBatch.length > 0) {
      await batchUpsert(milvusBatch);
      logger.debug("[memory-search] Batch written to Milvus", { count: milvusBatch.length });
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

/**
 * 删除记忆向量
 *
 * 从 Milvus 中删除指定记忆的向量
 *
 * @param memoryId 记忆 ID
 */
export async function removeMemoryVector(memoryId: string): Promise<void> {
  logger.debug("[memory-search] Removing memory vector from Milvus", { memoryId });
  await deleteVector(memoryId);
  logger.debug("[memory-search] Memory vector removed", { memoryId });
}
