/**
 * 记忆系统 LLM 服务
 *
 * 为记忆系统提供轻量级 LLM 调用能力。
 * 使用 `completeSimple` API 进行一次性调用，
 * 支持 API Key 解析、超时控制和优雅降级。
 *
 * @module memory/pluggable/llm/memory-llm-service
 */

import { completeSimple, getModel } from "@mariozechner/pi-ai";

import type { OpenClawConfig } from "../../../config/config.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";

const logger = createSubsystemLogger("memory/llm/service");

// ==================== 类型定义 ====================

/**
 * LLM 服务配置
 */
export interface MemoryLLMServiceConfig {
  /** LLM 提供者（如 "anthropic"） */
  provider: string;
  /** 模型名称（如 "claude-sonnet-4-20250514"） */
  model: string;
  /** 最大生成 token 数 */
  maxTokens: number;
  /** 温度参数 (0-1) */
  temperature: number;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 直接提供 API Key（测试用） */
  apiKey?: string;
  /** OpenClaw 配置（运行时解析 API Key） */
  cfg?: OpenClawConfig;
}

/**
 * LLM 完成结果
 */
export interface LLMCompletionResult {
  /** LLM 返回的文本 */
  text: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** token 使用量 */
  usage?: {
    input?: number;
    output?: number;
  };
}

/**
 * 默认 LLM 配置
 */
export const DEFAULT_LLM_CONFIG: Omit<MemoryLLMServiceConfig, "cfg"> = {
  provider: "anthropic",
  model: "anyrouter/claude-opus-4-6",
  maxTokens: 1024,
  temperature: 0.3,
  timeoutMs: 30_000,
};

// ==================== 内部辅助 ====================

/**
 * 解析 API Key
 *
 * 优先使用直接提供的 key，否则通过 resolveApiKeyForProvider 解析。
 *
 * @param config - LLM 服务配置
 * @returns API Key 或 undefined
 */
async function resolveApiKey(config: MemoryLLMServiceConfig): Promise<string | undefined> {
  // 直接提供的 key（测试场景）
  if (config.apiKey?.trim()) {
    return config.apiKey.trim();
  }

  // 通过 model-auth 解析
  if (config.cfg) {
    try {
      const { resolveApiKeyForProvider } = await import("../../../agents/model-auth.js");
      const auth = await resolveApiKeyForProvider({
        provider: config.provider,
        cfg: config.cfg,
      });
      return auth.apiKey?.trim() || undefined;
    } catch (error) {
      logger.debug("API Key 解析失败", {
        provider: config.provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  return undefined;
}

/**
 * 带超时的 Promise 包装
 *
 * @param promise - 原始 Promise
 * @param timeoutMs - 超时时间
 * @returns 包装后的 Promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LLM 调用超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ==================== LLM 服务 ====================

/**
 * 记忆系统 LLM 服务
 *
 * 提供轻量级的 LLM 调用能力，用于：
 * - 对话摘要生成
 * - 用户画像提取
 * - 其他需要 LLM 的记忆系统功能
 *
 * 设计原则：
 * - 无 API Key 时静默降级，不阻塞记忆系统其他功能
 * - 所有调用有超时保护
 * - 错误不向上抛出，通过 result.success 标记
 *
 * @example
 * ```typescript
 * const service = new MemoryLLMService({
 *   provider: "anthropic",
 *   model: "claude-sonnet-4-20250514",
 *   maxTokens: 1024,
 *   temperature: 0.3,
 *   timeoutMs: 30000,
 *   cfg: openclawConfig,
 * });
 *
 * if (await service.isAvailable()) {
 *   const result = await service.complete("system prompt", "user message");
 *   if (result.success) {
 *     console.log(result.text);
 *   }
 * }
 * ```
 */
export class MemoryLLMService {
  private readonly config: MemoryLLMServiceConfig;

  /** 缓存的 API Key（避免重复解析） */
  private cachedApiKey: string | undefined;

  /** 是否已检查过可用性 */
  private availabilityChecked = false;

  /** 缓存的可用性结果 */
  private cachedAvailable = false;

  constructor(config: Partial<MemoryLLMServiceConfig> & { cfg?: OpenClawConfig }) {
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
    };

    logger.info("创建 LLM 服务", {
      provider: this.config.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      hasApiKey: Boolean(this.config.apiKey),
      hasCfg: Boolean(this.config.cfg),
    });
  }

  /**
   * 检查 LLM 服务是否可用
   *
   * 主要检查 API Key 是否可解析。
   * 结果会被缓存，后续调用直接返回。
   *
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    if (this.availabilityChecked) {
      return this.cachedAvailable;
    }

    try {
      const apiKey = await resolveApiKey(this.config);
      this.cachedApiKey = apiKey;
      this.cachedAvailable = Boolean(apiKey);
      this.availabilityChecked = true;

      logger.info("LLM 可用性检查", {
        available: this.cachedAvailable,
        provider: this.config.provider,
      });

      return this.cachedAvailable;
    } catch (error) {
      logger.debug("LLM 可用性检查失败", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.cachedAvailable = false;
      this.availabilityChecked = true;
      return false;
    }
  }

  /**
   * 重置可用性缓存
   *
   * 当 API Key 可能发生变化时调用（如配置更新后）。
   */
  resetAvailability(): void {
    this.availabilityChecked = false;
    this.cachedAvailable = false;
    this.cachedApiKey = undefined;
  }

  /**
   * 执行 LLM 完成调用
   *
   * @param systemPrompt - 系统 prompt
   * @param userMessage - 用户消息
   * @returns 完成结果
   */
  async complete(systemPrompt: string, userMessage: string): Promise<LLMCompletionResult> {
    // 确保 API Key 已解析
    if (!this.cachedApiKey) {
      const apiKey = await resolveApiKey(this.config);
      if (!apiKey) {
        return {
          text: "",
          success: false,
          error: "无可用的 API Key",
        };
      }
      this.cachedApiKey = apiKey;
    }

    try {
      // provider/model 在运行时确定，使用类型断言绕过编译期模型 ID 校验
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (getModel as any)(this.config.provider, this.config.model);

      logger.debug("开始 LLM 调用", {
        provider: this.config.provider,
        model: this.config.model,
        systemPromptLength: systemPrompt.length,
        userMessageLength: userMessage.length,
      });

      const startTime = Date.now();

      const response = await withTimeout(
        completeSimple(
          model,
          {
            systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage,
                timestamp: Date.now(),
              },
            ],
          },
          {
            apiKey: this.cachedApiKey,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
          },
        ),
        this.config.timeoutMs,
      );

      const durationMs = Date.now() - startTime;

      // 提取文本内容
      const text = extractResponseText(response);

      logger.info("LLM 调用完成", {
        durationMs,
        textLength: text.length,
        usage: response.usage,
      });

      return {
        text,
        success: true,
        usage: {
          input: response.usage?.input,
          output: response.usage?.output,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("LLM 调用失败", {
        error: message,
        provider: this.config.provider,
        model: this.config.model,
      });

      return {
        text: "",
        success: false,
        error: message,
      };
    }
  }

  /**
   * 执行 LLM 完成调用并解析 JSON 响应
   *
   * 封装 complete + JSON 解析，支持自定义解析器。
   *
   * @param systemPrompt - 系统 prompt
   * @param userMessage - 用户消息
   * @param parse - JSON 解析函数
   * @returns 解析后的结果，失败时返回 null
   */
  async completeJSON<T>(
    systemPrompt: string,
    userMessage: string,
    parse: (raw: string) => T,
  ): Promise<T | null> {
    const result = await this.complete(systemPrompt, userMessage);

    if (!result.success) {
      logger.debug("completeJSON: LLM 调用失败，跳过解析", {
        error: result.error,
      });
      return null;
    }

    try {
      return parse(result.text);
    } catch (error) {
      logger.warn("completeJSON: 响应解析失败", {
        error: error instanceof Error ? error.message : String(error),
        textLength: result.text.length,
      });
      return null;
    }
  }
}

// ==================== 响应文本提取 ====================

/**
 * 从 completeSimple 响应中提取文本
 *
 * @param response - completeSimple 返回值
 * @returns 提取的文本
 */
function extractResponseText(response: { content?: unknown }): string {
  const content = response.content;

  // 字符串内容
  if (typeof content === "string") {
    return content;
  }

  // ContentBlock 数组
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as Record<string, unknown>).type === "text" &&
        "text" in block &&
        typeof (block as Record<string, unknown>).text === "string"
      ) {
        texts.push((block as Record<string, unknown>).text as string);
      }
    }
    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  // 回退：尝试字符串化
  return String(content ?? "");
}
