/**
 * 数据分析 Hooks
 *
 * 提供数据分析相关的 React Query Hooks
 * 使用 API Server REST API（全部对接真实后端数据）
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
 * 将 AnalyticsPeriod 映射到后端接受的 period 参数
 */
function mapPeriod(period: AnalyticsPeriod): string {
  const periodMap: Record<AnalyticsPeriod, string> = {
    day: 'week',
    week: 'week',
    month: 'month',
    quarter: 'quarter',
    year: 'quarter',
  }
  return periodMap[period]
}

/**
 * 获取分析概览
 */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: async (): Promise<AnalyticsOverview> => {
      console.log('[useAnalytics] 获取分析概览')
      const result = await apiClient.instance.getAnalyticsOverview()
      return {
        totalUsers: result.users?.total ?? 0,
        activeUsers: result.users?.active ?? 0,
        newUsersToday: result.users?.newToday ?? 0,
        totalRevenue: result.revenue?.total ?? 0,
        revenueGrowth: result.revenue?.growthRate ?? 0,
        avgSessionDuration: 0,
        conversionRate: result.subscriptions?.conversionRate ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * 获取用户增长趋势
 */
export function useUserGrowthTrend(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'growth', period],
    queryFn: async (): Promise<UserGrowthTrend> => {
      console.log('[useAnalytics] 获取用户增长趋势:', period)
      const result = await apiClient.instance.getUserGrowthTrend(mapPeriod(period))
      return {
        labels: (result.data ?? []).map((d) => d.date),
        data: (result.data ?? []).map((d) => d.new),
        total: result.summary?.totalUsers ?? 0,
        growth: result.summary?.growthRate ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取用户留存分析
 */
export function useUserRetention(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'retention', period],
    queryFn: async (): Promise<RetentionAnalysis> => {
      console.log('[useAnalytics] 获取用户留存分析:', period)
      const result = await apiClient.instance.getUserRetention(mapPeriod(period))
      return {
        cohorts: (result.cohorts ?? []).map((c) => ({
          cohort: c.cohort,
          day1: c.day1,
          day3: c.day3,
          day7: c.day7,
          day14: c.day14,
          day30: c.day30,
        })),
        averageRetention: result.averageRetention ?? {
          day1: 0,
          day3: 0,
          day7: 0,
          day14: 0,
          day30: 0,
        },
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取用户画像
 */
export function useUserDemographics() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', 'demographics'],
    queryFn: async (): Promise<UserDemographics> => {
      console.log('[useAnalytics] 获取用户画像')
      const result = await apiClient.instance.getUserDemographics()
      return {
        byRegion: (result.byRegion ?? []).map((r) => ({
          region: r.region,
          count: r.count,
          percentage: r.percentage,
        })),
        byDevice: (result.byDevice ?? []).map((d) => ({
          device: d.name,
          count: d.count,
          percentage: d.percentage,
        })),
        byPlatform: [], // 后端暂不提供平台分布
        byAge: [], // 后端暂不提供年龄分布
      }
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 获取收入趋势
 */
export function useRevenueTrend(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'trend', period],
    queryFn: async (): Promise<RevenueTrend> => {
      console.log('[useAnalytics] 获取收入趋势:', period)
      const result = await apiClient.instance.getRevenueTrend(mapPeriod(period))
      return {
        labels: (result.data ?? []).map((d) => d.date),
        data: (result.data ?? []).map((d) => d.revenue),
        total: result.summary?.totalRevenue ?? 0,
        growth: result.summary?.growthRate ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取收入来源分布
 */
export function useRevenueSources() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'sources'],
    queryFn: async (): Promise<RevenueBySource> => {
      console.log('[useAnalytics] 获取收入来源分布')
      const result = await apiClient.instance.getRevenueSources()
      const sources = (result.byPlan ?? []).map((p) => ({
        name: p.plan,
        revenue: p.revenue,
        percentage: p.percentage,
        orders: p.orders,
      }))
      const total = sources.reduce((sum, s) => sum + s.revenue, 0)
      return { sources, total }
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 获取用户价值指标
 */
export function useUserValueMetrics(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'metrics', period],
    queryFn: async (): Promise<UserValueMetrics> => {
      console.log('[useAnalytics] 获取用户价值指标:', period)
      const result = await apiClient.instance.getUserValueMetrics(mapPeriod(period))
      return {
        arpu: result.arpu ?? 0,
        arppu: result.arppu ?? 0,
        ltv: result.ltv ?? 0,
        payingUserRate: result.payingUserRate ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取技能使用分析
 */
export function useSkillUsageAnalytics(period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'skills', 'usage', period],
    queryFn: async (): Promise<SkillAnalytics> => {
      console.log('[useAnalytics] 获取技能使用分析:', period)
      const result = await apiClient.instance.getSkillUsageAnalytics(mapPeriod(period))
      return {
        topSkills: (result.topSkills ?? []).map((s) => ({
          skillId: s.id,
          skillName: s.name,
          category: '',
          totalExecutions: s.installCount,
          uniqueUsers: s.activeUsers,
          successRate: 0,
          averageExecutionTime: 0,
          trend: 'stable' as const,
          trendValue: 0,
        })),
        usageTrend: (result.usageTrend ?? []).map((t) => ({
          date: t.date,
          executions: t.executions,
          uniqueUsers: t.uniqueUsers,
        })),
        categoryDistribution: (result.categoryDistribution ?? []).map((c) => ({
          category: c.category,
          executions: c.count,
          percentage: c.percentage,
        })),
        summary: {
          totalExecutions: result.summary?.totalInstalls ?? 0,
          totalUniqueUsers: result.summary?.activeSkills ?? 0,
          averageExecutionsPerUser: result.summary?.avgInstallsPerSkill ?? 0,
          activeSkillsCount: result.summary?.activeSkills ?? 0,
        },
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取漏斗列表
 */
export function useFunnelList() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'funnels', 'list'],
    queryFn: async (): Promise<Array<{ id: string; name: string; description: string }>> => {
      console.log('[useAnalytics] 获取漏斗列表')
      return apiClient.instance.getFunnelList()
    },
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * 获取漏斗分析
 */
export function useFunnelAnalysis(type: string, period: AnalyticsPeriod = 'month') {
  return useQuery({
    queryKey: ['admin', 'analytics', 'funnels', 'get', type, period],
    queryFn: async (): Promise<FunnelAnalysis> => {
      console.log('[useAnalytics] 获取漏斗分析:', type, period)
      const result = await apiClient.instance.getFunnelAnalysis(type, mapPeriod(period))
      return {
        steps: (result.steps ?? []).map((s) => ({
          name: s.name,
          count: s.count,
          percentage: s.percentage,
          dropoffRate: s.dropoffRate,
        })),
        overallConversion: result.overallConversionRate ?? 0,
      }
    },
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  })
}
