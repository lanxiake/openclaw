/**
 * recall.ts 单元测试
 *
 * 测试 before_agent_start hook 的记忆召回功能：
 * - 从用户画像中获取事实和偏好
 * - 从情节记忆中搜索相关历史
 * - 组装 prependContext 注入到 Agent 上下文
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock GatewayMemoryService
const mockProfile = {
  getFacts: vi.fn(),
  getPreferences: vi.fn(),
  getPatterns: vi.fn(),
};

const mockEpisodic = {
  searchEpisodes: vi.fn(),
  getConversationHistory: vi.fn(),
};

const mockManager = {
  profile: mockProfile,
  episodic: mockEpisodic,
};

let mockIsReady = true;

vi.mock("../../../gateway/memory-service.js", () => ({
  getGatewayMemoryService: () => ({
    get isReady() {
      return mockIsReady;
    },
    manager: mockManager,
  }),
}));

import { createRecallHandler } from "./recall.js";
import type {
  PluginHookBeforeAgentStartEvent,
  PluginHookAgentContext,
  PluginHookBeforeAgentStartResult,
} from "../../../plugins/types.js";

/** 默认偏好（与 DEFAULT_USER_PREFERENCES 一致） */
const DEFAULT_PREFS = {
  language: "zh-CN",
  timezone: "Asia/Shanghai",
  responseStyle: "detailed",
  confirmLevel: "medium",
  favoriteSkills: [],
  disabledSkills: [],
  thinkingLevel: "medium",
  verboseLevel: "normal",
  notifications: { enabled: true, channels: [] },
};

describe("recall (before_agent_start hook)", () => {
  let recallHandler: (
    event: PluginHookBeforeAgentStartEvent,
    ctx: PluginHookAgentContext,
  ) => Promise<PluginHookBeforeAgentStartResult | void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady = true;
    recallHandler = createRecallHandler();

    // 设置默认 mock 返回值
    mockProfile.getFacts.mockResolvedValue([]);
    mockProfile.getPreferences.mockResolvedValue({ ...DEFAULT_PREFS });
    mockProfile.getPatterns.mockResolvedValue([]);
    mockEpisodic.searchEpisodes.mockResolvedValue([]);
  });

  // ========================================================================
  // RECALL-001: 无 sessionKey 时跳过
  // ========================================================================
  it("RECALL-001: 无 sessionKey 时应跳过记忆召回", async () => {
    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      // 无 sessionKey
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeUndefined();
    expect(mockProfile.getFacts).not.toHaveBeenCalled();
  });

  // ========================================================================
  // RECALL-002: 记忆服务不可用时跳过
  // ========================================================================
  it("RECALL-002: 记忆服务不可用时应跳过", async () => {
    mockIsReady = false;

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeUndefined();
  });

  // ========================================================================
  // RECALL-003: 成功召回用户事实
  // ========================================================================
  it("RECALL-003: 应将用户事实注入到 prependContext", async () => {
    mockProfile.getFacts.mockResolvedValue([
      {
        id: "fact-1",
        category: "personal",
        key: "name",
        value: "张三",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "fact-2",
        category: "work",
        key: "company",
        value: "MtBot Inc",
        confidence: 0.8,
        source: "inferred",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "帮我写一封邮件",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result?.prependContext).toBeDefined();
    expect(result!.prependContext).toContain("张三");
    expect(result!.prependContext).toContain("MtBot Inc");
    expect(result!.prependContext).toContain("user-profile-memory");
  });

  // ========================================================================
  // RECALL-004: 敏感事实不应出现在上下文中
  // ========================================================================
  it("RECALL-004: 应过滤掉敏感事实", async () => {
    mockProfile.getFacts.mockResolvedValue([
      {
        id: "fact-1",
        category: "personal",
        key: "name",
        value: "张三",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "fact-secret",
        category: "finance",
        key: "bank_account",
        value: "622812xxxxx",
        confidence: 0.9,
        source: "explicit",
        sensitive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "帮我查询余额",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("张三");
    expect(result!.prependContext).not.toContain("622812");
  });

  // ========================================================================
  // RECALL-005: 成功召回用户偏好（非默认值）
  // ========================================================================
  it("RECALL-005: 应将非默认用户偏好注入到 prependContext", async () => {
    mockProfile.getPreferences.mockResolvedValue({
      language: "en",
      timezone: "America/New_York",
      responseStyle: "concise",
      confirmLevel: "low",
      favoriteSkills: ["web-search"],
      disabledSkills: [],
      thinkingLevel: "high",
      verboseLevel: "minimal",
      notifications: { enabled: true, channels: [] },
    });

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "帮我搜索一下",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("concise");
    expect(result!.prependContext).toContain("America/New_York");
  });

  // ========================================================================
  // RECALL-006: 成功召回相关情节记忆
  // ========================================================================
  it("RECALL-006: 应将相关情节记忆注入到 prependContext", async () => {
    mockEpisodic.searchEpisodes.mockResolvedValue([
      {
        sessionId: "session-old-1",
        summary: "讨论了项目架构设计，决定使用微服务架构",
        topics: ["架构", "微服务"],
        score: 0.85,
        timestamp: new Date("2026-02-15"),
      },
    ]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "关于之前讨论的架构方案",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("微服务");
    expect(result!.prependContext).toContain("user-profile-memory");
    expect(result!.prependContext).toContain("Related Past Conversations");
    // userId 从 sessionKey 派生
    expect(mockEpisodic.searchEpisodes).toHaveBeenCalledWith(
      "agent:main:webchat:user-123",
      "关于之前讨论的架构方案",
      expect.any(Object),
    );
  });

  // ========================================================================
  // RECALL-007: 短 prompt 时跳过情节搜索
  // ========================================================================
  it("RECALL-007: 短 prompt（<5 字符）时应跳过情节搜索但仍返回画像", async () => {
    mockProfile.getFacts.mockResolvedValue([
      {
        id: "fact-1",
        category: "personal",
        key: "name",
        value: "张三",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "hi",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("张三");
    expect(mockEpisodic.searchEpisodes).not.toHaveBeenCalled();
  });

  // ========================================================================
  // RECALL-008: 无事实但有偏好时仍返回结果
  // ========================================================================
  it("RECALL-008: 只有非默认偏好时也应注入", async () => {
    mockProfile.getFacts.mockResolvedValue([]);
    mockProfile.getPreferences.mockResolvedValue({
      ...DEFAULT_PREFS,
      responseStyle: "concise",
    });

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("concise");
  });

  // ========================================================================
  // RECALL-009: 所有数据为默认值时返回 undefined
  // ========================================================================
  it("RECALL-009: 无任何有价值记忆数据时应返回 undefined", async () => {
    // 所有 mock 返回空/默认
    mockProfile.getFacts.mockResolvedValue([]);
    mockProfile.getPreferences.mockResolvedValue({ ...DEFAULT_PREFS });
    mockEpisodic.searchEpisodes.mockResolvedValue([]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeUndefined();
  });

  // ========================================================================
  // RECALL-010: 异常时优雅降级
  // ========================================================================
  it("RECALL-010: 异常时应返回 undefined（不中断 Agent 启动）", async () => {
    mockProfile.getFacts.mockRejectedValue(new Error("DB connection failed"));

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeUndefined();
  });

  // ========================================================================
  // RECALL-011: 低置信度事实应被过滤
  // ========================================================================
  it("RECALL-011: 低置信度事实（<0.5）应被过滤", async () => {
    mockProfile.getFacts.mockResolvedValue([
      {
        id: "fact-good",
        category: "personal",
        key: "name",
        value: "张三",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "fact-low",
        category: "hobby",
        key: "sport",
        value: "篮球",
        confidence: 0.3,
        source: "inferred",
        sensitive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const event: PluginHookBeforeAgentStartEvent = {
      prompt: "你好",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    const result = await recallHandler(event, ctx);
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("张三");
    expect(result!.prependContext).not.toContain("篮球");
  });
});
