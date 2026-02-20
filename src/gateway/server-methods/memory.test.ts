/**
 * 记忆系统 RPC 方法单元测试
 *
 * 验证 memory.* RPC handler 的：
 * - 认证检查（未认证时返回错误）
 * - 服务可用性检查（服务未就绪时返回错误）
 * - 正确的参数传递和响应格式
 * - 错误处理
 *
 * @module gateway/server-methods/memory.test
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryHandlers } from "./memory.js";
import type { GatewayClient, GatewayRequestContext } from "./types.js";

// ==================== Mock 设置 ====================

/** Mock 的 Profile Provider */
const mockProfile = {
  addFact: vi.fn(),
  getFacts: vi.fn(),
  searchFacts: vi.fn(),
  updateFact: vi.fn(),
  deleteFact: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  resetPreferences: vi.fn(),
  getPatterns: vi.fn(),
  addPattern: vi.fn(),
  updatePattern: vi.fn(),
  deletePattern: vi.fn(),
  confirmPattern: vi.fn(),
  exportProfile: vi.fn(),
};

/** Mock 的 Episodic Provider */
const mockEpisodic = {
  addConversation: vi.fn(),
  getConversationHistory: vi.fn(),
  summarizeConversation: vi.fn(),
  deleteConversation: vi.fn(),
  addKeyEvent: vi.fn(),
  getKeyEvents: vi.fn(),
  updateKeyEvent: vi.fn(),
  deleteKeyEvent: vi.fn(),
  searchEpisodes: vi.fn(),
  getTimeline: vi.fn(),
};

/** Mock 的 MemoryManager */
const mockManager = {
  profile: mockProfile,
  episodic: mockEpisodic,
};

/** Mock 的 GatewayMemoryService */
const mockService = {
  isReady: true,
  status: "ready" as const,
  manager: mockManager,
  healthCheck: vi.fn(),
};

vi.mock("../memory-service.js", () => ({
  getGatewayMemoryService: () => mockService,
}));

// ==================== 测试工具 ====================

const TEST_USER_ID = "test-user-123";

/**
 * 创建已认证的 mock client
 */
function createAuthenticatedClient(): GatewayClient {
  return {
    connect: { role: "operator", scopes: ["operator.write"] },
    authenticatedUser: {
      userId: TEST_USER_ID,
      displayName: "测试用户",
    },
  } as GatewayClient;
}

/**
 * 创建未认证的 mock client
 */
function createUnauthenticatedClient(): GatewayClient {
  return {
    connect: { role: "operator", scopes: [] },
  } as GatewayClient;
}

/**
 * 创建 mock respond 函数
 */
function createRespond() {
  return vi.fn();
}

/**
 * 创建 mock handler 选项
 */
function createHandlerOpts(overrides?: {
  params?: Record<string, unknown>;
  client?: GatewayClient | null;
}) {
  return {
    req: { type: "req" as const, id: "test-1", method: "test" },
    params: overrides?.params ?? {},
    client: overrides && "client" in overrides ? overrides.client : createAuthenticatedClient(),
    isWebchatConnect: () => false,
    respond: createRespond(),
    context: {} as GatewayRequestContext,
  };
}

// ==================== 测试 ====================

describe("memory RPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService.isReady = true;
  });

  // ==================== 认证检查 ====================

  describe("认证检查", () => {
    it("MEMORY-RPC-001: 未认证时应返回错误", async () => {
      const opts = createHandlerOpts({
        client: createUnauthenticatedClient(),
      });

      await memoryHandlers["memory.profile.fact.list"]!(opts);

      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("未认证"),
        }),
      );
    });

    it("MEMORY-RPC-002: client 为 null 时应返回错误", async () => {
      const opts = createHandlerOpts({ client: null });

      await memoryHandlers["memory.profile.fact.list"]!(opts);

      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("未认证"),
        }),
      );
    });
  });

  // ==================== 服务可用性 ====================

  describe("服务可用性", () => {
    it("MEMORY-RPC-003: 服务未就绪时应返回错误", async () => {
      mockService.isReady = false;
      const opts = createHandlerOpts();

      await memoryHandlers["memory.profile.fact.list"]!(opts);

      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("未就绪"),
        }),
      );
    });
  });

  // ==================== Profile: 事实管理 ====================

  describe("Profile: 事实管理", () => {
    it("MEMORY-RPC-004: 应该添加事实", async () => {
      mockProfile.addFact.mockResolvedValue("fact-001");

      const opts = createHandlerOpts({
        params: {
          category: "work",
          key: "company",
          value: "OpenClaw",
          confidence: 0.95,
          source: "explicit",
        },
      });

      await memoryHandlers["memory.profile.fact.add"]!(opts);

      expect(mockProfile.addFact).toHaveBeenCalledWith(TEST_USER_ID, {
        category: "work",
        key: "company",
        value: "OpenClaw",
        confidence: 0.95,
        source: "explicit",
        sensitive: false,
      });
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          factId: "fact-001",
        }),
      );
    });

    it("MEMORY-RPC-005: 应该查询事实列表", async () => {
      const mockFacts = [{ id: "f1", category: "work", key: "company", value: "OpenClaw" }];
      mockProfile.getFacts.mockResolvedValue(mockFacts);

      const opts = createHandlerOpts({
        params: { category: "work" },
      });

      await memoryHandlers["memory.profile.fact.list"]!(opts);

      expect(mockProfile.getFacts).toHaveBeenCalledWith(TEST_USER_ID, "work");
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          facts: mockFacts,
          total: 1,
        }),
      );
    });

    it("MEMORY-RPC-006: 应该搜索事实", async () => {
      const mockResults = [{ id: "f1", category: "work", key: "company", value: "OpenClaw" }];
      mockProfile.searchFacts.mockResolvedValue(mockResults);

      const opts = createHandlerOpts({
        params: { query: "OpenClaw" },
      });

      await memoryHandlers["memory.profile.fact.search"]!(opts);

      expect(mockProfile.searchFacts).toHaveBeenCalledWith(TEST_USER_ID, "OpenClaw");
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          facts: mockResults,
        }),
      );
    });

    it("MEMORY-RPC-007: 应该更新事实", async () => {
      mockProfile.updateFact.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: { factId: "f1", value: "新值", confidence: 0.9 },
      });

      await memoryHandlers["memory.profile.fact.update"]!(opts);

      expect(mockProfile.updateFact).toHaveBeenCalledWith(TEST_USER_ID, "f1", {
        value: "新值",
        confidence: 0.9,
      });
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });

    it("MEMORY-RPC-008: 应该删除事实", async () => {
      mockProfile.deleteFact.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: { factId: "f1" },
      });

      await memoryHandlers["memory.profile.fact.delete"]!(opts);

      expect(mockProfile.deleteFact).toHaveBeenCalledWith(TEST_USER_ID, "f1");
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });

    it("MEMORY-RPC-009: 事实操作失败时应返回错误", async () => {
      mockProfile.addFact.mockRejectedValue(new Error("数据库连接失败"));

      const opts = createHandlerOpts({
        params: {
          category: "work",
          key: "company",
          value: "test",
        },
      });

      await memoryHandlers["memory.profile.fact.add"]!(opts);

      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: false,
          error: "数据库连接失败",
        }),
      );
    });
  });

  // ==================== Profile: 偏好管理 ====================

  describe("Profile: 偏好管理", () => {
    it("MEMORY-RPC-010: 应该获取偏好", async () => {
      const mockPrefs = {
        language: "zh-CN",
        timezone: "Asia/Shanghai",
        responseStyle: "detailed",
      };
      mockProfile.getPreferences.mockResolvedValue(mockPrefs);

      const opts = createHandlerOpts();

      await memoryHandlers["memory.profile.preferences.get"]!(opts);

      expect(mockProfile.getPreferences).toHaveBeenCalledWith(TEST_USER_ID);
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          preferences: mockPrefs,
        }),
      );
    });

    it("MEMORY-RPC-011: 应该更新偏好（只传允许的字段）", async () => {
      mockProfile.updatePreferences.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: {
          language: "en-US",
          timezone: "America/New_York",
          invalidField: "should be ignored",
        },
      });

      await memoryHandlers["memory.profile.preferences.update"]!(opts);

      expect(mockProfile.updatePreferences).toHaveBeenCalledWith(TEST_USER_ID, {
        language: "en-US",
        timezone: "America/New_York",
      });
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });

    it("MEMORY-RPC-012: 应该重置偏好", async () => {
      mockProfile.resetPreferences.mockResolvedValue(undefined);

      const opts = createHandlerOpts();

      await memoryHandlers["memory.profile.preferences.reset"]!(opts);

      expect(mockProfile.resetPreferences).toHaveBeenCalledWith(TEST_USER_ID);
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });
  });

  // ==================== Profile: 行为模式 ====================

  describe("Profile: 行为模式", () => {
    it("MEMORY-RPC-013: 应该添加行为模式", async () => {
      mockProfile.addPattern.mockResolvedValue("pattern-001");

      const opts = createHandlerOpts({
        params: {
          type: "work_style",
          pattern: "偏好使用 TDD",
          evidence: ["总是先写测试"],
          confidence: 0.7,
        },
      });

      await memoryHandlers["memory.profile.pattern.add"]!(opts);

      expect(mockProfile.addPattern).toHaveBeenCalledWith(TEST_USER_ID, {
        type: "work_style",
        pattern: "偏好使用 TDD",
        evidence: ["总是先写测试"],
        confidence: 0.7,
      });
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          patternId: "pattern-001",
        }),
      );
    });

    it("MEMORY-RPC-014: 应该查询行为模式", async () => {
      const mockPatterns = [{ id: "p1", type: "work_style", pattern: "TDD", confidence: 0.7 }];
      mockProfile.getPatterns.mockResolvedValue(mockPatterns);

      const opts = createHandlerOpts();

      await memoryHandlers["memory.profile.pattern.list"]!(opts);

      expect(mockProfile.getPatterns).toHaveBeenCalledWith(TEST_USER_ID);
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          patterns: mockPatterns,
          total: 1,
        }),
      );
    });

    it("MEMORY-RPC-015: 应该确认行为模式", async () => {
      mockProfile.confirmPattern.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: { patternId: "p1", confirmed: true },
      });

      await memoryHandlers["memory.profile.pattern.confirm"]!(opts);

      expect(mockProfile.confirmPattern).toHaveBeenCalledWith(TEST_USER_ID, "p1", true);
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });
  });

  // ==================== Profile: 导出 ====================

  describe("Profile: 导出", () => {
    it("MEMORY-RPC-016: 应该导出完整画像", async () => {
      const mockExport = {
        facts: [{ id: "f1", category: "work", key: "role", value: "dev" }],
        preferences: { language: "zh-CN" },
        patterns: [{ id: "p1", type: "work_style", pattern: "TDD" }],
      };
      mockProfile.exportProfile.mockResolvedValue(mockExport);

      const opts = createHandlerOpts();

      await memoryHandlers["memory.profile.export"]!(opts);

      expect(mockProfile.exportProfile).toHaveBeenCalledWith(TEST_USER_ID);
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          profile: mockExport,
        }),
      );
    });
  });

  // ==================== Episodic: 对话历史 ====================

  describe("Episodic: 对话历史", () => {
    it("MEMORY-RPC-017: 应该添加对话", async () => {
      mockEpisodic.addConversation.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: {
          sessionId: "session-1",
          messages: [
            { role: "user", content: "你好" },
            { role: "assistant", content: "你好！" },
          ],
        },
      });

      await memoryHandlers["memory.episodic.conversation.add"]!(opts);

      expect(mockEpisodic.addConversation).toHaveBeenCalledWith(
        TEST_USER_ID,
        "session-1",
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "你好" }),
          expect.objectContaining({ role: "assistant", content: "你好！" }),
        ]),
      );
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });

    it("MEMORY-RPC-018: 应该获取对话历史", async () => {
      const mockHistory = [{ id: "c1", sessionId: "s1", summary: "讨论了架构", messageCount: 4 }];
      mockEpisodic.getConversationHistory.mockResolvedValue(mockHistory);

      const opts = createHandlerOpts({
        params: { limit: 10 },
      });

      await memoryHandlers["memory.episodic.conversation.history"]!(opts);

      expect(mockEpisodic.getConversationHistory).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 10,
        offset: undefined,
      });
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          history: mockHistory,
        }),
      );
    });

    it("MEMORY-RPC-019: 应该获取对话摘要", async () => {
      const mockSummary = {
        id: "c1",
        sessionId: "s1",
        summary: "讨论了微服务架构",
        keyTopics: ["微服务", "架构"],
        messageCount: 4,
      };
      mockEpisodic.summarizeConversation.mockResolvedValue(mockSummary);

      const opts = createHandlerOpts({
        params: { sessionId: "s1" },
      });

      await memoryHandlers["memory.episodic.conversation.summary"]!(opts);

      expect(mockEpisodic.summarizeConversation).toHaveBeenCalledWith(TEST_USER_ID, "s1");
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          summary: mockSummary,
        }),
      );
    });

    it("MEMORY-RPC-020: 应该删除对话", async () => {
      mockEpisodic.deleteConversation.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: { sessionId: "s1" },
      });

      await memoryHandlers["memory.episodic.conversation.delete"]!(opts);

      expect(mockEpisodic.deleteConversation).toHaveBeenCalledWith(TEST_USER_ID, "s1");
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });
  });

  // ==================== Episodic: 关键事件 ====================

  describe("Episodic: 关键事件", () => {
    it("MEMORY-RPC-021: 应该添加关键事件", async () => {
      mockEpisodic.addKeyEvent.mockResolvedValue("event-001");

      const opts = createHandlerOpts({
        params: {
          type: "milestone",
          description: "v1.0 发布",
          context: "首次正式版发布",
          importance: 0.9,
        },
      });

      await memoryHandlers["memory.episodic.event.add"]!(opts);

      expect(mockEpisodic.addKeyEvent).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          type: "milestone",
          description: "v1.0 发布",
          context: "首次正式版发布",
          importance: 0.9,
        }),
      );
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          eventId: "event-001",
        }),
      );
    });

    it("MEMORY-RPC-022: 应该查询关键事件（按类型过滤）", async () => {
      const mockEvents = [{ id: "e1", type: "milestone", description: "v1.0", importance: 0.9 }];
      mockEpisodic.getKeyEvents.mockResolvedValue(mockEvents);

      const opts = createHandlerOpts({
        params: { types: ["milestone"], limit: 5 },
      });

      await memoryHandlers["memory.episodic.event.list"]!(opts);

      expect(mockEpisodic.getKeyEvents).toHaveBeenCalledWith(TEST_USER_ID, {
        types: ["milestone"],
        limit: 5,
      });
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          events: mockEvents,
        }),
      );
    });

    it("MEMORY-RPC-023: 应该更新关键事件", async () => {
      mockEpisodic.updateKeyEvent.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: {
          eventId: "e1",
          description: "更新后的描述",
          importance: 0.95,
        },
      });

      await memoryHandlers["memory.episodic.event.update"]!(opts);

      expect(mockEpisodic.updateKeyEvent).toHaveBeenCalledWith(TEST_USER_ID, "e1", {
        description: "更新后的描述",
        importance: 0.95,
      });
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });

    it("MEMORY-RPC-024: 应该删除关键事件", async () => {
      mockEpisodic.deleteKeyEvent.mockResolvedValue(undefined);

      const opts = createHandlerOpts({
        params: { eventId: "e1" },
      });

      await memoryHandlers["memory.episodic.event.delete"]!(opts);

      expect(mockEpisodic.deleteKeyEvent).toHaveBeenCalledWith(TEST_USER_ID, "e1");
      expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });
  });

  // ==================== Episodic: 搜索和时间线 ====================

  describe("Episodic: 搜索和时间线", () => {
    it("MEMORY-RPC-025: 应该搜索情节", async () => {
      const mockResults = [
        { id: "r1", content: "PostgreSQL 性能调优", score: 0.85, type: "conversation" },
      ];
      mockEpisodic.searchEpisodes.mockResolvedValue(mockResults);

      const opts = createHandlerOpts({
        params: { query: "PostgreSQL", limit: 5 },
      });

      await memoryHandlers["memory.episodic.search"]!(opts);

      expect(mockEpisodic.searchEpisodes).toHaveBeenCalledWith(TEST_USER_ID, "PostgreSQL", {
        limit: 5,
      });
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          results: mockResults,
        }),
      );
    });

    it("MEMORY-RPC-026: 应该获取时间线", async () => {
      const mockTimeline = [
        {
          id: "t1",
          type: "conversation",
          title: "架构讨论",
          description: "讨论了微服务",
          timestamp: new Date("2025-01-01"),
        },
      ];
      mockEpisodic.getTimeline.mockResolvedValue(mockTimeline);

      const opts = createHandlerOpts({
        params: {
          startDate: "2025-01-01T00:00:00Z",
          endDate: "2025-01-31T23:59:59Z",
        },
      });

      await memoryHandlers["memory.episodic.timeline"]!(opts);

      expect(mockEpisodic.getTimeline).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.any(Date),
        expect.any(Date),
      );
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          timeline: mockTimeline,
        }),
      );
    });
  });

  // ==================== 通用 ====================

  describe("通用", () => {
    it("MEMORY-RPC-027: 应该返回健康状态", async () => {
      const mockHealth = {
        status: "ready",
        providers: {
          episodic: { status: "healthy" },
          profile: { status: "healthy" },
        },
        checkedAt: new Date(),
      };
      mockService.healthCheck.mockResolvedValue(mockHealth);

      const opts = createHandlerOpts();

      await memoryHandlers["memory.health"]!(opts);

      expect(mockService.healthCheck).toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          success: true,
          health: mockHealth,
        }),
      );
    });
  });
});
