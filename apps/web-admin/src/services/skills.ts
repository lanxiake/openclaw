/**
 * 技能服务
 *
 * 封装技能系统和技能商店相关的 Gateway RPC 调用
 */

import { gateway } from '../lib/gateway-client'

/**
 * 技能信息
 */
export interface Skill {
  id: string
  name: string
  description: string
  version: string
  category: string
  icon?: string
  status: 'loaded' | 'disabled' | 'error'
  origin: 'builtin' | 'local' | 'remote'
  runMode?: 'sync' | 'async'
  subscription?: 'free' | 'pro' | 'team'
  executionCount: number
  lastExecutedAt?: string
  error?: string
}

/**
 * 技能详情
 */
export interface SkillDetail extends Skill {
  triggers?: {
    commands?: string[]
    patterns?: string[]
    events?: string[]
  }
  parameters?: {
    name: string
    type: string
    required: boolean
    description?: string
    default?: unknown
  }[]
  source?: string
  loadedAt?: string
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean
  output?: string
  data?: unknown
  error?: string
  duration?: number
}

/**
 * 商店技能
 */
export interface StoreSkill {
  id: string
  name: string
  description: string
  version: string
  category: string
  icon?: string
  author?: string
  downloads: number
  rating: number
  subscription: 'free' | 'pro' | 'team'
  tags: string[]
  installed: boolean
  installedVersion?: string
  hasUpdate?: boolean
  sourceUrl?: string
  featured?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 商店统计信息
 */
export interface StoreStats {
  totalSkills: number
  freeSkills: number
  proSkills: number
  teamSkills: number
  categories: { name: string; count: number }[]
}

/**
 * 技能统计信息
 */
export interface SkillStats {
  total: number
  loaded: number
  disabled: number
  errors: number
  totalExecutions: number
  byCategory: Record<string, number>
  bySubscription: Record<string, number>
}

/**
 * 技能服务
 */
export const skillService = {
  // === 已安装技能 ===

  /**
   * 获取已加载的技能列表
   */
  async getLoadedSkills(): Promise<{ skills: Skill[]; total: number }> {
    console.log('[skill] 获取技能列表')

    try {
      const result = await gateway.call<{ skills: Skill[]; total: number }>('assistant.skills.list')
      return result
    } catch (error) {
      console.error('[skill] 获取技能列表失败', error)
      return { skills: [], total: 0 }
    }
  },

  /**
   * 获取所有技能（包括禁用的）
   */
  async getAllSkills(): Promise<{ skills: Skill[]; total: number }> {
    console.log('[skill] 获取所有技能')

    try {
      const result = await gateway.call<{ skills: Skill[]; total: number }>('assistant.skills.listAll')
      return result
    } catch (error) {
      console.error('[skill] 获取所有技能失败', error)
      return { skills: [], total: 0 }
    }
  },

  /**
   * 获取技能详情
   */
  async getSkillDetail(skillId: string): Promise<SkillDetail | null> {
    console.log('[skill] 获取技能详情', { skillId })

    try {
      const result = await gateway.call<SkillDetail>('assistant.skills.get', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 获取技能详情失败', error)
      return null
    }
  },

  /**
   * 执行技能
   */
  async executeSkill(
    skillId: string,
    params: Record<string, unknown> = {},
    sessionId?: string
  ): Promise<SkillExecutionResult> {
    console.log('[skill] 执行技能', { skillId, params })

    try {
      const result = await gateway.call<SkillExecutionResult>('assistant.skills.execute', {
        skillId,
        params,
        sessionId,
      })
      return result
    } catch (error) {
      console.error('[skill] 执行技能失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      }
    }
  },

  /**
   * 启用技能
   */
  async enableSkill(skillId: string): Promise<{ success: boolean }> {
    console.log('[skill] 启用技能', { skillId })

    try {
      const result = await gateway.call<{ success: boolean }>('assistant.skills.enable', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 启用技能失败', error)
      return { success: false }
    }
  },

  /**
   * 禁用技能
   */
  async disableSkill(skillId: string): Promise<{ success: boolean }> {
    console.log('[skill] 禁用技能', { skillId })

    try {
      const result = await gateway.call<{ success: boolean }>('assistant.skills.disable', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 禁用技能失败', error)
      return { success: false }
    }
  },

  /**
   * 切换技能状态
   */
  async toggleSkill(skillId: string): Promise<{ success: boolean; enabled: boolean }> {
    console.log('[skill] 切换技能状态', { skillId })

    try {
      const result = await gateway.call<{ success: boolean; enabled: boolean }>('assistant.skills.toggle', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 切换技能状态失败', error)
      return { success: false, enabled: false }
    }
  },

  /**
   * 卸载技能
   */
  async uninstallSkill(skillId: string): Promise<{ success: boolean }> {
    console.log('[skill] 卸载技能', { skillId })

    try {
      const result = await gateway.call<{ success: boolean }>('assistant.skills.uninstall', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 卸载技能失败', error)
      return { success: false }
    }
  },

  /**
   * 获取技能统计信息
   */
  async getStats(): Promise<SkillStats | null> {
    console.log('[skill] 获取技能统计')

    try {
      const result = await gateway.call<SkillStats>('assistant.skills.stats')
      return result
    } catch (error) {
      console.error('[skill] 获取技能统计失败', error)
      return null
    }
  },

  /**
   * 重新加载技能
   */
  async reload(): Promise<{ total: number; loaded: number }> {
    console.log('[skill] 重新加载技能')

    try {
      const result = await gateway.call<{ total: number; loaded: number }>('assistant.skills.reload')
      return result
    } catch (error) {
      console.error('[skill] 重新加载技能失败', error)
      return { total: 0, loaded: 0 }
    }
  },

  // === 技能商店 ===

  /**
   * 查询商店技能
   */
  async queryStore(params: {
    category?: string
    subscription?: 'free' | 'pro' | 'team'
    sortBy?: 'popular' | 'recent' | 'name' | 'rating'
    search?: string
    tags?: string[]
    offset?: number
    limit?: number
  } = {}): Promise<{ skills: StoreSkill[]; total: number; hasMore: boolean }> {
    console.log('[skill] 查询商店技能', params)

    try {
      const result = await gateway.call<{ skills: StoreSkill[]; total: number; hasMore: boolean }>(
        'assistant.store.query',
        params
      )
      return result
    } catch (error) {
      console.error('[skill] 查询商店技能失败', error)
      return { skills: [], total: 0, hasMore: false }
    }
  },

  /**
   * 获取商店技能详情
   */
  async getStoreSkillDetail(skillId: string): Promise<StoreSkill | null> {
    console.log('[skill] 获取商店技能详情', { skillId })

    try {
      const result = await gateway.call<StoreSkill>('assistant.store.detail', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 获取商店技能详情失败', error)
      return null
    }
  },

  /**
   * 获取推荐技能
   */
  async getFeatured(limit = 3): Promise<StoreSkill[]> {
    console.log('[skill] 获取推荐技能')

    try {
      const result = await gateway.call<{ skills: StoreSkill[] }>('assistant.store.featured', { limit })
      return result.skills
    } catch (error) {
      console.error('[skill] 获取推荐技能失败', error)
      return []
    }
  },

  /**
   * 获取热门技能
   */
  async getPopular(limit = 4): Promise<StoreSkill[]> {
    console.log('[skill] 获取热门技能')

    try {
      const result = await gateway.call<{ skills: StoreSkill[] }>('assistant.store.popular', { limit })
      return result.skills
    } catch (error) {
      console.error('[skill] 获取热门技能失败', error)
      return []
    }
  },

  /**
   * 获取最新技能
   */
  async getRecent(limit = 4): Promise<StoreSkill[]> {
    console.log('[skill] 获取最新技能')

    try {
      const result = await gateway.call<{ skills: StoreSkill[] }>('assistant.store.recent', { limit })
      return result.skills
    } catch (error) {
      console.error('[skill] 获取最新技能失败', error)
      return []
    }
  },

  /**
   * 搜索技能
   */
  async search(query: string, limit = 10): Promise<StoreSkill[]> {
    console.log('[skill] 搜索技能', { query })

    try {
      const result = await gateway.call<{ skills: StoreSkill[] }>('assistant.store.search', { query, limit })
      return result.skills
    } catch (error) {
      console.error('[skill] 搜索技能失败', error)
      return []
    }
  },

  /**
   * 获取商店统计信息
   */
  async getStoreStats(): Promise<StoreStats | null> {
    console.log('[skill] 获取商店统计')

    try {
      const result = await gateway.call<StoreStats>('assistant.store.stats')
      return result
    } catch (error) {
      console.error('[skill] 获取商店统计失败', error)
      return null
    }
  },

  /**
   * 从商店安装技能
   */
  async installFromStore(skillId: string): Promise<{ success: boolean; message?: string }> {
    console.log('[skill] 从商店安装技能', { skillId })

    try {
      const result = await gateway.call<{ success: boolean; message?: string }>('assistant.store.install', { skillId })
      return result
    } catch (error) {
      console.error('[skill] 从商店安装技能失败', error)
      return { success: false, message: error instanceof Error ? error.message : '安装失败' }
    }
  },

  /**
   * 检查技能更新
   */
  async checkUpdates(): Promise<StoreSkill[]> {
    console.log('[skill] 检查技能更新')

    try {
      const result = await gateway.call<{ skills: StoreSkill[] }>('assistant.store.checkUpdates')
      return result.skills
    } catch (error) {
      console.error('[skill] 检查技能更新失败', error)
      return []
    }
  },

  /**
   * 刷新商店索引
   */
  async refreshStore(): Promise<{ refreshed: boolean; stats?: StoreStats }> {
    console.log('[skill] 刷新商店索引')

    try {
      const result = await gateway.call<{ refreshed: boolean; stats?: StoreStats }>('assistant.store.refresh')
      return result
    } catch (error) {
      console.error('[skill] 刷新商店索引失败', error)
      return { refreshed: false }
    }
  },
}
