/**
 * 管理员管理 Hooks
 *
 * 提供管理员列表查询、创建、更新、状态管理等操作的 React Query Hooks
 * 使用 API Server REST API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  AdminItem,
  AdminListQuery,
  AdminListResponse,
  CreateAdminInput,
  UpdateAdminInput,
  UpdateAdminStatusInput,
} from '@/types/admin-manage'

/**
 * 获取管理员列表
 */
export function useAdminList(query: AdminListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'admins', 'list', query],
    queryFn: async (): Promise<AdminListResponse> => {
      console.log('[useAdmins] 获取管理员列表:', query)

      const response = await apiClient.instance.getAdmins({
        search: query.search,
        role: query.role,
        status: query.status,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        sortBy: query.orderBy,
        sortOrder: query.orderDir,
      })

      return {
        admins: response.data as unknown as AdminItem[],
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.limit,
        totalPages: response.meta.totalPages,
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 获取管理员详情
 */
export function useAdminDetail(adminId: string) {
  return useQuery({
    queryKey: ['admin', 'admins', 'detail', adminId],
    queryFn: async (): Promise<AdminItem> => {
      console.log('[useAdmins] 获取管理员详情:', adminId)
      const data = await apiClient.instance.getAdmin(adminId)
      return data as unknown as AdminItem
    },
    enabled: !!adminId,
    staleTime: 60 * 1000,
  })
}

/**
 * 创建管理员
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAdminInput) => {
      console.log('[useAdmins] 创建管理员:', input.username)
      const data = await apiClient.instance.createAdmin({
        username: input.username,
        password: input.password,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        role: input.role as 'admin' | 'operator',
      })
      return data as unknown as AdminItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}

/**
 * 更新管理员信息
 */
export function useUpdateAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateAdminInput) => {
      console.log('[useAdmins] 更新管理员:', input.adminId)
      const data = await apiClient.instance.updateAdmin(input.adminId, {
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        role: input.role as 'admin' | 'operator' | undefined,
      })
      return data as unknown as AdminItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}

/**
 * 重置管理员密码
 */
export function useResetAdminPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (adminId: string) => {
      console.log('[useAdmins] 重置管理员密码:', adminId)
      return apiClient.instance.resetAdminPassword(adminId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}

/**
 * 更新管理员状态（启用/禁用）
 */
export function useUpdateAdminStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateAdminStatusInput) => {
      console.log('[useAdmins] 更新管理员状态:', input.adminId, input.status)
      await apiClient.instance.updateAdminStatus(input.adminId, input.status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}

/**
 * 强制管理员登出
 */
export function useForceLogoutAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (adminId: string) => {
      console.log('[useAdmins] 强制管理员登出:', adminId)
      await apiClient.instance.forceAdminLogout(adminId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}
