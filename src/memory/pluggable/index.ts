/**
 * 可插拔记忆系统
 *
 * 提供统一的记忆管理接口，支持多种后端实现：
 * - 工作记忆 (Working Memory): 当前对话的临时上下文
 * - 情节记忆 (Episodic Memory): 长期对话历史和关键事件
 * - 画像记忆 (Profile Memory): 用户事实、偏好和行为模式
 * - 知识记忆 (Knowledge Memory): 文档、向量索引和知识图谱
 * - 对象存储 (Object Storage): 多媒体文件存储
 *
 * ## 设计原则
 *
 * 1. **可插拔架构**: 统一接口，支持多种后端实现
 * 2. **独立部署**: 可作为独立服务或嵌入式模块使用
 * 3. **渐进迁移**: 支持从现有系统平滑迁移
 *
 * ## 快速开始
 *
 * ```typescript
 * import {
 *   createWorkingMemoryProvider,
 *   MemoryWorkingMemoryProvider,
 * } from './memory/pluggable'
 *
 * // 创建提供者
 * const provider = createWorkingMemoryProvider({
 *   provider: 'memory',
 *   options: {},
 * })
 *
 * // 初始化
 * await provider.initialize()
 *
 * // 使用
 * const sessionId = await provider.createSession('user-123')
 * await provider.addMessage(sessionId, {
 *   role: 'user',
 *   content: 'Hello',
 * })
 *
 * // 关闭
 * await provider.shutdown()
 * ```
 *
 * @module memory/pluggable
 */

// ==================== 接口 ====================

// 基础接口
export type {
  HealthStatus,
  HealthStatusLevel,
  ProviderConfig,
  IMemoryProvider,
  ProviderConstructor,
} from "./interfaces/index.js";

// 工作记忆接口
export type {
  SessionOptions,
  MessageRole,
  ToolCall,
  ToolResult,
  Message,
  ToolState,
  PendingConfirm,
  WorkingMemory,
  SessionInfo,
  IWorkingMemoryProvider,
} from "./interfaces/index.js";

// 情节记忆接口
export type {
  ConversationSummary,
  KeyEventType,
  KeyEvent,
  EmotionalRecord,
  EmotionTrend,
  EpisodicQueryOptions,
  EventQueryOptions,
  EpisodicSearchOptions,
  EpisodeSearchResult,
  TimelineEntry,
  IEpisodicMemoryProvider,
} from "./interfaces/index.js";

// 画像记忆接口
export type {
  FactCategory,
  UserFact,
  UserPreferences,
  BehaviorPatternType,
  BehaviorPattern,
  ExtractedProfile,
  IProfileMemoryProvider,
} from "./interfaces/index.js";
export { DEFAULT_USER_PREFERENCES } from "./interfaces/index.js";

// 知识记忆接口
export type {
  DocumentSource,
  DocumentStatus,
  DocumentInput,
  DocumentChunk,
  KnowledgeDocument,
  Entity,
  Relationship,
  Community,
  SearchResult,
  VectorSearchOptions,
  HybridSearchOptions,
  GraphQuery,
  GraphQueryResult,
  EntityContext,
  GraphAnswer,
  DocumentListOptions,
  IKnowledgeMemoryProvider,
} from "./interfaces/index.js";

// 对象存储接口
export type {
  UploadOptions,
  MultipartUploadOptions,
  StorageListOptions,
  ListResult,
  ObjectMetadata,
  ObjectInfo,
  BucketInfo,
  StorageUsage,
  IObjectStorageProvider,
} from "./interfaces/index.js";

// ==================== 提供者 ====================

// 工厂
export {
  type MemoryType,
  registerProvider,
  unregisterProvider,
  createProvider,
  getAvailableProviders,
  hasProvider,
  getAllProviders,
  clearRegistry,
  createWorkingMemoryProvider,
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,
  createObjectStorageProvider,
} from "./providers/index.js";

// 内置提供者
export {
  MemoryWorkingMemoryProvider,
  type MemoryWorkingConfig,
  MemoryEpisodicMemoryProvider,
  MemoryProfileMemoryProvider,
  SimpleKnowledgeMemoryProvider,
  SQLiteKnowledgeMemoryAdapter,
  type SQLiteKnowledgeConfig,
  LocalObjectStorageProvider,
} from "./providers/index.js";

// ==================== 配置 ====================

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
} from "./config/index.js";

// ==================== 管理器 ====================

export {
  type MemoryManagerStatus,
  type MemoryHealthReport,
  type MemoryManagerOptions,
  MemoryManager,
  createMemoryManager,
} from "./manager.js";
