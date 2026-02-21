/**
 * SQLite 知识记忆适配器测试
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteKnowledgeMemoryAdapter } from "./sqlite-adapter.js";

describe("SQLiteKnowledgeMemoryAdapter", () => {
  let adapter: SQLiteKnowledgeMemoryAdapter;

  beforeEach(() => {
    // 创建不带 MemoryIndexManager 的适配器（使用空实现）
    adapter = new SQLiteKnowledgeMemoryAdapter({});
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.shutdown();
    }
  });

  describe("生命周期", () => {
    it("应该成功初始化", async () => {
      await adapter.initialize();
      const health = await adapter.healthCheck();
      // 没有 MemoryIndexManager 时返回降级状态
      expect(health.status).toBe("degraded");
    });

    it("应该成功关闭", async () => {
      await adapter.initialize();
      await adapter.shutdown();
      const health = await adapter.healthCheck();
      expect(health.status).toBe("unhealthy");
    });

    it("应该能重复初始化", async () => {
      await adapter.initialize();
      await adapter.initialize();
      const health = await adapter.healthCheck();
      expect(health.status).toBe("degraded");
    });

    it("应该能重复关闭", async () => {
      await adapter.initialize();
      await adapter.shutdown();
      await adapter.shutdown();
    });
  });

  describe("文档管理", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该添加文档", async () => {
      const docId = await adapter.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      expect(docId).toBeDefined();
      expect(typeof docId).toBe("string");
    });

    it("应该获取文档", async () => {
      const docId = await adapter.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const doc = await adapter.getDocument("user-123", docId);
      expect(doc).not.toBeNull();
      expect(doc?.title).toBe("测试文档");
      expect(doc?.source).toBe("upload");
    });

    it("应该返回 null 对于不存在的文档", async () => {
      const doc = await adapter.getDocument("user-123", "non-existent");
      expect(doc).toBeNull();
    });

    it("应该删除文档", async () => {
      const docId = await adapter.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      await adapter.deleteDocument("user-123", docId);
      const doc = await adapter.getDocument("user-123", docId);
      expect(doc).toBeNull();
    });

    it("应该列出文档", async () => {
      await adapter.addDocument("user-123", {
        title: "文档1",
        mimeType: "text/plain",
        source: "upload",
      });
      await adapter.addDocument("user-123", {
        title: "文档2",
        mimeType: "text/plain",
        source: "conversation",
      });

      const docs = await adapter.listDocuments("user-123");
      expect(docs).toHaveLength(2);
    });

    it("应该按来源过滤文档", async () => {
      await adapter.addDocument("user-123", {
        title: "上传文档",
        mimeType: "text/plain",
        source: "upload",
      });
      await adapter.addDocument("user-123", {
        title: "对话文档",
        mimeType: "text/plain",
        source: "conversation",
      });

      const docs = await adapter.listDocuments("user-123", { source: "upload" });
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("上传文档");
    });

    it("应该获取文档状态", async () => {
      const docId = await adapter.addDocument("user-123", {
        title: "测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const status = await adapter.getDocumentStatus("user-123", docId);
      expect(status.status).toBe("pending");
    });
  });

  describe("搜索功能", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该返回空结果（无 MemoryIndexManager）", async () => {
      const results = await adapter.searchSimilar("user-123", "测试查询");
      expect(results).toEqual([]);
    });

    it("应该返回空结果（混合搜索）", async () => {
      const results = await adapter.searchHybrid("user-123", "测试查询");
      expect(results).toEqual([]);
    });
  });
});
