/**
 * 知识记忆接口
 *
 * 知识记忆管理用户的结构化知识库，支持文档上传、向量索引、
 * 知识图谱构建和智能检索。
 *
 * @module memory/pluggable/interfaces
 */

import type { Readable } from "node:stream";
import type { IMemoryProvider } from "./memory-provider.js";
import type { Message } from "./working-memory.js";

// ==================== 文档类型 ====================

/**
 * 文档来源
 */
export type DocumentSource = "upload" | "conversation" | "web" | "integration";

/**
 * 文档状态
 */
export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";

/**
 * 文档输入
 */
export interface DocumentInput {
  /** 文档标题 */
  title: string;
  /** 文档内容（Buffer 或 Stream） */
  content?: Buffer | Readable;
  /** 已上传的对象键（如果已上传到对象存储） */
  objectKey?: string;
  /** MIME 类型 */
  mimeType: string;
  /** 来源类型 */
  source: DocumentSource;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 文档块
 */
export interface DocumentChunk {
  /** 块 ID */
  id: string;
  /** 所属文档 ID */
  documentId: string;
  /** 块内容 */
  content: string;
  /** 向量嵌入（可选，可能存储在向量数据库） */
  embedding?: number[];
  /** 起始偏移 */
  startOffset: number;
  /** 结束偏移 */
  endOffset: number;
  /** 元数据 */
  metadata: {
    page?: number;
    section?: string;
    heading?: string;
  };
}

/**
 * 知识文档
 */
export interface KnowledgeDocument {
  /** 文档 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 来源 */
  source: DocumentSource;
  /** 对象存储键 */
  objectKey: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 状态 */
  status: DocumentStatus;
  /** 块数量 */
  chunkCount: number;
  /** 嵌入模型 */
  embeddingModel: string;
  /** 错误信息（如果失败） */
  errorMessage?: string;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
  /** 处理完成时间 */
  processedAt?: Date;
}

// ==================== 知识图谱类型 ====================

/**
 * 实体
 */
export interface Entity {
  /** 实体 ID */
  id: string;
  /** 实体名称 */
  name: string;
  /** 实体类型（person, organization, concept, location, event 等） */
  type: string;
  /** 描述 */
  description?: string;
  /** 属性 */
  properties: Record<string, unknown>;
  /** 被引用次数 */
  mentionCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 关系
 */
export interface Relationship {
  /** 关系 ID */
  id: string;
  /** 源实体 ID */
  sourceId: string;
  /** 目标实体 ID */
  targetId: string;
  /** 关系类型（works_at, knows, part_of, related_to 等） */
  type: string;
  /** 属性 */
  properties: Record<string, unknown>;
  /** 关系强度 (0-1) */
  weight: number;
  /** 有效开始时间 */
  validFrom?: Date;
  /** 有效结束时间 */
  validUntil?: Date;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 社区（GraphRAG）
 */
export interface Community {
  /** 社区 ID */
  id: string;
  /** 层级 */
  level: number;
  /** 包含的实体 ID 列表 */
  entityIds: string[];
  /** AI 生成的摘要 */
  summary: string;
  /** 关键主题 */
  keyThemes: string[];
  /** 父社区 ID */
  parentCommunityId?: string;
}

// ==================== 搜索类型 ====================

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 结果 ID */
  id: string;
  /** 内容 */
  content: string;
  /** 相关度分数 */
  score: number;
  /** 来源文档 ID */
  documentId?: string;
  /** 来源文档标题 */
  documentTitle?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 向量搜索选项
 */
export interface VectorSearchOptions {
  /** 最大返回数量 */
  limit?: number;
  /** 最小分数阈值 */
  minScore?: number;
  /** 过滤条件 */
  filter?: Record<string, unknown>;
}

/**
 * 混合搜索选项
 */
export interface HybridSearchOptions extends VectorSearchOptions {
  /** 向量搜索权重（默认 0.7） */
  vectorWeight?: number;
  /** 文本搜索权重（默认 0.3） */
  textWeight?: number;
  /** 是否重排序 */
  rerank?: boolean;
}

// ==================== 图查询类型 ====================

/**
 * 图查询
 */
export interface GraphQuery {
  /** Cypher 查询语句 */
  cypher?: string;
  /** 模式匹配 */
  pattern?: {
    entityType?: string;
    relationshipType?: string;
    depth?: number;
  };
  /** 查询参数 */
  parameters?: Record<string, unknown>;
}

/**
 * 图查询结果
 */
export interface GraphQueryResult {
  /** 节点列表 */
  nodes: Entity[];
  /** 边列表 */
  edges: Relationship[];
  /** 路径列表 */
  paths?: Array<{
    nodes: string[];
    relationships: string[];
  }>;
}

/**
 * 实体上下文
 */
export interface EntityContext {
  /** 中心实体 */
  entity: Entity;
  /** 相邻实体 */
  neighbors: Entity[];
  /** 关系列表 */
  relationships: Relationship[];
  /** 相关文档 */
  relatedDocuments: Array<{
    id: string;
    title: string;
    relevance: number;
  }>;
}

/**
 * 图谱回答
 */
export interface GraphAnswer {
  /** 回答文本 */
  answer: string;
  /** 来源引用 */
  sources: Array<{
    type: "document" | "entity" | "relationship";
    id: string;
    content: string;
    relevance: number;
  }>;
  /** 涉及的实体 */
  entities: Entity[];
  /** 置信度 */
  confidence: number;
}

// ==================== 列表选项 ====================

/**
 * 文档列表选项
 */
export interface DocumentListOptions {
  /** 状态过滤 */
  status?: DocumentStatus;
  /** 来源过滤 */
  source?: DocumentSource;
  /** 最大返回数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 排序字段 */
  orderBy?: "createdAt" | "processedAt" | "title";
  /** 排序方向 */
  order?: "asc" | "desc";
}

// ==================== 提供者接口 ====================

/**
 * 知识记忆提供者接口
 *
 * 管理知识文档、向量索引、知识图谱，支持智能问答。
 *
 * @example
 * ```typescript
 * const provider = new GraphitiKnowledgeProvider({
 *   milvus: { address: 'localhost:19530' },
 *   neo4j: { uri: 'bolt://localhost:7687', ... },
 * })
 * await provider.initialize()
 *
 * // 添加文档
 * const docId = await provider.addDocument('user-123', {
 *   title: '产品手册',
 *   content: pdfBuffer,
 *   mimeType: 'application/pdf',
 *   source: 'upload',
 * })
 *
 * // 搜索知识
 * const results = await provider.searchHybrid('user-123', '产品优势')
 *
 * // 基于图谱回答
 * const answer = await provider.answerWithGraph('user-123', '张三的领导是谁？')
 *
 * await provider.shutdown()
 * ```
 */
export interface IKnowledgeMemoryProvider extends IMemoryProvider {
  // ==================== 文档管理 ====================

  /**
   * 添加文档
   *
   * @param userId - 用户 ID
   * @param document - 文档输入
   * @returns 文档 ID
   */
  addDocument(userId: string, document: DocumentInput): Promise<string>;

  /**
   * 获取文档
   *
   * @param userId - 用户 ID
   * @param documentId - 文档 ID
   * @returns 文档信息，不存在返回 null
   */
  getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null>;

  /**
   * 删除文档
   *
   * 同时删除相关的索引和图谱数据
   *
   * @param userId - 用户 ID
   * @param documentId - 文档 ID
   */
  deleteDocument(userId: string, documentId: string): Promise<void>;

  /**
   * 列出文档
   *
   * @param userId - 用户 ID
   * @param options - 列表选项
   * @returns 文档列表
   */
  listDocuments(userId: string, options?: DocumentListOptions): Promise<KnowledgeDocument[]>;

  /**
   * 获取文档状态
   *
   * @param userId - 用户 ID
   * @param documentId - 文档 ID
   * @returns 状态信息
   */
  getDocumentStatus(
    userId: string,
    documentId: string,
  ): Promise<{
    status: DocumentStatus;
    progress?: number;
    message?: string;
  }>;

  // ==================== 索引管理 ====================

  /**
   * 索引文档
   *
   * 解析文档、分块、生成嵌入、存储到向量数据库
   *
   * @param userId - 用户 ID
   * @param documentId - 文档 ID
   */
  indexDocument(userId: string, documentId: string): Promise<void>;

  /**
   * 重新索引文档
   *
   * @param userId - 用户 ID
   * @param documentId - 文档 ID
   */
  reindexDocument(userId: string, documentId: string): Promise<void>;

  /**
   * 重新索引所有文档
   *
   * @param userId - 用户 ID
   */
  reindexAll(userId: string): Promise<void>;

  // ==================== 向量搜索 ====================

  /**
   * 相似度搜索
   *
   * 纯向量搜索
   *
   * @param userId - 用户 ID
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  searchSimilar(
    userId: string,
    query: string,
    options?: VectorSearchOptions,
  ): Promise<SearchResult[]>;

  /**
   * 混合搜索
   *
   * 结合向量搜索和关键词搜索
   *
   * @param userId - 用户 ID
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  searchHybrid(
    userId: string,
    query: string,
    options?: HybridSearchOptions,
  ): Promise<SearchResult[]>;

  // ==================== 知识图谱 ====================

  /**
   * 添加实体
   *
   * @param userId - 用户 ID
   * @param entity - 实体信息（不含 id、createdAt、updatedAt、mentionCount）
   * @returns 实体 ID
   */
  addEntity(
    userId: string,
    entity: Omit<Entity, "id" | "createdAt" | "updatedAt" | "mentionCount">,
  ): Promise<string>;

  /**
   * 获取实体
   *
   * @param userId - 用户 ID
   * @param entityId - 实体 ID
   * @returns 实体信息，不存在返回 null
   */
  getEntity(userId: string, entityId: string): Promise<Entity | null>;

  /**
   * 更新实体
   *
   * @param userId - 用户 ID
   * @param entityId - 实体 ID
   * @param updates - 要更新的字段
   */
  updateEntity(userId: string, entityId: string, updates: Partial<Entity>): Promise<void>;

  /**
   * 删除实体
   *
   * 同时删除相关的关系
   *
   * @param userId - 用户 ID
   * @param entityId - 实体 ID
   */
  deleteEntity(userId: string, entityId: string): Promise<void>;

  /**
   * 添加关系
   *
   * @param userId - 用户 ID
   * @param relationship - 关系信息（不含 id、createdAt）
   * @returns 关系 ID
   */
  addRelationship(
    userId: string,
    relationship: Omit<Relationship, "id" | "createdAt">,
  ): Promise<string>;

  /**
   * 获取关系
   *
   * @param userId - 用户 ID
   * @param relationshipId - 关系 ID
   * @returns 关系信息，不存在返回 null
   */
  getRelationship(userId: string, relationshipId: string): Promise<Relationship | null>;

  /**
   * 更新关系
   *
   * @param userId - 用户 ID
   * @param relationshipId - 关系 ID
   * @param updates - 要更新的字段
   */
  updateRelationship(
    userId: string,
    relationshipId: string,
    updates: Partial<Relationship>,
  ): Promise<void>;

  /**
   * 删除关系
   *
   * @param userId - 用户 ID
   * @param relationshipId - 关系 ID
   */
  deleteRelationship(userId: string, relationshipId: string): Promise<void>;

  /**
   * 查询图谱
   *
   * @param userId - 用户 ID
   * @param query - 图查询
   * @returns 查询结果
   */
  queryGraph(userId: string, query: GraphQuery): Promise<GraphQueryResult>;

  /**
   * 获取实体上下文
   *
   * @param userId - 用户 ID
   * @param entityId - 实体 ID
   * @param depth - 遍历深度（默认 2）
   * @returns 实体上下文
   */
  getEntityContext(userId: string, entityId: string, depth?: number): Promise<EntityContext>;

  // ==================== GraphRAG ====================

  /**
   * 构建社区
   *
   * 对知识图谱进行社区检测和摘要生成
   *
   * @param userId - 用户 ID
   */
  buildCommunities(userId: string): Promise<void>;

  /**
   * 获取社区
   *
   * @param userId - 用户 ID
   * @param level - 层级（可选）
   * @returns 社区列表
   */
  getCommunities(userId: string, level?: number): Promise<Community[]>;

  /**
   * 基于图谱回答问题
   *
   * 结合向量搜索和图谱推理生成回答
   *
   * @param userId - 用户 ID
   * @param question - 问题
   * @returns 回答结果
   */
  answerWithGraph(userId: string, question: string): Promise<GraphAnswer>;

  // ==================== 对话转知识 ====================

  /**
   * 导入对话为知识
   *
   * 从对话中提取结构化知识
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param messages - 对话消息
   * @returns 导入结果
   */
  importConversation(
    userId: string,
    sessionId: string,
    messages: Message[],
  ): Promise<{
    documentId: string;
    entities: string[];
    relationships: string[];
  }>;
}
