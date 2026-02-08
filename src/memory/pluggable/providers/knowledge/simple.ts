/**
 * 简单知识记忆提供者
 *
 * 使用内存存储实现简化版知识记忆，适用于开发和测试环境。
 * 不支持向量搜索和知识图谱的高级功能，仅提供基础的文档和实体管理。
 * 数据在进程重启后会丢失。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { randomUUID } from 'node:crypto'

import type { HealthStatus, ProviderConfig } from '../../interfaces/memory-provider.js'
import type { Message } from '../../interfaces/working-memory.js'
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
} from '../../interfaces/knowledge-memory.js'
import { registerProvider } from '../factory.js'

/**
 * 用户知识数据存储结构
 */
interface UserKnowledgeData {
  /** 文档 (documentId -> document) */
  documents: Map<string, KnowledgeDocument>
  /** 文档内容 (documentId -> content string) */
  documentContents: Map<string, string>
  /** 实体 (entityId -> entity) */
  entities: Map<string, Entity>
  /** 关系 (relationshipId -> relationship) */
  relationships: Map<string, Relationship>
  /** 社区 (communityId -> community) */
  communities: Map<string, Community>
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
  readonly name = 'simple-knowledge'
  readonly version = '1.0.0'

  /** 用户数据存储 (userId -> data) */
  private storage = new Map<string, UserKnowledgeData>()

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
    console.log('[simple-knowledge] 初始化简单知识记忆提供者')
    this.storage.clear()
    console.log('[simple-knowledge] 初始化完成')
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log('[simple-knowledge] 关闭提供者')
    this.storage.clear()
    console.log('[simple-knowledge] 已关闭')
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      latency: 0,
      details: {
        userCount: this.storage.size,
      },
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取或创建用户数据
   */
  private getUserData(userId: string): UserKnowledgeData {
    let data = this.storage.get(userId)
    if (!data) {
      data = {
        documents: new Map(),
        documentContents: new Map(),
        entities: new Map(),
        relationships: new Map(),
        communities: new Map(),
      }
      this.storage.set(userId, data)
    }
    return data
  }

  /**
   * 简单文本匹配搜索
   */
  private textMatch(text: string, query: string): number {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 0)

    if (words.length === 0) return 0

    let matchCount = 0
    for (const word of words) {
      if (lowerText.includes(word)) {
        matchCount++
      }
    }

    return matchCount / words.length
  }

  // ==================== 文档管理 ====================

  /**
   * 添加文档
   */
  async addDocument(userId: string, document: DocumentInput): Promise<string> {
    const documentId = randomUUID()
    const now = new Date()

    console.log(`[simple-knowledge] 添加文档: ${documentId} (用户: ${userId}, 标题: ${document.title})`)

    const data = this.getUserData(userId)

    // 处理文档内容
    let contentString = ''
    if (document.content) {
      if (Buffer.isBuffer(document.content)) {
        contentString = document.content.toString('utf-8')
      } else {
        // Stream - 读取所有内容
        const chunks: Buffer[] = []
        for await (const chunk of document.content) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        contentString = Buffer.concat(chunks).toString('utf-8')
      }
    }

    const doc: KnowledgeDocument = {
      id: documentId,
      title: document.title,
      source: document.source,
      objectKey: document.objectKey || `docs/${documentId}`,
      mimeType: document.mimeType,
      size: contentString.length,
      status: 'indexed', // 简化版直接标记为已索引
      chunkCount: 1, // 简化版不分块
      embeddingModel: 'none', // 简化版不使用嵌入
      metadata: document.metadata || {},
      createdAt: now,
      processedAt: now,
    }

    data.documents.set(documentId, doc)
    data.documentContents.set(documentId, contentString)

    return documentId
  }

  /**
   * 获取文档
   */
  async getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null> {
    const data = this.getUserData(userId)
    return data.documents.get(documentId) || null
  }

  /**
   * 删除文档
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    console.log(`[simple-knowledge] 删除文档: ${documentId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    data.documents.delete(documentId)
    data.documentContents.delete(documentId)
  }

  /**
   * 列出文档
   */
  async listDocuments(userId: string, options?: DocumentListOptions): Promise<KnowledgeDocument[]> {
    const data = this.getUserData(userId)
    let docs = Array.from(data.documents.values())

    // 状态过滤
    if (options?.status) {
      docs = docs.filter(d => d.status === options.status)
    }

    // 来源过滤
    if (options?.source) {
      docs = docs.filter(d => d.source === options.source)
    }

    // 排序
    const orderBy = options?.orderBy || 'createdAt'
    const order = options?.order || 'desc'
    docs.sort((a, b) => {
      let aVal: number
      let bVal: number

      if (orderBy === 'title') {
        aVal = a.title.localeCompare(b.title)
        bVal = 0
      } else {
        const aDate = orderBy === 'processedAt' ? a.processedAt : a.createdAt
        const bDate = orderBy === 'processedAt' ? b.processedAt : b.createdAt
        aVal = aDate?.getTime() || 0
        bVal = bDate?.getTime() || 0
      }

      return order === 'asc' ? aVal - bVal : bVal - aVal
    })

    // 分页
    const offset = options?.offset || 0
    const limit = options?.limit || 10

    return docs.slice(offset, offset + limit)
  }

  /**
   * 获取文档状态
   */
  async getDocumentStatus(
    userId: string,
    documentId: string
  ): Promise<{ status: DocumentStatus; progress?: number; message?: string }> {
    const data = this.getUserData(userId)
    const doc = data.documents.get(documentId)

    if (!doc) {
      return { status: 'failed', message: '文档不存在' }
    }

    return {
      status: doc.status,
      progress: doc.status === 'indexed' ? 100 : 0,
    }
  }

  // ==================== 索引管理 ====================

  /**
   * 索引文档（简化版：直接标记为已索引）
   */
  async indexDocument(userId: string, documentId: string): Promise<void> {
    console.log(`[simple-knowledge] 索引文档: ${documentId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const doc = data.documents.get(documentId)

    if (!doc) {
      throw new Error(`文档不存在: ${documentId}`)
    }

    doc.status = 'indexed'
    doc.processedAt = new Date()
  }

  /**
   * 重新索引文档
   */
  async reindexDocument(userId: string, documentId: string): Promise<void> {
    await this.indexDocument(userId, documentId)
  }

  /**
   * 重新索引所有文档
   */
  async reindexAll(userId: string): Promise<void> {
    console.log(`[simple-knowledge] 重新索引所有文档 (用户: ${userId})`)

    const data = this.getUserData(userId)
    for (const doc of data.documents.values()) {
      doc.status = 'indexed'
      doc.processedAt = new Date()
    }
  }

  // ==================== 向量搜索 ====================

  /**
   * 相似度搜索（简化版：使用文本匹配）
   */
  async searchSimilar(
    userId: string,
    query: string,
    options?: VectorSearchOptions
  ): Promise<SearchResult[]> {
    console.log(`[simple-knowledge] 搜索: "${query}" (用户: ${userId})`)

    const data = this.getUserData(userId)
    const results: SearchResult[] = []
    const minScore = options?.minScore || 0.1

    for (const [docId, content] of data.documentContents) {
      const doc = data.documents.get(docId)
      if (!doc || doc.status !== 'indexed') continue

      const score = this.textMatch(content, query)
      if (score >= minScore) {
        results.push({
          id: docId,
          content: content.slice(0, 500), // 返回前 500 字符
          score,
          documentId: docId,
          documentTitle: doc.title,
        })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    // 限制返回数量
    const limit = options?.limit || 10
    return results.slice(0, limit)
  }

  /**
   * 混合搜索（简化版：与相似度搜索相同）
   */
  async searchHybrid(
    userId: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<SearchResult[]> {
    return this.searchSimilar(userId, query, options)
  }

  // ==================== 知识图谱 ====================

  /**
   * 添加实体
   */
  async addEntity(
    userId: string,
    entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt' | 'mentionCount'>
  ): Promise<string> {
    const entityId = randomUUID()
    const now = new Date()

    console.log(`[simple-knowledge] 添加实体: ${entityId} (用户: ${userId}, 名称: ${entity.name})`)

    const data = this.getUserData(userId)
    const fullEntity: Entity = {
      ...entity,
      id: entityId,
      mentionCount: 1,
      createdAt: now,
      updatedAt: now,
    }

    data.entities.set(entityId, fullEntity)

    return entityId
  }

  /**
   * 获取实体
   */
  async getEntity(userId: string, entityId: string): Promise<Entity | null> {
    const data = this.getUserData(userId)
    return data.entities.get(entityId) || null
  }

  /**
   * 更新实体
   */
  async updateEntity(userId: string, entityId: string, updates: Partial<Entity>): Promise<void> {
    console.log(`[simple-knowledge] 更新实体: ${entityId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const entity = data.entities.get(entityId)

    if (!entity) {
      throw new Error(`实体不存在: ${entityId}`)
    }

    const updatedEntity: Entity = {
      ...entity,
      ...updates,
      id: entityId,
      createdAt: entity.createdAt,
      updatedAt: new Date(),
    }

    data.entities.set(entityId, updatedEntity)
  }

  /**
   * 删除实体
   */
  async deleteEntity(userId: string, entityId: string): Promise<void> {
    console.log(`[simple-knowledge] 删除实体: ${entityId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    data.entities.delete(entityId)

    // 删除相关关系
    for (const [relId, rel] of data.relationships) {
      if (rel.sourceId === entityId || rel.targetId === entityId) {
        data.relationships.delete(relId)
      }
    }
  }

  /**
   * 添加关系
   */
  async addRelationship(
    userId: string,
    relationship: Omit<Relationship, 'id' | 'createdAt'>
  ): Promise<string> {
    const relationshipId = randomUUID()
    const now = new Date()

    console.log(`[simple-knowledge] 添加关系: ${relationshipId} (用户: ${userId}, 类型: ${relationship.type})`)

    const data = this.getUserData(userId)
    const fullRel: Relationship = {
      ...relationship,
      id: relationshipId,
      createdAt: now,
    }

    data.relationships.set(relationshipId, fullRel)

    return relationshipId
  }

  /**
   * 获取关系
   */
  async getRelationship(userId: string, relationshipId: string): Promise<Relationship | null> {
    const data = this.getUserData(userId)
    return data.relationships.get(relationshipId) || null
  }

  /**
   * 更新关系
   */
  async updateRelationship(
    userId: string,
    relationshipId: string,
    updates: Partial<Relationship>
  ): Promise<void> {
    console.log(`[simple-knowledge] 更新关系: ${relationshipId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const rel = data.relationships.get(relationshipId)

    if (!rel) {
      throw new Error(`关系不存在: ${relationshipId}`)
    }

    const updatedRel: Relationship = {
      ...rel,
      ...updates,
      id: relationshipId,
      createdAt: rel.createdAt,
    }

    data.relationships.set(relationshipId, updatedRel)
  }

  /**
   * 删除关系
   */
  async deleteRelationship(userId: string, relationshipId: string): Promise<void> {
    console.log(`[simple-knowledge] 删除关系: ${relationshipId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    data.relationships.delete(relationshipId)
  }

  /**
   * 查询图谱
   */
  async queryGraph(userId: string, query: GraphQuery): Promise<GraphQueryResult> {
    console.log(`[simple-knowledge] 查询图谱 (用户: ${userId})`)

    const data = this.getUserData(userId)
    let nodes = Array.from(data.entities.values())
    let edges = Array.from(data.relationships.values())

    // 简单的模式匹配
    if (query.pattern) {
      if (query.pattern.entityType) {
        nodes = nodes.filter(e => e.type === query.pattern!.entityType)
      }
      if (query.pattern.relationshipType) {
        edges = edges.filter(r => r.type === query.pattern!.relationshipType)
      }
    }

    return {
      nodes,
      edges,
    }
  }

  /**
   * 获取实体上下文
   */
  async getEntityContext(userId: string, entityId: string, _depth?: number): Promise<EntityContext> {
    console.log(`[simple-knowledge] 获取实体上下文: ${entityId} (用户: ${userId})`)

    const data = this.getUserData(userId)
    const entity = data.entities.get(entityId)

    if (!entity) {
      throw new Error(`实体不存在: ${entityId}`)
    }

    // 查找相邻实体和关系
    const neighbors: Entity[] = []
    const relationships: Relationship[] = []

    for (const rel of data.relationships.values()) {
      if (rel.sourceId === entityId) {
        relationships.push(rel)
        const neighbor = data.entities.get(rel.targetId)
        if (neighbor) neighbors.push(neighbor)
      } else if (rel.targetId === entityId) {
        relationships.push(rel)
        const neighbor = data.entities.get(rel.sourceId)
        if (neighbor) neighbors.push(neighbor)
      }
    }

    return {
      entity,
      neighbors,
      relationships,
      relatedDocuments: [],
    }
  }

  // ==================== GraphRAG ====================

  /**
   * 构建社区（简化版：不实现）
   */
  async buildCommunities(userId: string): Promise<void> {
    console.log(`[simple-knowledge] 构建社区 (用户: ${userId}) - 简化版不支持`)
    // 简化版不实现社区检测
  }

  /**
   * 获取社区
   */
  async getCommunities(userId: string, _level?: number): Promise<Community[]> {
    const data = this.getUserData(userId)
    return Array.from(data.communities.values())
  }

  /**
   * 基于图谱回答问题（简化版：使用简单搜索）
   */
  async answerWithGraph(userId: string, question: string): Promise<GraphAnswer> {
    console.log(`[simple-knowledge] 基于图谱回答: "${question}" (用户: ${userId})`)

    // 简化版：搜索文档和实体
    const searchResults = await this.searchSimilar(userId, question, { limit: 3 })
    const data = this.getUserData(userId)

    // 搜索相关实体
    const matchedEntities: Entity[] = []
    for (const entity of data.entities.values()) {
      if (this.textMatch(`${entity.name} ${entity.description || ''}`, question) > 0.1) {
        matchedEntities.push(entity)
      }
    }

    // 构建简单回答
    const sources = searchResults.map(r => ({
      type: 'document' as const,
      id: r.documentId || r.id,
      content: r.content.slice(0, 200),
      relevance: r.score,
    }))

    return {
      answer: searchResults.length > 0
        ? `根据相关文档，找到以下信息：${searchResults[0].content.slice(0, 300)}...`
        : '未找到相关信息。',
      sources,
      entities: matchedEntities.slice(0, 5),
      confidence: searchResults.length > 0 ? searchResults[0].score : 0,
    }
  }

  // ==================== 对话转知识 ====================

  /**
   * 导入对话为知识
   */
  async importConversation(
    userId: string,
    sessionId: string,
    messages: Message[]
  ): Promise<{ documentId: string; entities: string[]; relationships: string[] }> {
    console.log(`[simple-knowledge] 导入对话: ${sessionId} (用户: ${userId}, 消息数: ${messages.length})`)

    // 将对话转换为文档
    const content = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n')

    const documentId = await this.addDocument(userId, {
      title: `对话记录 - ${sessionId}`,
      content: Buffer.from(content, 'utf-8'),
      mimeType: 'text/plain',
      source: 'conversation',
      metadata: { sessionId },
    })

    // 简化版不提取实体和关系
    return {
      documentId,
      entities: [],
      relationships: [],
    }
  }
}

// 自动注册提供者
registerProvider('knowledge', 'simple', SimpleKnowledgeMemoryProvider as unknown as new (options: Record<string, unknown>) => SimpleKnowledgeMemoryProvider)
