/**
 * Agent Config Hooks
 *
 * 提供 Agent 配置读取、更新和重置的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AgentConfig, UpdateAgentConfigRequest } from '@openclaw/api-client/admin'

const QUERY_KEY = ['admin', 'agent-config'] as const

/**
 * 获取 Agent 配置
 */
export function useAgentConfig() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AgentConfig> => {
      return apiClient.instance.getAgentConfig()
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 更新 Agent 配置
 */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpdateAgentConfigRequest) => {
      return apiClient.instance.updateAgentConfig(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * 重置 Agent 配置为默认值
 */
export function useResetAgentConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiClient.instance.resetAgentConfig()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
