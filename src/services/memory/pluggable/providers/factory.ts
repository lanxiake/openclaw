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

/**
 * 记忆类型
 */
export type MemoryType = "working" | "episodic" | "profile" | "knowledge" | "storage";

/**
 * 提供者注册表
 *
 * 使用 Map 存储已注册的提供者构造函数
 */
const providerRegistry = new Map<string, ProviderConstructor>();

/**
 * 生成注册键
 *
 * @param type - 记忆类型
 * @param name - 提供者名称
 * @returns 注册键
 */
function getRegistryKey(type: MemoryType, name: string): string {
  return `${type}:${name}`;
}

/**
 * 注册提供者
 *
 * 将提供者构造函数注册到工厂，以便后续通过配置创建实例。
 *
 * @param type - 记忆类型
 * @param name - 提供者名称（如 mem0, redis, postgres）
 * @param constructor - 提供者构造函数
 *
 * @example
 * ```typescript
 * registerProvider('working', 'mem0', Mem0WorkingMemoryProvider)
 * registerProvider('storage', 'minio', MinIOStorageProvider)
 * ```
 */
export function registerProvider<T extends IMemoryProvider>(
  type: MemoryType,
  name: string,
  constructor: ProviderConstructor<T>,
): void {
  const key = getRegistryKey(type, name);

  if (providerRegistry.has(key)) {
    console.warn(`[MemoryProviderFactory] 覆盖已存在的提供者: ${key}`);
  }

  providerRegistry.set(key, constructor as ProviderConstructor);
  console.log(`[MemoryProviderFactory] 注册提供者: ${key}`);
}

/**
 * 注销提供者
 *
 * @param type - 记忆类型
 * @param name - 提供者名称
 * @returns 是否成功注销
 */
export function unregisterProvider(type: MemoryType, name: string): boolean {
  const key = getRegistryKey(type, name);
  const result = providerRegistry.delete(key);

  if (result) {
    console.log(`[MemoryProviderFactory] 注销提供者: ${key}`);
  }

  return result;
}

/**
 * 创建提供者实例
 *
 * 根据配置创建对应的提供者实例。
 *
 * @param type - 记忆类型
 * @param config - 提供者配置
 * @returns 提供者实例
 *
 * @throws Error 如果提供者未注册
 *
 * @example
 * ```typescript
 * const provider = createProvider<IWorkingMemoryProvider>('working', {
 *   provider: 'mem0',
 *   options: { apiKey: 'xxx' },
 * })
 * ```
 */
export function createProvider<T extends IMemoryProvider>(
  type: MemoryType,
  config: ProviderConfig,
): T {
  const key = getRegistryKey(type, config.provider);
  const Constructor = providerRegistry.get(key);

  if (!Constructor) {
    const available = getAvailableProviders(type);
    throw new Error(
      `[MemoryProviderFactory] 未知的记忆提供者: ${key}。` +
        `可用的 ${type} 提供者: ${available.length > 0 ? available.join(", ") : "(无)"}`,
    );
  }

  console.log(`[MemoryProviderFactory] 创建提供者: ${key}`);
  return new Constructor(config.options) as T;
}

/**
 * 获取可用的提供者列表
 *
 * @param type - 记忆类型
 * @returns 提供者名称列表
 *
 * @example
 * ```typescript
 * const workingProviders = getAvailableProviders('working')
 * // => ['mem0', 'redis', 'memory']
 * ```
 */
export function getAvailableProviders(type: MemoryType): string[] {
  const prefix = `${type}:`;
  const result: string[] = [];

  for (const key of providerRegistry.keys()) {
    if (key.startsWith(prefix)) {
      result.push(key.slice(prefix.length));
    }
  }

  return result.sort();
}

/**
 * 检查提供者是否已注册
 *
 * @param type - 记忆类型
 * @param name - 提供者名称
 * @returns 是否已注册
 */
export function hasProvider(type: MemoryType, name: string): boolean {
  return providerRegistry.has(getRegistryKey(type, name));
}

/**
 * 获取所有已注册的提供者
 *
 * @returns 提供者信息列表
 */
export function getAllProviders(): Array<{ type: MemoryType; name: string }> {
  const result: Array<{ type: MemoryType; name: string }> = [];

  for (const key of providerRegistry.keys()) {
    const [type, name] = key.split(":") as [MemoryType, string];
    result.push({ type, name });
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * 清空注册表
 *
 * 主要用于测试
 */
export function clearRegistry(): void {
  providerRegistry.clear();
  console.log("[MemoryProviderFactory] 清空注册表");
}

// ==================== 类型安全的创建函数 ====================

/**
 * 创建工作记忆提供者
 *
 * @param config - 提供者配置
 * @returns 工作记忆提供者实例
 */
export function createWorkingMemoryProvider(config: ProviderConfig): IWorkingMemoryProvider {
  return createProvider<IWorkingMemoryProvider>("working", config);
}

/**
 * 创建情节记忆提供者
 *
 * @param config - 提供者配置
 * @returns 情节记忆提供者实例
 */
export function createEpisodicMemoryProvider(config: ProviderConfig): IEpisodicMemoryProvider {
  return createProvider<IEpisodicMemoryProvider>("episodic", config);
}

/**
 * 创建画像记忆提供者
 *
 * @param config - 提供者配置
 * @returns 画像记忆提供者实例
 */
export function createProfileMemoryProvider(config: ProviderConfig): IProfileMemoryProvider {
  return createProvider<IProfileMemoryProvider>("profile", config);
}

/**
 * 创建知识记忆提供者
 *
 * @param config - 提供者配置
 * @returns 知识记忆提供者实例
 */
export function createKnowledgeMemoryProvider(config: ProviderConfig): IKnowledgeMemoryProvider {
  return createProvider<IKnowledgeMemoryProvider>("knowledge", config);
}

/**
 * 创建对象存储提供者
 *
 * @param config - 提供者配置
 * @returns 对象存储提供者实例
 */
export function createObjectStorageProvider(config: ProviderConfig): IObjectStorageProvider {
  return createProvider<IObjectStorageProvider>("storage", config);
}
