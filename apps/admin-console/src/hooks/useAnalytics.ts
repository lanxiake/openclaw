/**
 * 数据分析 Hooks
 *
 * 提供数据分析相关的 React Query Hooks
 * 使用 API Server REST API
 *
 * 注意：分析 API 需要在 API Server 中实现对应的路由
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  AnalyticsPeriod,
  AnalyticsOverview,
  UserGrowthTrend,
  RetentionAnalysis,
  UserDemographics,
  RevenueTrend,
  RevenueBySource,
  UserValueMetrics,
  SkillAnalytics,
  FunnelAnalysis,
} from '@/types/analytics'

/**
 * 获取分析概览
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/overview
 */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: async (): Promise<AnalyticsOverview> => {
      console.log('[useAnalytics] 获取分析概览')
      // 使用仪表盘统计作为临时替代
      const stats = await apiClient.instance.getDashboardStats()
      return {
        totalUsers: stats.users?.total ?? 0,
        activeUsers: stats.users?.active ?? 0,
        newUsersToday: stats.users?.newToday ?? 0,
        totalRevenue: stats.subscriptions?.revenue ?? 0,
        revenueGrowth: 0,
        avgSessionDuration: 0,
        conversionRate: 0,
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * 获取用户增长趋势
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/users/growth
 */
export function useUserGrowthTrend(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'growth', period],
    queryFn: async (): Promise<UserGrowthTrend> => {
      console.log('[useAnalytics] 获取用户增长趋势:', period)
      // 使用仪表盘趋势数据作为临时替代
      const daysMap: Record<AnalyticsPeriod, number> = { day: 1, week: 7, month: 30, quarter: 90, year: 365 }
      const trends = await apiClient.instance.getDashboardTrends(daysMap[period])
      return {
        labels: trends.labels,
        data: trends.datasets[0]?.data ?? [],
        total: 0,
        growth: 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取用户留存分析
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/users/retention
 */
export function useUserRetention(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'retention', period],
    queryFn: async (): Promise<RetentionAnalysis> => {
      console.log('[useAnalytics] 获取用户留存分析:', period)
      // 返回空数据，等待 API 实现
      return {
        cohorts: [],
        averageRetention: { day1: 0, day3: 0, day7: 0, day14: 0, day30: 0 },
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取用户画像
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/users/demographics
 */
export function useUserDemographics() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'demographics'],
    queryFn: async (): Promise<UserDemographics> => {
      console.log('[useAnalytics] 获取用户画像')
      // 返回空数据，等待 API 实现
      return {
        byRegion: [],
        byDevice: [],
        byPlatform: [],
        byAge: [],
      }
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 获取收入趋势
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/revenue/trend
 */
export function useRevenueTrend(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'trend', period],
    queryFn: async (): Promise<RevenueTrend> => {
      console.log('[useAnalytics] 获取收入趋势:', period)
      // 返回空数据，等待 API 实现
      return {
        labels: [],
        data: [],
        total: 0,
        growth: 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取收入来源分布
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/revenue/sources
 */
export function useRevenueSources() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'sources'],
    queryFn: async (): Promise<RevenueBySource> => {
      console.log('[useAnalytics] 获取收入来源分布')
      // 返回空数据，等待 API 实现
      return {
        sources: [],
        total: 0,
      }
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 获取用户价值指标
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/revenue/metrics
 */
export function useUserValueMetrics(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'metrics', period],
    queryFn: async (): Promise<UserValueMetrics> => {
      console.log('[useAnalytics] 获取用户价值指标:', period)
      // 返回空数据，等待 API 实现
      return {
        arpu: 0,
        arppu: 0,
        ltv: 0,
        payingUserRate: 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取技能使用分析
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/skills/usage
 */
export function useSkillUsageAnalytics(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'skills', 'usage', period],
    queryFn: async (): Promise<SkillAnalytics> => {
      console.log('[useAnalytics] 获取技能使用分析:', period)
      // 返回空数据，等待 API 实现
      return {
        topSkills: [],
        usageTrend: [],
        categoryDistribution: [],
        summary: {
          totalExecutions: 0,
          totalUniqueUsers: 0,
          averageExecutionsPerUser: 0,
          activeSkillsCount: 0,
        },
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取漏斗列表
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/funnels
 */
export function useFunnelList() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'funnels', 'list'],
    queryFn: async (): Promise<Array<{ id: string; name: string; description: string }>> => {
      console.log('[useAnalytics] 获取漏斗列表')
      // 返回空数据，等待 API 实现
      return []
    },
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * 获取漏斗分析
 * TODO: 需要在 API Server 中实现 /api/admin/analytics/funnels/:type
 */
export function useFunnelAnalysis(type: string, period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'funnels', 'get', type, period],
    queryFn: async (): Promise<FunnelAnalysis> => {
      console.log('[useAnalytics] 获取漏斗分析:', type, period)
      // 返回空数据，等待 API 实现
      return {
        steps: [],
        overallConversion: 0,
      }
    },
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  })
}
