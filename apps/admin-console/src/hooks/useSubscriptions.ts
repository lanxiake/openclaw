/**
 * 订阅管理 Hooks
 *
 * 提供订阅列表、订阅详情、订阅操作的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type {
  Subscription,
  SubscriptionListQuery,
  SubscriptionListResponse,
  SubscriptionPlan,
} from '@/types/subscription'

/**
 * 订阅统计数据
 */
export interface SubscriptionStats {
  totalSubscriptions: number
  activeSubscriptions: number
  trialSubscriptions: number
  canceledSubscriptions: number
  expiredSubscriptions: number
  monthlyRevenue: number
}

/**
 * 转换后端订阅数据
 */
function transformSubscription(backendSub: Record<string, unknown>): Subscription {
  return {
    id: backendSub.id as string,
    userId: backendSub.userId as string,
    userName: (backendSub.userName as string) || '未知用户',
    userPhone: backendSub.userPhone as string | undefined,
    planId: backendSub.planId as string,
    planName: (backendSub.planName as string) || '未知计划',
    status: backendSub.status as Subscription['status'],
    startDate: formatDate(backendSub.startDate),
    endDate: formatDate(backendSub.endDate),
    autoRenew: (backendSub.autoRenew as boolean) ?? false,
    canceledAt: formatDate(backendSub.canceledAt),
    cancelReason: backendSub.cancelReason as string | undefined,
    createdAt: formatDate(backendSub.createdAt),
    updatedAt: formatDate(backendSub.updatedAt),
  }
}

/**
 * 格式化日期
 */
function formatDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return ''
}

/**
 * 获取订阅统计数据
 */
export function useSubscriptionStats() {
  return useQuery({
    queryKey: ['admin', 'subscriptions', 'stats'],
    queryFn: async (): Promise<SubscriptionStats> => {
      const response = await gateway.call<{
        success: boolean
        data?: SubscriptionStats
        error?: string
      }>('admin.subscriptions.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取订阅统计失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 获取订阅列表
 */
export function useSubscriptionList(query: SubscriptionListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'subscriptions', 'list', query],
    queryFn: async (): Promise<SubscriptionListResponse> => {
      const response = await gateway.call<{
        success: boolean
        subscriptions?: Array<Record<string, unknown>>
        total?: number
        page?: number
        pageSize?: number
        error?: string
      }>('admin.subscriptions.list', {
        search: query.search,
        status: query.status,
        planId: query.planId,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        orderBy: query.sortBy,
        orderDir: query.sortOrder,
      })

      if (!response.success) {
        throw new Error(response.error || '获取订阅列表失败')
      }

      return {
        subscriptions: (response.subscriptions ?? []).map(transformSubscription),
        total: response.total ?? 0,
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 20,
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 获取订阅详情
 */
export function useSubscriptionDetail(subscriptionId: string) {
  return useQuery({
    queryKey: ['admin', 'subscriptions', 'detail', subscriptionId],
    queryFn: async (): Promise<Subscription> => {
      const response = await gateway.call<{
        success: boolean
        subscription?: Record<string, unknown>
        error?: string
      }>('admin.subscriptions.get', { subscriptionId })

      if (!response.success || !response.subscription) {
        throw new Error(response.error || '获取订阅详情失败')
      }

      return transformSubscription(response.subscription)
    },
    enabled: !!subscriptionId,
    staleTime: 60 * 1000,
  })
}

/**
 * 取消订阅
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      reason,
      immediate,
    }: {
      subscriptionId: string
      reason?: string
      immediate?: boolean
    }) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.subscriptions.cancel', { subscriptionId, reason, immediate })

      if (!response.success) {
        throw new Error(response.error || '取消订阅失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
    },
  })
}

/**
 * 延长订阅
 */
export function useExtendSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      days,
      reason,
    }: {
      subscriptionId: string
      days: number
      reason?: string
    }) => {
      const response = await gateway.call<{
        success: boolean
        newEndDate?: string
        error?: string
      }>('admin.subscriptions.extend', { subscriptionId, days, reason })

      if (!response.success) {
        throw new Error(response.error || '延长订阅失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
    },
  })
}

/**
 * 更改订阅计划
 */
export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      newPlanId,
      reason,
    }: {
      subscriptionId: string
      newPlanId: string
      reason?: string
    }) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.subscriptions.changePlan', { subscriptionId, newPlanId, reason })

      if (!response.success) {
        throw new Error(response.error || '更改计划失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
    },
  })
}

/**
 * 获取所有计划列表
 */
export function usePlanList() {
  return useQuery({
    queryKey: ['admin', 'plans', 'list'],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const response = await gateway.call<{
        success: boolean
        plans?: SubscriptionPlan[]
        error?: string
      }>('admin.plans.list', {})

      if (!response.success) {
        throw new Error(response.error || '获取计划列表失败')
      }

      return response.plans ?? []
    },
    staleTime: 10 * 60 * 1000, // 10 分钟后过期
  })
}

/**
 * 创建计划的输入参数
 */
export interface CreatePlanInput {
  code: string
  name: string
  description?: string
  priceMonthly: number
  priceYearly: number
  tokensPerMonth: number
  storageMb: number
  maxDevices: number
  sortOrder?: number
  features?: Record<string, unknown>
}

/**
 * 创建订阅计划
 */
export function useCreatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const response = await gateway.call<{
        success: boolean
        plan?: SubscriptionPlan
        error?: string
      }>('admin.plans.create', input)

      if (!response.success) {
        throw new Error(response.error || '创建计划失败')
      }

      return response.plan
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
    },
  })
}

/**
 * 更新计划的输入参数
 */
export interface UpdatePlanInput {
  planId: string
  name?: string
  description?: string
  priceMonthly?: number
  priceYearly?: number
  tokensPerMonth?: number
  storageMb?: number
  maxDevices?: number
  sortOrder?: number
  isActive?: boolean
  features?: Record<string, unknown>
}

/**
 * 更新订阅计划
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdatePlanInput) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.plans.update', input)

      if (!response.success) {
        throw new Error(response.error || '更新计划失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
    },
  })
}
