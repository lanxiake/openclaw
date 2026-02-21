/**
 * 仪表盘数据 Hooks
 *
 * 提供仪表盘统计数据、趋势数据、实时动态的获取
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { DashboardStats, TrendData, SubscriptionDistribution, Activity } from '@/types/dashboard'

/**
 * 获取仪表盘统计概览
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      console.log('[useDashboard] 获取仪表盘统计数据')
      // API 返回的类型与本地类型可能不完全匹配，使用类型断言
      const data = await apiClient.instance.getDashboardStats()
      return data as unknown as DashboardStats
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
      console.log('[useDashboard] 获取趋势数据:', type, period)
      const data = await apiClient.instance.getDashboardTrends(type, period)
      return data as unknown as TrendData
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
      console.log('[useDashboard] 获取订阅分布数据')
      const data = await apiClient.instance.getDashboardDistribution()
      return data as unknown as SubscriptionDistribution[]
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
      console.log('[useDashboard] 获取最近活动:', limit)
      const data = await apiClient.instance.getDashboardActivities(limit)
      return data as unknown as Activity[]
    },
    staleTime: 30 * 1000, // 30 秒后过期
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  })
}
