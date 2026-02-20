/**
 * PostgreSQL 情节记忆提供者单元测试
 *
 * 使用 mock MemoryRepository 验证 Provider 的接口映射逻辑。
 * 不需要真实 DB 连接。
 *
 * @module memory/pluggable/providers/episodic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type { UserMemory } from "../../../db/schema/memories.js";
import type {
  ConversationSummary,
  KeyEvent,
  EpisodeSearchResult,
  TimelineEntry,
} from "../../interfaces/episodic-memory.js";

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
  };
}

// ==================== Mock DB Record 工厂 ====================

/**
 * 创建模拟的 conversation 类型记忆记录
 */
function createMockConversationRecord(overrides?: Partial<UserMemory>): UserMemory {
  return {
    id: "mem-conv-001",
    userId: "user-123",
    type: "episodic",
    category: "conversation",
    content: "讨论了项目架构设计方案",
    summary: "关于微服务 vs 单体架构的讨论",
    embedding: null,
    importance: 5,
    sourceType: "conversation",
    sourceId: "session-001",
    metadata: {
      sessionId: "session-001",
      keyTopics: ["架构", "微服务"],
      decisions: ["采用微服务架构"],
      messageCount: 10,
      tokenCount: 2000,
    },
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:30:00Z"),
    ...overrides,
  };
}

/**
 * 创建模拟的 event 类型记忆记录
 */
function createMockEventRecord(overrides?: Partial<UserMemory>): UserMemory {
  return {
    id: "mem-evt-001",
    userId: "user-123",
    type: "episodic",
    category: "event",
    content: "完成了 CI/CD 流水线配置",
    summary: null,
    embedding: null,
    importance: 8,
    sourceType: "system",
    sourceId: null,
    metadata: {
      eventType: "task_completed",
      context: "配置了 GitHub Actions 自动部署",
      relatedSessions: ["session-001"],
    },
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2025-06-02T14:00:00Z"),
    updatedAt: new Date("2025-06-02T14:00:00Z"),
    ...overrides,
  };
}

// ==================== 测试 ====================

describe("PostgresEpisodicMemoryProvider", () => {
  let provider: any;
  let mockMemoryRepo: ReturnType<typeof createMockMemoryRepo>;
  let mockDb: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();

    mockMemoryRepo = createMockMemoryRepo();
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

    // 动态导入被测模块
    const mod = await import("./postgres.js");
    const PostgresEpisodicMemoryProvider = mod.PostgresEpisodicMemoryProvider;

    provider = new PostgresEpisodicMemoryProvider({ db: mockDb });
    await provider.initialize();
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("应该正确初始化", () => {
      expect(provider.name).toBe("postgres-episodic");
      expect(provider.version).toBe("1.0.0");
    });

    it("健康检查应该返回 healthy", async () => {
      const health = await provider.healthCheck();
      expect(health.status).toBe("healthy");
    });

    it("关闭后应该能正常调用", async () => {
      await expect(provider.shutdown()).resolves.not.toThrow();
    });
  });

  // ==================== 对话历史 ====================

  describe("对话历史", () => {
    it("addConversation 应该创建 episodic/conversation 记忆", async () => {
      mockMemoryRepo.create.mockResolvedValue(createMockConversationRecord());

      const messages = [
        { role: "user" as const, content: "我们讨论下项目架构" },
        { role: "assistant" as const, content: "好的，我建议采用微服务架构" },
      ];

      await provider.addConversation("user-123", "session-001", messages);

      expect(mockMemoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "episodic",
          category: "conversation",
          sourceType: "conversation",
          sourceId: "session-001",
        }),
      );
    });

    it("addConversation 应该将消息拼接为 content", async () => {
      mockMemoryRepo.create.mockResolvedValue(createMockConversationRecord());

      const messages = [
        { role: "user" as const, content: "你好" },
        { role: "assistant" as const, content: "你好！有什么可以帮你的？" },
      ];

      await provider.addConversation("user-123", "session-001", messages);

      const call = mockMemoryRepo.create.mock.calls[0][0];
      expect(call.content).toContain("你好");
      expect(call.content).toContain("有什么可以帮你的");
    });

    it("summarizeConversation 应该从 DB 返回已有摘要", async () => {
      const record = createMockConversationRecord();
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [record],
        total: 1,
      });

      const summary = await provider.summarizeConversation("user-123", "session-001");

      expect(summary).toMatchObject({
        id: "mem-conv-001",
        sessionId: "session-001",
        summary: "关于微服务 vs 单体架构的讨论",
        keyTopics: ["架构", "微服务"],
        messageCount: 10,
      });
    });

    it("summarizeConversation 不存在时应该抛出错误", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({ memories: [], total: 0 });

      await expect(provider.summarizeConversation("user-123", "session-999")).rejects.toThrow();
    });

    it("getConversationHistory 应该返回转换后的摘要列表", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [
          createMockConversationRecord(),
          createMockConversationRecord({
            id: "mem-conv-002",
            sourceId: "session-002",
            summary: "关于测试策略的讨论",
            metadata: {
              sessionId: "session-002",
              keyTopics: ["测试", "TDD"],
              decisions: [],
              messageCount: 5,
              tokenCount: 1000,
            },
          }),
        ],
        total: 2,
      });

      const summaries = await provider.getConversationHistory("user-123");

      expect(summaries).toHaveLength(2);
      expect(summaries[0].sessionId).toBe("session-001");
    });

    it("getConversationHistory 应该支持时间过滤", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({ memories: [], total: 0 });

      await provider.getConversationHistory("user-123", {
        startDate: new Date("2025-01-01"),
        limit: 5,
      });

      expect(mockMemoryRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "episodic",
          limit: 5,
        }),
      );
    });

    it("deleteConversation 应该调用 deactivate", async () => {
      const record = createMockConversationRecord();
      mockMemoryRepo.findAll.mockResolvedValue({ memories: [record], total: 1 });
      mockMemoryRepo.deactivate.mockResolvedValue(undefined);

      await provider.deleteConversation("user-123", "session-001");

      expect(mockMemoryRepo.deactivate).toHaveBeenCalledWith("mem-conv-001");
    });
  });

  // ==================== 关键事件 ====================

  describe("关键事件", () => {
    it("addKeyEvent 应该创建 episodic/event 记忆并返回 ID", async () => {
      mockMemoryRepo.create.mockResolvedValue(createMockEventRecord());

      const eventId = await provider.addKeyEvent("user-123", {
        type: "task_completed",
        description: "完成了 CI/CD 流水线配置",
        context: "配置了 GitHub Actions 自动部署",
        importance: 0.8,
        relatedSessions: ["session-001"],
        timestamp: new Date("2025-06-02T14:00:00Z"),
      });

      expect(eventId).toBe("mem-evt-001");
      expect(mockMemoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "episodic",
          category: "event",
          content: "完成了 CI/CD 流水线配置",
        }),
      );
    });

    it("addKeyEvent 应该将 importance 0-1 映射为 1-10", async () => {
      mockMemoryRepo.create.mockResolvedValue(createMockEventRecord());

      await provider.addKeyEvent("user-123", {
        type: "milestone",
        description: "v1.0 发布",
        context: "首次正式发布",
        importance: 0.9,
        relatedSessions: [],
        timestamp: new Date(),
      });

      const call = mockMemoryRepo.create.mock.calls[0][0];
      expect(call.importance).toBe(9); // 0.9 * 10 = 9
    });

    it("getKeyEvents 应该返回转换后的 KeyEvent 列表", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockEventRecord()],
        total: 1,
      });

      const events = await provider.getKeyEvents("user-123");

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: "mem-evt-001",
        type: "task_completed",
        description: "完成了 CI/CD 流水线配置",
        importance: 0.8, // 8 / 10 = 0.8
      });
    });

    it("updateKeyEvent 应该调用 repo.update", async () => {
      mockMemoryRepo.update.mockResolvedValue(createMockEventRecord());

      await provider.updateKeyEvent("user-123", "mem-evt-001", {
        description: "更新后的描述",
      });

      expect(mockMemoryRepo.update).toHaveBeenCalledWith(
        "mem-evt-001",
        expect.objectContaining({ content: "更新后的描述" }),
      );
    });

    it("deleteKeyEvent 应该调用 deactivate", async () => {
      mockMemoryRepo.deactivate.mockResolvedValue(undefined);

      await provider.deleteKeyEvent("user-123", "mem-evt-001");

      expect(mockMemoryRepo.deactivate).toHaveBeenCalledWith("mem-evt-001");
    });
  });

  // ==================== 搜索 ====================

  describe("搜索", () => {
    it("searchEpisodes 应该搜索并返回结果", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockConversationRecord(), createMockEventRecord()],
        total: 2,
      });

      const results = await provider.searchEpisodes("user-123", "架构");

      // 至少对话摘要应该匹配（包含"架构"关键词）
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].type).toBe("conversation");
    });

    it("searchEpisodes 应该按分数排序", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [
          createMockConversationRecord({
            content: "讨论了项目架构设计方案",
            summary: "架构设计讨论",
          }),
          createMockEventRecord({
            content: "架构",
          }),
        ],
        total: 2,
      });

      const results = await provider.searchEpisodes("user-123", "架构");

      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  // ==================== 时间线 ====================

  describe("时间线", () => {
    it("getTimeline 应该聚合对话和事件", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockConversationRecord(), createMockEventRecord()],
        total: 2,
      });

      const timeline = await provider.getTimeline(
        "user-123",
        new Date("2025-01-01"),
        new Date("2025-12-31"),
      );

      expect(timeline).toHaveLength(2);

      // 验证类型映射
      const convEntry = timeline.find((e: TimelineEntry) => e.type === "conversation");
      const evtEntry = timeline.find(
        (e: TimelineEntry) => e.type === "event" || e.type === "milestone",
      );

      expect(convEntry).toBeDefined();
      expect(evtEntry).toBeDefined();
    });

    it("getTimeline 应该按时间倒序排序", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [
          createMockConversationRecord({ createdAt: new Date("2025-06-01") }),
          createMockEventRecord({ createdAt: new Date("2025-06-02") }),
        ],
        total: 2,
      });

      const timeline = await provider.getTimeline(
        "user-123",
        new Date("2025-01-01"),
        new Date("2025-12-31"),
      );

      if (timeline.length >= 2) {
        expect(timeline[0].timestamp.getTime()).toBeGreaterThanOrEqual(
          timeline[1].timestamp.getTime(),
        );
      }
    });
  });

  // ==================== 类型转换 ====================

  describe("DB Record → 接口类型转换", () => {
    it("conversation 记录应该正确转为 ConversationSummary", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockConversationRecord()],
        total: 1,
      });

      const summaries: ConversationSummary[] = await provider.getConversationHistory("user-123");

      expect(summaries[0]).toMatchObject({
        id: "mem-conv-001",
        sessionId: "session-001",
        summary: "关于微服务 vs 单体架构的讨论",
        keyTopics: ["架构", "微服务"],
        decisions: ["采用微服务架构"],
        messageCount: 10,
        tokenCount: 2000,
      });
      // DB 专有字段不应出现
      expect((summaries[0] as any).userId).toBeUndefined();
      expect((summaries[0] as any).isActive).toBeUndefined();
      expect((summaries[0] as any).embedding).toBeUndefined();
    });

    it("event 记录应该正确转为 KeyEvent", async () => {
      mockMemoryRepo.findAll.mockResolvedValue({
        memories: [createMockEventRecord()],
        total: 1,
      });

      const events: KeyEvent[] = await provider.getKeyEvents("user-123");

      expect(events[0]).toMatchObject({
        id: "mem-evt-001",
        type: "task_completed",
        description: "完成了 CI/CD 流水线配置",
        context: "配置了 GitHub Actions 自动部署",
        relatedSessions: ["session-001"],
      });
      // importance 应该从 1-10 映射回 0-1
      expect(events[0].importance).toBe(0.8);
      // DB 专有字段不应出现
      expect((events[0] as any).userId).toBeUndefined();
      expect((events[0] as any).isActive).toBeUndefined();
    });
  });
});
