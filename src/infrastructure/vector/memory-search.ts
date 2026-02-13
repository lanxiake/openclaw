/**
 * 语义搜索服务模块
 *
 * 基于 pgvector 提供向量相似度搜索功能
 * 用于记忆检索、知识搜索等场景
 */

import { sql } from "drizzle-orm";

import { getDatabase, getSqlClient } from "../../db/connection.js";
import { userMemories, type UserMemory } from "../../db/schema/memories.js";
import { getLogger } from "../../logging/logger.js";

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
 * @returns 1536 维向量
 */
export async function embedText(text: string): Promise<number[]> {
  // TODO: 集成实际的嵌入 API（如 OpenAI text-embedding-3-small）
  // 当前返回占位向量用于测试
  logger.warn("[memory-search] Using placeholder embedding, integrate real API for production");

  // 生成基于文本哈希的伪随机向量（仅用于测试）
  const hash = simpleHash(text);
  const vector: number[] = [];
  for (let i = 0; i < 1536; i++) {
    // 使用哈希值生成伪随机数
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
 * 语义搜索记忆
 *
 * 使用余弦相似度搜索最相关的记忆
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

  const sqlClient = getSqlClient();

  try {
    // 构建向量字符串
    const vectorStr = `[${queryVector.join(",")}]`;

    // 构建 WHERE 条件
    const conditions: string[] = [`user_id = '${userId}'`];

    if (activeOnly) {
      conditions.push("is_active = true");
    }

    if (type) {
      conditions.push(`type = '${type}'`);
    }

    if (category) {
      conditions.push(`category = '${category}'`);
    }

    // 添加过期检查
    conditions.push("(expires_at IS NULL OR expires_at > NOW())");

    // 添加嵌入非空检查
    conditions.push("embedding IS NOT NULL");

    const whereClause = conditions.join(" AND ");

    // 执行向量搜索查询
    // 使用余弦距离 (<=>)，结果范围 0-2，0 表示完全相同
    const results = await sqlClient`
      SELECT
        *,
        1 - (embedding <=> ${vectorStr}::vector) as similarity,
        embedding <=> ${vectorStr}::vector as distance
      FROM user_memories
      WHERE ${sql.raw(whereClause)}
        AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    logger.debug("[memory-search] Search completed", {
      userId,
      resultCount: results.length,
    });

    return results.map((row) => ({
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
  } catch (error) {
    logger.error("[memory-search] Search failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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

  // 生成查询向量
  const queryVector = await embedText(query);

  // 执行向量搜索
  return searchMemories(queryVector, options);
}

/**
 * 存储记忆并生成嵌入
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

  // 插入记忆
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

  logger.info("[memory-search] Memory stored with embedding", {
    memoryId: result.id,
    userId: memory.userId,
  });

  return result;
}

/**
 * 更新记忆的嵌入向量
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

  // 更新嵌入
  await sqlClient`
    UPDATE user_memories
    SET embedding = ${vectorStr}::vector, updated_at = NOW()
    WHERE id = ${memoryId}
  `;

  logger.info("[memory-search] Memory embedding updated", { memoryId });
}

/**
 * 批量更新记忆嵌入
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

  let processed = 0;
  let failed = 0;
  let offset = 0;

  while (true) {
    // 获取一批记忆
    const memories = await sqlClient`
      SELECT id, content
      FROM user_memories
      WHERE user_id = ${userId}
      ORDER BY created_at
      LIMIT ${batchSize}
      OFFSET ${offset}
    `;

    if (memories.length === 0) {
      break;
    }

    // 逐个更新嵌入
    for (const memory of memories) {
      try {
        await updateMemoryEmbedding(memory.id, memory.content);
        processed++;
      } catch (error) {
        logger.error("[memory-search] Failed to update embedding", {
          memoryId: memory.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
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
