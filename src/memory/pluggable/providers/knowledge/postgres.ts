/**
 * PostgreSQL 知识记忆提供者
 *
 * 使用 PostgreSQL 存储知识文档元数据，Milvus 存储向量嵌入，
 * 支持向量相似度搜索和混合搜索（向量 + 文本匹配）。
 *
 * 数据存储在 user_memories 表中：
 * - type=knowledge, category=document: 文档主记录
 * - type=knowledge, category=chunk: 文档分块（含 embedding）
 *
 * @module memory/pluggable/providers/knowledge
 */

import { randomUUID } from "node:crypto";

import { createSubsystemLogger } from "../../../../logging/subsystem.js";
import type { OpenClawConfig } from "../../../../config/config.js";
import type { Database } from "../../../../db/connection.js";
import type { UserMemory } from "../../../../db/schema/memories.js";
import {
  getMemoryRepository,
  type MemoryRepository,
} from "../../../../db/repositories/memories.js";
import type { EmbeddingProvider } from "../../../embeddings.js";
import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type {
  DocumentInput,
  DocumentListOptions,
  DocumentStatus,
  HybridSearchOptions,
  IKnowledgeMemoryProvider,
  KnowledgeDocument,
  SearchResult,
  VectorSearchOptions,
} from "../../interfaces/knowledge-memory.js";
import { registerProvider } from "../factory.js";

const logger = createSubsystemLogger("memory/knowledge/postgres");

// ==================== Provider 配置 ====================

/**
 * PostgreSQL Knowledge Provider 配置
 */
interface PostgresKnowledgeConfig extends ProviderConfig {
  /** 已有的 DB 实例（优先于自动获取） */
  db?: Database;
  /** OpenClaw 配置（用于 embedding provider 初始化） */
  cfg?: OpenClawConfig;
  /** 已有的 embedding provider（测试用） */
  embeddingProvider?: EmbeddingProvider;
  /** 外部 embedding 配置（从数据库 system_configs 读取） */
  embeddingConfig?: {
    /** embedding 服务提供者类型（如 "openai"） */
    provider: string;
    /** 模型名称（如 "Qwen3-Embedding-0.6B"） */
    model: string;
    /** 向量维度 */
    dimensions: number;
    /** API 基础 URL（OpenAI 兼容格式） */
    baseUrl: string;
    /** API Key */
    apiKey?: string;
  };
}

// ==================== 辅助函数 ====================

/**
 * 简单文本匹配分数
 *
 * 按词匹配计算相关度（0-1），用于混合搜索的文本部分
 */
function textMatchScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return 0;

  let matchCount = 0;
  for (const word of words) {
    if (lowerText.includes(word)) {
      matchCount++;
    }
  }

  return matchCount / words.length;
}

/**
 * 将 DB UserMemory (category=document) 转换为 KnowledgeDocument
 */
function toKnowledgeDocument(record: UserMemory): KnowledgeDocument {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;

  return {
    id: record.id,
    title: (meta.title as string) ?? "",
    source: (meta.source as KnowledgeDocument["source"]) ?? "upload",
    objectKey: (meta.objectKey as string) ?? "",
    mimeType: (meta.mimeType as string) ?? "text/plain",
    size: (meta.size as number) ?? 0,
    status: (meta.status as DocumentStatus) ?? "pending",
    chunkCount: (meta.chunkCount as number) ?? 0,
    embeddingModel: (meta.embeddingModel as string) ?? "none",
    errorMessage: meta.errorMessage as string | undefined,
    metadata: (meta.extra as Record<string, unknown>) ?? {},
    createdAt: record.createdAt,
    processedAt: meta.processedAt ? new Date(meta.processedAt as string) : undefined,
  };
}

// ==================== Provider 实现 ====================

/**
 * PostgreSQL 知识记忆提供者
 *
 * 使用 user_memories 表 + Milvus 向量搜索实现知识记忆。
 * 支持文档管理、向量索引和混合搜索。
 *
 * @example
 * ```typescript
 * const provider = new PostgresKnowledgeMemoryProvider({ db, cfg })
 * await provider.initialize()
 *
 * const docId = await provider.addDocument('user-123', {
 *   title: '产品手册',
 *   mimeType: 'text/plain',
 *   source: 'upload',
 * })
 *
 * const results = await provider.searchHybrid('user-123', '产品优势')
 * await provider.shutdown()
 * ```
 */
export class PostgresKnowledgeMemoryProvider implements IKnowledgeMemoryProvider {
  readonly name = "postgres-knowledge";
  readonly version = "1.0.0";

  private db: Database | null = null;
  private readonly config: PostgresKnowledgeConfig;
  private embeddingProvider: EmbeddingProvider | null = null;

  /**
   * 创建 PostgreSQL 知识记忆提供者
   */
  constructor(config?: PostgresKnowledgeConfig | Record<string, unknown>) {
    this.config = (config ?? {}) as PostgresKnowledgeConfig;
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化提供者
   *
   * 获取数据库连接，可选初始化 embedding provider。
   */
  async initialize(): Promise<void> {
    logger.info("[postgres-knowledge] 初始化 PostgreSQL 知识记忆提供者");

    if (this.config.db) {
      this.db = this.config.db;
    } else {
      const { getDatabase } = await import("../../../../db/connection.js");
      this.db = getDatabase();
    }

    // 使用注入的 embedding provider 或自动创建
    if (this.config.embeddingProvider) {
      this.embeddingProvider = this.config.embeddingProvider;
      logger.info("[postgres-knowledge] 使用注入的 embedding provider");
    } else if (this.config.cfg) {
      try {
        const { createEmbeddingProvider } = await import("../../../embeddings.js");

        // 优先使用外部 embeddingConfig（来自数据库 system_configs）
        const embeddingConfig = this.config.embeddingConfig;
        const model = embeddingConfig?.model ?? "text-embedding-3-small";
        const remote = embeddingConfig?.baseUrl
          ? { baseUrl: embeddingConfig.baseUrl, apiKey: embeddingConfig.apiKey }
          : undefined;

        const result = await createEmbeddingProvider({
          config: this.config.cfg,
          provider: "openai",
          model,
          fallback: "none",
          remote,
        });
        this.embeddingProvider = result.provider;
        logger.info("[postgres-knowledge] Embedding provider 已初始化", {
          provider: result.provider.id,
          model: result.provider.model,
          baseUrl: embeddingConfig?.baseUrl ?? "default",
          dimensions: embeddingConfig?.dimensions ?? "default",
        });
      } catch (error) {
        logger.warn("[postgres-knowledge] Embedding provider 初始化失败，向量搜索将不可用", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.debug("[postgres-knowledge] 未提供 cfg，向量搜索功能将不可用");
    }

    logger.info("[postgres-knowledge] 初始化完成");
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    logger.info("[postgres-knowledge] 关闭提供者");
    this.db = null;
    this.embeddingProvider = null;
    logger.info("[postgres-knowledge] 已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.db) {
      return {
        status: "unhealthy",
        latency: 0,
        details: { error: "数据库未初始化" },
      };
    }

    return {
      status: "healthy",
      latency: 0,
      details: {
        provider: "postgres-knowledge",
        hasEmbedding: Boolean(this.embeddingProvider),
      },
    };
  }

  // ==================== 私有辅助 ====================

  /**
   * 获取数据库实例
   */
  private getDatabase(): Database {
    if (!this.db) {
      throw new Error("[postgres-knowledge] 数据库未初始化");
    }
    return this.db;
  }

  /**
   * 获取 MemoryRepository
   */
  private getRepo(userId: string): MemoryRepository {
    return getMemoryRepository(this.getDatabase(), userId);
  }

  // ==================== 文档管理 ====================

  /**
   * 添加文档
   */
  async addDocument(userId: string, document: DocumentInput): Promise<string> {
    logger.info("[postgres-knowledge] 添加文档", { userId, title: document.title });

    const repo = this.getRepo(userId);
    const docId = randomUUID();

    // 提取文本内容
    let textContent = "";
    if (document.content) {
      if (Buffer.isBuffer(document.content)) {
        textContent = document.content.toString("utf-8");
      }
    }

    const record = await repo.create({
      type: "knowledge",
      category: "document",
      content: textContent,
      summary: document.title,
      sourceType: document.source,
      sourceId: docId,
      importance: 5,
      metadata: {
        title: document.title,
        source: document.source,
        objectKey: document.objectKey ?? "",
        mimeType: document.mimeType,
        size: textContent.length,
        status: "pending" as DocumentStatus,
        chunkCount: 0,
        embeddingModel: this.embeddingProvider?.model ?? "none",
        extra: document.metadata ?? {},
      },
    });

    logger.debug("[postgres-knowledge] 文档已添加", { docId: record.id });
    return record.id;
  }

  /**
   * 获取文档
   */
  async getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null> {
    logger.debug("[postgres-knowledge] 获取文档", { userId, documentId });

    const repo = this.getRepo(userId);
    const record = await repo.findById(documentId);

    if (!record || record.category !== "document") {
      return null;
    }

    return toKnowledgeDocument(record);
  }

  /**
   * 删除文档
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    logger.info("[postgres-knowledge] 删除文档", { userId, documentId });

    const repo = this.getRepo(userId);
    await repo.deactivate(documentId);
  }

  /**
   * 列出文档
   */
  async listDocuments(userId: string, options?: DocumentListOptions): Promise<KnowledgeDocument[]> {
    logger.debug("[postgres-knowledge] 列出文档", { userId });

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "knowledge",
      category: "document",
      activeOnly: true,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });

    return memories.map(toKnowledgeDocument);
  }

  /**
   * 获取文档状态
   */
  async getDocumentStatus(
    userId: string,
    documentId: string,
  ): Promise<{
    status: DocumentStatus;
    progress?: number;
    message?: string;
  }> {
    const doc = await this.getDocument(userId, documentId);
    if (!doc) {
      return { status: "failed", message: "文档不存在" };
    }
    return {
      status: doc.status,
      message: doc.errorMessage,
    };
  }

  // ==================== 索引管理 ====================

  /**
   * 索引文档
   *
   * 生成文档的 embedding 向量并存储到 DB。
   */
  async indexDocument(userId: string, documentId: string): Promise<void> {
    logger.info("[postgres-knowledge] 索引文档", { userId, documentId });

    const repo = this.getRepo(userId);
    const record = await repo.findById(documentId);

    if (!record) {
      throw new Error(`文档不存在: ${documentId}`);
    }

    // 无 embedding provider 时标记为 indexed 但不生成向量
    if (!this.embeddingProvider) {
      logger.debug("[postgres-knowledge] 无 embedding provider，跳过向量生成");
      await repo.update(documentId, {
        metadata: {
          ...(record.metadata as Record<string, unknown>),
          status: "indexed" as DocumentStatus,
          chunkCount: 1,
        },
      });
      return;
    }

    try {
      // 更新状态为处理中
      await repo.update(documentId, {
        metadata: {
          ...(record.metadata as Record<string, unknown>),
          status: "processing" as DocumentStatus,
        },
      });

      // 生成 embedding
      const embedding = await this.embeddingProvider.embedQuery(record.content);

      // 存储 embedding 并更新状态
      await repo.update(documentId, {
        embedding,
        metadata: {
          ...(record.metadata as Record<string, unknown>),
          status: "indexed" as DocumentStatus,
          chunkCount: 1,
          embeddingModel: this.embeddingProvider.model,
          processedAt: new Date().toISOString(),
        },
      });

      logger.info("[postgres-knowledge] 文档索引完成", { documentId });
    } catch (error) {
      logger.error("[postgres-knowledge] 文档索引失败", {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await repo.update(documentId, {
        metadata: {
          ...(record.metadata as Record<string, unknown>),
          status: "failed" as DocumentStatus,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * 重新索引文档
   */
  async reindexDocument(userId: string, documentId: string): Promise<void> {
    logger.info("[postgres-knowledge] 重新索引文档", { userId, documentId });
    await this.indexDocument(userId, documentId);
  }

  /**
   * 重新索引所有文档
   */
  async reindexAll(userId: string): Promise<void> {
    logger.info("[postgres-knowledge] 重新索引所有文档", { userId });

    const docs = await this.listDocuments(userId, { limit: 1000 });
    for (const doc of docs) {
      await this.indexDocument(userId, doc.id);
    }
  }

  // ==================== 向量搜索 ====================

  /**
   * 向量相似度搜索
   *
   * 将查询文本转换为 embedding，使用 Milvus 进行余弦相似度搜索。
   * 无 embedding provider 时降级为文本匹配搜索。
   */
  async searchSimilar(
    userId: string,
    query: string,
    options?: VectorSearchOptions,
  ): Promise<SearchResult[]> {
    logger.debug("[postgres-knowledge] 向量搜索", { userId, queryLength: query.length });

    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0;

    // 有 embedding provider 时使用向量搜索
    if (this.embeddingProvider) {
      try {
        const queryEmbedding = await this.embeddingProvider.embedQuery(query);
        const repo = this.getRepo(userId);

        const results = await repo.searchByVector(queryEmbedding, {
          type: "knowledge",
          limit,
          minScore,
        });

        return results.map((r) => {
          const meta = (r.metadata ?? {}) as Record<string, unknown>;
          return {
            id: r.id,
            content: r.content,
            score: r.score,
            documentId: r.sourceId ?? undefined,
            documentTitle: (meta.title as string) ?? r.summary ?? undefined,
            metadata: meta,
          };
        });
      } catch (error) {
        logger.warn("[postgres-knowledge] 向量搜索失败，降级为文本搜索", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 降级：文本匹配搜索
    return this.textSearch(userId, query, limit, minScore);
  }

  /**
   * 混合搜索
   *
   * 结合向量搜索和文本匹配搜索，按权重合并结果。
   */
  async searchHybrid(
    userId: string,
    query: string,
    options?: HybridSearchOptions,
  ): Promise<SearchResult[]> {
    logger.debug("[postgres-knowledge] 混合搜索", { userId, queryLength: query.length });

    const limit = options?.limit ?? 10;
    const vectorWeight = options?.vectorWeight ?? 0.7;
    const textWeight = options?.textWeight ?? 0.3;

    // 无 embedding provider 时退化为纯文本搜索
    if (!this.embeddingProvider) {
      return this.textSearch(userId, query, limit, options?.minScore ?? 0);
    }

    // 并行执行向量搜索和文本搜索
    const [vectorResults, textResults] = await Promise.all([
      this.searchSimilar(userId, query, { limit: limit * 2 }),
      this.textSearch(userId, query, limit * 2, 0),
    ]);

    // 合并并加权
    const scoreMap = new Map<string, { result: SearchResult; combinedScore: number }>();

    for (const r of vectorResults) {
      scoreMap.set(r.id, {
        result: r,
        combinedScore: r.score * vectorWeight,
      });
    }

    for (const r of textResults) {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.combinedScore += r.score * textWeight;
      } else {
        scoreMap.set(r.id, {
          result: r,
          combinedScore: r.score * textWeight,
        });
      }
    }

    // 排序并截取
    return Array.from(scoreMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit)
      .map((entry) => ({
        ...entry.result,
        score: entry.combinedScore,
      }));
  }

  /**
   * 纯文本匹配搜索（降级方案）
   */
  private async textSearch(
    userId: string,
    query: string,
    limit: number,
    minScore: number,
  ): Promise<SearchResult[]> {
    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "knowledge",
      activeOnly: true,
      limit: 200,
    });

    return memories
      .map((m) => {
        const score = textMatchScore(m.content, query);
        const meta = (m.metadata ?? {}) as Record<string, unknown>;
        return {
          id: m.id,
          content: m.content,
          score,
          documentId: m.sourceId ?? undefined,
          documentTitle: (meta.title as string) ?? m.summary ?? undefined,
          metadata: meta,
        };
      })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// ==================== 注册到工厂 ====================

registerProvider("knowledge", "postgres", PostgresKnowledgeMemoryProvider);
