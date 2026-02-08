/**
 * 用户管理 Hooks
 *
 * 提供用户列表查询、用户详情、用户操作的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type { User, UserDetail, UserListQuery, UserListResponse } from '@/types/user'

/**
 * 将后端响应转换为前端 User 类型
 */
function transformUser(backendUser: Record<string, unknown>): User {
  return {
    id: backendUser.id as string,
    phone: backendUser.phone as string | undefined,
    email: backendUser.email as string | undefined,
    displayName: (backendUser.displayName as string) || '未知用户',
    avatar: backendUser.avatarUrl as string | undefined,
    // 后端使用 isActive，前端使用 status
    status: (backendUser.isActive as boolean) ? 'active' : 'suspended',
    isPhoneVerified: (backendUser.phoneVerified as boolean) ?? false,
    isEmailVerified: (backendUser.emailVerified as boolean) ?? false,
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    createdAt: formatDate(backendUser.createdAt),
    lastLoginAt: formatDate(backendUser.lastLoginAt),
    deviceCount: (backendUser.deviceCount as number) ?? 0,
    subscriptionPlan: (backendUser.subscription as Record<string, unknown> | null)?.planName as string | undefined,
    subscriptionStatus: (backendUser.subscription as Record<string, unknown> | null)?.status as User['subscriptionStatus'],
  }
}

/**
 * 将后端响应转换为前端 UserDetail 类型
 */
function transformUserDetail(backendUser: Record<string, unknown>): UserDetail {
  const user = transformUser(backendUser)
  const devices = (backendUser.devices as Array<Record<string, unknown>>) || []
  const subscriptionDetail = backendUser.subscriptionDetail as Record<string, unknown> | null
  const usageStats = backendUser.usageStats as Record<string, unknown> | null

  return {
    ...user,
    devices: devices.map((device) => ({
      id: device.id as string,
      deviceId: device.deviceId as string,
      deviceName: (device.alias as string) || '未命名设备',
      platform: 'unknown',
      lastActiveAt: formatDate(device.lastActiveAt),
      isOnline: false, // 后端暂无此字段
    })),
    subscription: subscriptionDetail
      ? {
          id: subscriptionDetail.id as string,
          planId: subscriptionDetail.planId as string,
          planName: subscriptionDetail.planName as string,
          status: subscriptionDetail.status as UserDetail['subscription'] extends { status: infer S } ? S : never,
          startDate: formatDate(subscriptionDetail.startDate),
          endDate: formatDate(subscriptionDetail.endDate),
          autoRenew: (subscriptionDetail.autoRenew as boolean) ?? false,
        }
      : undefined,
    usageStats: {
      totalMessages: (usageStats?.totalMessages as number) ?? 0,
      totalTokens: (usageStats?.totalTokens as number) ?? 0,
      totalSkillExecutions: 0,
      monthlyMessages: (usageStats?.monthlyMessages as number) ?? 0,
      monthlyTokens: (usageStats?.monthlyTokens as number) ?? 0,
    },
    auditLogs: [], // 审计日志需要单独查询
  }
}

/**
 * 格式化日期
 */
function formatDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return ''
}

/**
 * 获取用户列表
 */
export function useUserList(query: UserListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'users', 'list', query],
    queryFn: async (): Promise<UserListResponse> => {
      const response = await gateway.call<{
        success: boolean
        users?: Array<Record<string, unknown>>
        total?: number
        page?: number
        pageSize?: number
        error?: string
      }>('admin.users.list', {
        search: query.search,
        status: query.status,
        subscriptionStatus: query.subscriptionStatus,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        orderBy: query.sortBy,
        orderDir: query.sortOrder,
      })

      if (!response.success) {
        throw new Error(response.error || '获取用户列表失败')
      }

      return {
        users: (response.users ?? []).map(transformUser),
        total: response.total ?? 0,
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 20,
      }
    },
    staleTime: 30 * 1000, // 30 秒后过期
  })
}

/**
 * 获取用户详情
 */
export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', 'detail', userId],
    queryFn: async (): Promise<UserDetail> => {
      const response = await gateway.call<{
        success: boolean
        user?: Record<string, unknown>
        error?: string
      }>('admin.users.get', { userId })

      if (!response.success || !response.user) {
        throw new Error(response.error || '获取用户详情失败')
      }

      return transformUserDetail(response.user)
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 分钟后过期
  })
}

/**
 * 暂停用户
 */
export function useSuspendUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.users.suspend', { userId, reason })

      if (!response.success) {
        throw new Error(response.error || '暂停用户失败')
      }

      return response
    },
    onSuccess: () => {
      // 刷新用户列表和详情
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

/**
 * 激活用户
 */
export function useActivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.users.activate', { userId })

      if (!response.success) {
        throw new Error(response.error || '激活用户失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

/**
 * 重置用户密码
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await gateway.call<{
        success: boolean
        tempPassword?: string
        error?: string
      }>('admin.users.resetPassword', { userId })

      if (!response.success) {
        throw new Error(response.error || '重置密码失败')
      }

      return response
    },
  })
}

/**
 * 解绑用户设备
 */
export function useUnlinkDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, deviceId }: { userId: string; deviceId: string }) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.users.unlinkDevice', { userId, deviceId })

      if (!response.success) {
        throw new Error(response.error || '解绑设备失败')
      }

      return response
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', variables.userId] })
    },
  })
}

/**
 * 强制登出用户
 */
export function useForceLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await gateway.call<{
        success: boolean
        error?: string
      }>('admin.users.forceLogout', { userId })

      if (!response.success) {
        throw new Error(response.error || '强制登出失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

/**
 * 获取用户统计数据
 */
export function useUserStats() {
  return useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: async () => {
      const response = await gateway.call<{
        success: boolean
        data?: {
          totalUsers: number
          activeUsers: number
          suspendedUsers: number
          newUsersToday: number
          newUsersWeek: number
          newUsersMonth: number
        }
        error?: string
      }>('admin.users.stats', {})

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取用户统计失败')
      }

      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}
