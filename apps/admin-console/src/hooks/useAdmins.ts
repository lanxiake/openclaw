/**
 * 管理员管理 Hooks
 *
 * 提供管理员列表查询、创建、更新、状态管理等操作的 React Query Hooks
 * 对应后端 admin.admins.* RPC 方法
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type {
  AdminItem,
  AdminListQuery,
  AdminListResponse,
  CreateAdminInput,
  UpdateAdminInput,
  ResetAdminPasswordInput,
  UpdateAdminStatusInput,
} from '@/types/admin-manage'

/**
 * 将后端响应转换为前端 AdminItem 类型
 */
function transformAdmin(backendAdmin: Record<string, unknown>): AdminItem {
  return {
    id: backendAdmin.id as string,
    username: backendAdmin.username as string,
    displayName: (backendAdmin.displayName as string) || '',
    email: (backendAdmin.email as string) ?? null,
    phone: (backendAdmin.phone as string) ?? null,
    avatarUrl: (backendAdmin.avatarUrl as string) ?? null,
    role: backendAdmin.role as AdminItem['role'],
    status: backendAdmin.status as AdminItem['status'],
    mfaEnabled: (backendAdmin.mfaEnabled as boolean) ?? false,
    lastLoginAt: formatDate(backendAdmin.lastLoginAt),
    lastLoginIp: (backendAdmin.lastLoginIp as string) ?? null,
    createdAt: formatDate(backendAdmin.createdAt) || '',
  }
}

/**
 * 格式化日期字段
 */
function formatDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return null
}

/**
 * 获取管理员列表
 */
export function useAdminList(query: AdminListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'admins', 'list', query],
    queryFn: async (): Promise<AdminListResponse> => {
      const response = await gateway.call<{
        success: boolean
        admins?: Array<Record<string, unknown>>
        total?: number
        page?: number
        pageSize?: number
        totalPages?: number
        error?: string
      }>('admin.admins.list', {
        search: query.search,
        role: query.role,
        status: query.status,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        orderBy: query.orderBy,
        orderDir: query.orderDir,
      })

      if (!response.success) {
        throw new Error(response.error || '获取管理员列表失败')
      }

      return {
        admins: (response.admins ?? []).map(transformAdmin),
        total: response.total ?? 0,
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 20,
        totalPages: response.totalPages ?? 0,
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
      const response = await gateway.call<{
        success: boolean
        admin?: Record<string, unknown>
        error?: string
      }>('admin.admins.get', { adminId })

      if (!response.success || !response.admin) {
        throw new Error(response.error || '获取管理员详情失败')
      }

      return transformAdmin(response.admin)
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
      const response = await gateway.call<{
        success: boolean
        admin?: Record<string, unknown>
        error?: string
      }>('admin.admins.create', {
        username: input.username,
        password: input.password,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        role: input.role,
      })

      if (!response.success) {
        throw new Error(response.error || '创建管理员失败')
      }

      return response.admin ? transformAdmin(response.admin) : undefined
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
      const response = await gateway.call<{
        success: boolean
        admin?: Record<string, unknown>
        error?: string
      }>('admin.admins.update', {
        adminId: input.adminId,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        role: input.role,
      })

      if (!response.success) {
        throw new Error(response.error || '更新管理员失败')
      }

      return response.admin ? transformAdmin(response.admin) : undefined
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
    mutationFn: async (input: ResetAdminPasswordInput) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.admins.resetPassword', {
        adminId: input.adminId,
        newPassword: input.newPassword,
      })

      if (!response.success) {
        throw new Error(response.error || '重置密码失败')
      }

      return response
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
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.admins.updateStatus', {
        adminId: input.adminId,
        status: input.status,
        reason: input.reason,
      })

      if (!response.success) {
        throw new Error(response.error || '更新管理员状态失败')
      }

      return response
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
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.admins.forceLogout', { adminId })

      if (!response.success) {
        throw new Error(response.error || '强制登出失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
  })
}
