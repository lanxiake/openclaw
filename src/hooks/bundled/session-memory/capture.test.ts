/**
 * capture.ts 单元测试
 *
 * 测试 agent_end hook 的记忆捕获功能：
 * - 将对话消息保存到情节记忆
 * - 从对话中提取关键事件
 * - 错误时优雅降级
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock GatewayMemoryService
const mockEpisodic = {
  addConversation: vi.fn(),
  addKeyEvent: vi.fn(),
};

const mockManager = {
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

import { createCaptureHandler } from "./capture.js";
import type { PluginHookAgentEndEvent, PluginHookAgentContext } from "../../../plugins/types.js";

describe("capture (agent_end hook)", () => {
  let captureHandler: (
    event: PluginHookAgentEndEvent,
    ctx: PluginHookAgentContext,
  ) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady = true;
    captureHandler = createCaptureHandler();

    mockEpisodic.addConversation.mockResolvedValue(undefined);
    mockEpisodic.addKeyEvent.mockResolvedValue(undefined);
  });

  // ========================================================================
  // CAPTURE-001: 无 sessionKey 时跳过
  // ========================================================================
  it("CAPTURE-001: 无 sessionKey 时应跳过", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！有什么可以帮你的？" },
      ],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CAPTURE-002: 记忆服务不可用时跳过
  // ========================================================================
  it("CAPTURE-002: 记忆服务不可用时应跳过", async () => {
    mockIsReady = false;

    const event: PluginHookAgentEndEvent = {
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CAPTURE-003: 失败的会话不保存
  // ========================================================================
  it("CAPTURE-003: 失败的会话不应保存到记忆", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [{ role: "user", content: "你好" }],
      success: false,
      error: "API timeout",
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CAPTURE-004: 空消息列表时跳过
  // ========================================================================
  it("CAPTURE-004: 空消息列表时应跳过", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CAPTURE-005: 成功保存对话到情节记忆
  // ========================================================================
  it("CAPTURE-005: 应将成功的对话保存到情节记忆", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [
        { role: "user", content: "帮我写一封邮件给张总" },
        { role: "assistant", content: "好的，以下是邮件草稿..." },
      ],
      success: true,
      durationMs: 5000,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).toHaveBeenCalledTimes(1);
    expect(mockEpisodic.addConversation).toHaveBeenCalledWith(
      "agent:main:webchat:user-123", // userId = sessionKey
      expect.any(String), // sessionId (generated)
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "帮我写一封邮件给张总",
        }),
        expect.objectContaining({
          role: "assistant",
          content: "好的，以下是邮件草稿...",
        }),
      ]),
    );
  });

  // ========================================================================
  // CAPTURE-006: 正确处理 content block 数组格式
  // ========================================================================
  it("CAPTURE-006: 应正确处理 content block 数组格式的消息", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "帮我分析一下数据" }],
        },
        {
          role: "assistant",
          content: [
            { type: "text", text: "以下是分析结果：" },
            { type: "text", text: "数据显示增长趋势。" },
          ],
        },
      ],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).toHaveBeenCalledTimes(1);

    const savedMessages = mockEpisodic.addConversation.mock.calls[0][2];
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages[0].content).toBe("帮我分析一下数据");
    expect(savedMessages[1].content).toContain("以下是分析结果：");
    expect(savedMessages[1].content).toContain("数据显示增长趋势。");
  });

  // ========================================================================
  // CAPTURE-007: 跳过 tool 和 system 角色的消息
  // ========================================================================
  it("CAPTURE-007: 应跳过 tool/system 角色的消息", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "搜索天气" },
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "search" }] },
        { role: "tool", content: "北京 25°C 晴" },
        { role: "assistant", content: "北京今天天气晴朗，25°C。" },
      ],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).toHaveBeenCalledTimes(1);

    const savedMessages = mockEpisodic.addConversation.mock.calls[0][2];
    // 只保存 user 和 assistant 的文本消息
    const roles = savedMessages.map((m: { role: string }) => m.role);
    expect(roles).not.toContain("system");
    expect(roles).not.toContain("tool");
  });

  // ========================================================================
  // CAPTURE-008: 太短的对话不保存
  // ========================================================================
  it("CAPTURE-008: 只有 1 条消息的对话不应保存", async () => {
    const event: PluginHookAgentEndEvent = {
      messages: [{ role: "user", content: "hi" }],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    // 只有 1 条 user 消息，没有 assistant 回复，不保存
    expect(mockEpisodic.addConversation).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CAPTURE-009: 异常时不中断
  // ========================================================================
  it("CAPTURE-009: 保存失败时应优雅降级（不抛错）", async () => {
    mockEpisodic.addConversation.mockRejectedValue(new Error("Storage full"));

    const event: PluginHookAgentEndEvent = {
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ],
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    // 不应抛出异常
    await expect(captureHandler(event, ctx)).resolves.toBeUndefined();
  });

  // ========================================================================
  // CAPTURE-010: 长时间对话应被截断保存
  // ========================================================================
  it("CAPTURE-010: 超过限制的消息应被截断", async () => {
    // 生成 60 条消息
    const messages = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `消息 ${i + 1}`,
    }));

    const event: PluginHookAgentEndEvent = {
      messages,
      success: true,
    };
    const ctx: PluginHookAgentContext = {
      agentId: "main",
      sessionKey: "agent:main:webchat:user-123",
    };

    await captureHandler(event, ctx);
    expect(mockEpisodic.addConversation).toHaveBeenCalledTimes(1);

    // 应截断到最近 50 条
    const savedMessages = mockEpisodic.addConversation.mock.calls[0][2];
    expect(savedMessages.length).toBeLessThanOrEqual(50);
  });
});
