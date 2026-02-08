/**
 * 订阅服务
 *
 * 封装订阅和支付相关的 Gateway RPC 调用
 */

import { gateway } from '../lib/gateway-client'

/**
 * 订阅计划
 */
export interface Plan {
  id: string
  name: string
  description: string
  price: number
  period: 'month' | 'year'
  features: string[]
  limits: {
    devices: number
    skills: number | 'unlimited'
    dailyCalls: number | 'unlimited'
    storage: number
  }
  popular?: boolean
}

/**
 * 用户订阅
 */
export interface Subscription {
  id: string
  userId: string
  planId: string
  plan: Plan
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  startAt: string
  endAt: string
  autoRenew: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 使用量记录
 */
export interface UsageRecord {
  date: string
  calls: number
  skills: number
  devices: number
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt?: string
  message?: string
}

/**
 * 订阅概览
 */
export interface SubscriptionOverview {
  subscription: Subscription | null
  usage: {
    devices: { used: number; limit: number }
    skills: { used: number; limit: number | 'unlimited' }
    dailyCalls: { used: number; limit: number | 'unlimited' }
    storage: { used: number; limit: number }
  }
  history: UsageRecord[]
}

/**
 * 订阅服务
 */
export const subscriptionService = {
  /**
   * 获取所有订阅计划
   */
  async getPlans(): Promise<Plan[]> {
    console.log('[subscription] 获取订阅计划')

    try {
      const result = await gateway.call<{ plans: Plan[] }>('assistant.subscription.plans')
      return result.plans
    } catch (error) {
      console.error('[subscription] 获取订阅计划失败', error)
      return []
    }
  },

  /**
   * 获取指定计划详情
   */
  async getPlan(planId: string): Promise<Plan | null> {
    console.log('[subscription] 获取计划详情', { planId })

    try {
      const result = await gateway.call<Plan>('assistant.subscription.plan', { planId })
      return result
    } catch (error) {
      console.error('[subscription] 获取计划详情失败', error)
      return null
    }
  },

  /**
   * 获取当前用户订阅
   */
  async getCurrentSubscription(): Promise<Subscription | null> {
    console.log('[subscription] 获取当前订阅')

    try {
      const result = await gateway.call<{ subscription: Subscription | null }>('assistant.subscription.get')
      return result.subscription
    } catch (error) {
      console.error('[subscription] 获取当前订阅失败', error)
      return null
    }
  },

  /**
   * 创建订阅
   */
  async createSubscription(planId: string): Promise<{
    success: boolean
    subscription?: Subscription
    paymentUrl?: string
    error?: string
  }> {
    console.log('[subscription] 创建订阅', { planId })

    try {
      const result = await gateway.call<{
        success: boolean
        subscription?: Subscription
        paymentUrl?: string
      }>('assistant.subscription.create', { planId })
      return result
    } catch (error) {
      console.error('[subscription] 创建订阅失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败',
      }
    }
  },

  /**
   * 更新订阅（升级/降级）
   */
  async updateSubscription(planId: string): Promise<{
    success: boolean
    subscription?: Subscription
    paymentUrl?: string
    error?: string
  }> {
    console.log('[subscription] 更新订阅', { planId })

    try {
      const result = await gateway.call<{
        success: boolean
        subscription?: Subscription
        paymentUrl?: string
      }>('assistant.subscription.update', { planId })
      return result
    } catch (error) {
      console.error('[subscription] 更新订阅失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新失败',
      }
    }
  },

  /**
   * 取消订阅
   */
  async cancelSubscription(): Promise<{ success: boolean; error?: string }> {
    console.log('[subscription] 取消订阅')

    try {
      const result = await gateway.call<{ success: boolean }>('assistant.subscription.cancel')
      return result
    } catch (error) {
      console.error('[subscription] 取消订阅失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消失败',
      }
    }
  },

  /**
   * 检查配额
   */
  async checkQuota(type: 'calls' | 'skills' | 'devices' | 'storage'): Promise<QuotaCheckResult> {
    console.log('[subscription] 检查配额', { type })

    try {
      const result = await gateway.call<QuotaCheckResult>('assistant.subscription.quota.check', { type })
      return result
    } catch (error) {
      console.error('[subscription] 检查配额失败', error)
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        message: error instanceof Error ? error.message : '检查失败',
      }
    }
  },

  /**
   * 获取使用量记录
   */
  async getUsage(params: {
    startDate?: string
    endDate?: string
    limit?: number
  } = {}): Promise<UsageRecord[]> {
    console.log('[subscription] 获取使用量')

    try {
      const result = await gateway.call<{ records: UsageRecord[] }>('assistant.subscription.usage', params)
      return result.records
    } catch (error) {
      console.error('[subscription] 获取使用量失败', error)
      return []
    }
  },

  /**
   * 获取订阅概览
   */
  async getOverview(): Promise<SubscriptionOverview | null> {
    console.log('[subscription] 获取订阅概览')

    try {
      const result = await gateway.call<SubscriptionOverview>('assistant.subscription.overview')
      return result
    } catch (error) {
      console.error('[subscription] 获取订阅概览失败', error)
      return null
    }
  },
}
