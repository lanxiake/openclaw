/**
 * useSubscription Hook - 订阅管理（简化版）
 *
 * 提供订阅相关功能：
 * - 获取订阅计划列表（仅月费/年费）
 * - 获取用户积分余额
 * - 创建/取消订阅
 */

import { useState, useCallback, useEffect } from 'react'
import { subscriptionService } from '../services/subscription-service'

/**
 * 计费周期
 */
export type BillingPeriod = 'monthly' | 'yearly'

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
 * 服务端返回的订阅计划
 */
export interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  description?: string
  price: number
  currency: string
  billingCycle: 'monthly' | 'yearly'
  features: {
    maxDevices: number
    maxSkills: number
    maxConversations: number
    maxMemorySize: number
    prioritySupport: boolean
    customBranding: boolean
  }
  isActive: boolean
}

/**
 * 用户订阅信息
 */
export interface UserSubscription {
  id: string
  userId: string
  planId: string
  status: SubscriptionStatus
  billingPeriod: BillingPeriod
  currentPeriodStart: string
  currentPeriodEnd: string
  canceledAt?: string
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 积分余额信息
 */
export interface CreditBalance {
  id: string
  userId: string
  totalBalance: number
  totalEarned: number
  totalConsumed: number
  totalExpired: number
  createdAt: string
  updatedAt: string
}

interface UseSubscriptionReturn {
  /** 所有订阅计划（服务端返回） */
  plans: SubscriptionPlan[]
  /** 用户订阅信息 */
  subscription: UserSubscription | null
  /** 积分余额 */
  creditBalance: CreditBalance | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 当前选中的计费周期 */
  selectedPeriod: BillingPeriod

  /** 获取所有计划 */
  fetchPlans: () => Promise<void>
  /** 创建订阅 */
  createSubscription: (
    planId: string,
    billingPeriod: BillingPeriod,
  ) => Promise<void>
  /** 取消订阅 */
  cancelSubscription: (immediately?: boolean, reason?: string) => Promise<void>
  /** 刷新所有数据 */
  refresh: () => Promise<void>
  /** 格式化价格 */
  formatPrice: (plan: SubscriptionPlan) => string
  /** 切换计费周期 */
  setSelectedPeriod: (period: BillingPeriod) => void
}

/**
 * 订阅管理 Hook（简化版）
 *
 * 移除了 overview / usage / quota 等不存在的端点调用，
 * 仅获取计划列表和积分余额。
 */
export function useSubscription(): UseSubscriptionReturn {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('monthly')

  /**
   * 获取订阅计划列表
   */
  const fetchPlans = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('mtbot_access_token')
      if (!accessToken) {
        throw new Error('未登录')
      }

      subscriptionService.setAccessToken(accessToken)
      const result = await subscriptionService.getAvailablePlans()

      if (result.success && result.plans) {
        setPlans(result.plans)
      } else {
        throw new Error(result.error || '获取计划列表失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取计划列表失败'
      setError(errorMessage)
    }
  }, [])

  /**
   * 获取用户订阅状态
   */
  const fetchSubscription = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('mtbot_access_token')
      if (!accessToken) {
        return
      }

      subscriptionService.setAccessToken(accessToken)
      const result = await subscriptionService.getSubscription()

      if (result.success) {
        setSubscription((result.subscription as UserSubscription) ?? null)
      }
    } catch (err) {
      // 订阅信息获取失败不阻塞，静默处理
      const errorMessage = err instanceof Error ? err.message : '获取订阅状态失败'
      setError(errorMessage)
    }
  }, [])

  /**
   * 获取积分余额
   */
  const fetchCreditBalance = useCallback(async () => {
    try {
      const response = await window.electronAPI.api.getCreditBalance() as {
        success: boolean
        data?: CreditBalance | null
        error?: string
      }

      if (response.success) {
        setCreditBalance(response.data ?? null)
      }
    } catch (err) {
      // 积分余额获取失败不阻塞
      const errorMessage = err instanceof Error ? err.message : '获取积分余额失败'
      setError(errorMessage)
    }
  }, [])

  /**
   * 创建订阅
   */
  const createSubscription = useCallback(
    async (planId: string, billingPeriod: BillingPeriod) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.api.createSubscription({
          planId,
          billingPeriod,
        }) as {
          success: boolean
          data?: { subscription: UserSubscription; message?: string }
          error?: string
        }

        if (result.success && result.data) {
          setSubscription(result.data.subscription)
        } else {
          throw new Error(result.error || '创建订阅失败')
        }

        // 刷新积分余额
        await fetchCreditBalance()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '创建订阅失败'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [fetchCreditBalance],
  )

  /**
   * 取消订阅
   */
  const cancelSubscription = useCallback(
    async (immediately?: boolean, reason?: string) => {
      if (!subscription) {
        throw new Error('没有活跃的订阅')
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.api.cancelSubscription(
          subscription.id,
          { immediately, reason },
        ) as {
          success: boolean
          data?: { subscription: UserSubscription; message?: string }
          error?: string
        }

        if (result.success && result.data) {
          setSubscription(result.data.subscription)
        } else {
          throw new Error(result.error || '取消订阅失败')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '取消订阅失败'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [subscription],
  )

  /**
   * 刷新所有数据
   */
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    await Promise.allSettled([
      fetchPlans(),
      fetchSubscription(),
      fetchCreditBalance(),
    ])

    setIsLoading(false)
  }, [fetchPlans, fetchSubscription, fetchCreditBalance])

  /**
   * 格式化价格显示
   */
  const formatPrice = useCallback(
    (plan: SubscriptionPlan): string => {
      if (plan.price === 0) return '免费'
      if (plan.price === -1) return '联系销售'

      const displayPrice = (plan.price / 100).toFixed(0)
      const periodLabel = plan.billingCycle === 'yearly' ? '年' : '月'
      return `¥${displayPrice}/${periodLabel}`
    },
    [],
  )

  /**
   * 初始化加载
   */
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    plans,
    subscription,
    creditBalance,
    isLoading,
    error,
    selectedPeriod,
    fetchPlans,
    createSubscription,
    cancelSubscription,
    refresh,
    formatPrice,
    setSelectedPeriod,
  }
}
