/**
 * SQLite 知识记忆适配器
 *
 * 将现有的 MemoryIndexManager (SQLite + sqlite-vec) 包装为 IKnowledgeMemoryProvider 接口，
 * 实现与可插拔记忆系统的无缝集成。
 *
 * ## 设计说明
 *
 * 该适配器主要关注搜索功能的封装，因为现有 MemoryIndexManager 的核心能力是：
 * - 向量搜索（sqlite-vec）
 * - 混合搜索（向量 + BM25）
 * - 文件内容读取
 *
 * 文档管理功能提供基础内存实现，可在未来逐步扩展。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { randomUUID } from "node:crypto";
import type { HealthStatus } from "../../interfaces/memory-provider.js";
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
import { createSubsystemLogger } from "../../../../logging/subsystem.js";

const logger = createSubsystemLogger("memory/knowledge/sqlite");

/**
 * SQLite 适配器配置
 */
export interface SQLiteKnowledgeConfig {
  /**
   * OpenClaw 配置对象
   * 用于创建 MemoryIndexManager
   */
  openclawConfig?: unknown;

  /**
   * Agent ID
   */
  agentId?: string;

  /**
   * 已存在的 MemoryIndexManager 实例
   * 如果提供，将直接使用此实例
   */
  indexManager?: unknown;
}

/**
 * MemoryIndexManager 搜索结果类型
 */
interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: "memory" | "sessions";
}

/**
 * MemoryIndexManager 接口
 * 定义我们需要使用的方法
 */
interface IMemoryIndexManager {
  /**
   * 执行搜索
   */
  search(
    query: string,
    opts?: {
      maxResults?: number;
      minScore?: number;
      sessionKey?: string;
    },
  ): Promise<MemorySearchResult[]>;

  /**
   * 读取文件内容
   */
  readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }>;

  /**
   * 同步索引
   */
  sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: { completed: number; total: number; label?: string }) => void;
  }): Promise<void>;

  /**
   * 获取状态
   */
  status(): {
    files: number;
    chunks: number;
    dirty: boolean;
    syncing: boolean;
    provider: string;
    model: string;
    fallbackFrom?: string;
    fallbackReason?: string;
  };

  /**
   * 关闭管理器
   */
  close(): Promise<void>;
}

/**
 * SQLite 知识记忆适配器
 *
 * 将 MemoryIndexManager 包装为 IKnowledgeMemoryProvider 接口。
 *
 * @example
 * ```typescript
 * // 使用已存在的 MemoryIndexManager
 * const adapter = new SQLiteKnowledgeMemoryAdapter({
 *   indexManager: existingManager,
 * })
 *
 * // 或者通过配置创建
 * const adapter = new SQLiteKnowledgeMemoryAdapter({
 *   openclawConfig: config,
 *   agentId: 'main',
 * })
 *
 * await adapter.initialize()
 *
 * // 执行混合搜索
 * const results = await adapter.searchHybrid('user-123', '查询内容')
 *
 * await adapter.shutdown()
 * ```
 */
export class SQLiteKnowledgeMemoryAdapter implements IKnowledgeMemoryProvider {
  /** 提供者名称 */
  static readonly providerName = "sqlite";

  /** 提供者名称（接口要求） */
  readonly name = "sqlite";

  /** 提供者版本（接口要求） */
  readonly version = "1.0.0";

  /** 配置 */
  private readonly config: SQLiteKnowledgeConfig;

  /** MemoryIndexManager 实例 */
  private indexManager: IMemoryIndexManager | null = null;

  /** 是否已初始化 */
  private initialized = false;

  /** 是否需要关闭管理器 */
  private ownsManager = false;

  /** 文档存储（内存中的简单实现） */
  private documents = new Map<string, Map<string, KnowledgeDocument>>();

  /**
   * 创建适配器
   *
   * @param config - 配置选项
   */
  constructor(config: SQLiteKnowledgeConfig = {}) {
    this.config = config;

    logger.debug("创建适配器");
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("已初始化");
      return;
    }

    logger.info("开始初始化...");

    try {
      // 如果提供了已存在的管理器，直接使用
      if (this.config.indexManager) {
        this.indexManager = this.config.indexManager as IMemoryIndexManager;
        this.ownsManager = false;
        logger.info("使用已存在的 MemoryIndexManager");
      } else if (this.config.openclawConfig && this.config.agentId) {
        // 动态导入并创建管理器
        const { getMemorySearchManager } = await import("../../../search-manager.js");
        const result = await getMemorySearchManager({
          cfg: this.config.openclawConfig as Parameters<typeof getMemorySearchManager>[0]["cfg"],
          agentId: this.config.agentId,
        });

        if (result.error) {
          throw new Error(`创建 MemoryIndexManager 失败: ${result.error}`);
        }

        if (!result.manager) {
          logger.warn("记忆搜索未启用，使用空实现");
        }

        this.indexManager = result.manager as IMemoryIndexManager | null;
        this.ownsManager = true;
      }

      this.initialized = true;
      logger.info("初始化完成");
    } catch (error) {
      logger.error("初始化失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 关闭适配器
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info("开始关闭...");

    // 只有当我们拥有管理器时才关闭它
    if (this.ownsManager && this.indexManager) {
      await this.indexManager.close();
    }

    this.indexManager = null;
    this.initialized = false;
    this.documents.clear();

    logger.info("已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.initialized) {
      return {
        status: "unhealthy",
        latency: 0,
        details: { error: "适配器未初始化" },
      };
    }

    const startTime = Date.now();

    try {
      if (this.indexManager) {
        const status = this.indexManager.status();
        return {
          status: "healthy",
          latency: Date.now() - startTime,
          details: {
            files: status.files,
            chunks: status.chunks,
            dirty: status.dirty,
            syncing: status.syncing,
            provider: status.provider,
            model: status.model,
          },
        };
      }

      // 没有管理器时返回降级状态
      return {
        status: "degraded",
        latency: Date.now() - startTime,
        details: { message: "记忆搜索未启用" },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  // ==================== 文档管理（基础实现） ====================

  /**
   * 添加文档
   *
   * 注意：当前实现仅在内存中存储元数据，
   * 实际索引需要通过 sync() 触发 MemoryIndexManager 的文件同步
   */
  async addDocument(userId: string, document: DocumentInput): Promise<string> {
    const id = randomUUID();
    const now = new Date();

    const doc: KnowledgeDocument = {
      id,
      title: document.title,
      source: document.source,
      objectKey: document.objectKey ?? id,
      mimeType: document.mimeType,
      size: 0, // 需要从 content 计算
      status: "pending",
      chunkCount: 0,
      embeddingModel: this.indexManager?.status().model ?? "unknown",
      metadata: document.metadata ?? {},
      createdAt: now,
    };

    // 存储文档元数据
    if (!this.documents.has(userId)) {
      this.documents.set(userId, new Map());
    }
    this.documents.get(userId)!.set(id, doc);

    logger.debug("添加文档", { documentId: id, userId });

    return id;
  }

  /**
   * 获取文档
   */
  async getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null> {
    return this.documents.get(userId)?.get(documentId) ?? null;
  }

  /**
   * 删除文档
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    this.documents.get(userId)?.delete(documentId);
    logger.debug("删除文档", { documentId });
  }

  /**
   * 列出文档
   */
  async listDocuments(userId: string, options?: DocumentListOptions): Promise<KnowledgeDocument[]> {
    const userDocs = this.documents.get(userId);
    if (!userDocs) {
      return [];
    }

    let docs = Array.from(userDocs.values());

    // 应用过滤
    if (options?.status) {
      docs = docs.filter((d) => d.status === options.status);
    }
    if (options?.source) {
      docs = docs.filter((d) => d.source === options.source);
    }

    // 排序
    const orderBy = options?.orderBy ?? "createdAt";
    const order = options?.order ?? "desc";
    docs.sort((a, b) => {
      const aVal = a[orderBy] ?? a.createdAt;
      const bVal = b[orderBy] ?? b.createdAt;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === "desc" ? -cmp : cmp;
    });

    // 分页
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return docs.slice(offset, offset + limit);
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
    return { status: doc.status, progress: doc.status === "indexed" ? 100 : 0 };
  }

  // ==================== 索引管理 ====================

  /**
   * 索引文档
   *
   * 触发 MemoryIndexManager 的同步
   */
  async indexDocument(userId: string, documentId: string): Promise<void> {
    const doc = this.documents.get(userId)?.get(documentId);
    if (doc) {
      doc.status = "processing";
    }

    // 触发同步
    if (this.indexManager) {
      await this.indexManager.sync({ reason: "document-index", force: true });
    }

    if (doc) {
      doc.status = "indexed";
      doc.processedAt = new Date();
    }
  }

  /**
   * 重新索引文档
   */
  async reindexDocument(userId: string, documentId: string): Promise<void> {
    await this.indexDocument(userId, documentId);
  }

  /**
   * 重新索引所有文档
   */
  async reindexAll(userId: string): Promise<void> {
    if (this.indexManager) {
      await this.indexManager.sync({ reason: "reindex-all", force: true });
    }

    const userDocs = this.documents.get(userId);
    if (userDocs) {
      for (const doc of userDocs.values()) {
        doc.status = "indexed";
        doc.processedAt = new Date();
      }
    }
  }

  // ==================== 向量搜索（核心功能） ====================

  /**
   * 相似度搜索
   *
   * 通过 MemoryIndexManager 执行向量搜索
   */
  async searchSimilar(
    userId: string,
    query: string,
    options?: VectorSearchOptions,
  ): Promise<SearchResult[]> {
    if (!this.indexManager) {
      logger.debug("记忆搜索未启用，返回空结果");
      return [];
    }

    const results = await this.indexManager.search(query, {
      maxResults: options?.limit ?? 10,
      minScore: options?.minScore ?? 0.3,
    });

    return results.map((r, index) => ({
      id: `${r.path}:${r.startLine}-${r.endLine}`,
      content: r.snippet,
      score: r.score,
      documentId: r.path,
      documentTitle: r.path.split("/").pop() ?? r.path,
      metadata: {
        source: r.source,
        startLine: r.startLine,
        endLine: r.endLine,
      },
    }));
  }

  /**
   * 混合搜索
   *
   * 通过 MemoryIndexManager 执行混合搜索（向量 + BM25）
   */
  async searchHybrid(
    userId: string,
    query: string,
    options?: HybridSearchOptions,
  ): Promise<SearchResult[]> {
    // MemoryIndexManager 默认就是混合搜索
    return this.searchSimilar(userId, query, {
      limit: options?.limit,
      minScore: options?.minScore,
      filter: options?.filter,
    });
  }
}

// 注册提供者
registerProvider(
  "knowledge",
  "sqlite",
  SQLiteKnowledgeMemoryAdapter as unknown as new (
    options: Record<string, unknown>,
  ) => IKnowledgeMemoryProvider,
);
