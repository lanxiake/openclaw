/**
 * 技能相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { skillService } from '../services'

// 查询键
export const skillKeys = {
  all: ['skills'] as const,
  list: () => [...skillKeys.all, 'list'] as const,
  listAll: () => [...skillKeys.all, 'listAll'] as const,
  detail: (id: string) => [...skillKeys.all, 'detail', id] as const,
  stats: () => [...skillKeys.all, 'stats'] as const,
  store: ['store'] as const,
  storeQuery: (params: Record<string, unknown>) => [...skillKeys.store, 'query', params] as const,
  storeDetail: (id: string) => [...skillKeys.store, 'detail', id] as const,
  storeFeatured: () => [...skillKeys.store, 'featured'] as const,
  storePopular: () => [...skillKeys.store, 'popular'] as const,
  storeRecent: () => [...skillKeys.store, 'recent'] as const,
  storeStats: () => [...skillKeys.store, 'stats'] as const,
  storeUpdates: () => [...skillKeys.store, 'updates'] as const,
}

/**
 * 获取已加载的技能列表
 */
export function useLoadedSkills() {
  return useQuery({
    queryKey: skillKeys.list(),
    queryFn: () => skillService.getLoadedSkills(),
  })
}

/**
 * 获取所有技能（包括禁用的）
 */
export function useAllSkills() {
  return useQuery({
    queryKey: skillKeys.listAll(),
    queryFn: () => skillService.getAllSkills(),
  })
}

/**
 * 获取技能详情
 */
export function useSkillDetail(skillId: string) {
  return useQuery({
    queryKey: skillKeys.detail(skillId),
    queryFn: () => skillService.getSkillDetail(skillId),
    enabled: Boolean(skillId),
  })
}

/**
 * 获取技能统计信息
 */
export function useSkillStats() {
  return useQuery({
    queryKey: skillKeys.stats(),
    queryFn: () => skillService.getStats(),
  })
}

/**
 * 执行技能
 */
export function useExecuteSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      skillId,
      params,
      sessionId,
    }: {
      skillId: string
      params?: Record<string, unknown>
      sessionId?: string
    }) => skillService.executeSkill(skillId, params, sessionId),
    onSuccess: () => {
      // 刷新技能列表和统计
      queryClient.invalidateQueries({ queryKey: skillKeys.list() })
      queryClient.invalidateQueries({ queryKey: skillKeys.stats() })
    },
  })
}

/**
 * 切换技能状态
 */
export function useToggleSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (skillId: string) => skillService.toggleSkill(skillId),
    onSuccess: (_, skillId) => {
      queryClient.invalidateQueries({ queryKey: skillKeys.list() })
      queryClient.invalidateQueries({ queryKey: skillKeys.listAll() })
      queryClient.invalidateQueries({ queryKey: skillKeys.detail(skillId) })
    },
  })
}

/**
 * 卸载技能
 */
export function useUninstallSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (skillId: string) => skillService.uninstallSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.all })
      queryClient.invalidateQueries({ queryKey: skillKeys.store })
    },
  })
}

/**
 * 重新加载技能
 */
export function useReloadSkills() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => skillService.reload(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.all })
    },
  })
}

// === 技能商店 Hooks ===

/**
 * 查询商店技能
 */
export function useStoreSkills(params: {
  category?: string
  subscription?: 'free' | 'pro' | 'team'
  sortBy?: 'popular' | 'recent' | 'name' | 'rating'
  search?: string
  offset?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: skillKeys.storeQuery(params),
    queryFn: () => skillService.queryStore(params),
  })
}

/**
 * 获取商店技能详情
 */
export function useStoreSkillDetail(skillId: string) {
  return useQuery({
    queryKey: skillKeys.storeDetail(skillId),
    queryFn: () => skillService.getStoreSkillDetail(skillId),
    enabled: Boolean(skillId),
  })
}

/**
 * 获取推荐技能
 */
export function useFeaturedSkills(limit = 3) {
  return useQuery({
    queryKey: skillKeys.storeFeatured(),
    queryFn: () => skillService.getFeatured(limit),
  })
}

/**
 * 获取热门技能
 */
export function usePopularSkills(limit = 4) {
  return useQuery({
    queryKey: skillKeys.storePopular(),
    queryFn: () => skillService.getPopular(limit),
  })
}

/**
 * 获取最新技能
 */
export function useRecentSkills(limit = 4) {
  return useQuery({
    queryKey: skillKeys.storeRecent(),
    queryFn: () => skillService.getRecent(limit),
  })
}

/**
 * 获取商店统计信息
 */
export function useStoreStats() {
  return useQuery({
    queryKey: skillKeys.storeStats(),
    queryFn: () => skillService.getStoreStats(),
  })
}

/**
 * 检查技能更新
 */
export function useSkillUpdates() {
  return useQuery({
    queryKey: skillKeys.storeUpdates(),
    queryFn: () => skillService.checkUpdates(),
  })
}

/**
 * 从商店安装技能
 */
export function useInstallFromStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (skillId: string) => skillService.installFromStore(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.all })
      queryClient.invalidateQueries({ queryKey: skillKeys.store })
    },
  })
}

/**
 * 搜索技能
 */
export function useSearchSkills(query: string, limit = 10) {
  return useQuery({
    queryKey: ['skills', 'search', query, limit],
    queryFn: () => skillService.search(query, limit),
    enabled: query.length >= 2,
  })
}

/**
 * 刷新商店索引
 */
export function useRefreshStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => skillService.refreshStore(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.store })
    },
  })
}
