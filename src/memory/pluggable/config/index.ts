/**
 * 配置模块导出
 *
 * @module memory/pluggable/config
 */

export {
  // 配置模式
  ProviderConfigSchema,
  Mem0ConfigSchema,
  RedisConfigSchema,
  PostgresConfigSchema,
  MilvusConfigSchema,
  Neo4jConfigSchema,
  MinIOConfigSchema,
  EmbeddingConfigSchema,
  GraphitiConfigSchema,
  MemoryManagerConfigSchema,

  // 类型
  type Mem0Config,
  type RedisConfig,
  type PostgresConfig,
  type MilvusConfig,
  type Neo4jConfig,
  type MinIOConfig,
  type EmbeddingConfig,
  type GraphitiConfig,
  type MemoryManagerConfig,

  // 默认配置
  DEFAULT_DEV_CONFIG,
  PRODUCTION_CONFIG_TEMPLATE,

  // 验证函数
  validateConfig,
  safeValidateConfig,
} from './schema.js'
