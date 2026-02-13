/**
 * 用户管理 Hooks
 *
 * 提供用户列表查询、用户详情、用户操作的 React Query Hooks
 * 使用 HTTP API 替代 WebSocket
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api-client";
import type { User, UserDetail, UserListQuery, UserListResponse } from "@/types/user";

/**
 * 将后端响应转换为前端 User 类型
 */
function transformUser(
  backendUser: Record<string, unknown>,
): User {
  return {
    id: backendUser.id as string,
    phone: backendUser.phone as string | undefined,
    email: backendUser.email as string | undefined,
    displayName: (backendUser.displayName as string) || "未知用户",
    avatar: backendUser.avatarUrl as string | undefined,
    // 后端使用 isActive，前端使用 status
    status: (backendUser.isActive as boolean) ? "active" : "suspended",
    isPhoneVerified: (backendUser.phoneVerified as boolean) ?? false,
    isEmailVerified: (backendUser.emailVerified as boolean) ?? false,
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    createdAt: formatDate(backendUser.createdAt),
    lastLoginAt: formatDate(backendUser.lastLoginAt),
    deviceCount: (backendUser.deviceCount as number) ?? 0,
    subscriptionPlan: (
      backendUser.subscription as Record<string, unknown> | null
    )?.planName as string | undefined,
    subscriptionStatus: (
      backendUser.subscription as Record<string, unknown> | null
    )?.status as User["subscriptionStatus"],
  };
}

/**
 * 将后端响应转换为前端 UserDetail 类型
 */
function transformUserDetail(
  backendUser: Record<string, unknown>,
): UserDetail {
  const user = transformUser(backendUser);
  const devices =
    (backendUser.devices as Array<Record<string, unknown>>) || [];
  const subscriptionDetail =
    backendUser.subscriptionDetail as Record<string, unknown> | null;
  const usageStats =
    backendUser.usageStats as Record<string, unknown> | null;

  return {
    ...user,
    devices: devices.map((device) => ({
      id: device.id as string,
      deviceId: device.deviceId as string,
      deviceName: (device.alias as string) || "未命名设备",
      platform: "unknown",
      lastActiveAt: formatDate(device.lastActiveAt),
      isOnline: false, // 后端暂无此字段
    })),
    subscription: subscriptionDetail
      ? {
          id: subscriptionDetail.id as string,
          planId: subscriptionDetail.planId as string,
          planName: subscriptionDetail.planName as string,
          status: subscriptionDetail.status as UserDetail["subscription"] extends
            { status: infer S }
            ? S
            : never,
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
  };
}

/**
 * 格式化日期
 */
function formatDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
}

/**
 * 获取用户列表
 */
export function useUserList(query: UserListQuery = {}) {
  return useQuery({
    queryKey: ["admin", "users", "list", query],
    queryFn: async (): Promise<UserListResponse> => {
      const client = getApiClient();
      const response = await client.getUsers({
        search: query.search,
        status: query.status as "active" | "suspended" | undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return {
        users: response.data.map((u) => transformUser(u as unknown as Record<string, unknown>)),
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      };
    },
    staleTime: 30 * 1000, // 30 秒后过期
  });
}

/**
 * 获取用户详情
 */
export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ["admin", "users", "detail", userId],
    queryFn: async (): Promise<UserDetail> => {
      const client = getApiClient();
      const user = await client.getUser(userId);
      return transformUserDetail(user as unknown as Record<string, unknown>);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 分钟后过期
  });
}

/**
 * 暂停用户
 */
export function useSuspendUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason?: string;
    }) => {
      const client = getApiClient();
      await client.suspendUser(userId, reason);
      return { success: true };
    },
    onSuccess: () => {
      // 刷新用户列表和详情
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/**
 * 激活用户
 */
export function useActivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const client = getApiClient();
      await client.activateUser(userId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/**
 * 重置用户密码
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (_userId: string) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // const result = await client.resetUserPassword(userId);
      // return result;
      throw new Error("API not implemented");
    },
  });
}

/**
 * 解绑用户设备
 */
export function useUnlinkDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      deviceId: _deviceId,
    }: {
      userId: string;
      deviceId: string;
    }) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // await client.unlinkUserDevice(userId, deviceId);
      return { success: true, userId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "users", "detail", variables.userId],
      });
    },
  });
}

/**
 * 强制登出用户
 */
export function useForceLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_userId: string) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // await client.forceLogoutUser(userId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/**
 * 获取用户统计数据
 */
export function useUserStats() {
  return useQuery({
    queryKey: ["admin", "users", "stats"],
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserStats();
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  });
}
