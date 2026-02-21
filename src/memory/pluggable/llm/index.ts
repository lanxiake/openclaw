/**
 * 记忆系统 LLM 集成模块
 *
 * 为记忆系统提供 LLM 调用能力：
 * - MemoryLLMService: 轻量级 LLM 服务
 * - Prompts: 结构化 prompt 构建
 * - Response Parsers: LLM JSON 响应解析
 *
 * @module memory/pluggable/llm
 */

// ==================== LLM 服务 ====================

export {
  type MemoryLLMServiceConfig,
  type LLMCompletionResult,
  DEFAULT_LLM_CONFIG,
  MemoryLLMService,
} from "./memory-llm-service.js";

// ==================== Prompt 构建 ====================

export {
  buildSummarizationSystemPrompt,
  buildSummarizationUserMessage,
  buildProfileExtractionSystemPrompt,
  buildProfileExtractionUserMessage,
} from "./prompts.js";

// ==================== 响应解析 ====================

export {
  extractJSON,
  SummarizationResponseSchema,
  type SummarizationResponse,
  parseSummarizationResponse,
  ProfileExtractionResponseSchema,
  type ProfileExtractionResponse,
  parseProfileExtractionResponse,
} from "./response-parsers.js";
