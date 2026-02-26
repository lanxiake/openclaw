/**
 * Auth Profile Hooks
 *
 * 提供 Auth Profile CRUD 和优先级管理的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  AuthProfile,
  UpsertAuthProfileRequest,
  UpdateAuthProfileRequest,
  AuthProfileOrder,
} from '@mtbot/api-client/admin'

const QUERY_KEY = ['admin', 'auth-profiles'] as const
const ORDERS_QUERY_KEY = ['admin', 'auth-profile-orders'] as const

/**
 * 获取 Auth Profile 列表
 */
export function useAuthProfiles() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AuthProfile[]> => {
      return apiClient.instance.getAuthProfiles()
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 创建 Auth Profile
 */
export function useCreateAuthProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpsertAuthProfileRequest) => {
      return apiClient.instance.upsertAuthProfile(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 更新 Auth Profile
 */
export function useUpdateAuthProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { profileId: string; request: UpdateAuthProfileRequest }) => {
      return apiClient.instance.updateAuthProfile(params.profileId, params.request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 删除 Auth Profile
 */
export function useDeleteAuthProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profileId: string) => {
      await apiClient.instance.deleteAuthProfile(profileId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 获取 Auth Profile 优先级列表
 */
export function useAuthProfileOrders() {
  return useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: async (): Promise<AuthProfileOrder[]> => {
      return apiClient.instance.getAuthProfileOrders()
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 更新 Auth Profile 优先级
 */
export function useUpdateAuthProfileOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { agentKey: string; profileIds: string[] }) => {
      return apiClient.instance.updateAuthProfileOrder(params.agentKey, params.profileIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
    },
  })
}
