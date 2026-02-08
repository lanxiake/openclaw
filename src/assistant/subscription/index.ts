/**
 * 订阅模块入口 - Subscription Module Entry
 *
 * 导出订阅系统的所有公共 API
 *
 * @author OpenClaw
 */

// 类型导出
export type {
  SubscriptionPlanId,
  BillingPeriod,
  SubscriptionStatus,
  SubscriptionPlan,
  PlanFeature,
  PlanQuotas,
  UserSubscription,
  UserUsage,
  QuotaCheckResult,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  SubscriptionEvent,
  SubscriptionEventType,
} from "./types.js";

// 常量和工具函数导出
export {
  DEFAULT_SUBSCRIPTION_PLANS,
  getPlanQuotas,
  isPaidPlan,
  getPlanDisplayPrice,
} from "./types.js";

// 服务函数导出
export {
  // 订阅管理
  getUserSubscription,
  getUserPlan,
  isSubscriptionActive,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  // 配额和使用量
  getUserDailyUsage,
  getUserMonthlyUsage,
  incrementUsage,
  checkQuota,
  // 计划查询
  getAllPlans,
  getPlan,
  comparePlans,
  canUpgrade,
  canDowngrade,
} from "./service.js";
