/**
 * 订阅相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionService } from '../services'

// 查询键
export const subscriptionKeys = {
  all: ['subscription'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  plan: (id: string) => [...subscriptionKeys.all, 'plan', id] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  overview: () => [...subscriptionKeys.all, 'overview'] as const,
  usage: (params?: Record<string, unknown>) => [...subscriptionKeys.all, 'usage', params] as const,
  quota: (type: string) => [...subscriptionKeys.all, 'quota', type] as const,
}

/**
 * 获取所有订阅计划
 */
export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => subscriptionService.getPlans(),
  })
}

/**
 * 获取指定计划详情
 */
export function usePlan(planId: string) {
  return useQuery({
    queryKey: subscriptionKeys.plan(planId),
    queryFn: () => subscriptionService.getPlan(planId),
    enabled: Boolean(planId),
  })
}

/**
 * 获取当前用户订阅
 */
export function useCurrentSubscription() {
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: () => subscriptionService.getCurrentSubscription(),
  })
}

/**
 * 获取订阅概览
 */
export function useSubscriptionOverview() {
  return useQuery({
    queryKey: subscriptionKeys.overview(),
    queryFn: () => subscriptionService.getOverview(),
  })
}

/**
 * 获取使用量记录
 */
export function useUsageRecords(params: {
  startDate?: string
  endDate?: string
  limit?: number
} = {}) {
  return useQuery({
    queryKey: subscriptionKeys.usage(params),
    queryFn: () => subscriptionService.getUsage(params),
  })
}

/**
 * 检查配额
 */
export function useQuotaCheck(type: 'calls' | 'skills' | 'devices' | 'storage') {
  return useQuery({
    queryKey: subscriptionKeys.quota(type),
    queryFn: () => subscriptionService.checkQuota(type),
  })
}

/**
 * 创建订阅
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => subscriptionService.createSubscription(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
    },
  })
}

/**
 * 更新订阅（升级/降级）
 */
export function useUpdateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => subscriptionService.updateSubscription(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
    },
  })
}

/**
 * 取消订阅
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => subscriptionService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
    },
  })
}
