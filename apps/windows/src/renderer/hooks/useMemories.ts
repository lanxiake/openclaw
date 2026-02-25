/**
 * useMemories Hook - 用户记忆管理
 *
 * 提供记忆的查询、创建、编辑、删除功能
 * 通过 IPC → REST API 与后端交互
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * 记忆类型
 */
export type MemoryType = 'episodic' | 'profile' | 'preference' | 'fact'

/**
 * 记忆条目
 */
export interface MemoryItem {
  id: string
  /** 记忆类型 */
  type: MemoryType
  /** 分类 */
  category?: string
  /** 内容 */
  content: string
  /** 摘要 */
  summary?: string
  /** 重要度 (1-10) */
  importance: number
  /** 来源类型 */
  sourceType?: string
  /** 是否激活 */
  isActive: boolean
  /** 附加数据 */
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/**
 * 记忆类型的中文标签
 */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  episodic: '情景记忆',
  profile: '用户画像',
  preference: '偏好设置',
  fact: '事实知识',
}

/**
 * useMemories 返回值
 */
interface UseMemoriesReturn {
  /** 记忆列表 */
  memories: MemoryItem[]
  /** 总数 */
  total: number
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 当前类型过滤 */
  typeFilter: MemoryType | ''
  /** 设置类型过滤 */
  setTypeFilter: (type: MemoryType | '') => void
  /** 刷新列表 */
  refresh: () => Promise<void>
  /** 加载更多 */
  loadMore: () => Promise<void>
  /** 是否有更多 */
  hasMore: boolean
  /** 创建记忆 */
  createMemory: (data: { type: MemoryType; content: string; category?: string; importance?: number }) => Promise<boolean>
  /** 更新记忆 */
  updateMemory: (id: string, data: { content?: string; category?: string; importance?: number }) => Promise<boolean>
  /** 删除记忆 */
  deleteMemory: (id: string) => Promise<boolean>
}

const PAGE_SIZE = 20

/**
 * 用户记忆管理 Hook
 */
export function useMemories(): UseMemoriesReturn {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<MemoryType | ''>('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  /**
   * 加载记忆列表（首页）
   */
  const fetchMemories = useCallback(async (type: MemoryType | '') => {
    console.log('[useMemories] 加载记忆列表', { type })
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.api.getMemories({
        type: type || undefined,
        activeOnly: true,
        limit: PAGE_SIZE,
        offset: 0,
      }) as {
        success: boolean
        data?: MemoryItem[]
        meta?: { total: number }
        error?: string
      }

      if (result.success) {
        setMemories(result.data ?? [])
        setTotal(result.meta?.total ?? 0)
        setOffset(PAGE_SIZE)
        setHasMore((result.data?.length ?? 0) >= PAGE_SIZE)
        console.log('[useMemories] 加载成功', { count: result.data?.length, total: result.meta?.total })
      } else {
        const errMsg = result.error ?? '获取记忆列表失败'
        console.error('[useMemories] 加载失败:', errMsg)
        setError(errMsg)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '获取记忆列表失败'
      console.error('[useMemories] 加载异常:', errMsg)
      setError(errMsg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 刷新
   */
  const refresh = useCallback(async () => {
    await fetchMemories(typeFilter)
  }, [fetchMemories, typeFilter])

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    try {
      const result = await window.electronAPI.api.getMemories({
        type: typeFilter || undefined,
        activeOnly: true,
        limit: PAGE_SIZE,
        offset,
      }) as {
        success: boolean
        data?: MemoryItem[]
        error?: string
      }

      if (result.success && result.data) {
        setMemories(prev => [...prev, ...result.data!])
        setOffset(prev => prev + PAGE_SIZE)
        setHasMore(result.data.length >= PAGE_SIZE)
      }
    } catch (err) {
      console.error('[useMemories] 加载更多失败:', err)
    }
  }, [hasMore, isLoading, typeFilter, offset])

  /**
   * 创建记忆
   */
  const createMemory = useCallback(async (data: {
    type: MemoryType
    content: string
    category?: string
    importance?: number
  }): Promise<boolean> => {
    console.log('[useMemories] 创建记忆', { type: data.type })
    try {
      const result = await window.electronAPI.api.createMemory(data) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        await refresh()
        return true
      }
      console.error('[useMemories] 创建失败:', result.error)
      return false
    } catch (err) {
      console.error('[useMemories] 创建异常:', err)
      return false
    }
  }, [refresh])

  /**
   * 更新记忆
   */
  const updateMemory = useCallback(async (id: string, data: {
    content?: string
    category?: string
    importance?: number
  }): Promise<boolean> => {
    console.log('[useMemories] 更新记忆', { id })
    try {
      const result = await window.electronAPI.api.updateMemory(id, data) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        await refresh()
        return true
      }
      console.error('[useMemories] 更新失败:', result.error)
      return false
    } catch (err) {
      console.error('[useMemories] 更新异常:', err)
      return false
    }
  }, [refresh])

  /**
   * 删除（停用）记忆
   */
  const deleteMemory = useCallback(async (id: string): Promise<boolean> => {
    console.log('[useMemories] 删除记忆', { id })
    try {
      const result = await window.electronAPI.api.deleteMemory(id) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        await refresh()
        return true
      }
      console.error('[useMemories] 删除失败:', result.error)
      return false
    } catch (err) {
      console.error('[useMemories] 删除异常:', err)
      return false
    }
  }, [refresh])

  /**
   * 类型过滤变化时重新加载
   */
  const handleTypeFilterChange = useCallback((type: MemoryType | '') => {
    setTypeFilter(type)
    fetchMemories(type)
  }, [fetchMemories])

  /**
   * 初始化加载
   */
  useEffect(() => {
    fetchMemories('')
  }, [fetchMemories])

  return {
    memories,
    total,
    isLoading,
    error,
    typeFilter,
    setTypeFilter: handleTypeFilterChange,
    refresh,
    loadMore,
    hasMore,
    createMemory,
    updateMemory,
    deleteMemory,
  }
}
