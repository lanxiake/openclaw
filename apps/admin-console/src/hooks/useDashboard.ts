/**
 * 仪表盘数据 Hooks
 *
 * 提供仪表盘统计数据、趋势数据、实时动态的获取
 */

import { useQuery } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type { DashboardStats, TrendData, SubscriptionDistribution, Activity } from '@/types/dashboard'

/**
 * 获取仪表盘统计概览
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const response = await gateway.call<{
        success: boolean
        data?: DashboardStats
        error?: string
      }>('admin.dashboard.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取统计数据失败')
      }

      return response.data
    },
    staleTime: 30 * 1000, // 30 秒后过期
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  })
}

/**
 * 获取趋势数据
 *
 * @param type - 趋势类型 (users | revenue | subscriptions)
 * @param period - 时间周期 (7d | 30d | 90d)
 */
export function useTrends(
  type: 'users' | 'revenue' | 'subscriptions',
  period: '7d' | '30d' | '90d' = '30d'
) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'trends', type, period],
    queryFn: async (): Promise<TrendData> => {
      const response = await gateway.call<{
        success: boolean
        data?: TrendData
        error?: string
      }>('admin.dashboard.trends', { type, period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取趋势数据失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 获取订阅分布数据
 */
export function useSubscriptionDistribution() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'subscriptionDistribution'],
    queryFn: async (): Promise<SubscriptionDistribution[]> => {
      const response = await gateway.call<{
        success: boolean
        data?: SubscriptionDistribution[]
        error?: string
      }>('admin.dashboard.subscriptionDistribution', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取订阅分布失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 获取最近活动
 *
 * @param limit - 返回数量限制
 */
export function useActivities(limit = 10) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'activities', limit],
    queryFn: async (): Promise<Activity[]> => {
      const response = await gateway.call<{
        success: boolean
        data?: Activity[]
        error?: string
      }>('admin.dashboard.activities', { limit })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取活动数据失败')
      }

      return response.data
    },
    staleTime: 30 * 1000, // 30 秒后过期
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  })
}
