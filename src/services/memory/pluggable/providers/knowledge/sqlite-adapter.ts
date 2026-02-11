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
 * 对于文档管理、实体关系、图谱等高级功能，该适配器提供基础存根实现，
 * 可在未来逐步扩展或通过其他提供者实现。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { randomUUID } from "node:crypto";
import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type {
  Community,
  DocumentInput,
  DocumentListOptions,
  DocumentStatus,
  Entity,
  EntityContext,
  GraphAnswer,
  GraphQuery,
  GraphQueryResult,
  HybridSearchOptions,
  IKnowledgeMemoryProvider,
  KnowledgeDocument,
  Relationship,
  SearchResult,
  VectorSearchOptions,
} from "../../interfaces/knowledge-memory.js";
import type { Message } from "../../interfaces/working-memory.js";
import { registerProvider } from "../factory.js";

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

  /** 实体存储 */
  private entities = new Map<string, Map<string, Entity>>();

  /** 关系存储 */
  private relationships = new Map<string, Map<string, Relationship>>();

  /**
   * 创建适配器
   *
   * @param config - 配置选项
   */
  constructor(config: SQLiteKnowledgeConfig = {}) {
    this.config = config;

    console.log("[SQLiteKnowledgeAdapter] 创建适配器");
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[SQLiteKnowledgeAdapter] 已初始化");
      return;
    }

    console.log("[SQLiteKnowledgeAdapter] 开始初始化...");

    try {
      // 如果提供了已存在的管理器，直接使用
      if (this.config.indexManager) {
        this.indexManager = this.config.indexManager as IMemoryIndexManager;
        this.ownsManager = false;
        console.log("[SQLiteKnowledgeAdapter] 使用已存在的 MemoryIndexManager");
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
          console.log("[SQLiteKnowledgeAdapter] 记忆搜索未启用，使用空实现");
        }

        this.indexManager = result.manager as IMemoryIndexManager | null;
        this.ownsManager = true;
      }

      this.initialized = true;
      console.log("[SQLiteKnowledgeAdapter] 初始化完成");
    } catch (error) {
      console.error("[SQLiteKnowledgeAdapter] 初始化失败:", error);
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

    console.log("[SQLiteKnowledgeAdapter] 开始关闭...");

    // 只有当我们拥有管理器时才关闭它
    if (this.ownsManager && this.indexManager) {
      await this.indexManager.close();
    }

    this.indexManager = null;
    this.initialized = false;
    this.documents.clear();
    this.entities.clear();
    this.relationships.clear();

    console.log("[SQLiteKnowledgeAdapter] 已关闭");
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

    console.log(`[SQLiteKnowledgeAdapter] 添加文档: ${id} for user ${userId}`);

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
    console.log(`[SQLiteKnowledgeAdapter] 删除文档: ${documentId}`);
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
      console.log("[SQLiteKnowledgeAdapter] 记忆搜索未启用，返回空结果");
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

  // ==================== 知识图谱（基础实现） ====================

  /**
   * 添加实体
   */
  async addEntity(
    userId: string,
    entity: Omit<Entity, "id" | "createdAt" | "updatedAt" | "mentionCount">,
  ): Promise<string> {
    const id = randomUUID();
    const now = new Date();

    const newEntity: Entity = {
      ...entity,
      id,
      mentionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (!this.entities.has(userId)) {
      this.entities.set(userId, new Map());
    }
    this.entities.get(userId)!.set(id, newEntity);

    return id;
  }

  /**
   * 获取实体
   */
  async getEntity(userId: string, entityId: string): Promise<Entity | null> {
    return this.entities.get(userId)?.get(entityId) ?? null;
  }

  /**
   * 更新实体
   */
  async updateEntity(userId: string, entityId: string, updates: Partial<Entity>): Promise<void> {
    const entity = this.entities.get(userId)?.get(entityId);
    if (entity) {
      Object.assign(entity, updates, { updatedAt: new Date() });
    }
  }

  /**
   * 删除实体
   */
  async deleteEntity(userId: string, entityId: string): Promise<void> {
    this.entities.get(userId)?.delete(entityId);

    // 删除相关关系
    const userRels = this.relationships.get(userId);
    if (userRels) {
      for (const [relId, rel] of userRels) {
        if (rel.sourceId === entityId || rel.targetId === entityId) {
          userRels.delete(relId);
        }
      }
    }
  }

  /**
   * 添加关系
   */
  async addRelationship(
    userId: string,
    relationship: Omit<Relationship, "id" | "createdAt">,
  ): Promise<string> {
    const id = randomUUID();

    const newRel: Relationship = {
      ...relationship,
      id,
      createdAt: new Date(),
    };

    if (!this.relationships.has(userId)) {
      this.relationships.set(userId, new Map());
    }
    this.relationships.get(userId)!.set(id, newRel);

    return id;
  }

  /**
   * 获取关系
   */
  async getRelationship(userId: string, relationshipId: string): Promise<Relationship | null> {
    return this.relationships.get(userId)?.get(relationshipId) ?? null;
  }

  /**
   * 更新关系
   */
  async updateRelationship(
    userId: string,
    relationshipId: string,
    updates: Partial<Relationship>,
  ): Promise<void> {
    const rel = this.relationships.get(userId)?.get(relationshipId);
    if (rel) {
      Object.assign(rel, updates);
    }
  }

  /**
   * 删除关系
   */
  async deleteRelationship(userId: string, relationshipId: string): Promise<void> {
    this.relationships.get(userId)?.delete(relationshipId);
  }

  /**
   * 查询图谱
   *
   * 基础实现：返回所有实体和关系
   */
  async queryGraph(userId: string, query: GraphQuery): Promise<GraphQueryResult> {
    const nodes = Array.from(this.entities.get(userId)?.values() ?? []);
    const edges = Array.from(this.relationships.get(userId)?.values() ?? []);

    // 简单的模式匹配过滤
    if (query.pattern?.entityType) {
      const filteredNodes = nodes.filter((n) => n.type === query.pattern!.entityType);
      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredEdges = edges.filter((e) => nodeIds.has(e.sourceId) || nodeIds.has(e.targetId));
      return { nodes: filteredNodes, edges: filteredEdges };
    }

    return { nodes, edges };
  }

  /**
   * 获取实体上下文
   */
  async getEntityContext(userId: string, entityId: string, depth?: number): Promise<EntityContext> {
    const entity = await this.getEntity(userId, entityId);
    if (!entity) {
      throw new Error(`实体不存在: ${entityId}`);
    }

    const userRels = this.relationships.get(userId);
    const relationships: Relationship[] = [];
    const neighborIds = new Set<string>();

    if (userRels) {
      for (const rel of userRels.values()) {
        if (rel.sourceId === entityId) {
          relationships.push(rel);
          neighborIds.add(rel.targetId);
        } else if (rel.targetId === entityId) {
          relationships.push(rel);
          neighborIds.add(rel.sourceId);
        }
      }
    }

    const neighbors: Entity[] = [];
    const userEntities = this.entities.get(userId);
    if (userEntities) {
      for (const id of neighborIds) {
        const neighbor = userEntities.get(id);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }

    return {
      entity,
      neighbors,
      relationships,
      relatedDocuments: [],
    };
  }

  // ==================== GraphRAG（存根实现） ====================

  /**
   * 构建社区
   *
   * 当前为存根实现，需要图数据库支持
   */
  async buildCommunities(userId: string): Promise<void> {
    console.log(`[SQLiteKnowledgeAdapter] buildCommunities 尚未实现 (userId: ${userId})`);
  }

  /**
   * 获取社区
   */
  async getCommunities(userId: string, level?: number): Promise<Community[]> {
    console.log(`[SQLiteKnowledgeAdapter] getCommunities 尚未实现`);
    return [];
  }

  /**
   * 基于图谱回答问题
   *
   * 当前实现：使用搜索结果生成简单回答
   */
  async answerWithGraph(userId: string, question: string): Promise<GraphAnswer> {
    const searchResults = await this.searchHybrid(userId, question, { limit: 5 });

    const sources = searchResults.map((r) => ({
      type: "document" as const,
      id: r.id,
      content: r.content,
      relevance: r.score,
    }));

    return {
      answer:
        searchResults.length > 0
          ? `根据相关文档，找到 ${searchResults.length} 条相关信息。`
          : "未找到相关信息。",
      sources,
      entities: [],
      confidence: searchResults.length > 0 ? 0.6 : 0.1,
    };
  }

  // ==================== 对话转知识 ====================

  /**
   * 导入对话为知识
   *
   * 当前为基础实现
   */
  async importConversation(
    userId: string,
    sessionId: string,
    messages: Message[],
  ): Promise<{
    documentId: string;
    entities: string[];
    relationships: string[];
  }> {
    // 创建对话文档
    const content = messages.map((m) => `[${m.role}]: ${m.content}`).join("\n\n");

    const docId = await this.addDocument(userId, {
      title: `对话 ${sessionId}`,
      mimeType: "text/plain",
      source: "conversation",
      metadata: { sessionId, messageCount: messages.length },
    });

    return {
      documentId: docId,
      entities: [],
      relationships: [],
    };
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
