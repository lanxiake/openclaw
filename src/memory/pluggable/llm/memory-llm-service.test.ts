/**
 * MemoryLLMService 测试
 *
 * 使用 mock 测试 LLM 服务的完成调用、超时、错误处理。
 *
 * @module memory/pluggable/llm/memory-llm-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MemoryLLMService, DEFAULT_LLM_CONFIG } from "./memory-llm-service.js";

// ==================== Mock 设置 ====================

// Mock @mariozechner/pi-ai
const mockCompleteSimple = vi.fn();
const mockGetModel = vi.fn();

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple: (...args: unknown[]) => mockCompleteSimple(...args),
  getModel: (...args: unknown[]) => mockGetModel(...args),
}));

// Mock model-auth
const mockResolveApiKey = vi.fn();

vi.mock("../../../agents/model-auth.js", () => ({
  resolveApiKeyForProvider: (...args: unknown[]) => mockResolveApiKey(...args),
}));

// ==================== 测试工具 ====================

/** 创建成功的 LLM 响应 */
function mockSuccessResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input: 100, output: 50 },
  };
}

/** 创建带直接 apiKey 的服务（绕过 key 解析） */
function createServiceWithKey(overrides: Record<string, unknown> = {}) {
  return new MemoryLLMService({
    apiKey: "test-api-key",
    ...overrides,
  });
}

// ==================== 测试 ====================

describe("MemoryLLMService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModel.mockReturnValue({ provider: "anthropic", id: "test-model" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== 构造和默认配置 ====================

  describe("构造函数", () => {
    it("应使用默认配置", () => {
      const service = new MemoryLLMService({});

      expect(service).toBeDefined();
      // 默认配置通过 DEFAULT_LLM_CONFIG 提供
      expect(DEFAULT_LLM_CONFIG.provider).toBe("anthropic");
      expect(DEFAULT_LLM_CONFIG.maxTokens).toBe(1024);
      expect(DEFAULT_LLM_CONFIG.temperature).toBe(0.3);
    });

    it("应允许覆盖配置", () => {
      const service = new MemoryLLMService({
        provider: "openai",
        model: "gpt-4o",
        maxTokens: 2048,
      });

      expect(service).toBeDefined();
    });
  });

  // ==================== 可用性检查 ====================

  describe("isAvailable", () => {
    it("有直接 apiKey 时应返回 true", async () => {
      const service = createServiceWithKey();
      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it("无 apiKey 且无 cfg 时应返回 false", async () => {
      const service = new MemoryLLMService({});
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it("通过 cfg 解析到 key 时应返回 true", async () => {
      mockResolveApiKey.mockResolvedValue({
        apiKey: "resolved-key",
        source: "env",
        mode: "api-key",
      });

      const service = new MemoryLLMService({
        cfg: {} as any,
      });
      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it("通过 cfg 解析失败时应返回 false", async () => {
      mockResolveApiKey.mockRejectedValue(new Error("No API key"));

      const service = new MemoryLLMService({
        cfg: {} as any,
      });
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it("应缓存可用性结果", async () => {
      mockResolveApiKey.mockResolvedValue({
        apiKey: "resolved-key",
        source: "env",
        mode: "api-key",
      });

      const service = new MemoryLLMService({
        cfg: {} as any,
      });

      await service.isAvailable();
      await service.isAvailable();

      // resolveApiKeyForProvider 只调用一次
      expect(mockResolveApiKey).toHaveBeenCalledTimes(1);
    });

    it("resetAvailability 应清除缓存", async () => {
      mockResolveApiKey.mockResolvedValue({
        apiKey: "resolved-key",
        source: "env",
        mode: "api-key",
      });

      const service = new MemoryLLMService({
        cfg: {} as any,
      });

      await service.isAvailable();
      service.resetAvailability();
      await service.isAvailable();

      expect(mockResolveApiKey).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== complete ====================

  describe("complete", () => {
    it("应成功返回 LLM 响应文本", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse('{"summary": "test"}'));

      const service = createServiceWithKey();
      const result = await service.complete("system prompt", "user message");

      expect(result.success).toBe(true);
      expect(result.text).toBe('{"summary": "test"}');
      expect(result.usage?.input).toBe(100);
      expect(result.usage?.output).toBe(50);
    });

    it("应正确传递 system/user 消息", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse("ok"));

      const service = createServiceWithKey();
      await service.complete("my system", "my user");

      expect(mockCompleteSimple).toHaveBeenCalledTimes(1);
      const callArgs = mockCompleteSimple.mock.calls[0];

      // 第二个参数是 messages 配置（systemPrompt + messages）
      const messagesArg = callArgs[1];
      expect(messagesArg.systemPrompt).toBe("my system");
      expect(messagesArg.messages).toHaveLength(1);
      expect(messagesArg.messages[0].role).toBe("user");
      expect(messagesArg.messages[0].content).toBe("my user");
    });

    it("应传递 apiKey 和 maxTokens", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse("ok"));

      const service = createServiceWithKey({ maxTokens: 2048 });
      await service.complete("sys", "usr");

      const callArgs = mockCompleteSimple.mock.calls[0];
      const options = callArgs[2];
      expect(options.apiKey).toBe("test-api-key");
      expect(options.maxTokens).toBe(2048);
    });

    it("无 apiKey 时应返回错误", async () => {
      const service = new MemoryLLMService({});
      const result = await service.complete("sys", "usr");

      expect(result.success).toBe(false);
      expect(result.error).toContain("API Key");
      expect(result.text).toBe("");
    });

    it("LLM 调用失败时应返回错误", async () => {
      mockCompleteSimple.mockRejectedValue(new Error("API error"));

      const service = createServiceWithKey();
      const result = await service.complete("sys", "usr");

      expect(result.success).toBe(false);
      expect(result.error).toContain("API error");
    });

    it("超时时应返回错误", async () => {
      // 模拟一个永不 resolve 的 promise
      mockCompleteSimple.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const service = createServiceWithKey({ timeoutMs: 50 });
      const result = await service.complete("sys", "usr");

      expect(result.success).toBe(false);
      expect(result.error).toContain("超时");
    }, 10_000);

    it("应处理字符串 content 响应", async () => {
      mockCompleteSimple.mockResolvedValue({
        content: "直接字符串",
        usage: { input: 10, output: 5 },
      });

      const service = createServiceWithKey();
      const result = await service.complete("sys", "usr");

      expect(result.success).toBe(true);
      expect(result.text).toBe("直接字符串");
    });
  });

  // ==================== completeJSON ====================

  describe("completeJSON", () => {
    it("应返回解析后的 JSON 对象", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse('{"name": "test", "value": 42}'));

      const service = createServiceWithKey();
      const result = await service.completeJSON("sys", "usr", (raw) => JSON.parse(raw));

      expect(result).toEqual({ name: "test", value: 42 });
    });

    it("LLM 失败时应返回 null", async () => {
      mockCompleteSimple.mockRejectedValue(new Error("fail"));

      const service = createServiceWithKey();
      const result = await service.completeJSON("sys", "usr", JSON.parse);

      expect(result).toBeNull();
    });

    it("解析失败时应返回 null", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse("not valid json"));

      const service = createServiceWithKey();
      const result = await service.completeJSON("sys", "usr", (raw) => {
        throw new Error("parse error: " + raw);
      });

      expect(result).toBeNull();
    });

    it("应支持自定义解析函数", async () => {
      mockCompleteSimple.mockResolvedValue(mockSuccessResponse('{"items": [1, 2, 3]}'));

      const service = createServiceWithKey();
      const result = await service.completeJSON<number[]>("sys", "usr", (raw) => {
        const parsed = JSON.parse(raw);
        return parsed.items;
      });

      expect(result).toEqual([1, 2, 3]);
    });
  });
});
