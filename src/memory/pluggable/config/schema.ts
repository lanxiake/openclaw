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
    provider: "simple",
    options: {},
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
