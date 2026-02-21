/**
 * 记忆系统配置模式
 *
 * 使用 Zod 定义配置验证模式。
 *
 * @module memory/pluggable/config
 */

import { z } from "zod";

// ==================== 提供者配置模式 ====================

/**
 * 通用提供者配置模式
 *
 * 注意: Zod v4 要求 z.record 使用双参数形式
 */
export const ProviderConfigSchema = z.object({
  /** 提供者名称 */
  provider: z.string().min(1, "提供者名称不能为空"),
  /** 提供者选项 - 使用 z.record(z.string(), z.unknown()) 兼容 Zod v4 */
  options: z.record(z.string(), z.unknown()),
});

// ==================== PostgreSQL 配置模式 ====================

/**
 * PostgreSQL 提供者配置
 */
export const PostgresConfigSchema = z.object({
  /** 数据库连接 URL */
  url: z.string().min(1, "数据库 URL 不能为空"),
  /** Schema 名称 */
  schema: z.string().optional(),
  /** 连接池配置 */
  pool: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().positive().optional(),
    })
    .optional(),
});

export type PostgresConfig = z.infer<typeof PostgresConfigSchema>;

// ==================== 嵌入模型配置模式 ====================

/**
 * 嵌入模型配置
 */
export const EmbeddingConfigSchema = z.object({
  /** 提供者 */
  provider: z.enum(["openai", "gemini", "local"]),
  /** 模型名称 */
  model: z.string().optional(),
  /** 向量维度 */
  dimensions: z.number().positive().optional(),
  /** API Key */
  apiKey: z.string().optional(),
  /** 基础 URL */
  baseUrl: z.string().url().optional(),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ==================== LLM 配置模式 ====================

/**
 * LLM 调用配置
 *
 * 用于对话摘要、画像提取等需要 LLM 能力的功能。
 * 如果未配置或 API Key 不可用，相关功能将回退到朴素实现。
 */
export const LLMConfigSchema = z.object({
  /** 是否启用 LLM 功能 */
  enabled: z.boolean().default(true),
  /** LLM 提供者（如 "anthropic"） */
  provider: z.string().default("anthropic"),
  /** 模型名称 */
  model: z.string().default("anyrouter/claude-opus-4-6"),
  /** 最大生成 token 数 */
  maxTokens: z.number().positive().default(1024),
  /** 温度参数 (0-1) */
  temperature: z.number().min(0).max(1).default(0.3),
  /** 超时时间（毫秒） */
  timeoutMs: z.number().positive().default(30_000),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// ==================== 记忆管理器配置模式 ====================

/**
 * 记忆管理器完整配置
 */
export const MemoryManagerConfigSchema = z.object({
  /** 情节记忆配置 */
  episodic: ProviderConfigSchema,
  /** 画像记忆配置 */
  profile: ProviderConfigSchema,
  /** 知识记忆配置 */
  knowledge: ProviderConfigSchema,
  /** LLM 配置（可选，未配置时回退朴素实现） */
  llm: LLMConfigSchema.optional(),
});

export type MemoryManagerConfig = z.infer<typeof MemoryManagerConfigSchema>;

// ==================== 默认配置 ====================

/**
 * 开发环境默认配置
 *
 * 使用内存实现，无需外部服务
 */
export const DEFAULT_DEV_CONFIG: MemoryManagerConfig = {
  episodic: {
    provider: "memory",
    options: {},
  },
  profile: {
    provider: "memory",
    options: {},
  },
  knowledge: {
    provider: "simple",
    options: {},
  },
};

/**
 * 生产环境推荐配置模板
 *
 * 使用 PostgreSQL 作为后端存储
 */
export const PRODUCTION_CONFIG_TEMPLATE: MemoryManagerConfig = {
  episodic: {
    provider: "postgres",
    options: {
      url: "${DATABASE_URL}",
    },
  },
  profile: {
    provider: "postgres",
    options: {
      url: "${DATABASE_URL}",
    },
  },
  knowledge: {
    provider: "postgres",
    options: {
      url: "${DATABASE_URL}",
    },
  },
};

// ==================== 配置验证函数 ====================

/**
 * 验证记忆管理器配置
 *
 * @param config - 待验证的配置
 * @returns 验证后的配置
 * @throws ZodError 如果验证失败
 */
export function validateConfig(config: unknown): MemoryManagerConfig {
  return MemoryManagerConfigSchema.parse(config);
}

/**
 * 安全验证配置（不抛出错误）
 *
 * @param config - 待验证的配置
 * @returns 验证结果
 */
export function safeValidateConfig(config: unknown): {
  success: boolean;
  data?: MemoryManagerConfig;
  error?: string;
} {
  const result = MemoryManagerConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
  };
}
