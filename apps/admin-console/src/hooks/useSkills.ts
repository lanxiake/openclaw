/**
 * 技能商店管理 Hooks
 *
 * 提供技能列表、详情、操作等 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type {
  Skill,
  SkillDetail,
  SkillCategory,
  SkillListQuery,
  SkillListResponse,
  SkillStats,
  SkillReviewAction,
  SkillPublishAction,
  SkillFeaturedAction,
  CategoryCreateInput,
  CategoryUpdateInput,
} from '@/types/skill'

/**
 * 转换后端技能数据
 */
function transformSkill(backendSkill: Record<string, unknown>): Skill {
  return {
    id: backendSkill.id as string,
    name: backendSkill.name as string,
    description: backendSkill.description as string,
    version: backendSkill.version as string,
    category: backendSkill.category as string,
    categoryName: backendSkill.categoryName as string | undefined,
    icon: backendSkill.icon as string | undefined,
    author: backendSkill.author as string | undefined,
    authorId: backendSkill.authorId as string | undefined,
    status: backendSkill.status as Skill['status'],
    subscription: backendSkill.subscription as Skill['subscription'],
    runMode: backendSkill.runMode as Skill['runMode'],
    tags: backendSkill.tags as string[] | undefined,
    installCount: (backendSkill.installCount as number) || 0,
    rating: backendSkill.rating as number | undefined,
    ratingCount: (backendSkill.ratingCount as number) || 0,
    featured: Boolean(backendSkill.featured),
    featuredOrder: backendSkill.featuredOrder as number | undefined,
    createdAt: backendSkill.createdAt as string,
    updatedAt: backendSkill.updatedAt as string,
    publishedAt: backendSkill.publishedAt as string | undefined,
    sourceUrl: backendSkill.sourceUrl as string | undefined,
  }
}

/**
 * 转换后端分类数据
 */
function transformCategory(backendCat: Record<string, unknown>): SkillCategory {
  return {
    id: backendCat.id as string,
    name: backendCat.name as string,
    code: backendCat.code as string,
    description: backendCat.description as string | undefined,
    icon: backendCat.icon as string | undefined,
    sortOrder: (backendCat.sortOrder as number) || 0,
    skillCount: (backendCat.skillCount as number) || 0,
    isActive: Boolean(backendCat.isActive),
    createdAt: backendCat.createdAt as string,
    updatedAt: backendCat.updatedAt as string,
  }
}

/**
 * 获取技能统计
 */
export function useSkillStats() {
  return useQuery({
    queryKey: ['admin', 'skills', 'stats'],
    queryFn: async (): Promise<SkillStats> => {
      const response = await gateway.call<{
        success: boolean
        data?: SkillStats
        error?: string
      }>('admin.skills.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取技能统计失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 获取技能列表
 */
export function useSkillList(query: SkillListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'skills', 'list', query],
    queryFn: async (): Promise<SkillListResponse> => {
      const response = await gateway.call<{
        success: boolean
        skills?: Array<Record<string, unknown>>
        total?: number
        page?: number
        pageSize?: number
        error?: string
      }>('admin.skills.list', {
        search: query.search,
        status: query.status,
        category: query.category,
        subscription: query.subscription,
        featured: query.featured,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      })

      if (!response.success) {
        throw new Error(response.error || '获取技能列表失败')
      }

      return {
        skills: (response.skills ?? []).map(transformSkill),
        total: response.total ?? 0,
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 20,
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 获取技能详情
 */
export function useSkillDetail(skillId: string) {
  return useQuery({
    queryKey: ['admin', 'skills', 'detail', skillId],
    queryFn: async (): Promise<SkillDetail> => {
      const response = await gateway.call<{
        success: boolean
        skill?: Record<string, unknown>
        error?: string
      }>('admin.skills.get', { skillId })

      if (!response.success || !response.skill) {
        throw new Error(response.error || '获取技能详情失败')
      }

      const skill = response.skill
      return {
        ...transformSkill(skill),
        readme: skill.readme as string | undefined,
        changelog: skill.changelog as string | undefined,
        triggers: skill.triggers as string[] | undefined,
        parameters: skill.parameters as SkillDetail['parameters'],
        screenshots: skill.screenshots as string[] | undefined,
        reviewNotes: skill.reviewNotes as string | undefined,
        reviewedBy: skill.reviewedBy as string | undefined,
        reviewedAt: skill.reviewedAt as string | undefined,
      }
    },
    enabled: !!skillId,
    staleTime: 60 * 1000,
  })
}

/**
 * 审核技能
 */
export function useReviewSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: SkillReviewAction) => {
      const response = await gateway.call<{
        success: boolean
        skillId?: string
        status?: string
        message?: string
        error?: string
      }>('admin.skills.review', {
        skillId: action.skillId,
        action: action.action,
        notes: action.notes,
      })

      if (!response.success) {
        throw new Error(response.error || '审核操作失败')
      }

      return response
    },
    onSuccess: () => {
      // 刷新技能列表和统计
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}

/**
 * 发布/下架技能
 */
export function usePublishSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: SkillPublishAction) => {
      const response = await gateway.call<{
        success: boolean
        skillId?: string
        status?: string
        message?: string
        error?: string
      }>('admin.skills.publish', {
        skillId: action.skillId,
        action: action.action,
        reason: action.reason,
      })

      if (!response.success) {
        throw new Error(response.error || '发布/下架操作失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}

/**
 * 设置技能推荐
 */
export function useSetFeatured() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: SkillFeaturedAction) => {
      const response = await gateway.call<{
        success: boolean
        skillId?: string
        featured?: boolean
        featuredOrder?: number
        message?: string
        error?: string
      }>('admin.skills.setFeatured', {
        skillId: action.skillId,
        featured: action.featured,
        order: action.order,
      })

      if (!response.success) {
        throw new Error(response.error || '设置推荐失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'featured'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}

/**
 * 获取推荐技能列表
 */
export function useFeaturedSkills() {
  return useQuery({
    queryKey: ['admin', 'skills', 'featured'],
    queryFn: async (): Promise<Skill[]> => {
      const response = await gateway.call<{
        success: boolean
        skills?: Array<Record<string, unknown>>
        total?: number
        error?: string
      }>('admin.skills.featured.list', {})

      if (!response.success) {
        throw new Error(response.error || '获取推荐技能失败')
      }

      return (response.skills ?? []).map(transformSkill)
    },
    staleTime: 60 * 1000,
  })
}

/**
 * 更新推荐技能排序
 */
export function useReorderFeatured() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (skillIds: string[]) => {
      const response = await gateway.call<{
        success: boolean
        message?: string
        error?: string
      }>('admin.skills.featured.reorder', { skillIds })

      if (!response.success) {
        throw new Error(response.error || '更新排序失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'featured'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'list'] })
    },
  })
}

/**
 * 获取技能分类列表
 */
export function useSkillCategories() {
  return useQuery({
    queryKey: ['admin', 'skills', 'categories'],
    queryFn: async (): Promise<SkillCategory[]> => {
      const response = await gateway.call<{
        success: boolean
        categories?: Array<Record<string, unknown>>
        total?: number
        error?: string
      }>('admin.skills.categories.list', {})

      if (!response.success) {
        throw new Error(response.error || '获取分类列表失败')
      }

      return (response.categories ?? []).map(transformCategory)
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 创建技能分类
 */
export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryCreateInput) => {
      const response = await gateway.call<{
        success: boolean
        category?: Record<string, unknown>
        message?: string
        error?: string
      }>('admin.skills.categories.create', input as unknown as Record<string, unknown>)

      if (!response.success) {
        throw new Error(response.error || '创建分类失败')
      }

      return response.category ? transformCategory(response.category) : null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}

/**
 * 更新技能分类
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryUpdateInput) => {
      const response = await gateway.call<{
        success: boolean
        category?: Record<string, unknown>
        message?: string
        error?: string
      }>('admin.skills.categories.update', input as unknown as Record<string, unknown>)

      if (!response.success) {
        throw new Error(response.error || '更新分类失败')
      }

      return response.category ? transformCategory(response.category) : null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'categories'] })
    },
  })
}

/**
 * 创建技能的输入参数
 */
export interface CreateSkillInput {
  name: string
  description?: string
  version?: string
  categoryId?: string
  subscriptionLevel?: string
  iconUrl?: string
  tags?: string[]
  readme?: string
  manifestUrl?: string
  packageUrl?: string
  config?: Record<string, unknown>
}

/**
 * 管理员创建技能（直接发布，跳过审核）
 */
export function useCreateSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSkillInput) => {
      const response = await gateway.call<{
        success: boolean
        skill?: Record<string, unknown>
        message?: string
        error?: string
      }>('admin.skills.create', input as unknown as Record<string, unknown>)

      if (!response.success) {
        throw new Error(response.error || '创建技能失败')
      }

      return response.skill ? transformSkill(response.skill) : null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}

/**
 * 删除技能分类
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await gateway.call<{
        success: boolean
        categoryId?: string
        message?: string
        error?: string
      }>('admin.skills.categories.delete', { categoryId })

      if (!response.success) {
        throw new Error(response.error || '删除分类失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills', 'stats'] })
    },
  })
}
