/**
 * 璁㈤槄绯荤粺 RPC 鏂规硶 - Subscription RPC Methods
 *
 * 鎻愪緵璁㈤槄鐩稿叧鐨?Gateway RPC 鏂规硶锛? * - 鑾峰彇璁㈤槄璁″垝鍒楄〃
 * - 鑾峰彇鐢ㄦ埛璁㈤槄鐘舵€? * - 鍒涘缓/鏇存柊/鍙栨秷璁㈤槄
 * - 閰嶉妫€鏌? * - 浣跨敤閲忕粺璁? *
 * @author OpenClaw
 */

import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
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

// 鏃ュ織
const log = createSubsystemLogger("subscription-rpc");

// ============================================================================
// 杈呭姪鍑芥暟
// ============================================================================

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * 楠岃瘉甯冨皵鍙傛暟
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
 * 楠岃瘉鏁板瓧鍙傛暟
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
// RPC 鏂规硶澶勭悊鍣?// ============================================================================

/**
 * 璁㈤槄鐩稿叧 RPC 鏂规硶
 */
export const assistantSubscriptionMethods: GatewayRequestHandlers = {
  /**
   * 鑾峰彇鎵€鏈夎闃呰鍒?   */
  "assistant.subscription.plans": ({ respond }) => {
    log.debug("鑾峰彇璁㈤槄璁″垝鍒楄〃");

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
   * 鑾峰彇鎸囧畾璁″垝璇︽儏
   */
  "assistant.subscription.plan": ({ params, respond }) => {
    try {
      const planId = validateStringParam(params, "planId", true) as SubscriptionPlanId;

      log.debug("鑾峰彇璁″垝璇︽儏", { planId });

      const plan = getPlan(planId);
      if (!plan) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `璁″垝涓嶅瓨鍦? ${planId}`));
        return;
      }

      respond(true, { plan }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛璁㈤槄鐘舵€?   */
  "assistant.subscription.get": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("鑾峰彇鐢ㄦ埛璁㈤槄鐘舵€?, { userId });

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
   * 鍒涘缓璁㈤槄
   */
  "assistant.subscription.create": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";
      const planId = validateStringParam(params, "planId", true) as SubscriptionPlanId;
      const billingPeriod = (validateStringParam(params, "billingPeriod") ??
        "monthly") as BillingPeriod;
      const paymentMethodId = validateStringParam(params, "paymentMethodId");
      const startTrial = validateBooleanParam(params, "startTrial");

      log.info("鍒涘缓璁㈤槄", { userId, planId, billingPeriod });

      // 楠岃瘉璁″垝瀛樺湪
      const plan = getPlan(planId);
      if (!plan) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `鏃犳晥鐨勮鍒? ${planId}`));
        return;
      }

      // 鍒涘缓璁㈤槄
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
          message: startTrial ? "璇曠敤宸插紑濮? : "璁㈤槄宸插垱寤?,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鏇存柊璁㈤槄
   */
  "assistant.subscription.update": async ({ params, respond }) => {
    try {
      const subscriptionId = validateStringParam(params, "subscriptionId", true);
      const planId = validateStringParam(params, "planId") as SubscriptionPlanId | undefined;
      const billingPeriod = validateStringParam(params, "billingPeriod") as
        | BillingPeriod
        | undefined;
      const cancelAtPeriodEnd = validateBooleanParam(params, "cancelAtPeriodEnd");

      if (!subscriptionId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing subscriptionId"));
        return;
      }

      log.info("鏇存柊璁㈤槄", { subscriptionId, planId, billingPeriod });

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
          message: "璁㈤槄宸叉洿鏂?,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍙栨秷璁㈤槄
   */
  "assistant.subscription.cancel": async ({ params, respond }) => {
    try {
      const subscriptionId = validateStringParam(params, "subscriptionId", true);
      const immediately = validateBooleanParam(params, "immediately");
      const reason = validateStringParam(params, "reason");
      const feedback = validateStringParam(params, "feedback");

      if (!subscriptionId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing subscriptionId"));
        return;
      }

      log.info("鍙栨秷璁㈤槄", { subscriptionId, immediately });

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
          message: immediately ? "璁㈤槄宸茬珛鍗冲彇娑? : "璁㈤槄灏嗗湪鍛ㄦ湡缁撴潫鍚庡彇娑?,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 妫€鏌ラ厤棰?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing quotaType"));
        return;
      }

      log.debug("妫€鏌ラ厤棰?, { userId, quotaType });

      const result = await checkQuota(userId, quotaType);

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇浣跨敤閲忕粺璁?   */
  "assistant.subscription.usage": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("鑾峰彇浣跨敤閲忕粺璁?, { userId });

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
   * 璁板綍浣跨敤閲?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing type"));
        return;
      }

      log.debug("璁板綍浣跨敤閲?, { userId, type, amount });

      await incrementUsage(userId, type, amount);

      respond(true, { success: true }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇璁㈤槄姒傝锛堢敤浜庝华琛ㄧ洏锛?   */
  "assistant.subscription.overview": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId") ?? "default";

      log.debug("鑾峰彇璁㈤槄姒傝", { userId });

      const subscription = await getUserSubscription(userId);
      const plan = await getUserPlan(userId);
      const dailyUsage = await getUserDailyUsage(userId);
      const monthlyUsage = await getUserMonthlyUsage(userId);

      // 璁＄畻閰嶉浣跨敤鐧惧垎姣?      const conversationUsage =
        plan.quotas.dailyConversations === -1
          ? 0
          : Math.round((dailyUsage.conversations / plan.quotas.dailyConversations) * 100);

      const aiCallUsage =
        plan.quotas.monthlyAiCalls === -1
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
