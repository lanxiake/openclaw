/**
 * useDashboard Hook - 仪表盘数据聚合
 *
 * 聚合多个数据源，提供 Dashboard 所需的概览数据：
 * - 订阅信息和当前计划
 * - 设备使用量
 * - 技能加载统计
 * - 今日调用量
 *
 * 数据来源：
 * - subscriptionService: 订阅状态和使用量（REST API）
 * - deviceService: 设备列表（REST API）
 * - Gateway RPC: 技能列表（WebSocket）
 */

import { useState, useCallback, useEffect } from 'react'
import { subscriptionService } from '../services/subscription-service'
import type { Subscription, SubscriptionPlan, UsageStats } from '../services/subscription-service'
import { deviceService } from '../services/device-service'

/**
 * 技能统计信息
 */
interface SkillStats {
  /** 技能总数 */
  total: number
  /** 已加载数 */
  loaded: number
  /** 加载错误数 */
  errors: number
}

/**
 * useDashboard 返回值
 */
interface UseDashboardReturn {
  /** 当前订阅 */
  subscription: Subscription | null
  /** 当前计划名称 */
  planName: string
  /** 使用量统计 */
  usage: UsageStats | null
  /** 已绑定设备数 */
  deviceCount: number
  /** 技能统计 */
  skillStats: SkillStats
  /** 订阅剩余天数 */
  daysRemaining: number
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 手动刷新所有数据 */
  refresh: () => Promise<void>
}

/**
 * 计算两个日期之间的天数差
 */
function calcDaysRemaining(endDate: string | undefined): number {
  if (!endDate) {
    return 0
  }
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * 默认技能统计
 */
const DEFAULT_SKILL_STATS: SkillStats = {
  total: 0,
  loaded: 0,
  errors: 0,
}

/**
 * 仪表盘数据聚合 Hook
 */
export function useDashboard(): UseDashboardReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [planName, setPlanName] = useState<string>('免费版')
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [deviceCount, setDeviceCount] = useState<number>(0)
  const [skillStats, setSkillStats] = useState<SkillStats>(DEFAULT_SKILL_STATS)
  const [daysRemaining, setDaysRemaining] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 加载技能统计（通过 Gateway RPC，失败不阻塞其他数据）
   */
  const loadSkillStats = useCallback(async (): Promise<SkillStats> => {
    try {
      const result = await window.electronAPI.gateway.call('assistant.skills.listAll', {})
      const skills = result?.skills || []
      const loaded = skills.filter((s: { status: string }) => s.status === 'loaded').length
      const errors = skills.filter((s: { status: string }) => s.status === 'error').length
      console.log('[useDashboard] 技能统计:', { total: skills.length, loaded, errors })
      return { total: skills.length, loaded, errors }
    } catch (err) {
      console.warn('[useDashboard] 获取技能统计失败（Gateway 可能未连接）:', err)
      return DEFAULT_SKILL_STATS
    }
  }, [])

  /**
   * 加载所有 Dashboard 数据
   */
  const loadAll = useCallback(async () => {
    console.log('[useDashboard] 开始加载 Dashboard 数据')
    setIsLoading(true)
    setError(null)

    const accessToken = localStorage.getItem('openclaw_access_token')
    if (!accessToken) {
      console.warn('[useDashboard] 未登录，跳过加载')
      setIsLoading(false)
      setError('未登录')
      return
    }

    // 设置 token 到各服务
    subscriptionService.setAccessToken(accessToken)
    deviceService.setAccessToken(accessToken)

    try {
      // 并行加载所有数据源
      const [subResult, usageResult, deviceResult, skills] = await Promise.all([
        subscriptionService.getSubscription(),
        subscriptionService.getUsage(),
        deviceService.getDevices(),
        loadSkillStats(),
      ])

      // 处理订阅数据
      if (!subResult.success) {
        throw new Error(subResult.error || '获取订阅信息失败')
      }
      setSubscription(subResult.subscription || null)
      setPlanName(subResult.plan?.displayName || '免费版')
      setDaysRemaining(calcDaysRemaining(subResult.subscription?.endDate))

      // 处理使用量数据
      if (usageResult.success && usageResult.usage) {
        setUsage(usageResult.usage)
      }

      // 处理设备数据
      if (deviceResult.success && deviceResult.devices) {
        setDeviceCount(deviceResult.devices.length)
      }

      // 处理技能数据
      setSkillStats(skills)

      console.log('[useDashboard] Dashboard 数据加载完成')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败'
      console.error('[useDashboard] 加载 Dashboard 数据失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [loadSkillStats])

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    console.log('[useDashboard] 手动刷新 Dashboard 数据')
    await loadAll()
  }, [loadAll])

  // 初始化加载
  useEffect(() => {
    loadAll()
  }, [loadAll])

  return {
    subscription,
    planName,
    usage,
    deviceCount,
    skillStats,
    daysRemaining,
    isLoading,
    error,
    refresh,
  }
}
