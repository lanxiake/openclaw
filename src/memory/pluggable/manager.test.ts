/**
 * 记忆管理器单元测试
 *
 * 验证 MemoryManager 的生命周期管理、健康检查和提供者集成。
 * 使用内存提供者（无需外部服务）。
 *
 * @module memory/pluggable
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { MemoryManager } from "./manager.js";
import { DEFAULT_DEV_CONFIG } from "./config/schema.js";

// 确保内置提供者已注册
import "./providers/index.js";

describe("MemoryManager", () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager({
      config: DEFAULT_DEV_CONFIG,
    });
  });

  afterEach(async () => {
    if (manager.status !== "shutdown") {
      await manager.shutdown();
    }
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("创建后状态应该是 uninitialized", () => {
      expect(manager.status).toBe("uninitialized");
    });

    it("初始化后状态应该是 ready", async () => {
      await manager.initialize();

      expect(manager.status).toBe("ready");
    });

    it("重复初始化不应抛出异常", async () => {
      await manager.initialize();
      await manager.initialize();

      expect(manager.status).toBe("ready");
    });

    it("关闭后状态应该是 shutdown", async () => {
      await manager.initialize();
      await manager.shutdown();

      expect(manager.status).toBe("shutdown");
    });

    it("重复关闭不应抛出异常", async () => {
      await manager.initialize();
      await manager.shutdown();
      await manager.shutdown();

      expect(manager.status).toBe("shutdown");
    });
  });

  // ==================== 提供者访问 ====================

  describe("提供者访问", () => {
    it("初始化后应该能访问 episodic 提供者", async () => {
      await manager.initialize();

      expect(manager.episodic).toBeDefined();
      expect(manager.episodic.name).toBe("memory-episodic");
    });

    it("初始化后应该能访问 profile 提供者", async () => {
      await manager.initialize();

      expect(manager.profile).toBeDefined();
      expect(manager.profile.name).toBe("memory-profile");
    });

    it("初始化后应该能访问 knowledge 提供者", async () => {
      await manager.initialize();

      expect(manager.knowledge).toBeDefined();
      expect(manager.knowledge.name).toBe("simple-knowledge");
    });

    it("未初始化时访问提供者应该抛出异常", () => {
      expect(() => manager.episodic).toThrow("MemoryManager 未初始化");
      expect(() => manager.profile).toThrow("MemoryManager 未初始化");
      expect(() => manager.knowledge).toThrow("MemoryManager 未初始化");
    });

    it("关闭后访问提供者应该抛出异常", async () => {
      await manager.initialize();
      await manager.shutdown();

      expect(() => manager.episodic).toThrow("MemoryManager 已关闭");
      expect(() => manager.profile).toThrow("MemoryManager 已关闭");
      expect(() => manager.knowledge).toThrow("MemoryManager 已关闭");
    });
  });

  // ==================== 健康检查 ====================

  describe("健康检查", () => {
    it("初始化后健康检查应该返回 ready", async () => {
      await manager.initialize();

      const report = await manager.healthCheck();

      expect(report.status).toBe("ready");
      expect(report.checkedAt).toBeInstanceOf(Date);
    });

    it("健康检查应该包含所有提供者状态", async () => {
      await manager.initialize();

      const report = await manager.healthCheck();

      expect(report.providers.episodic).toBeDefined();
      expect(report.providers.profile).toBeDefined();
      expect(report.providers.knowledge).toBeDefined();
    });

    it("关闭后健康检查应该返回 shutdown", async () => {
      await manager.initialize();
      await manager.shutdown();

      const report = await manager.healthCheck();

      expect(report.status).toBe("shutdown");
    });
  });

  // ==================== Episodic 提供者功能验证 ====================

  describe("Episodic 提供者功能", () => {
    it("应该能通过 manager.episodic 添加对话并生成摘要", async () => {
      await manager.initialize();

      const messages = [
        { role: "user" as const, content: "讨论架构设计" },
        { role: "assistant" as const, content: "建议采用微服务" },
      ];

      await manager.episodic.addConversation("user-test", "session-001", messages);

      // 内存提供者需先调用 summarize 生成摘要
      const summary = await manager.episodic.summarizeConversation("user-test", "session-001");

      expect(summary).toBeDefined();
      expect(summary.sessionId).toBe("session-001");
      expect(summary.messageCount).toBe(2);

      // 摘要生成后，getConversationHistory 才能查到
      const history = await manager.episodic.getConversationHistory("user-test");

      expect(history.length).toBeGreaterThanOrEqual(1);
      const found = history.find((h) => h.sessionId === "session-001");
      expect(found).toBeDefined();
    });

    it("应该能通过 manager.episodic 添加和查询关键事件", async () => {
      await manager.initialize();

      const eventId = await manager.episodic.addKeyEvent("user-test", {
        type: "milestone",
        description: "v1.0 发布",
        context: "首次正式版本发布",
        importance: 0.9,
        relatedSessions: [],
        timestamp: new Date(),
      });

      expect(eventId).toBeDefined();

      const events = await manager.episodic.getKeyEvents("user-test");

      expect(events.length).toBeGreaterThanOrEqual(1);
      const found = events.find((e) => e.id === eventId);
      expect(found).toBeDefined();
      expect(found!.type).toBe("milestone");
    });

    it("应该能通过 manager.episodic 搜索情节", async () => {
      await manager.initialize();

      // 添加包含"架构"关键词的对话并生成摘要
      const messages = [
        { role: "user" as const, content: "我们来讨论系统架构" },
        { role: "assistant" as const, content: "好的，架构设计是关键" },
      ];
      await manager.episodic.addConversation("user-search", "session-search", messages);
      await manager.episodic.summarizeConversation("user-search", "session-search");

      const results = await manager.episodic.searchEpisodes("user-search", "架构");

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("应该能通过 manager.episodic 获取时间线", async () => {
      await manager.initialize();

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 86400000);
      const dayAfter = new Date(now.getTime() + 86400000);

      // 添加对话并生成摘要
      await manager.episodic.addConversation("user-timeline", "session-tl", [
        { role: "user" as const, content: "时间线测试对话" },
      ]);
      await manager.episodic.summarizeConversation("user-timeline", "session-tl");

      // 添加事件
      await manager.episodic.addKeyEvent("user-timeline", {
        type: "task_completed",
        description: "完成时间线测试",
        context: "测试上下文",
        importance: 0.5,
        relatedSessions: [],
        timestamp: now,
      });

      const timeline = await manager.episodic.getTimeline("user-timeline", dayAgo, dayAfter);

      expect(timeline.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Profile 提供者功能验证 ====================

  describe("Profile 提供者功能", () => {
    it("应该能通过 manager.profile 添加和查询事实", async () => {
      await manager.initialize();

      const factId = await manager.profile.addFact("user-test", {
        category: "work",
        key: "company",
        value: "TestCorp",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
      });

      expect(factId).toBeDefined();

      const facts = await manager.profile.getFacts("user-test", "work");

      expect(facts.length).toBeGreaterThanOrEqual(1);
      const found = facts.find((f) => f.id === factId);
      expect(found).toBeDefined();
      expect(found!.value).toBe("TestCorp");
    });

    it("应该能通过 manager.profile 管理偏好", async () => {
      await manager.initialize();

      const prefs = await manager.profile.getPreferences("user-test");

      expect(prefs).toBeDefined();
      expect(prefs.language).toBe("zh-CN");

      await manager.profile.updatePreferences("user-test", {
        language: "en-US",
      });

      const updated = await manager.profile.getPreferences("user-test");

      expect(updated.language).toBe("en-US");
    });

    it("应该能通过 manager.profile 管理行为模式", async () => {
      await manager.initialize();

      const patternId = await manager.profile.addPattern("user-test", {
        type: "work_style",
        pattern: "偏好 TDD 工作流",
        evidence: ["总是先写测试"],
        confidence: 0.7,
      });

      expect(patternId).toBeDefined();

      const patterns = await manager.profile.getPatterns("user-test");

      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it("应该能通过 manager.profile 导出画像", async () => {
      await manager.initialize();

      // 添加数据
      await manager.profile.addFact("user-export", {
        category: "personal",
        key: "name",
        value: "测试用户",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });

      const profile = await manager.profile.exportProfile("user-export");

      expect(profile.facts).toBeDefined();
      expect(profile.preferences).toBeDefined();
      expect(profile.patterns).toBeDefined();
    });
  });

  // ==================== Knowledge 提供者功能验证 ====================

  describe("Knowledge 提供者功能", () => {
    it("应该能通过 manager.knowledge 添加和获取文档", async () => {
      await manager.initialize();

      const docId = await manager.knowledge.addDocument("user-test", {
        title: "TypeScript 指南",
        content: Buffer.from("TypeScript 是一种强类型的 JavaScript 超集"),
        mimeType: "text/plain",
        source: "upload",
      });

      expect(docId).toBeDefined();
      expect(typeof docId).toBe("string");

      const doc = await manager.knowledge.getDocument("user-test", docId);

      expect(doc).not.toBeNull();
      expect(doc!.id).toBe(docId);
      expect(doc!.title).toBe("TypeScript 指南");
      expect(doc!.mimeType).toBe("text/plain");
      expect(doc!.source).toBe("upload");
    });

    it("应该能通过 manager.knowledge 列出和删除文档", async () => {
      await manager.initialize();

      const docId1 = await manager.knowledge.addDocument("user-test", {
        title: "文档A",
        mimeType: "text/plain",
        source: "upload",
      });
      await manager.knowledge.addDocument("user-test", {
        title: "文档B",
        mimeType: "application/pdf",
        source: "conversation",
      });

      const docs = await manager.knowledge.listDocuments("user-test");
      expect(docs).toHaveLength(2);

      // 删除第一个文档
      await manager.knowledge.deleteDocument("user-test", docId1);

      const remaining = await manager.knowledge.listDocuments("user-test");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe("文档B");
    });

    it("应该能通过 manager.knowledge 搜索文档", async () => {
      await manager.initialize();

      await manager.knowledge.addDocument("user-search", {
        title: "TypeScript 教程",
        content: Buffer.from("TypeScript 是一种强类型的编程语言"),
        mimeType: "text/plain",
        source: "upload",
      });
      await manager.knowledge.addDocument("user-search", {
        title: "Python 入门",
        content: Buffer.from("Python 是一种解释型语言"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await manager.knowledge.searchSimilar("user-search", "TypeScript");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].documentTitle).toBe("TypeScript 教程");
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("应该能通过 manager.knowledge 获取文档状态", async () => {
      await manager.initialize();

      const docId = await manager.knowledge.addDocument("user-test", {
        title: "状态测试文档",
        mimeType: "text/plain",
        source: "upload",
      });

      const status = await manager.knowledge.getDocumentStatus("user-test", docId);

      expect(status.status).toBe("indexed");
      expect(status.progress).toBe(100);
    });

    it("应该能通过 manager.knowledge 索引和重新索引文档", async () => {
      await manager.initialize();

      const docId = await manager.knowledge.addDocument("user-test", {
        title: "索引测试",
        content: Buffer.from("需要被索引的内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      // 重新索引单个文档
      await manager.knowledge.reindexDocument("user-test", docId);

      const doc = await manager.knowledge.getDocument("user-test", docId);
      expect(doc!.status).toBe("indexed");
      expect(doc!.processedAt).toBeDefined();

      // 重新索引全部
      await manager.knowledge.reindexAll("user-test");

      const docs = await manager.knowledge.listDocuments("user-test");
      for (const d of docs) {
        expect(d.status).toBe("indexed");
      }
    });
  });
});
