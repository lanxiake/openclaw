/**
 * 可插拔记忆系统接口定义
 *
 * 本模块导出所有记忆类型的接口定义，用于实现可插拔的记忆后端。
 *
 * @module memory/pluggable/interfaces
 */

// 基础接口
export type {
  HealthStatus,
  HealthStatusLevel,
  ProviderConfig,
  IMemoryProvider,
  ProviderConstructor,
} from "./memory-provider.js";

// 公共类型（从 types.ts 提取）
export type {
  MessageRole,
  ToolCall,
  ToolResult,
  Message,
} from "./types.js";

// 情节记忆
export type {
  ConversationSummary,
  KeyEventType,
  KeyEvent,
  EpisodicQueryOptions,
  EventQueryOptions,
  EpisodicSearchOptions,
  EpisodeSearchResult,
  TimelineEntry,
  IEpisodicMemoryProvider,
} from "./episodic-memory.js";

// 画像记忆
export type {
  FactCategory,
  UserFact,
  UserPreferences,
  BehaviorPatternType,
  BehaviorPattern,
  ExtractedProfile,
  IProfileMemoryProvider,
} from "./profile-memory.js";
export { DEFAULT_USER_PREFERENCES } from "./profile-memory.js";

// 知识记忆
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
} from "./knowledge-memory.js";

