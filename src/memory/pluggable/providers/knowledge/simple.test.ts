/**
 * 简单知识记忆提供者单元测试
 *
 * 验证 SimpleKnowledgeMemoryProvider 的文档管理、索引管理和搜索功能。
 * 使用内存存储，不需要外部依赖。
 *
 * @module memory/pluggable/providers/knowledge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SimpleKnowledgeMemoryProvider } from "./simple.js";

describe("SimpleKnowledgeMemoryProvider", () => {
  let provider: SimpleKnowledgeMemoryProvider;

  beforeEach(async () => {
    provider = new SimpleKnowledgeMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("应该正确初始化", () => {
      expect(provider.name).toBe("simple-knowledge");
      expect(provider.version).toBe("1.0.0");
    });

    it("健康检查应该返回 healthy", async () => {
      const health = await provider.healthCheck();

      expect(health.status).toBe("healthy");
      expect(health.latency).toBe(0);
    });

    it("关闭后不应抛出异常", async () => {
      await expect(provider.shutdown()).resolves.not.toThrow();
    });

    it("重复初始化不应抛出异常", async () => {
      await provider.initialize();

      const health = await provider.healthCheck();
      expect(health.status).toBe("healthy");
    });
  });

  // ==================== 工厂创建 ====================

  describe("工厂创建", () => {
    it("实例应该实现 IKnowledgeMemoryProvider 接口所有方法", () => {
      const requiredMethods = [
        "addDocument",
        "getDocument",
        "deleteDocument",
        "listDocuments",
        "getDocumentStatus",
        "indexDocument",
        "reindexDocument",
        "reindexAll",
        "searchSimilar",
        "searchHybrid",
      ];

      for (const method of requiredMethods) {
        expect(typeof (provider as any)[method]).toBe("function");
      }
    });
  });

  // ==================== 文档管理 ====================

  describe("文档管理", () => {
    it("应该添加文档并返回 ID", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "测试文档",
        content: Buffer.from("这是一个测试文档的内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      expect(docId).toBeDefined();
      expect(typeof docId).toBe("string");
    });

    it("应该获取已添加的文档", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "测试文档",
        content: Buffer.from("内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      const doc = await provider.getDocument("user-123", docId);

      expect(doc).not.toBeNull();
      expect(doc!.id).toBe(docId);
      expect(doc!.title).toBe("测试文档");
      expect(doc!.mimeType).toBe("text/plain");
      expect(doc!.source).toBe("upload");
      expect(doc!.status).toBe("indexed");
    });

    it("获取不存在的文档应返回 null", async () => {
      const doc = await provider.getDocument("user-123", "non-existent");

      expect(doc).toBeNull();
    });

    it("应该删除文档", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "将被删除",
        mimeType: "text/plain",
        source: "upload",
      });

      await provider.deleteDocument("user-123", docId);

      const doc = await provider.getDocument("user-123", docId);
      expect(doc).toBeNull();
    });

    it("应该列出文档", async () => {
      await provider.addDocument("user-123", {
        title: "文档A",
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-123", {
        title: "文档B",
        mimeType: "application/pdf",
        source: "conversation",
      });

      const docs = await provider.listDocuments("user-123");

      expect(docs).toHaveLength(2);
    });

    it("应该按来源过滤文档列表", async () => {
      await provider.addDocument("user-123", {
        title: "上传文档",
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-123", {
        title: "对话文档",
        mimeType: "text/plain",
        source: "conversation",
      });

      const docs = await provider.listDocuments("user-123", { source: "upload" });

      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("上传文档");
    });

    it("应该按状态过滤文档列表", async () => {
      await provider.addDocument("user-123", {
        title: "已索引文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const docs = await provider.listDocuments("user-123", { status: "indexed" });

      expect(docs).toHaveLength(1);

      const pendingDocs = await provider.listDocuments("user-123", { status: "pending" });

      expect(pendingDocs).toHaveLength(0);
    });

    it("应该支持文档列表分页", async () => {
      for (let i = 0; i < 5; i++) {
        await provider.addDocument("user-123", {
          title: `文档${i}`,
          mimeType: "text/plain",
          source: "upload",
        });
      }

      const page1 = await provider.listDocuments("user-123", { limit: 2, offset: 0 });
      const page2 = await provider.listDocuments("user-123", { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it("应该获取文档状态", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const status = await provider.getDocumentStatus("user-123", docId);

      expect(status.status).toBe("indexed");
      expect(status.progress).toBe(100);
    });

    it("获取不存在文档的状态应返回 failed", async () => {
      const status = await provider.getDocumentStatus("user-123", "non-existent");

      expect(status.status).toBe("failed");
      expect(status.message).toBe("文档不存在");
    });

    it("不同用户的文档应该隔离", async () => {
      await provider.addDocument("user-A", {
        title: "用户A的文档",
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-B", {
        title: "用户B的文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const docsA = await provider.listDocuments("user-A");
      const docsB = await provider.listDocuments("user-B");

      expect(docsA).toHaveLength(1);
      expect(docsA[0].title).toBe("用户A的文档");
      expect(docsB).toHaveLength(1);
      expect(docsB[0].title).toBe("用户B的文档");
    });
  });

  // ==================== 索引管理 ====================

  describe("索引管理", () => {
    it("indexDocument 应该将文档标记为 indexed", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      await provider.indexDocument("user-123", docId);

      const doc = await provider.getDocument("user-123", docId);
      expect(doc!.status).toBe("indexed");
      expect(doc!.processedAt).toBeDefined();
    });

    it("indexDocument 对不存在的文档应该抛出错误", async () => {
      await expect(provider.indexDocument("user-123", "non-existent")).rejects.toThrow(
        "文档不存在",
      );
    });

    it("reindexDocument 应该重新索引文档", async () => {
      const docId = await provider.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      await provider.reindexDocument("user-123", docId);

      const doc = await provider.getDocument("user-123", docId);
      expect(doc!.status).toBe("indexed");
    });

    it("reindexAll 应该重新索引所有文档", async () => {
      await provider.addDocument("user-123", {
        title: "文档1",
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-123", {
        title: "文档2",
        mimeType: "text/plain",
        source: "upload",
      });

      await provider.reindexAll("user-123");

      const docs = await provider.listDocuments("user-123");
      for (const doc of docs) {
        expect(doc.status).toBe("indexed");
        expect(doc.processedAt).toBeDefined();
      }
    });
  });

  // ==================== 搜索 ====================

  describe("搜索", () => {
    it("searchSimilar 应该返回匹配结果", async () => {
      await provider.addDocument("user-123", {
        title: "TypeScript 指南",
        content: Buffer.from("TypeScript 是一种强类型的 JavaScript 超集"),
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-123", {
        title: "Python 教程",
        content: Buffer.from("Python 是一种解释型编程语言"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await provider.searchSimilar("user-123", "TypeScript");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].documentTitle).toBe("TypeScript 指南");
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("searchSimilar 应该按分数排序", async () => {
      await provider.addDocument("user-123", {
        title: "TypeScript 基础",
        content: Buffer.from("TypeScript TypeScript TypeScript 全面解析"),
        mimeType: "text/plain",
        source: "upload",
      });
      await provider.addDocument("user-123", {
        title: "混合文档",
        content: Buffer.from("一些关于 TypeScript 和 Python 的内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await provider.searchSimilar("user-123", "TypeScript");

      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it("searchSimilar 应该支持 limit 参数", async () => {
      for (let i = 0; i < 5; i++) {
        await provider.addDocument("user-123", {
          title: `文档${i}`,
          content: Buffer.from(`包含关键词 test 的文档内容 ${i}`),
          mimeType: "text/plain",
          source: "upload",
        });
      }

      const results = await provider.searchSimilar("user-123", "test", { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("searchSimilar 无匹配时应返回空数组", async () => {
      await provider.addDocument("user-123", {
        title: "测试文档",
        content: Buffer.from("完全不相关的内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await provider.searchSimilar("user-123", "xyznotexist");

      expect(results).toEqual([]);
    });

    it("searchHybrid 应该返回结果（简化版与 searchSimilar 相同）", async () => {
      await provider.addDocument("user-123", {
        title: "混合搜索测试",
        content: Buffer.from("这是混合搜索的测试内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await provider.searchHybrid("user-123", "混合搜索");

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
