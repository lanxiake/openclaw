/**
 * 模型提供商 Hooks
 *
 * 提供模型提供商 CRUD 的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  ModelProvider,
  ModelProviderTestResult,
  UpsertModelProviderRequest,
  UpdateModelProviderRequest,
} from '@openclaw/api-client/admin'

const QUERY_KEY = ['admin', 'model-providers'] as const

/**
 * 获取模型提供商列表
 */
export function useModelProviders() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ModelProvider[]> => {
      return apiClient.instance.getModelProviders()
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 创建模型提供商（POST）
 */
export function useCreateModelProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpsertModelProviderRequest) => {
      return apiClient.instance.upsertModelProvider(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 更新模型提供商（PUT，apiKey 可选）
 */
export function useUpdateModelProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { providerKey: string; request: UpdateModelProviderRequest }) => {
      return apiClient.instance.updateModelProvider(params.providerKey, params.request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 创建/更新模型提供商（兼容旧代码，始终用 POST）
 * @deprecated 请使用 useCreateModelProvider 或 useUpdateModelProvider
 */
export function useUpsertModelProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpsertModelProviderRequest) => {
      return apiClient.instance.upsertModelProvider(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 删除模型提供商
 */
export function useDeleteModelProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (providerKey: string) => {
      await apiClient.instance.deleteModelProvider(providerKey)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 测试模型提供商连通性和模型可用性
 */
export function useTestModelProvider() {
  return useMutation({
    mutationFn: async (providerKey: string): Promise<ModelProviderTestResult> => {
      return apiClient.instance.testModelProvider(providerKey)
    },
  })
}
