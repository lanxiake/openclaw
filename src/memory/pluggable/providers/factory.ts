/**
 * 提供者工厂
 *
 * 使用工厂模式创建记忆提供者实例，支持动态注册和类型安全创建。
 *
 * @module memory/pluggable/providers
 */

import type {
  IMemoryProvider,
  IWorkingMemoryProvider,
  IEpisodicMemoryProvider,
  IProfileMemoryProvider,
  IKnowledgeMemoryProvider,
  IObjectStorageProvider,
  ProviderConfig,
  ProviderConstructor,
} from "../interfaces/index.js";


