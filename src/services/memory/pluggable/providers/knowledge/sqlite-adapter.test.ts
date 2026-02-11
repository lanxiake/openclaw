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

  describe("实体管理", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该添加实体", async () => {
      const entityId = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: { age: 30 },
      });

      expect(entityId).toBeDefined();
      expect(typeof entityId).toBe("string");
    });

    it("应该获取实体", async () => {
      const entityId = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: { age: 30 },
      });

      const entity = await adapter.getEntity("user-123", entityId);
      expect(entity).not.toBeNull();
      expect(entity?.name).toBe("张三");
      expect(entity?.type).toBe("person");
    });

    it("应该更新实体", async () => {
      const entityId = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: { age: 30 },
      });

      await adapter.updateEntity("user-123", entityId, { name: "李四" });
      const entity = await adapter.getEntity("user-123", entityId);
      expect(entity?.name).toBe("李四");
    });

    it("应该删除实体", async () => {
      const entityId = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });

      await adapter.deleteEntity("user-123", entityId);
      const entity = await adapter.getEntity("user-123", entityId);
      expect(entity).toBeNull();
    });
  });

  describe("关系管理", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该添加关系", async () => {
      const entity1 = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      const entity2 = await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      const relId = await adapter.addRelationship("user-123", {
        sourceId: entity1,
        targetId: entity2,
        type: "works_at",
        properties: {},
        weight: 0.9,
      });

      expect(relId).toBeDefined();
    });

    it("应该获取关系", async () => {
      const entity1 = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      const entity2 = await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      const relId = await adapter.addRelationship("user-123", {
        sourceId: entity1,
        targetId: entity2,
        type: "works_at",
        properties: {},
        weight: 0.9,
      });

      const rel = await adapter.getRelationship("user-123", relId);
      expect(rel).not.toBeNull();
      expect(rel?.type).toBe("works_at");
    });

    it("应该删除实体时同时删除相关关系", async () => {
      const entity1 = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      const entity2 = await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      const relId = await adapter.addRelationship("user-123", {
        sourceId: entity1,
        targetId: entity2,
        type: "works_at",
        properties: {},
        weight: 0.9,
      });

      await adapter.deleteEntity("user-123", entity1);

      const rel = await adapter.getRelationship("user-123", relId);
      expect(rel).toBeNull();
    });
  });

  describe("图谱查询", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该查询图谱", async () => {
      await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      const result = await adapter.queryGraph("user-123", {});
      expect(result.nodes).toHaveLength(2);
    });

    it("应该按实体类型过滤", async () => {
      await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      const result = await adapter.queryGraph("user-123", {
        pattern: { entityType: "person" },
      });
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe("person");
    });

    it("应该获取实体上下文", async () => {
      const entity1 = await adapter.addEntity("user-123", {
        name: "张三",
        type: "person",
        properties: {},
      });
      const entity2 = await adapter.addEntity("user-123", {
        name: "公司A",
        type: "organization",
        properties: {},
      });

      await adapter.addRelationship("user-123", {
        sourceId: entity1,
        targetId: entity2,
        type: "works_at",
        properties: {},
        weight: 0.9,
      });

      const context = await adapter.getEntityContext("user-123", entity1);
      expect(context.entity.name).toBe("张三");
      expect(context.neighbors).toHaveLength(1);
      expect(context.relationships).toHaveLength(1);
    });
  });

  describe("GraphRAG 功能", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该返回空社区列表（存根实现）", async () => {
      const communities = await adapter.getCommunities("user-123");
      expect(communities).toEqual([]);
    });

    it("应该基于图谱回答问题", async () => {
      const answer = await adapter.answerWithGraph("user-123", "测试问题");
      expect(answer.answer).toBeDefined();
      expect(answer.confidence).toBeDefined();
    });
  });

  describe("对话导入", () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it("应该导入对话为知识", async () => {
      const result = await adapter.importConversation("user-123", "session-1", [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi there!",
          createdAt: new Date(),
        },
      ]);

      expect(result.documentId).toBeDefined();
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);

      // 验证文档已创建
      const doc = await adapter.getDocument("user-123", result.documentId);
      expect(doc).not.toBeNull();
      expect(doc?.source).toBe("conversation");
    });
  });
});
