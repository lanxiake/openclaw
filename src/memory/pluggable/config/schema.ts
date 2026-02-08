/**
 * 记忆系统配置模式
 *
 * 使用 Zod 定义配置验证模式。
 *
 * @module memory/pluggable/config
 */

import { z } from 'zod'

// ==================== 提供者配置模式 ====================

/**
 * 通用提供者配置模式
 *
 * 注意: Zod v4 要求 z.record 使用双参数形式
 */
export const ProviderConfigSchema = z.object({
  /** 提供者名称 */
  provider: z.string().min(1, '提供者名称不能为空'),
  /** 提供者选项 - 使用 z.record(z.string(), z.unknown()) 兼容 Zod v4 */
  options: z.record(z.string(), z.unknown()),
})

// ==================== Mem0 配置模式 ====================

/**
 * Mem0 提供者配置
 */
export const Mem0ConfigSchema = z.object({
  /** Mem0 Cloud API Key */
  apiKey: z.string().optional(),
  /** 自托管 Mem0 服务地址 */
  baseUrl: z.string().url().optional(),
  /** 会话 TTL（毫秒） */
  sessionTtl: z.number().positive().optional(),
  /** 是否同步到远程 */
  syncToRemote: z.boolean().optional(),
})

export type Mem0Config = z.infer<typeof Mem0ConfigSchema>

// ==================== Redis 配置模式 ====================

/**
 * Redis 提供者配置
 */
export const RedisConfigSchema = z.object({
  /** Redis 连接 URL */
  url: z.string().url(),
  /** 键前缀 */
  keyPrefix: z.string().optional(),
  /** 连接超时（毫秒） */
  connectTimeout: z.number().positive().optional(),
})

export type RedisConfig = z.infer<typeof RedisConfigSchema>

// ==================== PostgreSQL 配置模式 ====================

/**
 * PostgreSQL 提供者配置
 */
export const PostgresConfigSchema = z.object({
  /** 数据库连接 URL */
  url: z.string().min(1, '数据库 URL 不能为空'),
  /** Schema 名称 */
  schema: z.string().optional(),
  /** 连接池配置 */
  pool: z.object({
    min: z.number().nonnegative().optional(),
    max: z.number().positive().optional(),
  }).optional(),
})

export type PostgresConfig = z.infer<typeof PostgresConfigSchema>

// ==================== Milvus 配置模式 ====================

/**
 * Milvus 向量数据库配置
 */
export const MilvusConfigSchema = z.object({
  /** 服务地址 */
  address: z.string().min(1, 'Milvus 地址不能为空'),
  /** 认证 Token */
  token: z.string().optional(),
  /** 数据库名称 */
  database: z.string().optional(),
  /** 集合前缀 */
  collectionPrefix: z.string().optional(),
})

export type MilvusConfig = z.infer<typeof MilvusConfigSchema>

// ==================== Neo4j 配置模式 ====================

/**
 * Neo4j 图数据库配置
 */
export const Neo4jConfigSchema = z.object({
  /** 连接 URI */
  uri: z.string().min(1, 'Neo4j URI 不能为空'),
  /** 用户名 */
  username: z.string().min(1, '用户名不能为空'),
  /** 密码 */
  password: z.string().min(1, '密码不能为空'),
  /** 数据库名称 */
  database: z.string().optional(),
})

export type Neo4jConfig = z.infer<typeof Neo4jConfigSchema>

// ==================== MinIO 配置模式 ====================

/**
 * MinIO 对象存储配置
 */
export const MinIOConfigSchema = z.object({
  /** 服务端点 */
  endpoint: z.string().min(1, 'MinIO 端点不能为空'),
  /** 端口 */
  port: z.number().positive().optional(),
  /** 是否使用 SSL */
  useSSL: z.boolean().optional(),
  /** 访问密钥 */
  accessKey: z.string().min(1, 'Access Key 不能为空'),
  /** 密钥 */
  secretKey: z.string().min(1, 'Secret Key 不能为空'),
  /** 区域 */
  region: z.string().optional(),
  /** 存储桶配置 */
  buckets: z.object({
    documents: z.string().optional(),
    media: z.string().optional(),
    temp: z.string().optional(),
    exports: z.string().optional(),
  }).optional(),
})

export type MinIOConfig = z.infer<typeof MinIOConfigSchema>

// ==================== 嵌入模型配置模式 ====================

/**
 * 嵌入模型配置
 */
export const EmbeddingConfigSchema = z.object({
  /** 提供者 */
  provider: z.enum(['openai', 'gemini', 'local']),
  /** 模型名称 */
  model: z.string().optional(),
  /** 向量维度 */
  dimensions: z.number().positive().optional(),
  /** API Key */
  apiKey: z.string().optional(),
  /** 基础 URL */
  baseUrl: z.string().url().optional(),
})

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>

// ==================== 知识记忆配置模式 ====================

/**
 * 知识记忆提供者配置（Graphiti）
 */
export const GraphitiConfigSchema = z.object({
  /** Milvus 配置 */
  milvus: MilvusConfigSchema,
  /** Neo4j 配置 */
  neo4j: Neo4jConfigSchema,
  /** 嵌入模型配置 */
  embedding: EmbeddingConfigSchema.optional(),
})

export type GraphitiConfig = z.infer<typeof GraphitiConfigSchema>

// ==================== 记忆管理器配置模式 ====================

/**
 * 记忆管理器完整配置
 */
export const MemoryManagerConfigSchema = z.object({
  /** 工作记忆配置 */
  working: ProviderConfigSchema,
  /** 情节记忆配置 */
  episodic: ProviderConfigSchema,
  /** 画像记忆配置 */
  profile: ProviderConfigSchema,
  /** 知识记忆配置 */
  knowledge: ProviderConfigSchema,
  /** 对象存储配置 */
  storage: ProviderConfigSchema,
})

export type MemoryManagerConfig = z.infer<typeof MemoryManagerConfigSchema>

// ==================== 默认配置 ====================

/**
 * 开发环境默认配置
 *
 * 使用内存和本地存储，无需外部服务
 */
export const DEFAULT_DEV_CONFIG: MemoryManagerConfig = {
  working: {
    provider: 'memory',
    options: {},
  },
  episodic: {
    provider: 'memory',
    options: {},
  },
  profile: {
    provider: 'memory',
    options: {},
  },
  knowledge: {
    provider: 'simple',
    options: {},
  },
  storage: {
    provider: 'local',
    options: {
      basePath: './.memory/storage',
    },
  },
}

/**
 * 生产环境推荐配置模板
 *
 * 需要替换实际的配置值
 */
export const PRODUCTION_CONFIG_TEMPLATE: MemoryManagerConfig = {
  working: {
    provider: 'mem0',
    options: {
      apiKey: '${MEM0_API_KEY}',
    },
  },
  episodic: {
    provider: 'mem0',
    options: {
      apiKey: '${MEM0_API_KEY}',
    },
  },
  profile: {
    provider: 'postgres',
    options: {
      url: '${DATABASE_URL}',
    },
  },
  knowledge: {
    provider: 'graphiti',
    options: {
      milvus: {
        address: '${MILVUS_ADDRESS}',
      },
      neo4j: {
        uri: '${NEO4J_URI}',
        username: '${NEO4J_USER}',
        password: '${NEO4J_PASSWORD}',
      },
    },
  },
  storage: {
    provider: 'minio',
    options: {
      endpoint: '${MINIO_ENDPOINT}',
      accessKey: '${MINIO_ACCESS_KEY}',
      secretKey: '${MINIO_SECRET_KEY}',
    },
  },
}

// ==================== 配置验证函数 ====================

/**
 * 验证记忆管理器配置
 *
 * @param config - 待验证的配置
 * @returns 验证后的配置
 * @throws ZodError 如果验证失败
 */
export function validateConfig(config: unknown): MemoryManagerConfig {
  return MemoryManagerConfigSchema.parse(config)
}

/**
 * 安全验证配置（不抛出错误）
 *
 * @param config - 待验证的配置
 * @returns 验证结果
 */
export function safeValidateConfig(config: unknown): {
  success: boolean
  data?: MemoryManagerConfig
  error?: string
} {
  const result = MemoryManagerConfigSchema.safeParse(config)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    error: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
  }
}
