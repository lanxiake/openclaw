/**
 * 提供者模块导出
 *
 * @module memory/pluggable/providers
 */

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
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,
} from "./factory.js";

// 情节记忆提供者
export { MemoryEpisodicMemoryProvider, PostgresEpisodicMemoryProvider } from "./episodic/index.js";

// 画像记忆提供者
export { MemoryProfileMemoryProvider, PostgresProfileMemoryProvider } from "./profile/index.js";

// 知识记忆提供者
export {
  SimpleKnowledgeMemoryProvider,
  SQLiteKnowledgeMemoryAdapter,
  type SQLiteKnowledgeConfig,
  PostgresKnowledgeMemoryProvider,
} from "./knowledge/index.js";

// 自动注册内置提供者
import "./episodic/index.js";
import "./profile/index.js";
import "./knowledge/index.js";
