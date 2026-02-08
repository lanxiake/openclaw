/**
 * useSubscription Hook - 订阅管理
 *
 * 提供订阅相关功能：
 * - 获取订阅计划列表
 * - 获取用户订阅状态
 * - 创建/取消订阅
 * - 配额检查
 * - 使用量统计
 *
 * @author OpenClaw
 */

import { useState, useCallback, useEffect } from 'react'

/**
 * 订阅计划 ID
 */
export type SubscriptionPlanId = 'free' | 'pro' | 'team' | 'enterprise'

/**
 * 计费周期
 */
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime'

/**
 * 订阅状态
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'paused'

/**
 * 计划功能特性
 */
export interface PlanFeature {
  id: string
  name: string
  description?: string
  included: boolean
  limit?: string
}

/**
 * 计划配额
 */
export interface PlanQuotas {
  dailyConversations: number
  monthlyAiCalls: number
  maxSkills: number
  maxDevices: number
  storageQuotaMb: number
  premiumSkills: boolean
  prioritySupport: boolean
  apiAccess: boolean
}

/**
 * 订阅计划
 */
export interface SubscriptionPlan {
  id: SubscriptionPlanId
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
  }
  features: PlanFeature[]
  quotas: PlanQuotas
  recommended?: boolean
}

/**
 * 用户订阅
 */
export interface UserSubscription {
  id: string
  userId: string
  planId: SubscriptionPlanId
  status: SubscriptionStatus
  billingPeriod: BillingPeriod
  currentPeriodStart: string
  currentPeriodEnd: string
  canceledAt?: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
  createdAt: string
  updatedAt: string
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean
  quotaType: string
  current: number
  limit: number
  remaining: number
  resetAt?: string
  reason?: string
}

/**
 * 使用量统计
 */
export interface UsageStats {
  daily: {
    conversations: number
    aiCalls: number
    skillExecutions: number
    fileOperations: number
    quotas: {
      conversations: number
    }
  }
  monthly: {
    conversations: number
    aiCalls: number
    skillExecutions: number
    fileOperations: number
    quotas: {
      aiCalls: number
      storage: number
    }
  }
}

/**
 * 订阅概览
 */
export interface SubscriptionOverview {
  subscription: {
    id: string
    planId: SubscriptionPlanId
    status: SubscriptionStatus
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  } | null
  plan: {
    id: SubscriptionPlanId
    name: string
  }
  usage: {
    conversations: {
      used: number
      limit: number
      percent: number
    }
    aiCalls: {
      used: number
      limit: number
      percent: number
    }
  }
  features: {
    premiumSkills: boolean
    prioritySupport: boolean
    apiAccess: boolean
  }
}

interface UseSubscriptionReturn {
  /** 所有订阅计划 */
  plans: SubscriptionPlan[]
  /** 用户订阅信息 */
  subscription: UserSubscription | null
  /** 当前计划 */
  currentPlan: SubscriptionPlan | null
  /** 订阅概览 */
  overview: SubscriptionOverview | null
  /** 使用量统计 */
  usage: UsageStats | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null

  /** 获取所有计划 */
  fetchPlans: () => Promise<void>
  /** 获取用户订阅 */
  fetchSubscription: () => Promise<void>
  /** 获取订阅概览 */
  fetchOverview: () => Promise<void>
  /** 获取使用量 */
  fetchUsage: () => Promise<void>
  /** 创建订阅 */
  createSubscription: (
    planId: SubscriptionPlanId,
    billingPeriod: BillingPeriod,
    options?: { startTrial?: boolean }
  ) => Promise<void>
  /** 取消订阅 */
  cancelSubscription: (immediately?: boolean, reason?: string) => Promise<void>
  /** 更新订阅 */
  updateSubscription: (planId: SubscriptionPlanId, billingPeriod?: BillingPeriod) => Promise<void>
  /** 检查配额 */
  checkQuota: (
    quotaType: 'conversations' | 'aiCalls' | 'skills' | 'devices' | 'storage'
  ) => Promise<QuotaCheckResult>
  /** 刷新所有数据 */
  refresh: () => Promise<void>
  /** 获取价格显示文本 */
  formatPrice: (planId: SubscriptionPlanId, period: BillingPeriod) => string
  /** 是否可以升级到目标计划 */
  canUpgradeTo: (targetPlanId: SubscriptionPlanId) => boolean
}

/**
 * 订阅管理 Hook
 */
export function useSubscription(): UseSubscriptionReturn {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null)
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取所有订阅计划
   */
  const fetchPlans = useCallback(async () => {
    console.log('[useSubscription] 获取订阅计划列表')
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.gateway.call<{ plans: SubscriptionPlan[] }>(
        'assistant.subscription.plans',
        {}
      )
      setPlans(result.plans)
      console.log('[useSubscription] 获取到', result.plans.length, '个计划')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取计划列表失败'
      console.error('[useSubscription] 获取计划失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 获取用户订阅状态
   */
  const fetchSubscription = useCallback(async () => {
    console.log('[useSubscription] 获取用户订阅状态')
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.gateway.call<{
        subscription: UserSubscription | null
        plan: { id: SubscriptionPlanId; name: string; quotas: PlanQuotas }
        hasActiveSubscription: boolean
      }>('assistant.subscription.get', {})

      setSubscription(result.subscription)

      // 查找当前计划的完整信息
      if (plans.length > 0) {
        const plan = plans.find((p) => p.id === result.plan.id)
        setCurrentPlan(plan || null)
      }

      console.log('[useSubscription] 订阅状态:', result.hasActiveSubscription ? '活跃' : '无')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取订阅状态失败'
      console.error('[useSubscription] 获取订阅失败:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [plans])

  /**
   * 获取订阅概览
   */
  const fetchOverview = useCallback(async () => {
    console.log('[useSubscription] 获取订阅概览')

    try {
      const result = await window.electronAPI.gateway.call<SubscriptionOverview>(
        'assistant.subscription.overview',
        {}
      )
      setOverview(result)
      console.log('[useSubscription] 概览:', result.plan.name)
    } catch (err) {
      console.error('[useSubscription] 获取概览失败:', err)
    }
  }, [])

  /**
   * 获取使用量统计
   */
  const fetchUsage = useCallback(async () => {
    console.log('[useSubscription] 获取使用量统计')

    try {
      const result = await window.electronAPI.gateway.call<UsageStats>(
        'assistant.subscription.usage',
        {}
      )
      setUsage(result)
      console.log('[useSubscription] 使用量:', result.daily.conversations, '次对话')
    } catch (err) {
      console.error('[useSubscription] 获取使用量失败:', err)
    }
  }, [])

  /**
   * 创建订阅
   */
  const createSubscription = useCallback(
    async (
      planId: SubscriptionPlanId,
      billingPeriod: BillingPeriod,
      options?: { startTrial?: boolean }
    ) => {
      console.log('[useSubscription] 创建订阅:', planId, billingPeriod)
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.gateway.call<{
          success: boolean
          subscription: UserSubscription
          message: string
        }>('assistant.subscription.create', {
          planId,
          billingPeriod,
          startTrial: options?.startTrial,
        })

        setSubscription(result.subscription)
        console.log('[useSubscription] 订阅创建成功:', result.message)

        // 刷新相关数据
        await fetchOverview()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '创建订阅失败'
        console.error('[useSubscription] 创建订阅失败:', errorMessage)
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchOverview]
  )

  /**
   * 取消订阅
   */
  const cancelSubscription = useCallback(
    async (immediately?: boolean, reason?: string) => {
      if (!subscription) {
        throw new Error('没有活跃的订阅')
      }

      console.log('[useSubscription] 取消订阅:', subscription.id, immediately ? '立即' : '周期结束')
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.gateway.call<{
          success: boolean
          subscription: UserSubscription
          message: string
        }>('assistant.subscription.cancel', {
          subscriptionId: subscription.id,
          immediately,
          reason,
        })

        setSubscription(result.subscription)
        console.log('[useSubscription] 订阅取消成功:', result.message)

        // 刷新相关数据
        await fetchOverview()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '取消订阅失败'
        console.error('[useSubscription] 取消订阅失败:', errorMessage)
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [subscription, fetchOverview]
  )

  /**
   * 更新订阅（升级/降级）
   */
  const updateSubscription = useCallback(
    async (planId: SubscriptionPlanId, billingPeriod?: BillingPeriod) => {
      if (!subscription) {
        throw new Error('没有活跃的订阅')
      }

      console.log('[useSubscription] 更新订阅:', planId)
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.gateway.call<{
          success: boolean
          subscription: UserSubscription
          message: string
        }>('assistant.subscription.update', {
          subscriptionId: subscription.id,
          planId,
          billingPeriod,
        })

        setSubscription(result.subscription)
        console.log('[useSubscription] 订阅更新成功:', result.message)

        // 刷新相关数据
        await fetchOverview()
        await fetchSubscription()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '更新订阅失败'
        console.error('[useSubscription] 更新订阅失败:', errorMessage)
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [subscription, fetchOverview, fetchSubscription]
  )

  /**
   * 检查配额
   */
  const checkQuota = useCallback(
    async (
      quotaType: 'conversations' | 'aiCalls' | 'skills' | 'devices' | 'storage'
    ): Promise<QuotaCheckResult> => {
      console.log('[useSubscription] 检查配额:', quotaType)

      const result = await window.electronAPI.gateway.call<QuotaCheckResult>(
        'assistant.subscription.quota.check',
        { quotaType }
      )

      return result
    },
    []
  )

  /**
   * 刷新所有数据
   */
  const refresh = useCallback(async () => {
    console.log('[useSubscription] 刷新所有数据')
    await Promise.all([fetchPlans(), fetchSubscription(), fetchOverview(), fetchUsage()])
  }, [fetchPlans, fetchSubscription, fetchOverview, fetchUsage])

  /**
   * 格式化价格显示
   */
  const formatPrice = useCallback(
    (planId: SubscriptionPlanId, period: BillingPeriod): string => {
      const plan = plans.find((p) => p.id === planId)
      if (!plan) return '¥0'

      if (plan.price.monthly === -1) return '联系销售'
      if (plan.price.monthly === 0) return '免费'

      const price = period === 'yearly' ? plan.price.yearly : plan.price.monthly
      const displayPrice = (price / 100).toFixed(0)
      return `¥${displayPrice}/${period === 'yearly' ? '年' : '月'}`
    },
    [plans]
  )

  /**
   * 检查是否可以升级到目标计划
   */
  const canUpgradeTo = useCallback(
    (targetPlanId: SubscriptionPlanId): boolean => {
      const currentPlanId = subscription?.planId || 'free'
      const planOrder = ['free', 'pro', 'team', 'enterprise']
      return planOrder.indexOf(targetPlanId) > planOrder.indexOf(currentPlanId)
    },
    [subscription]
  )

  /**
   * 初始化加载
   */
  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  /**
   * 计划加载后获取订阅状态
   */
  useEffect(() => {
    if (plans.length > 0) {
      fetchSubscription()
      fetchOverview()
    }
  }, [plans, fetchSubscription, fetchOverview])

  return {
    // 状态
    plans,
    subscription,
    currentPlan,
    overview,
    usage,
    isLoading,
    error,

    // 方法
    fetchPlans,
    fetchSubscription,
    fetchOverview,
    fetchUsage,
    createSubscription,
    cancelSubscription,
    updateSubscription,
    checkQuota,
    refresh,
    formatPrice,
    canUpgradeTo,
  }
}
