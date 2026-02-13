/**
 * 订阅管理 Hooks
 *
 * 提供订阅列表、订阅详情、订阅操作的 React Query Hooks
 * 使用 HTTP API 替代 WebSocket
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api-client";
import type {
  Subscription,
  SubscriptionListQuery,
  SubscriptionListResponse,
  SubscriptionPlan,
} from "@/types/subscription";

/**
 * 订阅统计数据
 */
export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  canceledSubscriptions: number;
  expiredSubscriptions: number;
  monthlyRevenue: number;
}

/**
 * 转换后端订阅数据
 */
function transformSubscription(
  backendSub: Record<string, unknown>,
): Subscription {
  return {
    id: backendSub.id as string,
    userId: backendSub.userId as string,
    userName: (backendSub.userName as string) || "未知用户",
    userPhone: backendSub.userPhone as string | undefined,
    planId: backendSub.planId as string,
    planName: (backendSub.planName as string) || "未知计划",
    status: backendSub.status as Subscription["status"],
    startDate: formatDate(backendSub.startDate),
    endDate: formatDate(backendSub.endDate),
    autoRenew: (backendSub.autoRenew as boolean) ?? false,
    canceledAt: formatDate(backendSub.canceledAt),
    cancelReason: backendSub.cancelReason as string | undefined,
    createdAt: formatDate(backendSub.createdAt),
    updatedAt: formatDate(backendSub.updatedAt),
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
 * 获取订阅统计数据
 */
export function useSubscriptionStats() {
  return useQuery({
    queryKey: ["admin", "subscriptions", "stats"],
    queryFn: async (): Promise<SubscriptionStats> => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // return client.getSubscriptionStats();
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        trialSubscriptions: 0,
        canceledSubscriptions: 0,
        expiredSubscriptions: 0,
        monthlyRevenue: 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  });
}

/**
 * 获取订阅列表
 */
export function useSubscriptionList(query: SubscriptionListQuery = {}) {
  return useQuery({
    queryKey: ["admin", "subscriptions", "list", query],
    queryFn: async (): Promise<SubscriptionListResponse> => {
      const client = getApiClient();
      const response = await client.getSubscriptions({
        search: query.search,
        status: query.status,
        planId: query.planId,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return {
        subscriptions: response.data.map((s) =>
          transformSubscription(s as unknown as Record<string, unknown>),
        ),
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * 获取订阅详情
 */
export function useSubscriptionDetail(subscriptionId: string) {
  return useQuery({
    queryKey: ["admin", "subscriptions", "detail", subscriptionId],
    queryFn: async (): Promise<Subscription> => {
      const client = getApiClient();
      const subscription = await client.getSubscription(subscriptionId);
      return transformSubscription(
        subscription as unknown as Record<string, unknown>,
      );
    },
    enabled: !!subscriptionId,
    staleTime: 60 * 1000,
  });
}

/**
 * 取消订阅
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId: _subscriptionId,
      reason: _reason,
      immediate: _immediate,
    }: {
      subscriptionId: string;
      reason?: string;
      immediate?: boolean;
    }) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // await client.cancelSubscription(subscriptionId, { reason, immediate });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });
}

/**
 * 延长订阅
 */
export function useExtendSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId: _subscriptionId,
      days: _days,
      reason: _reason,
    }: {
      subscriptionId: string;
      days: number;
      reason?: string;
    }) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // return client.extendSubscription(subscriptionId, { days, reason });
      return { success: true, newEndDate: "" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });
}

/**
 * 更改订阅计划
 */
export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId: _subscriptionId,
      newPlanId: _newPlanId,
      reason: _reason,
    }: {
      subscriptionId: string;
      newPlanId: string;
      reason?: string;
    }) => {
      // TODO: 后端需要实现此 API
      // const client = getApiClient();
      // await client.changeSubscriptionPlan(subscriptionId, { newPlanId, reason });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });
}

/**
 * 获取所有计划列表
 */
export function usePlanList() {
  return useQuery({
    queryKey: ["admin", "plans", "list"],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const client = getApiClient();
      const plans = await client.getPlans();
      return plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        tokensPerMonth: p.tokensPerMonth,
        storageMb: p.storageMb,
        maxDevices: p.maxDevices,
        features: p.features,
        sortOrder: p.sortOrder,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    },
    staleTime: 10 * 60 * 1000, // 10 分钟后过期
  });
}

/**
 * 创建计划的输入参数
 */
export interface CreatePlanInput {
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  tokensPerMonth: number;
  storageMb: number;
  maxDevices: number;
  sortOrder?: number;
  features?: Record<string, unknown>;
}

/**
 * 创建订阅计划
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const client = getApiClient();
      return client.createPlan(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
  });
}

/**
 * 更新计划的输入参数
 */
export interface UpdatePlanInput {
  planId: string;
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  tokensPerMonth?: number;
  storageMb?: number;
  maxDevices?: number;
  sortOrder?: number;
  isActive?: boolean;
  features?: Record<string, unknown>;
}

/**
 * 更新订阅计划
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePlanInput) => {
      const client = getApiClient();
      const { planId, ...data } = input;
      await client.updatePlan(planId, data);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
  });
}
