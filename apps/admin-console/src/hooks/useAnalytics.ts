/**
 * 数据分析 Hooks
 *
 * 提供数据分析相关的 React Query Hooks
 */

import { useQuery } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
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
 */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: async (): Promise<AnalyticsOverview> => {
      const response = await gateway.call<{
        success: boolean
        data?: AnalyticsOverview
        error?: string
      }>('admin.analytics.overview', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取分析概览失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: UserGrowthTrend
        error?: string
      }>('admin.analytics.users.growth', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取用户增长趋势失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: RetentionAnalysis
        error?: string
      }>('admin.analytics.users.retention', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取用户留存分析失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: UserDemographics
        error?: string
      }>('admin.analytics.users.demographics', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取用户画像失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: RevenueTrend
        error?: string
      }>('admin.analytics.revenue.trend', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取收入趋势失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: RevenueBySource
        error?: string
      }>('admin.analytics.revenue.sources', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取收入来源分布失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: UserValueMetrics
        error?: string
      }>('admin.analytics.revenue.metrics', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取用户价值指标失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        data?: SkillAnalytics
        error?: string
      }>('admin.analytics.skills.usage', { period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取技能使用分析失败')
      }

      return response.data
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
      const response = await gateway.call<{
        success: boolean
        funnels?: Array<{ id: string; name: string; description: string }>
        error?: string
      }>('admin.analytics.funnels.list', {})

      if (!response.success) {
        throw new Error(response.error || '获取漏斗列表失败')
      }

      return response.funnels ?? []
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
      const response = await gateway.call<{
        success: boolean
        data?: FunnelAnalysis
        error?: string
      }>('admin.analytics.funnels.get', { type, period })

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取漏斗分析失败')
      }

      return response.data
    },
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  })
}
