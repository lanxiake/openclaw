/**
 * Milvus 向量存储服务
 *
 * 管理 mtbot_memories collection，提供向量 CRUD 和相似度搜索。
 * 向量数据存 Milvus，元数据存 PostgreSQL，通过 id 关联。
 *
 * Collection schema: mtbot_memories
 *   - id: VARCHAR(64) 主键
 *   - user_id: VARCHAR(64) 多租户分区键
 *   - embedding: FLOAT_VECTOR(1024) 向量字段
 *   - memory_type: VARCHAR(32) 记忆类型
 *   - is_active: BOOL 活跃状态
 */

import { DataType, MetricType, IndexType, type MilvusClient } from "@zilliz/milvus2-sdk-node";

import { getMilvus } from "./connection.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/** Collection 名称 */
const COLLECTION_NAME = "mtbot_memories";

/** 向量维度 (匹配 Qwen3-Embedding-0.6B 模型输出) */
const VECTOR_DIM = 1024;

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  /** 记忆 ID (对应 PostgreSQL user_memories.id) */
  id: string;
  /** 相似度分数 (0-1，越高越相似) */
  score: number;
  /** 余弦距离 */
  distance: number;
}

/**
 * 向量 upsert 数据
 */
export interface VectorUpsertData {
  /** 记忆 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 嵌入向量 (1024 维) */
  embedding: number[];
  /** 记忆类型 */
  memoryType: string;
  /** 是否活跃 */
  isActive: boolean;
}

/**
 * 搜索选项
 */
export interface MilvusSearchOptions {
  /** 返回结果数量 (默认 10) */
  limit?: number;
  /** 最小相似度分数 (默认 0) */
  minScore?: number;
  /** 记忆类型过滤 */
  memoryType?: string;
  /** 是否只搜索活跃记忆 (默认 true) */
  activeOnly?: boolean;
}

/**
 * 确保 Collection 存在
 *
 * 幂等操作：如果 Collection 已存在则跳过创建。
 * 自动创建 HNSW 索引和加载 Collection 到内存。
 *
 * @param client - 可选的 MilvusClient 实例 (默认使用单例)
 */
export async function ensureCollection(client?: MilvusClient): Promise<void> {
  const milvus = client ?? getMilvus();

  logger.debug("[milvus-store] Checking collection existence", {
    collection: COLLECTION_NAME,
  });

  const hasCollection = await milvus.hasCollection({
    collection_name: COLLECTION_NAME,
  });

  if (hasCollection.value) {
    logger.debug("[milvus-store] Collection already exists", {
      collection: COLLECTION_NAME,
    });
    return;
  }

  logger.info("[milvus-store] Creating collection", {
    collection: COLLECTION_NAME,
    vectorDim: VECTOR_DIM,
  });

  await milvus.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "id",
        data_type: DataType.VarChar,
        is_primary_key: true,
        max_length: 64,
      },
      {
        name: "user_id",
        data_type: DataType.VarChar,
        max_length: 64,
        is_partition_key: true,
      },
      {
        name: "embedding",
        data_type: DataType.FloatVector,
        dim: VECTOR_DIM,
      },
      {
        name: "memory_type",
        data_type: DataType.VarChar,
        max_length: 32,
      },
      {
        name: "is_active",
        data_type: DataType.Bool,
      },
    ],
  });

  logger.info("[milvus-store] Creating HNSW index on embedding field");

  await milvus.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: "embedding",
    index_type: IndexType.HNSW,
    metric_type: MetricType.COSINE,
    params: { M: 16, efConstruction: 256 },
  });

  logger.info("[milvus-store] Loading collection into memory");

  await milvus.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  logger.info("[milvus-store] Collection created and loaded successfully");
}

/**
 * 插入或更新向量
 *
 * @param data - 向量数据
 * @param client - 可选的 MilvusClient
 */
export async function upsertVector(data: VectorUpsertData, client?: MilvusClient): Promise<void> {
  const milvus = client ?? getMilvus();

  logger.debug("[milvus-store] Upserting vector", {
    id: data.id,
    userId: data.userId,
    memoryType: data.memoryType,
  });

  await milvus.upsert({
    collection_name: COLLECTION_NAME,
    data: [
      {
        id: data.id,
        user_id: data.userId,
        embedding: data.embedding,
        memory_type: data.memoryType,
        is_active: data.isActive,
      },
    ],
  });

  logger.debug("[milvus-store] Vector upserted successfully", {
    id: data.id,
  });
}

/**
 * 批量插入或更新向量
 *
 * @param vectors - 向量数据数组
 * @param client - 可选的 MilvusClient
 */
export async function batchUpsert(
  vectors: VectorUpsertData[],
  client?: MilvusClient,
): Promise<void> {
  if (vectors.length === 0) return;

  const milvus = client ?? getMilvus();

  logger.debug("[milvus-store] Batch upserting vectors", {
    count: vectors.length,
  });

  const data = vectors.map((v) => ({
    id: v.id,
    user_id: v.userId,
    embedding: v.embedding,
    memory_type: v.memoryType,
    is_active: v.isActive,
  }));

  await milvus.upsert({
    collection_name: COLLECTION_NAME,
    data,
  });

  logger.debug("[milvus-store] Batch upsert completed", {
    count: vectors.length,
  });
}

/**
 * 删除向量
 *
 * @param id - 记忆 ID
 * @param client - 可选的 MilvusClient
 */
export async function deleteVector(id: string, client?: MilvusClient): Promise<void> {
  const milvus = client ?? getMilvus();

  logger.debug("[milvus-store] Deleting vector", { id });

  await milvus.delete({
    collection_name: COLLECTION_NAME,
    filter: `id == "${id}"`,
  });

  logger.debug("[milvus-store] Vector deleted", { id });
}

/**
 * 批量删除向量
 *
 * @param ids - 记忆 ID 数组
 * @param client - 可选的 MilvusClient
 */
export async function batchDelete(ids: string[], client?: MilvusClient): Promise<void> {
  if (ids.length === 0) return;

  const milvus = client ?? getMilvus();

  logger.debug("[milvus-store] Batch deleting vectors", {
    count: ids.length,
  });

  const idsStr = ids.map((id) => `"${id}"`).join(", ");
  await milvus.delete({
    collection_name: COLLECTION_NAME,
    filter: `id in [${idsStr}]`,
  });

  logger.debug("[milvus-store] Batch delete completed", {
    count: ids.length,
  });
}

/**
 * 向量相似度搜索
 *
 * 在指定用户的记忆中搜索与查询向量最相似的记录。
 * Milvus COSINE 度量返回的 score 范围为 [0, 1]，1 表示完全相同。
 *
 * @param queryVector - 查询向量 (1024 维)
 * @param userId - 用户 ID (多租户过滤)
 * @param options - 搜索选项
 * @param client - 可选的 MilvusClient
 * @returns 搜索结果数组 (按相似度降序)
 */
export async function search(
  queryVector: number[],
  userId: string,
  options?: MilvusSearchOptions,
  client?: MilvusClient,
): Promise<VectorSearchResult[]> {
  const milvus = client ?? getMilvus();
  const limit = options?.limit ?? 10;
  const minScore = options?.minScore ?? 0;
  const activeOnly = options?.activeOnly ?? true;

  logger.debug("[milvus-store] Searching vectors", {
    userId,
    limit,
    minScore,
    memoryType: options?.memoryType,
    activeOnly,
  });

  // 构建过滤表达式
  const filters: string[] = [`user_id == "${userId}"`];

  if (activeOnly) {
    filters.push("is_active == true");
  }

  if (options?.memoryType) {
    filters.push(`memory_type == "${options.memoryType}"`);
  }

  const filterExpr = filters.join(" && ");

  const response = await milvus.search({
    collection_name: COLLECTION_NAME,
    data: [queryVector],
    limit,
    filter: filterExpr,
    output_fields: ["id"],
    params: { ef: 128 },
  });

  const results: VectorSearchResult[] = [];

  if (response.results && response.results.length > 0) {
    for (const hit of response.results) {
      // Milvus COSINE 度量：score = 1 - distance/2，范围 [0, 1]
      const score = hit.score ?? 0;
      const distance = 2 * (1 - score);

      if (score >= minScore) {
        results.push({
          id: hit.id as string,
          score,
          distance,
        });
      }
    }
  }

  logger.debug("[milvus-store] Search completed", {
    userId,
    resultCount: results.length,
  });

  return results;
}

/**
 * 获取 Collection 统计信息
 *
 * @param client - 可选的 MilvusClient
 * @returns 行数
 */
export async function getCollectionStats(client?: MilvusClient): Promise<{ rowCount: number }> {
  const milvus = client ?? getMilvus();

  const stats = await milvus.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });

  const rowCount = parseInt(stats.data?.row_count ?? stats.stats?.[0]?.value ?? "0", 10);

  return { rowCount };
}

/**
 * 删除 Collection (谨慎使用)
 *
 * @param client - 可选的 MilvusClient
 */
export async function dropCollection(client?: MilvusClient): Promise<void> {
  const milvus = client ?? getMilvus();

  logger.warn("[milvus-store] Dropping collection", {
    collection: COLLECTION_NAME,
  });

  await milvus.dropCollection({
    collection_name: COLLECTION_NAME,
  });

  logger.info("[milvus-store] Collection dropped");
}

/** 导出 collection 名称和向量维度常量 */
export { COLLECTION_NAME, VECTOR_DIM };
