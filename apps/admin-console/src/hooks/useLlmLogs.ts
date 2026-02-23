/**
 * LLM 调用日志 Hooks
 *
 * 提供 LLM 调用日志查询、统计和性能指标的 React Query Hooks
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  LlmLogQuery,
  LlmLogListResponse,
  LlmLogStats,
  LlmModelDistribution,
  LlmPerformanceStats,
} from '@/types/llm-logs'

/**
 * 获取 LLM 调用日志列表
 */
export function useLlmLogs(query: LlmLogQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'llm-logs', 'list', query],
    queryFn: async (): Promise<LlmLogListResponse> => {
      console.log('[useLlmLogs] 获取 LLM 调用日志列表')
      return apiClient.instance.getLlmLogs(query)
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/**
 * 获取 LLM 调用统计
 */
export function useLlmLogStats(params?: { startTime?: string; endTime?: string }) {
  return useQuery({
    queryKey: ['admin', 'llm-logs', 'stats', params],
    queryFn: async (): Promise<LlmLogStats> => {
      console.log('[useLlmLogs] 获取 LLM 调用统计')
      return apiClient.instance.getLlmLogStats(params)
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * 获取 LLM 性能指标
 */
export function useLlmPerformance(params?: { startTime?: string; endTime?: string }) {
  return useQuery({
    queryKey: ['admin', 'llm-logs', 'performance', params],
    queryFn: async (): Promise<LlmPerformanceStats> => {
      console.log('[useLlmLogs] 获取 LLM 性能指标')
      return apiClient.instance.getLlmLogPerformance(params)
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * 获取模型使用分布
 */
export function useLlmModelDistribution(params?: { startTime?: string; endTime?: string }) {
  return useQuery({
    queryKey: ['admin', 'llm-logs', 'models', params],
    queryFn: async (): Promise<LlmModelDistribution> => {
      console.log('[useLlmLogs] 获取模型使用分布')
      return apiClient.instance.getLlmLogModels(params)
    },
    staleTime: 60 * 1000,
  })
}
