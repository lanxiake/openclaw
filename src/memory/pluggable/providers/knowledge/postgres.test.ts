/**
 * PostgreSQL 知识记忆提供者单元测试
 *
 * 使用 mock MemoryRepository 和 EmbeddingProvider 验证
 * Provider 的文档管理、向量搜索和混合搜索逻辑。
 * 不需要真实 DB 连接。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type { UserMemory } from "../../../../db/schema/memories.js";

// ==================== Mock Repository ====================

/**
 * 创建 mock MemoryRepository
 */
function createMockMemoryRepo() {
  return {
    tenantId: "user-123",
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    searchByVector: vi.fn(),
  };
}

// ==================== Mock Embedding Provider ====================

/**
 * 创建 mock EmbeddingProvider
 */
function createMockEmbeddingProvider() {
  const fakeEmbedding = Array.from({ length: 1536 }, () => Math.random());
  return {
    id: "openai",
    model: "text-embedding-3-small",
    embedQuery: vi.fn().mockResolvedValue(fakeEmbedding),
    embedBatch: vi.fn().mockResolvedValue([fakeEmbedding]),
  };
}

// ==================== Mock DB Record 工厂 ====================

/**
 * 创建模拟的 knowledge document 记忆记录
 */
function createMockDocumentRecord(overrides?: Partial<UserMemory>): UserMemory {
  return {
    id: "mem-doc-001",
    userId: "user-123",
    type: "knowledge",
    category: "document",
    content: "这是一篇关于微服务架构的技术文档",
    summary: "微服务架构文档",
    embedding: null,
    importance: 5,
    sourceType: "upload",
    sourceId: "doc-001",
    metadata: {
      title: "微服务架构指南",
      mimeType: "text/plain",
      source: "upload",
      status: "indexed",
      size: 100,
      chunkCount: 1,
      embeddingModel: "text-embedding-3-small",
    },
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:30:00Z"),
    ...overrides,
  };
}

// ==================== 测试 ====================

describe("PostgresKnowledgeMemoryProvider", () => {
  let provider: any;
  let mockMemoryRepo: ReturnType<typeof createMockMemoryRepo>;
  let mockEmbeddingProvider: ReturnType<typeof createMockEmbeddingProvider>;
  let mockDb: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();

    mockMemoryRepo = createMockMemoryRepo();
    mockEmbeddingProvider = createMockEmbeddingProvider();
    mockDb = {};

    // Mock MemoryRepository 工厂函数
    vi.doMock("../../../../db/repositories/memories.js", () => ({
      getMemoryRepository: vi.fn().mockReturnValue(mockMemoryRepo),
      MemoryRepository: vi.fn(),
    }));

    // Mock factory 注册
    vi.doMock("../factory.js", () => ({
      registerProvider: vi.fn(),
    }));

    // Mock embeddings（返回 mock provider）
    vi.doMock("../../../embeddings.js", () => ({
      createEmbeddingProvider: vi.fn().mockResolvedValue({
        provider: mockEmbeddingProvider,
      }),
    }));

    // 动态导入被测模块
    const mod = await import("./postgres.js");

    // 通过 embeddingProvider 直接注入 mock（绕过 createEmbeddingProvider）
    provider = new mod.PostgresKnowledgeMemoryProvider({
      db: mockDb,
      embeddingProvider: mockEmbeddingProvider,
    });
    await provider.initialize();
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("应该正确初始化", () => {
      expect(provider.name).toBe("postgres-knowledge");
      expect(provider.version).toBe("1.0.0");
    });

    it("健康检查应该返回 healthy", async () => {
      const health = await provider.healthCheck();
      expect(health.status).toBe("healthy");
    });

    it("关闭后不应抛出异常", async () => {
      await expect(provider.shutdown()).resolves.not.toThrow();
    });
  });

  // ==================== 文档管理 ====================

  describe("文档管理", () => {
    it("addDocument 应该创建 knowledge/document 记忆", async () => {
      mockMemoryRepo.create.mockResolvedValue(createMockDocumentRecord());

      const docId = await provider.addDocument("user-123", {
        title: "微服务架构指南",
        mimeType: "text/plain",
        source: "upload",
        content: Buffer.from("这是一篇关于微服务架构的技术文档"),
      });

      expect(mockMemoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "knowledge",
          category: "document",
        }),
      );
      expect(docId).toBe("mem-doc-001");
    });

    it("getDocument 应该返回转换后的 KnowledgeDocument", async () => {
      mockMemoryRepo.findById.mockResolvedValue(createMockDocumentRecord());

      const doc = await provider.getDocument("user-123", "mem-doc-001");

      expect(doc).not.toBeNull();
      expect(doc!.id).toBe("mem-doc-001");
      expect(doc!.title).toBe("微服务架构指南");
      expect(doc!.source).toBe("upload");
      expect(doc!.status).toBe("indexed");
    });

    it("getDocument 不存在时应该返回 null", async () => {
      mockMemoryRepo.findById.mockResolvedValue(null);

      const doc = await provider.getDocument("user-123", "not-exist");

      expect(doc).toBeNull();
    });

    it("deleteDocument 应该调用 deactivate", async () => {
      mockMemoryRepo.deactivate.mockResolvedValue(undefined);

      await provider.deleteDocument("user-123", "mem-doc-001");

      expect(mockMemoryRepo.deactivate).toHaveBeenCalledWith("mem-doc-001");
    });

    it("listDocuments 应该返回转换后的文档列表", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockDocumentRecord()],
        total: 1,
      });

      const docs = await provider.listDocuments("user-123");

      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("微服务架构指南");
    });
  });

  // ==================== 向量搜索 ====================

  describe("searchSimilar", () => {
    it("应该调用 embedding provider 向量化 query 并执行向量搜索", async () => {
      const vectorResults = [{ ...createMockDocumentRecord(), score: 0.92 }];
      mockMemoryRepo.searchByVector.mockResolvedValue(vectorResults);

      const results = await provider.searchSimilar("user-123", "微服务架构");

      // 应调用 embedQuery
      expect(mockEmbeddingProvider.embedQuery).toHaveBeenCalledWith("微服务架构");
      // 应调用 searchByVector
      expect(mockMemoryRepo.searchByVector).toHaveBeenCalled();
      // 应返回结果
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.92);
      expect(results[0].content).toBe("这是一篇关于微服务架构的技术文档");
    });

    it("应该尊重 minScore 过滤", async () => {
      mockMemoryRepo.searchByVector.mockResolvedValue([]);

      const results = await provider.searchSimilar("user-123", "测试", {
        minScore: 0.8,
        limit: 5,
      });

      expect(results).toEqual([]);
      expect(mockMemoryRepo.searchByVector).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          type: "knowledge",
          minScore: 0.8,
          limit: 5,
        }),
      );
    });

    it("无 embedding provider 时应降级为文本搜索", async () => {
      vi.resetModules();

      vi.doMock("../../../../db/repositories/memories.js", () => ({
        getMemoryRepository: vi.fn().mockReturnValue(mockMemoryRepo),
        MemoryRepository: vi.fn(),
      }));

      vi.doMock("../factory.js", () => ({
        registerProvider: vi.fn(),
      }));

      const mod = await import("./postgres.js");
      // 不传 embeddingProvider 和 cfg
      const noEmbedProvider = new mod.PostgresKnowledgeMemoryProvider({ db: mockDb });
      await noEmbedProvider.initialize();

      // 文本搜索需要 findAll 返回数据
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockDocumentRecord({ content: "测试内容包含关键词" })],
        total: 1,
      });

      const results = await noEmbedProvider.searchSimilar("user-123", "测试");

      // 应降级为文本搜索（匹配到"测试"关键词）
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==================== 混合搜索 ====================

  describe("searchHybrid", () => {
    it("应该结合向量搜索和文本搜索", async () => {
      const vectorResults = [{ ...createMockDocumentRecord({ id: "doc-1" }), score: 0.9 }];
      mockMemoryRepo.searchByVector.mockResolvedValue(vectorResults);
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockDocumentRecord({ id: "doc-2", content: "微服务部署文档" })],
        total: 1,
      });

      const results = await provider.searchHybrid("user-123", "微服务");

      expect(results.length).toBeGreaterThan(0);
    });

    it("无 embedding provider 时应回退为纯文本搜索", async () => {
      vi.resetModules();

      vi.doMock("../../../../db/repositories/memories.js", () => ({
        getMemoryRepository: vi.fn().mockReturnValue(mockMemoryRepo),
        MemoryRepository: vi.fn(),
      }));

      vi.doMock("../factory.js", () => ({
        registerProvider: vi.fn(),
      }));

      const mod = await import("./postgres.js");
      // 不传 embeddingProvider 和 cfg
      const noEmbedProvider = new mod.PostgresKnowledgeMemoryProvider({ db: mockDb });
      await noEmbedProvider.initialize();

      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockDocumentRecord({ content: "微服务文档内容" })],
        total: 1,
      });

      const results = await noEmbedProvider.searchHybrid("user-123", "微服务");

      // 应降级为纯文本搜索
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==================== 文档状态 ====================

  describe("getDocumentStatus", () => {
    it("应该返回文档的处理状态", async () => {
      mockMemoryRepo.findById.mockResolvedValue(createMockDocumentRecord());

      const status = await provider.getDocumentStatus("user-123", "mem-doc-001");

      expect(status.status).toBe("indexed");
    });

    it("文档不存在时应返回 failed 状态", async () => {
      mockMemoryRepo.findById.mockResolvedValue(null);

      const status = await provider.getDocumentStatus("user-123", "not-exist");

      expect(status.status).toBe("failed");
      expect(status.message).toContain("不存在");
    });
  });
});
