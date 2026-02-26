/**
 * Gateway 配置 Hooks
 *
 * 提供 Gateway 配置读取和更新的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { GatewayConfig, UpdateGatewayConfigRequest } from '@mtbot/api-client/admin'

const QUERY_KEY = ['admin', 'gateway-config'] as const

/**
 * 获取 Gateway 配置
 */
export function useGatewayConfig() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<GatewayConfig> => {
      return apiClient.instance.getGatewayConfig()
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 更新 Gateway 配置
 */
export function useUpdateGatewayConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpdateGatewayConfigRequest) => {
      return apiClient.instance.updateGatewayConfig(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
