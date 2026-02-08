/**
 * 订阅系统 RPC 方法 - Subscription RPC Methods
 *
 * 提供订阅相关的 Gateway RPC 方法：
 * - 获取订阅计划列表
 * - 获取用户订阅状态
 * - 创建/更新/取消订阅
 * - 配额检查
 * - 使用量统计
 *
 * @author OpenClaw
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  getAllPlans,
  getPlan,
  getUserSubscription,
  getUserPlan,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getUserDailyUsage,
  getUserMonthlyUsage,
  checkQuota,
  incrementUsage,
  type SubscriptionPlanId,
  type BillingPeriod,
} from "../../assistant/subscription/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// 日志
const log = createSubsystemLogger("subscription-rpc");

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }
  return value.trim();
}

/**
 * 验证布尔参数
 */
function validateBooleanParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): boolean | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Parameter ${key} must be a boolean`);
  }
  return value;
}

/**
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return value;
}

// ============================================================================
// RPC 方法处理器
// ============================================================================

/**
 * 订阅相关 RPC 方法
 */
export const assistantSubscriptionMethods: GatewayRequestHandlers = {
  /**
   * 获取所有订阅计划
   */
  "assistant.subscription.plans": ({ respond }) => {
    log.debug("获取订阅计划列表");

    const plans = getAllPlans();

    respond(
      true,
      {
        plans: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          features: plan.features,
          quotas: plan.quotas,
          recommended: plan.recommended,
        })),
      },
      undefined,
    );
  },

  /**
   * 获取指定计划详情
   */
  "assistant.subscription.plan": ({ params, respond }) => {
    try {
      const planId = validateStringParam(params, "planId", true) as SubscriptionPlanId;

      log.debug("获取计划详情", { planId });

      const plan = getPlan(planId);
      if (!plan) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `计划不存在: ${planId}`),
        );
        return;
      }

      respond(true, { plan }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 获取用户订阅状态
   */
  "assistant.subscription.get": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("获取用户订阅状态", { userId });

      const subscription = await getUserSubscription(userId);
      const plan = await getUserPlan(userId);

      respond(
        true,
        {
          subscription,
          plan: {
            id: plan.id,
            name: plan.name,
            quotas: plan.quotas,
          },
          hasActiveSubscription: subscription !== null,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 创建订阅
   */
  "assistant.subscription.create": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";
      const planId = validateStringParam(params, "planId", true) as SubscriptionPlanId;
      const billingPeriod = (validateStringParam(params, "billingPeriod") ?? "monthly") as BillingPeriod;
      const paymentMethodId = validateStringParam(params, "paymentMethodId");
      const startTrial = validateBooleanParam(params, "startTrial");

      log.info("创建订阅", { userId, planId, billingPeriod });

      // 验证计划存在
      const plan = getPlan(planId);
      if (!plan) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `无效的计划: ${planId}`),
        );
        return;
      }

      // 创建订阅
      const subscription = await createSubscription({
        userId,
        planId,
        billingPeriod,
        paymentMethodId,
        startTrial,
      });

      respond(
        true,
        {
          success: true,
          subscription,
          message: startTrial ? "试用已开始" : "订阅已创建",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 更新订阅
   */
  "assistant.subscription.update": async ({ params, respond }) => {
    try {
      const subscriptionId = validateStringParam(params, "subscriptionId", true);
      const planId = validateStringParam(params, "planId") as SubscriptionPlanId | undefined;
      const billingPeriod = validateStringParam(params, "billingPeriod") as BillingPeriod | undefined;
      const cancelAtPeriodEnd = validateBooleanParam(params, "cancelAtPeriodEnd");

      if (!subscriptionId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing subscriptionId"),
        );
        return;
      }

      log.info("更新订阅", { subscriptionId, planId, billingPeriod });

      const subscription = await updateSubscription({
        subscriptionId,
        planId,
        billingPeriod,
        cancelAtPeriodEnd,
      });

      respond(
        true,
        {
          success: true,
          subscription,
          message: "订阅已更新",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 取消订阅
   */
  "assistant.subscription.cancel": async ({ params, respond }) => {
    try {
      const subscriptionId = validateStringParam(params, "subscriptionId", true);
      const immediately = validateBooleanParam(params, "immediately");
      const reason = validateStringParam(params, "reason");
      const feedback = validateStringParam(params, "feedback");

      if (!subscriptionId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing subscriptionId"),
        );
        return;
      }

      log.info("取消订阅", { subscriptionId, immediately });

      const subscription = await cancelSubscription({
        subscriptionId,
        immediately,
        reason,
        feedback,
      });

      respond(
        true,
        {
          success: true,
          subscription,
          message: immediately ? "订阅已立即取消" : "订阅将在周期结束后取消",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 检查配额
   */
  "assistant.subscription.quota.check": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";
      const quotaType = validateStringParam(params, "quotaType", true) as
        | "conversations"
        | "aiCalls"
        | "skills"
        | "devices"
        | "storage";

      if (!quotaType) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing quotaType"),
        );
        return;
      }

      log.debug("检查配额", { userId, quotaType });

      const result = await checkQuota(userId, quotaType);

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取使用量统计
   */
  "assistant.subscription.usage": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("获取使用量统计", { userId });

      const dailyUsage = await getUserDailyUsage(userId);
      const monthlyUsage = await getUserMonthlyUsage(userId);
      const plan = await getUserPlan(userId);

      respond(
        true,
        {
          daily: {
            ...dailyUsage,
            quotas: {
              conversations: plan.quotas.dailyConversations,
            },
          },
          monthly: {
            ...monthlyUsage,
            quotas: {
              aiCalls: plan.quotas.monthlyAiCalls,
              storage: plan.quotas.storageQuotaMb,
            },
          },
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 记录使用量
   */
  "assistant.subscription.usage.record": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";
      const type = validateStringParam(params, "type", true) as
        | "conversations"
        | "aiCalls"
        | "skillExecutions"
        | "fileOperations";
      const amount = validateNumberParam(params, "amount") ?? 1;

      if (!type) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing type"),
        );
        return;
      }

      log.debug("记录使用量", { userId, type, amount });

      await incrementUsage(userId, type, amount);

      respond(true, { success: true }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取订阅概览（用于仪表盘）
   */
  "assistant.subscription.overview": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("获取订阅概览", { userId });

      const subscription = await getUserSubscription(userId);
      const plan = await getUserPlan(userId);
      const dailyUsage = await getUserDailyUsage(userId);
      const monthlyUsage = await getUserMonthlyUsage(userId);

      // 计算配额使用百分比
      const conversationUsage = plan.quotas.dailyConversations === -1
        ? 0
        : Math.round((dailyUsage.conversations / plan.quotas.dailyConversations) * 100);

      const aiCallUsage = plan.quotas.monthlyAiCalls === -1
        ? 0
        : Math.round((monthlyUsage.aiCalls / plan.quotas.monthlyAiCalls) * 100);

      respond(
        true,
        {
          subscription: subscription
            ? {
                id: subscription.id,
                planId: subscription.planId,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              }
            : null,
          plan: {
            id: plan.id,
            name: plan.name,
          },
          usage: {
            conversations: {
              used: dailyUsage.conversations,
              limit: plan.quotas.dailyConversations,
              percent: conversationUsage,
            },
            aiCalls: {
              used: monthlyUsage.aiCalls,
              limit: plan.quotas.monthlyAiCalls,
              percent: aiCallUsage,
            },
          },
          features: {
            premiumSkills: plan.quotas.premiumSkills,
            prioritySupport: plan.quotas.prioritySupport,
            apiAccess: plan.quotas.apiAccess,
          },
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
