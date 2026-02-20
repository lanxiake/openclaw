/**
 * 简单知识记忆提供者
 *
 * 使用内存存储实现简化版知识记忆，适用于开发和测试环境。
 * 不支持向量搜索和知识图谱的高级功能，仅提供基础的文档和实体管理。
 * 数据在进程重启后会丢失。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { randomUUID } from "node:crypto";

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

/**
 * 用户知识数据存储结构
 */
interface UserKnowledgeData {
  /** 文档 (documentId -> document) */
  documents: Map<string, KnowledgeDocument>;
  /** 文档内容 (documentId -> content string) */
  documentContents: Map<string, string>;
}

/**
 * 简单知识记忆提供者
 *
 * 特性:
 * - 内存存储，重启后数据丢失
 * - 简化的文本搜索（不支持向量搜索）
 * - 基础的实体和关系管理
 * - 不支持 GraphRAG 高级功能
 *
 * @example
 * ```typescript
 * const provider = new SimpleKnowledgeMemoryProvider()
 * await provider.initialize()
 *
 * const docId = await provider.addDocument('user-1', {
 *   title: '测试文档',
 *   mimeType: 'text/plain',
 *   source: 'upload',
 * })
 *
 * await provider.shutdown()
 * ```
 */
export class SimpleKnowledgeMemoryProvider implements IKnowledgeMemoryProvider {
  readonly name = "simple-knowledge";
  readonly version = "1.0.0";

  /** 用户数据存储 (userId -> data) */
  private storage = new Map<string, UserKnowledgeData>();

  /**
   * 创建简单知识记忆提供者
   *
   * @param _config - 配置（当前未使用）
   */
  constructor(_config?: ProviderConfig) {
    // 简单提供者不需要配置
  }

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    console.log("[simple-knowledge] 初始化简单知识记忆提供者");
    this.storage.clear();
    console.log("[simple-knowledge] 初始化完成");
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log("[simple-knowledge] 关闭提供者");
    this.storage.clear();
    console.log("[simple-knowledge] 已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      status: "healthy",
      latency: 0,
      details: {
        userCount: this.storage.size,
      },
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取或创建用户数据
   */
  private getUserData(userId: string): UserKnowledgeData {
    let data = this.storage.get(userId);
    if (!data) {
      data = {
        documents: new Map(),
        documentContents: new Map(),
      };
      this.storage.set(userId, data);
    }
    return data;
  }

  /**
   * 简单文本匹配搜索
   */
  private textMatch(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) return 0;

    let matchCount = 0;
    for (const word of words) {
      if (lowerText.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / words.length;
  }

  // ==================== 文档管理 ====================

  /**
   * 添加文档
   */
  async addDocument(userId: string, document: DocumentInput): Promise<string> {
    const documentId = randomUUID();
    const now = new Date();

    console.log(
      `[simple-knowledge] 添加文档: ${documentId} (用户: ${userId}, 标题: ${document.title})`,
    );

    const data = this.getUserData(userId);

    // 处理文档内容
    let contentString = "";
    if (document.content) {
      if (Buffer.isBuffer(document.content)) {
        contentString = document.content.toString("utf-8");
      } else {
        // Stream - 读取所有内容
        const chunks: Buffer[] = [];
        for await (const chunk of document.content) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        contentString = Buffer.concat(chunks).toString("utf-8");
      }
    }

    const doc: KnowledgeDocument = {
      id: documentId,
      title: document.title,
      source: document.source,
      objectKey: document.objectKey || `docs/${documentId}`,
      mimeType: document.mimeType,
      size: contentString.length,
      status: "indexed", // 简化版直接标记为已索引
      chunkCount: 1, // 简化版不分块
      embeddingModel: "none", // 简化版不使用嵌入
      metadata: document.metadata || {},
      createdAt: now,
      processedAt: now,
    };

    data.documents.set(documentId, doc);
    data.documentContents.set(documentId, contentString);

    return documentId;
  }

  /**
   * 获取文档
   */
  async getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null> {
    const data = this.getUserData(userId);
    return data.documents.get(documentId) || null;
  }

  /**
   * 删除文档
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    console.log(`[simple-knowledge] 删除文档: ${documentId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    data.documents.delete(documentId);
    data.documentContents.delete(documentId);
  }

  /**
   * 列出文档
   */
  async listDocuments(userId: string, options?: DocumentListOptions): Promise<KnowledgeDocument[]> {
    const data = this.getUserData(userId);
    let docs = Array.from(data.documents.values());

    // 状态过滤
    if (options?.status) {
      docs = docs.filter((d) => d.status === options.status);
    }

    // 来源过滤
    if (options?.source) {
      docs = docs.filter((d) => d.source === options.source);
    }

    // 排序
    const orderBy = options?.orderBy || "createdAt";
    const order = options?.order || "desc";
    docs.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (orderBy === "title") {
        aVal = a.title.localeCompare(b.title);
        bVal = 0;
      } else {
        const aDate = orderBy === "processedAt" ? a.processedAt : a.createdAt;
        const bDate = orderBy === "processedAt" ? b.processedAt : b.createdAt;
        aVal = aDate?.getTime() || 0;
        bVal = bDate?.getTime() || 0;
      }

      return order === "asc" ? aVal - bVal : bVal - aVal;
    });

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 10;

    return docs.slice(offset, offset + limit);
  }

  /**
   * 获取文档状态
   */
  async getDocumentStatus(
    userId: string,
    documentId: string,
  ): Promise<{ status: DocumentStatus; progress?: number; message?: string }> {
    const data = this.getUserData(userId);
    const doc = data.documents.get(documentId);

    if (!doc) {
      return { status: "failed", message: "文档不存在" };
    }

    return {
      status: doc.status,
      progress: doc.status === "indexed" ? 100 : 0,
    };
  }

  // ==================== 索引管理 ====================

  /**
   * 索引文档（简化版：直接标记为已索引）
   */
  async indexDocument(userId: string, documentId: string): Promise<void> {
    console.log(`[simple-knowledge] 索引文档: ${documentId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    const doc = data.documents.get(documentId);

    if (!doc) {
      throw new Error(`文档不存在: ${documentId}`);
    }

    doc.status = "indexed";
    doc.processedAt = new Date();
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
    console.log(`[simple-knowledge] 重新索引所有文档 (用户: ${userId})`);

    const data = this.getUserData(userId);
    for (const doc of data.documents.values()) {
      doc.status = "indexed";
      doc.processedAt = new Date();
    }
  }

  // ==================== 向量搜索 ====================

  /**
   * 相似度搜索（简化版：使用文本匹配）
   */
  async searchSimilar(
    userId: string,
    query: string,
    options?: VectorSearchOptions,
  ): Promise<SearchResult[]> {
    console.log(`[simple-knowledge] 搜索: "${query}" (用户: ${userId})`);

    const data = this.getUserData(userId);
    const results: SearchResult[] = [];
    const minScore = options?.minScore || 0.1;

    for (const [docId, content] of data.documentContents) {
      const doc = data.documents.get(docId);
      if (!doc || doc.status !== "indexed") continue;

      const score = this.textMatch(content, query);
      if (score >= minScore) {
        results.push({
          id: docId,
          content: content.slice(0, 500), // 返回前 500 字符
          score,
          documentId: docId,
          documentTitle: doc.title,
        });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    // 限制返回数量
    const limit = options?.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * 混合搜索（简化版：与相似度搜索相同）
   */
  async searchHybrid(
    userId: string,
    query: string,
    options?: HybridSearchOptions,
  ): Promise<SearchResult[]> {
    return this.searchSimilar(userId, query, options);
  }
}

// 自动注册提供者
registerProvider(
  "knowledge",
  "simple",
  SimpleKnowledgeMemoryProvider as unknown as new (
    options: Record<string, unknown>,
  ) => SimpleKnowledgeMemoryProvider,
);
