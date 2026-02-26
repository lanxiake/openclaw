/**
 * 积分管理 Hooks
 *
 * 提供积分余额、流水、定价管理的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { FullResponse } from '@mtbot/api-client'
import type {
  CreditBalance,
  CreditHistoryQuery,
  CreditTransaction,
  CreditOperationResult,
  ModelPricing,
  CleanupResult,
} from '@/types/credits'

/** 积分流水分页响应（复用 api-client 的 FullResponse 类型） */
type CreditHistoryFullResponse = FullResponse<CreditTransaction[]>

/**
 * 查询用户积分余额
 */
export function useCreditBalance(userId: string) {
  return useQuery({
    queryKey: ['admin', 'credits', 'balance', userId],
    queryFn: async (): Promise<CreditBalance> => {
      console.log('[useCredits] 查询用户积分余额:', userId)
      return apiClient.instance.getCreditBalance(userId)
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

/**
 * 查询用户积分流水
 */
export function useCreditHistory(userId: string, query: CreditHistoryQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'credits', 'history', userId, query],
    queryFn: async (): Promise<CreditHistoryFullResponse> => {
      console.log('[useCredits] 查询用户积分流水:', userId, query)
      return apiClient.instance.getCreditHistory(userId, query)
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

/**
 * 管理员发放积分
 */
export function useGrantCredits() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      request,
    }: {
      userId: string
      request: { amount: number; expiryMonths?: number; description?: string; adminNote?: string }
    }): Promise<CreditOperationResult> => {
      console.log('[useCredits] 管理员发放积分:', userId, request)
      return apiClient.instance.grantCredits(userId, request)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'credits', 'balance', variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'credits', 'history', variables.userId],
      })
    },
  })
}

/**
 * 获取模型定价列表
 */
export function useModelPricingList(activeOnly?: boolean) {
  return useQuery({
    queryKey: ['admin', 'credits', 'pricing', { activeOnly }],
    queryFn: async (): Promise<ModelPricing[]> => {
      console.log('[useCredits] 获取模型定价列表')
      return apiClient.instance.getModelPricingList(activeOnly)
    },
    staleTime: 60 * 1000,
  })
}

/**
 * 创建/更新模型定价
 */
export function useUpsertModelPricing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      modelId,
      request,
    }: {
      modelId: string
      request: { modelName: string; inputPrice: number; outputPrice: number; multiplier?: string }
    }) => {
      console.log('[useCredits] 创建/更新模型定价:', modelId)
      await apiClient.instance.upsertModelPricing(modelId, request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'credits', 'pricing'] })
    },
  })
}

/**
 * 删除模型定价
 */
export function useDeleteModelPricing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modelId: string) => {
      console.log('[useCredits] 删除模型定价:', modelId)
      await apiClient.instance.deleteModelPricing(modelId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'credits', 'pricing'] })
    },
  })
}

/**
 * 触发过期批次清理
 */
export function useCleanupExpiredCredits() {
  return useMutation({
    mutationFn: async (): Promise<CleanupResult> => {
      console.log('[useCredits] 触发过期批次清理')
      return apiClient.instance.cleanupExpiredCredits()
    },
  })
}
