/**
 * useSkills Hook - 技能管理
 *
 * 管理用户已安装技能的自定义 Hook
 * 数据源：REST API（/api/store/skills/installed）
 * 提供已安装技能列表、启用/禁用、卸载等功能
 */

import { useState, useCallback } from 'react'

/**
 * 已安装技能信息（来自 REST API）
 */
export interface InstalledSkillInfo {
  /** 安装记录 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 技能商店条目 ID */
  skillItemId: string
  /** 安装版本 */
  installedVersion: string
  /** 是否启用 */
  isEnabled: boolean
  /** 安装时间 */
  installedAt: string
  /** 最后使用时间 */
  lastUsedAt?: string
  /** 技能详情 */
  skill: {
    id: string
    name: string
    description?: string
    version: string
    authorName?: string
    categoryId?: string
    tags?: string[]
    status: string
    downloadCount: number
    ratingAvg?: string
    ratingCount: number
    iconUrl?: string
    sourceType: 'system' | 'user'
    isFeatured: boolean
    createdAt: string
    updatedAt: string
  }
}

/**
 * 技能统计信息
 */
export interface SkillStats {
  /** 已安装总数 */
  total: number
  /** 已启用数量 */
  enabled: number
  /** 已禁用数量 */
  disabled: number
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  message?: string
}

interface UseSkillsReturn {
  /** 已安装技能列表 */
  installedSkills: InstalledSkillInfo[]
  /** 技能统计信息 */
  stats: SkillStats | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null

  /** 加载已安装技能列表 */
  loadInstalledSkills: () => Promise<void>
  /** 启用技能 */
  enableSkill: (skillItemId: string) => Promise<boolean>
  /** 禁用技能 */
  disableSkill: (skillItemId: string) => Promise<boolean>
  /** 切换技能启用状态 */
  toggleSkill: (skillItemId: string) => Promise<{ success: boolean; isEnabled?: boolean; error?: string }>
  /** 卸载技能 */
  uninstallSkill: (skillItemId: string) => Promise<boolean>
}

/**
 * 技能管理 Hook
 */
export function useSkills(): UseSkillsReturn {
  const [installedSkills, setInstalledSkills] = useState<InstalledSkillInfo[]>([])
  const [stats, setStats] = useState<SkillStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 从已安装列表计算统计信息
   */
  const computeStats = (skills: InstalledSkillInfo[]): SkillStats => {
    const enabled = skills.filter(s => s.isEnabled).length
    return {
      total: skills.length,
      enabled,
      disabled: skills.length - enabled,
    }
  }

  /**
   * 加载已安装技能列表（通过 REST API）
   */
  const loadInstalledSkills = useCallback(async () => {
    console.log('[useSkills] 加载已安装技能列表')
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.electronAPI.api.getInstalledSkills() as {
        success: boolean
        data?: InstalledSkillInfo[]
        error?: string
      }

      if (response.success && response.data) {
        console.log('[useSkills] 获取到已安装技能:', response.data.length)
        setInstalledSkills(response.data)
        setStats(computeStats(response.data))
      } else {
        console.error('[useSkills] 加载失败:', response.error)
        setError(response.error ?? '加载已安装技能列表失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载已安装技能列表失败'
      console.error('[useSkills] 加载失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 启用技能（通过 REST API）
   */
  const enableSkill = useCallback(async (skillItemId: string): Promise<boolean> => {
    console.log('[useSkills] 启用技能:', skillItemId)

    try {
      const response = await window.electronAPI.api.enableInstalledSkill(skillItemId) as {
        success: boolean
        error?: string
      }

      if (response.success) {
        /** 更新本地状态，避免重新请求 */
        setInstalledSkills(prev => {
          const updated = prev.map(s =>
            s.skillItemId === skillItemId ? { ...s, isEnabled: true } : s
          )
          setStats(computeStats(updated))
          return updated
        })
        return true
      }

      console.error('[useSkills] 启用失败:', response.error)
      return false
    } catch (err) {
      console.error('[useSkills] 启用失败:', err)
      return false
    }
  }, [])

  /**
   * 禁用技能（通过 REST API）
   */
  const disableSkill = useCallback(async (skillItemId: string): Promise<boolean> => {
    console.log('[useSkills] 禁用技能:', skillItemId)

    try {
      const response = await window.electronAPI.api.disableInstalledSkill(skillItemId) as {
        success: boolean
        error?: string
      }

      if (response.success) {
        /** 更新本地状态 */
        setInstalledSkills(prev => {
          const updated = prev.map(s =>
            s.skillItemId === skillItemId ? { ...s, isEnabled: false } : s
          )
          setStats(computeStats(updated))
          return updated
        })
        return true
      }

      console.error('[useSkills] 禁用失败:', response.error)
      return false
    } catch (err) {
      console.error('[useSkills] 禁用失败:', err)
      return false
    }
  }, [])

  /**
   * 切换技能启用/禁用状态（通过 REST API）
   */
  const toggleSkill = useCallback(async (skillItemId: string): Promise<{ success: boolean; isEnabled?: boolean; error?: string }> => {
    console.log('[useSkills] 切换技能状态:', skillItemId)

    try {
      const response = await window.electronAPI.api.toggleInstalledSkill(skillItemId) as {
        success: boolean
        data?: { isEnabled: boolean }
        error?: string
      }

      if (response.success && response.data) {
        /** 更新本地状态 */
        const newEnabled = response.data.isEnabled
        setInstalledSkills(prev => {
          const updated = prev.map(s =>
            s.skillItemId === skillItemId ? { ...s, isEnabled: newEnabled } : s
          )
          setStats(computeStats(updated))
          return updated
        })
        return { success: true, isEnabled: newEnabled }
      }

      return { success: false, error: response.error ?? '切换状态失败' }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '切换状态失败'
      console.error('[useSkills] 切换失败:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 卸载技能（通过 REST API）
   */
  const uninstallSkill = useCallback(async (skillItemId: string): Promise<boolean> => {
    console.log('[useSkills] 卸载技能:', skillItemId)

    try {
      const response = await window.electronAPI.api.uninstallStoreSkill(skillItemId) as {
        success: boolean
        error?: string
      }

      if (response.success) {
        /** 从本地列表中移除 */
        setInstalledSkills(prev => {
          const updated = prev.filter(s => s.skillItemId !== skillItemId)
          setStats(computeStats(updated))
          return updated
        })
        return true
      }

      console.error('[useSkills] 卸载失败:', response.error)
      return false
    } catch (err) {
      console.error('[useSkills] 卸载失败:', err)
      return false
    }
  }, [])

  return {
    installedSkills,
    stats,
    isLoading,
    error,
    loadInstalledSkills,
    enableSkill,
    disableSkill,
    toggleSkill,
    uninstallSkill,
  }
}
