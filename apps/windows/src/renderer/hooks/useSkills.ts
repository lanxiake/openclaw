/**
 * useSkills Hook - 技能管理
 *
 * 管理 AI 助理技能系统的自定义 Hook
 * 提供技能列表、详情、执行、安装、卸载、启用/禁用等功能
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * 技能信息
 */
export interface SkillInfo {
  id: string
  name: string
  description: string
  version: string
  category?: string
  icon?: string
  status: 'loading' | 'loaded' | 'error' | 'disabled'
  origin: 'builtin' | 'installed' | 'workspace'
  runMode: 'server' | 'local' | 'hybrid'
  subscription?: {
    type: 'free' | 'premium' | 'enterprise'
    requiredPlan?: string
  }
  executionCount: number
  lastExecutedAt?: string
  error?: string
}

/**
 * 技能详情
 */
export interface SkillDetail extends SkillInfo {
  source?: string
  triggers?: Array<{
    type: 'command' | 'keyword' | 'event' | 'schedule' | 'ai-invoke'
    command?: string
    keywords?: string[]
    event?: string
    cron?: string
  }>
  parameters?: Array<{
    name: string
    type: string
    description: string
    required?: boolean
    default?: unknown
    enum?: string[]
  }>
  loadedAt?: string
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

/**
 * 技能安装选项
 */
export interface SkillInstallOptions {
  /** 本地技能路径 */
  localPath?: string
  /** 远程技能 URL */
  sourceUrl?: string
  /** 是否强制安装（覆盖已有） */
  force?: boolean
}

/**
 * 技能安装结果
 */
export interface SkillInstallResult {
  success: boolean
  skillId?: string
  error?: string
}

/**
 * 技能统计信息
 */
export interface SkillStats {
  /** 技能总数 */
  total: number
  /** 已加载数量 */
  loaded: number
  /** 已禁用数量 */
  disabled: number
  /** 加载错误数量 */
  error: number
  /** 按分类统计 */
  byCategory: Record<string, number>
  /** 按来源统计 */
  byOrigin: Record<string, number>
}

/**
 * 技能配置
 */
export type SkillConfig = Record<string, unknown>

interface UseSkillsReturn {
  /** 技能列表（已加载的） */
  skills: SkillInfo[]
  /** 所有技能（包括禁用的） */
  allSkills: SkillInfo[]
  /** 技能统计信息 */
  stats: SkillStats | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null

  // === 查询方法 ===
  /** 加载技能列表（仅已启用） */
  loadSkills: () => Promise<void>
  /** 加载所有技能（包括禁用的） */
  loadAllSkills: () => Promise<void>
  /** 获取技能详情 */
  getSkillDetail: (skillId: string) => Promise<SkillDetail | null>
  /** 获取技能统计信息 */
  getSkillStats: () => Promise<SkillStats | null>
  /** 查找命令对应的技能 */
  findSkillByCommand: (command: string) => Promise<SkillInfo | null>

  // === 执行方法 ===
  /** 执行技能 */
  executeSkill: (skillId: string, params?: Record<string, unknown>) => Promise<SkillExecutionResult>
  /** 通过命令执行技能 */
  executeSkillByCommand: (command: string, args?: string) => Promise<SkillExecutionResult>

  // === 技能管理方法 ===
  /** 安装技能 */
  installSkill: (options: SkillInstallOptions) => Promise<SkillInstallResult>
  /** 卸载技能 */
  uninstallSkill: (skillId: string) => Promise<boolean>
  /** 启用技能 */
  enableSkill: (skillId: string) => Promise<boolean>
  /** 禁用技能 */
  disableSkill: (skillId: string) => Promise<boolean>
  /** 切换技能启用状态 */
  toggleSkill: (skillId: string) => Promise<{ enabled: boolean; error?: string }>
  /** 重新加载技能系统 */
  reloadSkills: () => Promise<void>

  // === 配置方法 ===
  /** 获取技能配置 */
  getSkillConfig: (skillId: string) => Promise<SkillConfig | null>
  /** 设置技能配置 */
  setSkillConfig: (skillId: string, config: SkillConfig) => Promise<boolean>
}

/**
 * 技能管理 Hook
 */
export function useSkills(): UseSkillsReturn {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([])
  const [stats, setStats] = useState<SkillStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 加载技能列表（仅已启用的）
   */
  const loadSkills = useCallback(async () => {
    console.log('[useSkills] 加载已启用技能列表')
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.electronAPI.gateway.call<{
        skills: SkillInfo[]
        total: number
      }>('assistant.skills.list', {})

      console.log('[useSkills] 获取到技能列表:', response)
      setSkills(response.skills || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载技能列表失败'
      console.error('[useSkills] 加载失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 加载所有技能（包括禁用的）
   */
  const loadAllSkills = useCallback(async () => {
    console.log('[useSkills] 加载所有技能列表')
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.electronAPI.gateway.call<{
        skills: SkillInfo[]
        total: number
      }>('assistant.skills.listAll', {})

      console.log('[useSkills] 获取到所有技能:', response)
      setAllSkills(response.skills || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载技能列表失败'
      console.error('[useSkills] 加载失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 获取技能详情
   */
  const getSkillDetail = useCallback(async (skillId: string): Promise<SkillDetail | null> => {
    console.log('[useSkills] 获取技能详情:', skillId)

    try {
      const response = await window.electronAPI.gateway.call<SkillDetail>(
        'assistant.skills.get',
        { skillId }
      )
      return response
    } catch (err) {
      console.error('[useSkills] 获取详情失败:', err)
      return null
    }
  }, [])

  /**
   * 执行技能
   */
  const executeSkill = useCallback(
    async (skillId: string, params?: Record<string, unknown>): Promise<SkillExecutionResult> => {
      console.log('[useSkills] 执行技能:', skillId, params)

      try {
        const result = await window.electronAPI.gateway.call<SkillExecutionResult>(
          'assistant.skills.execute',
          { skillId, params }
        )

        // 执行成功后刷新列表以更新执行次数
        loadSkills()

        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '执行技能失败'
        console.error('[useSkills] 执行失败:', errorMessage)
        return { success: false, error: errorMessage }
      }
    },
    [loadSkills]
  )

  /**
   * 通过命令执行技能
   */
  const executeSkillByCommand = useCallback(
    async (command: string, args?: string): Promise<SkillExecutionResult> => {
      console.log('[useSkills] 通过命令执行技能:', command, args)

      try {
        const result = await window.electronAPI.gateway.call<SkillExecutionResult>(
          'assistant.skills.executeByCommand',
          { command, args }
        )

        // 执行成功后刷新列表
        loadSkills()

        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '执行技能失败'
        console.error('[useSkills] 执行失败:', errorMessage)
        return { success: false, error: errorMessage }
      }
    },
    [loadSkills]
  )

  /**
   * 重新加载技能
   */
  const reloadSkills = useCallback(async () => {
    console.log('[useSkills] 重新加载技能系统')
    setIsLoading(true)
    setError(null)

    try {
      await window.electronAPI.gateway.call('assistant.skills.reload', {})
      await loadSkills()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重新加载失败'
      console.error('[useSkills] 重新加载失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [loadSkills])

  /**
   * 查找命令对应的技能
   */
  const findSkillByCommand = useCallback(async (command: string): Promise<SkillInfo | null> => {
    console.log('[useSkills] 查找命令对应的技能:', command)

    try {
      const result = await window.electronAPI.gateway.call<SkillInfo | null>(
        'assistant.skills.findByCommand',
        { command }
      )
      return result
    } catch (err) {
      console.error('[useSkills] 查找失败:', err)
      return null
    }
  }, [])

  /**
   * 获取技能统计信息
   */
  const getSkillStats = useCallback(async (): Promise<SkillStats | null> => {
    console.log('[useSkills] 获取技能统计信息')

    try {
      const result = await window.electronAPI.gateway.call<SkillStats>(
        'assistant.skills.stats',
        {}
      )
      setStats(result)
      return result
    } catch (err) {
      console.error('[useSkills] 获取统计信息失败:', err)
      return null
    }
  }, [])

  // === 技能管理方法 ===

  /**
   * 安装技能
   */
  const installSkill = useCallback(async (options: SkillInstallOptions): Promise<SkillInstallResult> => {
    console.log('[useSkills] 安装技能:', options)

    try {
      const result = await window.electronAPI.gateway.call<SkillInstallResult>(
        'assistant.skills.install',
        options
      )

      // 安装成功后刷新列表
      if (result.success) {
        await loadAllSkills()
        await loadSkills()
        await getSkillStats()
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '安装技能失败'
      console.error('[useSkills] 安装失败:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [loadAllSkills, loadSkills, getSkillStats])

  /**
   * 卸载技能
   */
  const uninstallSkill = useCallback(async (skillId: string): Promise<boolean> => {
    console.log('[useSkills] 卸载技能:', skillId)

    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId: string }>(
        'assistant.skills.uninstall',
        { skillId }
      )

      // 卸载成功后刷新列表
      if (result.success) {
        await loadAllSkills()
        await loadSkills()
        await getSkillStats()
      }

      return result.success
    } catch (err) {
      console.error('[useSkills] 卸载失败:', err)
      return false
    }
  }, [loadAllSkills, loadSkills, getSkillStats])

  /**
   * 启用技能
   */
  const enableSkill = useCallback(async (skillId: string): Promise<boolean> => {
    console.log('[useSkills] 启用技能:', skillId)

    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId: string; enabled: boolean }>(
        'assistant.skills.enable',
        { skillId }
      )

      // 启用成功后刷新列表
      if (result.success) {
        await loadAllSkills()
        await loadSkills()
        await getSkillStats()
      }

      return result.success
    } catch (err) {
      console.error('[useSkills] 启用失败:', err)
      return false
    }
  }, [loadAllSkills, loadSkills, getSkillStats])

  /**
   * 禁用技能
   */
  const disableSkill = useCallback(async (skillId: string): Promise<boolean> => {
    console.log('[useSkills] 禁用技能:', skillId)

    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId: string; enabled: boolean }>(
        'assistant.skills.disable',
        { skillId }
      )

      // 禁用成功后刷新列表
      if (result.success) {
        await loadAllSkills()
        await loadSkills()
        await getSkillStats()
      }

      return result.success
    } catch (err) {
      console.error('[useSkills] 禁用失败:', err)
      return false
    }
  }, [loadAllSkills, loadSkills, getSkillStats])

  /**
   * 切换技能启用状态
   */
  const toggleSkill = useCallback(async (skillId: string): Promise<{ enabled: boolean; error?: string }> => {
    console.log('[useSkills] 切换技能状态:', skillId)

    try {
      const result = await window.electronAPI.gateway.call<{ skillId: string; enabled: boolean; error?: string }>(
        'assistant.skills.toggle',
        { skillId }
      )

      // 切换成功后刷新列表
      await loadAllSkills()
      await loadSkills()
      await getSkillStats()

      return { enabled: result.enabled, error: result.error }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '切换状态失败'
      console.error('[useSkills] 切换失败:', errorMessage)
      return { enabled: false, error: errorMessage }
    }
  }, [loadAllSkills, loadSkills, getSkillStats])

  // === 配置方法 ===

  /**
   * 获取技能配置
   */
  const getSkillConfig = useCallback(async (skillId: string): Promise<SkillConfig | null> => {
    console.log('[useSkills] 获取技能配置:', skillId)

    try {
      const result = await window.electronAPI.gateway.call<{ skillId: string; config: SkillConfig | null }>(
        'assistant.skills.getConfig',
        { skillId }
      )
      return result.config
    } catch (err) {
      console.error('[useSkills] 获取配置失败:', err)
      return null
    }
  }, [])

  /**
   * 设置技能配置
   */
  const setSkillConfig = useCallback(async (skillId: string, config: SkillConfig): Promise<boolean> => {
    console.log('[useSkills] 设置技能配置:', skillId, config)

    try {
      const result = await window.electronAPI.gateway.call<{ success: boolean; skillId: string }>(
        'assistant.skills.setConfig',
        { skillId, config }
      )
      return result.success
    } catch (err) {
      console.error('[useSkills] 设置配置失败:', err)
      return false
    }
  }, [])

  return {
    // 状态
    skills,
    allSkills,
    stats,
    isLoading,
    error,

    // 查询方法
    loadSkills,
    loadAllSkills,
    getSkillDetail,
    getSkillStats,
    findSkillByCommand,

    // 执行方法
    executeSkill,
    executeSkillByCommand,

    // 技能管理方法
    installSkill,
    uninstallSkill,
    enableSkill,
    disableSkill,
    toggleSkill,
    reloadSkills,

    // 配置方法
    getSkillConfig,
    setSkillConfig,
  }
}
