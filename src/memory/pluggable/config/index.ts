/**
 * 配置模块导出
 *
 * @module memory/pluggable/config
 */

export {
  // 配置模式
  ProviderConfigSchema,
  PostgresConfigSchema,
  EmbeddingConfigSchema,
  LLMConfigSchema,
  MemoryManagerConfigSchema,

  // 类型
  type PostgresConfig,
  type EmbeddingConfig,
  type LLMConfig,
  type MemoryManagerConfig,

  // 默认配置
  DEFAULT_DEV_CONFIG,
  PRODUCTION_CONFIG_TEMPLATE,

  // 验证函数
  validateConfig,
  safeValidateConfig,
} from "./schema.js";
