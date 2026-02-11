/**
 * Mock LLM Provider - 模拟 AI 模型提供商
 *
 * 用于开发和测试环境，无需真实 API Key
 *
 * 功能：
 * - 模拟聊天完成响应
 * - 模拟流式输出
 * - 可配置延迟和错误率
 * - 支持预设响应模式
 *
 * 使用方式：
 *   设置环境变量 USE_MOCK_LLM=true 启用
 */

import { getLogger } from "../shared/logging/logger.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Mock Provider 配置
 */
export interface MockLLMConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 模拟延迟 (毫秒) */
  delayMs?: number;
  /** 流式输出每个 chunk 的延迟 (毫秒) */
  streamChunkDelayMs?: number;
  /** 错误率 (0-1) */
  errorRate?: number;
  /** 响应模式 */
  responseMode?: "echo" | "fixed" | "random";
  /** 固定响应内容 (responseMode=fixed 时使用) */
  fixedResponse?: string;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 完成响应
 */
export interface CompletionResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "error";
}

/**
 * 流式 chunk
 */
export interface StreamChunk {
  type: "text" | "done" | "error";
  content?: string;
  error?: string;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: MockLLMConfig = {
  enabled: false,
  delayMs: 100,
  streamChunkDelayMs: 50,
  errorRate: 0,
  responseMode: "echo",
};

// 预设响应库
const PRESET_RESPONSES = [
  "我理解了你的问题。让我来帮你分析一下...",
  "这是一个很好的问题！根据我的理解...",
  "好的，我来为你处理这个请求。",
  "让我想想...这个问题可以从几个角度来看。",
  "收到！我会尽力帮助你完成这个任务。",
];

// ============================================================================
// Mock Provider 实现
// ============================================================================

/**
 * Mock LLM Provider 类
 */
export class MockLLMProvider {
  private config: MockLLMConfig;

  constructor(config: Partial<MockLLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info("[mock-llm] MockLLMProvider initialized", {
      enabled: this.config.enabled,
      responseMode: this.config.responseMode,
    });
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MockLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 模拟聊天完成
   */
  async complete(messages: ChatMessage[]): Promise<CompletionResponse> {
    logger.debug("[mock-llm] complete() called", {
      messageCount: messages.length,
    });

    // 模拟延迟
    if (this.config.delayMs) {
      await this.delay(this.config.delayMs);
    }

    // 模拟错误
    if (this.shouldError()) {
      throw new Error("[Mock] Simulated API error");
    }

    // 生成响应
    const content = this.generateResponse(messages);
    const promptTokens = this.estimateTokens(messages);
    const completionTokens = this.estimateTokens([{ role: "assistant", content }]);

    return {
      id: `mock-${Date.now()}`,
      model: "mock-gpt-4",
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: "stop",
    };
  }

  /**
   * 模拟流式聊天完成
   */
  async *stream(messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    logger.debug("[mock-llm] stream() called", {
      messageCount: messages.length,
    });

    // 模拟初始延迟
    if (this.config.delayMs) {
      await this.delay(this.config.delayMs);
    }

    // 模拟错误
    if (this.shouldError()) {
      yield { type: "error", error: "[Mock] Simulated API error" };
      return;
    }

    // 生成响应并分块输出
    const content = this.generateResponse(messages);
    const chunks = this.splitIntoChunks(content);

    for (const chunk of chunks) {
      if (this.config.streamChunkDelayMs) {
        await this.delay(this.config.streamChunkDelayMs);
      }
      yield { type: "text", content: chunk };
    }

    yield { type: "done" };
  }

  /**
   * 生成响应内容
   */
  private generateResponse(messages: ChatMessage[]): string {
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();

    switch (this.config.responseMode) {
      case "echo":
        // 回显模式：返回用户消息的摘要
        if (lastUserMessage) {
          const preview = lastUserMessage.content.slice(0, 100);
          return `[Mock Response] 收到消息: "${preview}${lastUserMessage.content.length > 100 ? "..." : ""}"`;
        }
        return "[Mock Response] 没有收到用户消息";

      case "fixed":
        // 固定响应模式
        return this.config.fixedResponse || "[Mock] 固定响应内容";

      case "random":
        // 随机响应模式
        const randomIndex = Math.floor(Math.random() * PRESET_RESPONSES.length);
        return PRESET_RESPONSES[randomIndex];

      default:
        return "[Mock Response] 默认响应";
    }
  }

  /**
   * 将内容分割成 chunks
   */
  private splitIntoChunks(content: string): string[] {
    const chunks: string[] = [];
    const words = content.split(/(\s+)/);

    let currentChunk = "";
    for (const word of words) {
      currentChunk += word;
      // 每 3-5 个词作为一个 chunk
      if (currentChunk.length >= 10 + Math.random() * 10) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(messages: ChatMessage[]): number {
    // 简单估算：每 4 个字符约 1 个 token
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * 判断是否应该模拟错误
   */
  private shouldError(): boolean {
    return Math.random() < (this.config.errorRate || 0);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let mockProviderInstance: MockLLMProvider | null = null;

/**
 * 获取 Mock Provider 单例
 */
export function getMockLLMProvider(): MockLLMProvider {
  if (!mockProviderInstance) {
    const enabled = process.env["USE_MOCK_LLM"] === "true";
    mockProviderInstance = new MockLLMProvider({ enabled });
  }
  return mockProviderInstance;
}

/**
 * 检查是否应该使用 Mock Provider
 */
export function shouldUseMockLLM(): boolean {
  return process.env["USE_MOCK_LLM"] === "true";
}

/**
 * 重置 Mock Provider (用于测试)
 */
export function resetMockLLMProvider(): void {
  mockProviderInstance = null;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建 Mock 模型配置
 *
 * 用于在模型列表中添加 Mock 模型
 */
export function createMockModelConfig() {
  return {
    id: "mock-gpt-4",
    name: "Mock GPT-4 (Testing)",
    api: "openai-completions" as const,
    reasoning: false,
    input: ["text"] as Array<"text" | "image">,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 128000,
    maxTokens: 4096,
  };
}

/**
 * 创建 Mock Provider 配置
 */
export function createMockProviderConfig() {
  return {
    baseUrl: "http://localhost:0/mock",
    apiKey: "mock-api-key",
    api: "openai-completions" as const,
    models: [createMockModelConfig()],
  };
}
