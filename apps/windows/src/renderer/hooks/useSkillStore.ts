/**
 * useSkillStore Hook - 技能商店
 *
 * 管理技能商店的浏览、搜索、安装等功能
 * 通过 Gateway RPC 方法与后端交互
 */

import { useState, useCallback } from 'react'

/**
 * 商店技能信息
 */
export interface StoreSkillInfo {
  /** 技能 ID */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 详细描述 */
  longDescription?: string
  /** 版本 */
  version: string
  /** 作者 */
  author: string
  /** 图标 */
  icon?: string
  /** 分类 */
  category: string
  /** 标签 */
  tags: string[]
  /** 运行模式 */
  runMode: 'server' | 'local' | 'hybrid'
  /** 订阅要求 */
  subscription: {
    type: 'free' | 'premium' | 'enterprise'
    price?: number
    period?: 'monthly' | 'yearly' | 'once'
  }
  /** 下载次数 */
  downloads: number
  /** 评分 */
  rating: number
  /** 评分人数 */
  ratingCount: number
  /** 更新时间 */
  updatedAt: string
  /** 截图 */
  screenshots?: string[]
  /** 源 URL */
  sourceUrl?: string
  /** 是否已安装 */
  installed?: boolean
  /** 安装的版本 */
  installedVersion?: string
}

/**
 * 技能分类信息
 */
export interface SkillCategory {
  id: string
  name: string
  icon: string
  count: number
}

/**
 * 商店筛选条件
 */
export interface StoreFilters {
  category?: string
  tags?: string[]
  subscription?: 'free' | 'premium' | 'enterprise' | 'all'
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name'
  search?: string
}

/**
 * 商店统计信息
 */
export interface StoreStats {
  totalSkills: number
  totalDownloads: number
  categories: SkillCategory[]
  popularTags: string[]
}

/**
 * 技能上传数据
 */
export interface SkillUploadData {
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 详细说明 (Markdown) */
  readme?: string
  /** 版本号 */
  version: string
  /** 分类 ID */
  categoryId?: string
  /** 标签列表 */
  tags?: string[]
  /** 订阅级别要求 */
  subscriptionLevel?: 'free' | 'pro' | 'team' | 'enterprise'
  /** 图标 URL */
  iconUrl?: string
  /** 技能配置文件 URL */
  manifestUrl?: string
  /** 技能包下载 URL */
  packageUrl?: string
  /** 技能配置 (JSON) */
  config?: Record<string, unknown>
}

/**
 * 商店查询结果
 */
interface StoreQueryResult {
  skills: StoreSkillInfo[]
  total: number
  offset: number
  limit: number
}

interface UseSkillStoreReturn {
  /** 商店技能列表 */
  skills: StoreSkillInfo[]
  /** 推荐技能 */
  featured: StoreSkillInfo[]
  /** 热门技能 */
  popular: StoreSkillInfo[]
  /** 最新技能 */
  recent: StoreSkillInfo[]
  /** 商店统计 */
  stats: StoreStats | null
  /** 分类列表 */
  categories: SkillCategory[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否正在上传 */
  isUploading: boolean
  /** 错误信息 */
  error: string | null
  /** 当前筛选条件 */
  filters: StoreFilters

  /** 加载商店技能列表 */
  loadStoreSkills: (filters?: StoreFilters) => Promise<void>
  /** 加载推荐技能 */
  loadFeatured: () => Promise<void>
  /** 加载热门技能 */
  loadPopular: () => Promise<void>
  /** 加载最新技能 */
  loadRecent: () => Promise<void>
  /** 加载商店统计 */
  loadStats: () => Promise<void>
  /** 加载分类列表 */
  loadCategories: () => Promise<void>
  /** 搜索技能 */
  searchSkills: (query: string) => Promise<void>
  /** 设置筛选条件 */
  setFilters: (filters: StoreFilters) => void
  /** 获取技能详情 */
  getSkillDetail: (skillId: string) => Promise<StoreSkillInfo | null>
  /** 安装技能 */
  installSkill: (skillId: string) => Promise<{ success: boolean; error?: string }>
  /** 上传技能 */
  uploadSkill: (data: SkillUploadData) => Promise<{ success: boolean; skillId?: string; error?: string }>
  /** 检查更新 */
  checkUpdates: () => Promise<StoreSkillInfo[]>
  /** 刷新商店 */
  refreshStore: () => Promise<void>
}

/**
 * 技能商店 Hook
 */
export function useSkillStore(): UseSkillStoreReturn {
  const [skills, setSkills] = useState<StoreSkillInfo[]>([])
  const [featured, setFeatured] = useState<StoreSkillInfo[]>([])
  const [popular, setPopular] = useState<StoreSkillInfo[]>([])
  const [recent, setRecent] = useState<StoreSkillInfo[]>([])
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<StoreFilters>({})

  /**
   * 加载商店技能列表
   */
  const loadStoreSkills = useCallback(async (newFilters?: StoreFilters) => {
    console.log('[useSkillStore] 加载商店技能列表', newFilters)
    setIsLoading(true)
    setError(null)

    if (newFilters) {
      setFilters(newFilters)
    }

    try {
      const currentFilters = newFilters || filters

      // 调用后端 API
      const result = await window.electronAPI.gateway.call<StoreQueryResult>(
        'assistant.store.query',
        {
          category: currentFilters.category,
          subscription: currentFilters.subscription,
          sortBy: currentFilters.sortBy,
          search: currentFilters.search,
          tags: currentFilters.tags,
          offset: 0,
          limit: 50,
        }
      )

      setSkills(result.skills)
      console.log('[useSkillStore] 加载成功，共', result.total, '个技能')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载商店失败'
      console.error('[useSkillStore] 加载失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  /**
   * 加载推荐技能
   */
  const loadFeatured = useCallback(async () => {
    console.log('[useSkillStore] 加载推荐技能')
    try {
      const result = await window.electronAPI.gateway.call<{ skills: StoreSkillInfo[]; total: number }>(
        'assistant.store.featured',
        { limit: 3 }
      )
      setFeatured(result.skills)
    } catch (err) {
      console.error('[useSkillStore] 加载推荐失败:', err)
    }
  }, [])

  /**
   * 加载热门技能
   */
  const loadPopular = useCallback(async () => {
    console.log('[useSkillStore] 加载热门技能')
    try {
      const result = await window.electronAPI.gateway.call<{ skills: StoreSkillInfo[]; total: number }>(
        'assistant.store.popular',
        { limit: 4 }
      )
      setPopular(result.skills)
    } catch (err) {
      console.error('[useSkillStore] 加载热门失败:', err)
    }
  }, [])

  /**
   * 加载最新技能
   */
  const loadRecent = useCallback(async () => {
    console.log('[useSkillStore] 加载最新技能')
    try {
      const result = await window.electronAPI.gateway.call<{ skills: StoreSkillInfo[]; total: number }>(
        'assistant.store.recent',
        { limit: 4 }
      )
      setRecent(result.skills)
    } catch (err) {
      console.error('[useSkillStore] 加载最新失败:', err)
    }
  }, [])

  /**
   * 加载商店统计
   */
  const loadStats = useCallback(async () => {
    console.log('[useSkillStore] 加载商店统计')
    try {
      const result = await window.electronAPI.gateway.call<StoreStats>(
        'assistant.store.stats',
        {}
      )
      setStats(result)
    } catch (err) {
      console.error('[useSkillStore] 加载统计失败:', err)
    }
  }, [])

  /**
   * 加载分类列表
   */
  const loadCategories = useCallback(async () => {
    console.log('[useSkillStore] 加载分类列表')
    try {
      const result = await window.electronAPI.gateway.call<{ categories: SkillCategory[]; total: number }>(
        'assistant.store.categories',
        {}
      )
      setCategories(result.categories || [])
    } catch (err) {
      console.error('[useSkillStore] 加载分类失败:', err)
    }
  }, [])

  /**
   * 搜索技能
   */
  const searchSkills = useCallback(async (query: string) => {
    console.log('[useSkillStore] 搜索技能:', query)
    await loadStoreSkills({ ...filters, search: query })
  }, [filters, loadStoreSkills])

  /**
   * 获取技能详情
   */
  const getSkillDetail = useCallback(async (skillId: string): Promise<StoreSkillInfo | null> => {
    console.log('[useSkillStore] 获取技能详情:', skillId)
    try {
      const result = await window.electronAPI.gateway.call<StoreSkillInfo>(
        'assistant.store.detail',
        { skillId }
      )
      return result
    } catch (err) {
      console.error('[useSkillStore] 获取详情失败:', err)
      return null
    }
  }, [])

  /**
   * 安装技能
   */
  const installSkill = useCallback(async (skillId: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[useSkillStore] 安装技能:', skillId)
    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId?: string; error?: string; message?: string }>(
        'assistant.store.install',
        { skillId }
      )

      if (result.success) {
        // 刷新商店列表以更新安装状态
        await loadStoreSkills()
      }

      return { success: result.success, error: result.error }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '安装失败'
      console.error('[useSkillStore] 安装失败:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [loadStoreSkills])

  /**
   * 上传技能
   */
  const uploadSkill = useCallback(async (data: SkillUploadData): Promise<{ success: boolean; skillId?: string; error?: string }> => {
    console.log('[useSkillStore] 上传技能:', data.name)
    setIsUploading(true)
    setError(null)

    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId?: string; skill?: unknown; error?: string }>(
        'assistant.store.submit',
        data
      )

      if (result.success) {
        console.log('[useSkillStore] 上传成功, skillId:', result.skillId)
        // 刷新商店列表
        await loadStoreSkills()
      } else {
        console.error('[useSkillStore] 上传失败:', result.error)
        setError(result.error || '上传失败')
      }

      return { success: result.success, skillId: result.skillId, error: result.error }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败'
      console.error('[useSkillStore] 上传异常:', errorMessage)
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsUploading(false)
    }
  }, [loadStoreSkills])

  /**
   * 检查更新
   */
  const checkUpdates = useCallback(async (): Promise<StoreSkillInfo[]> => {
    console.log('[useSkillStore] 检查更新')
    try {
      const result = await window.electronAPI.gateway.call<{ skills: StoreSkillInfo[]; total: number }>(
        'assistant.store.checkUpdates',
        {}
      )
      return result.skills
    } catch (err) {
      console.error('[useSkillStore] 检查更新失败:', err)
      return []
    }
  }, [])

  /**
   * 刷新商店
   */
  const refreshStore = useCallback(async () => {
    console.log('[useSkillStore] 刷新商店')
    try {
      await window.electronAPI.gateway.call<{ refreshed: boolean; stats: StoreStats }>(
        'assistant.store.refresh',
        {}
      )
      // 重新加载所有数据
      await Promise.all([
        loadStoreSkills(),
        loadFeatured(),
        loadPopular(),
        loadRecent(),
        loadStats(),
      ])
    } catch (err) {
      console.error('[useSkillStore] 刷新商店失败:', err)
    }
  }, [loadStoreSkills, loadFeatured, loadPopular, loadRecent, loadStats])

  return {
    // 状态
    skills,
    featured,
    popular,
    recent,
    stats,
    categories,
    isLoading,
    isUploading,
    error,
    filters,

    // 方法
    loadStoreSkills,
    loadFeatured,
    loadPopular,
    loadRecent,
    loadStats,
    loadCategories,
    searchSkills,
    setFilters,
    getSkillDetail,
    installSkill,
    uploadSkill,
    checkUpdates,
    refreshStore,
  }
}
