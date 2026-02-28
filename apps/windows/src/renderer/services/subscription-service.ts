/**
 * 订阅管理服务
 *
 * 封装订阅查询、计划管理相关的 API 调用
 */

/**
 * 订阅信息
 */
export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  startDate: string
  endDate?: string
  cancelledAt?: string
  autoRenew: boolean
  billingCycle: 'monthly' | 'yearly'
}

/**
 * 订阅计划
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
 * 使用量统计
 */
export interface UsageStats {
  devices: {
    current: number
    limit: number
  }
  skills: {
    current: number
    limit: number
  }
  conversations: {
    daily: number
    monthly: number
    limit: number
  }
  storage: {
    used: number
    limit: number
  }
}

/** 默认 API 基础 URL（与主进程 OPENCLAW_API_BASE_URL 未设置时的默认值一致） */
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000'

/**
 * 订阅管理服务
 */
export class SubscriptionService {
  private baseUrl: string
  private accessToken: string | null = null

  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * 设置 API 基础 URL（通常由主进程 OPENCLAW_API_BASE_URL 或设置项同步而来）
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * 设置访问令牌
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }
    return headers
  }

  /**
   * 获取当前用户订阅信息
   */
  async getSubscription(): Promise<{
    success: boolean
    subscription?: Subscription
    plan?: SubscriptionPlan
    error?: string
  }> {
    console.log('[subscription-service] 获取订阅信息')

    try {
      const response = await fetch(`${this.baseUrl}/api/users/me/subscription`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        subscription: data.data?.subscription,
        plan: data.data?.plan,
      }
    } catch (error) {
      console.error('[subscription-service] 获取订阅信息失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      }
    }
  }

  /**
   * 获取使用量统计
   */
  async getUsage(): Promise<{
    success: boolean
    usage?: UsageStats
    error?: string
  }> {
    console.log('[subscription-service] 获取使用量统计')

    try {
      const response = await fetch(`${this.baseUrl}/api/users/me/usage`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        usage: data.data,
      }
    } catch (error) {
      console.error('[subscription-service] 获取使用量统计失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      }
    }
  }

  /**
   * 获取可用的订阅计划列表
   */
  async getAvailablePlans(): Promise<{
    success: boolean
    plans?: SubscriptionPlan[]
    error?: string
  }> {
    console.log('[subscription-service] 获取可用计划列表')

    try {
      const response = await fetch(`${this.baseUrl}/api/plans`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        plans: data.data?.plans || [],
      }
    } catch (error) {
      console.error('[subscription-service] 获取计划列表失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      }
    }
  }
}

// 导出单例
export const subscriptionService = new SubscriptionService()
