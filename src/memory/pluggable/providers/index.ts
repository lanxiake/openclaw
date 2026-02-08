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
  createWorkingMemoryProvider,
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,
  createObjectStorageProvider,
} from './factory.js'

// 工作记忆提供者
export { MemoryWorkingMemoryProvider, type MemoryWorkingConfig } from './working/index.js'

// 情节记忆提供者
export { MemoryEpisodicMemoryProvider } from './episodic/index.js'

// 画像记忆提供者
export { MemoryProfileMemoryProvider } from './profile/index.js'

// 知识记忆提供者
export { SimpleKnowledgeMemoryProvider, SQLiteKnowledgeMemoryAdapter, type SQLiteKnowledgeConfig } from './knowledge/index.js'

// 对象存储提供者
export { LocalObjectStorageProvider } from './storage/index.js'

// 自动注册内置提供者
import './working/index.js'
import './episodic/index.js'
import './profile/index.js'
import './knowledge/index.js'
import './storage/index.js'
