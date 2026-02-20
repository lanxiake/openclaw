/**
 * register.ts 单元测试
 *
 * 测试记忆系统 hook 注册模块
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock plugin registry
const mockTypedHooks: any[] = [];

vi.mock("../../../plugins/hook-runner-global.js", () => ({
  getGlobalPluginRegistry: () => ({
    typedHooks: mockTypedHooks,
  }),
}));

// Mock recall/capture handlers
vi.mock("./recall.js", () => ({
  createRecallHandler: () => vi.fn(),
}));

vi.mock("./capture.js", () => ({
  createCaptureHandler: () => vi.fn(),
}));

import { registerMemoryHooks } from "./register.js";

describe("registerMemoryHooks", () => {
  beforeEach(() => {
    mockTypedHooks.length = 0;
  });

  // ========================================================================
  // REG-001: 成功注册 2 个 hooks
  // ========================================================================
  it("REG-001: 应注册 before_agent_start 和 agent_end 两个 hooks", () => {
    const count = registerMemoryHooks();

    expect(count).toBe(2);
    expect(mockTypedHooks).toHaveLength(2);

    const hookNames = mockTypedHooks.map((h) => h.hookName);
    expect(hookNames).toContain("before_agent_start");
    expect(hookNames).toContain("agent_end");
  });

  // ========================================================================
  // REG-002: hooks 具有正确的 pluginId
  // ========================================================================
  it("REG-002: 注册的 hooks 应具有 memory-hooks pluginId", () => {
    registerMemoryHooks();

    for (const hook of mockTypedHooks) {
      expect(hook.pluginId).toBe("memory-hooks");
      expect(hook.source).toBe("bundled:session-memory");
    }
  });

  // ========================================================================
  // REG-003: 不重复注册
  // ========================================================================
  it("REG-003: 重复调用不应重复注册", () => {
    registerMemoryHooks();
    registerMemoryHooks();

    expect(mockTypedHooks).toHaveLength(2);
  });

  // ========================================================================
  // REG-004: hooks 具有 priority
  // ========================================================================
  it("REG-004: 注册的 hooks 应具有 priority", () => {
    registerMemoryHooks();

    for (const hook of mockTypedHooks) {
      expect(hook.priority).toBeDefined();
      expect(typeof hook.priority).toBe("number");
    }
  });
});
