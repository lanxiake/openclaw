/**
 * 缓存工具模块 - Cache Utils
 *
 * 提供多种缓存策略：
 * - LRU 缓存 (最近最少使用)
 * - TTL 缓存 (带过期时间)
 * - 请求去重
 * - 防抖/节流
 */

// ============================================================================
// LRU 缓存
// ============================================================================

/**
 * LRU 缓存配置
 */
interface LRUCacheOptions {
  /** 最大容量 */
  maxSize: number
  /** 过期时间 (毫秒)，0 表示不过期 */
  ttl?: number
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  value: T
  createdAt: number
  accessedAt: number
}

/**
 * LRU 缓存实现
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>
  private maxSize: number
  private ttl: number

  constructor(options: LRUCacheOptions) {
    this.cache = new Map()
    this.maxSize = options.maxSize
    this.ttl = options.ttl || 0
  }

  /**
   * 获取缓存值
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    // 更新访问时间，移动到末尾（最近使用）
    entry.accessedAt = Date.now()
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * 设置缓存值
   */
  set(key: K, value: V): void {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // 如果超出容量，删除最久未使用的
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    const now = Date.now()
    this.cache.set(key, {
      value,
      createdAt: now,
      accessedAt: now,
    })
  }

  /**
   * 检查是否存在
   */
  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * 删除缓存
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    if (this.ttl <= 0) return 0

    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttl) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }
}

// ============================================================================
// 请求缓存 (带去重)
// ============================================================================

/**
 * 请求缓存配置
 */
interface RequestCacheOptions {
  /** 缓存过期时间 (毫秒) */
  ttl: number
  /** 最大并发请求数 */
  maxConcurrent?: number
}

/**
 * 请求缓存 - 自动去重和缓存
 */
export class RequestCache<T> {
  private cache: LRUCache<string, T>
  private pending: Map<string, Promise<T>>
  private maxConcurrent: number

  constructor(options: RequestCacheOptions) {
    this.cache = new LRUCache<string, T>({ maxSize: 100, ttl: options.ttl })
    this.pending = new Map()
    this.maxConcurrent = options.maxConcurrent || 10
  }

  /**
   * 获取或请求数据
   *
   * @param key 缓存键
   * @param fetcher 获取数据的函数
   * @returns 数据
   */
  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    // 1. 检查缓存
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    // 2. 检查是否有相同的请求正在进行
    const pending = this.pending.get(key)
    if (pending) {
      return pending
    }

    // 3. 检查并发限制
    if (this.pending.size >= this.maxConcurrent) {
      // 等待一个请求完成
      await Promise.race(this.pending.values())
    }

    // 4. 发起新请求
    const promise = fetcher()
      .then((result) => {
        this.cache.set(key, result)
        return result
      })
      .finally(() => {
        this.pending.delete(key)
      })

    this.pending.set(key, promise)
    return promise
  }

  /**
   * 使缓存失效
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// 防抖函数
// ============================================================================

/**
 * 防抖函数
 *
 * @param fn 要防抖的函数
 * @param delay 延迟时间 (毫秒)
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 带取消功能的防抖
 */
export function debounceCancelable<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): { run: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return {
    run: (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        fn(...args)
        timeoutId = null
      }, delay)
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    },
  }
}

// ============================================================================
// 节流函数
// ============================================================================

/**
 * 节流函数
 *
 * @param fn 要节流的函数
 * @param limit 时间限制 (毫秒)
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()

    if (now - lastRun >= limit) {
      fn(...args)
      lastRun = now
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn(...args)
        lastRun = Date.now()
        timeoutId = null
      }, limit - (now - lastRun))
    }
  }
}

// ============================================================================
// Memoization
// ============================================================================

/**
 * 简单的 memoize 函数
 *
 * @param fn 要缓存的函数
 * @param keyFn 生成缓存键的函数
 * @returns 缓存后的函数
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}

/**
 * 带过期时间的 memoize
 */
export function memoizeWithTTL<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttl: number,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new LRUCache<string, ReturnType<T>>({ maxSize: 100, ttl })

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args)
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}

// ============================================================================
// 批量处理
// ============================================================================

/**
 * 批量处理器配置
 */
interface BatchProcessorOptions {
  /** 批量大小 */
  batchSize: number
  /** 延迟时间 (毫秒) */
  delay: number
}

/**
 * 批量处理器 - 将多个请求合并处理
 */
export class BatchProcessor<T, R> {
  private queue: Array<{ item: T; resolve: (result: R) => void; reject: (error: Error) => void }>
  private processor: (items: T[]) => Promise<R[]>
  private batchSize: number
  private delay: number
  private timeoutId: ReturnType<typeof setTimeout> | null

  constructor(processor: (items: T[]) => Promise<R[]>, options: BatchProcessorOptions) {
    this.queue = []
    this.processor = processor
    this.batchSize = options.batchSize
    this.delay = options.delay
    this.timeoutId = null
  }

  /**
   * 添加项目到队列
   */
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })

      if (this.queue.length >= this.batchSize) {
        this.flush()
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.delay)
      }
    })
  }

  /**
   * 立即处理队列
   */
  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.queue.length === 0) return

    const batch = this.queue.splice(0, this.batchSize)
    const items = batch.map((b) => b.item)

    try {
      const results = await this.processor(items)
      batch.forEach((b, index) => {
        b.resolve(results[index])
      })
    } catch (error) {
      batch.forEach((b) => {
        b.reject(error instanceof Error ? error : new Error(String(error)))
      })
    }
  }
}

// ============================================================================
// 文件系统缓存
// ============================================================================

/**
 * 文件信息缓存
 */
export interface FileInfoCache {
  path: string
  size: number
  isDirectory: boolean
  modifiedAt: number
  cachedAt: number
}

/**
 * 目录列表缓存
 */
export class DirectoryCache {
  private cache: LRUCache<string, FileInfoCache[]>

  constructor(ttl: number = 5000) {
    this.cache = new LRUCache({ maxSize: 50, ttl })
  }

  /**
   * 获取目录内容
   */
  get(path: string): FileInfoCache[] | undefined {
    return this.cache.get(path)
  }

  /**
   * 设置目录内容
   */
  set(path: string, files: FileInfoCache[]): void {
    this.cache.set(path, files)
  }

  /**
   * 使目录缓存失效
   */
  invalidate(path: string): void {
    this.cache.delete(path)
  }

  /**
   * 使所有以某路径开头的缓存失效
   */
  invalidatePrefix(prefix: string): void {
    // 由于 LRUCache 不支持遍历，需要额外实现
    // 这里简单地清空所有缓存
    this.cache.clear()
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// 导出默认实例
// ============================================================================

/**
 * 默认目录缓存实例
 */
export const directoryCache = new DirectoryCache()

/**
 * 默认请求缓存实例
 */
export const requestCache = new RequestCache<unknown>({ ttl: 30000 })
