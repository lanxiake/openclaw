/**
 * 订阅系统类型定义 - Subscription Types
 *
 * 定义用户订阅相关的所有类型：
 * - 订阅计划
 * - 用户订阅状态
 * - 订阅权益
 * - 使用量配额
 *
 * @author OpenClaw
 */

// ============================================================================
// 订阅计划类型
// ============================================================================

/**
 * 订阅计划 ID
 */
export type SubscriptionPlanId = "free" | "monthly" | "yearly";

/**
 * 计费周期
 */
export type BillingPeriod = "monthly" | "yearly" | "lifetime";

/**
 * 订阅计划定义
 */
export interface SubscriptionPlan {
  /** 计划 ID */
  id: SubscriptionPlanId;
  /** 计划名称 */
  name: string;
  /** 计划描述 */
  description: string;
  /** 价格（分为单位） */
  price: {
    monthly: number;
    yearly: number;
  };
  /** 功能特性 */
  features: PlanFeature[];
  /** 配额限制 */
  quotas: PlanQuotas;
  /** 是否推荐 */
  recommended?: boolean;
  /** 排序权重 */
  sortOrder: number;
}

/**
 * 计划功能特性
 */
export interface PlanFeature {
  /** 特性 ID */
  id: string;
  /** 特性名称 */
  name: string;
  /** 特性描述 */
  description?: string;
  /** 是否包含 */
  included: boolean;
  /** 限制说明 */
  limit?: string;
}

/**
 * 计划配额
 */
export interface PlanQuotas {
  /** 每日对话次数限制 (-1 表示无限) */
  dailyConversations: number;
  /** 每月 AI 调用次数限制 (-1 表示无限) */
  monthlyAiCalls: number;
  /** 最大技能数量 (-1 表示无限) */
  maxSkills: number;
  /** 最大设备数量 */
  maxDevices: number;
  /** 文件存储空间 (MB) */
  storageQuotaMb: number;
  /** 是否支持高级技能 */
  premiumSkills: boolean;
  /** 是否支持优先支持 */
  prioritySupport: boolean;
  /** 是否支持 API 访问 */
  apiAccess: boolean;
  /** 自定义配额 */
  custom?: Record<string, number | boolean>;
}

// ============================================================================
// 用户订阅类型
// ============================================================================

/**
 * 订阅状态
 */
export type SubscriptionStatus =
  | "active" // 活跃
  | "trialing" // 试用中
  | "past_due" // 逾期
  | "canceled" // 已取消
  | "expired" // 已过期
  | "paused"; // 已暂停

/**
 * 用户订阅信息
 */
export interface UserSubscription {
  /** 订阅 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 计划 ID */
  planId: SubscriptionPlanId;
  /** 订阅状态 */
  status: SubscriptionStatus;
  /** 计费周期 */
  billingPeriod: BillingPeriod;
  /** 当前周期开始时间 */
  currentPeriodStart: string;
  /** 当前周期结束时间 */
  currentPeriodEnd: string;
  /** 取消时间（如果已取消） */
  canceledAt?: string;
  /** 是否在周期结束时取消 */
  cancelAtPeriodEnd: boolean;
  /** 试用结束时间 */
  trialEnd?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 支付方式 ID */
  paymentMethodId?: string;
  /** 外部订阅 ID（如 Stripe） */
  externalId?: string;
  /** 元数据 */
  metadata?: Record<string, string>;
}

/**
 * 用户使用量
 */
export interface UserUsage {
  /** 用户 ID */
  userId: string;
  /** 统计周期（YYYY-MM-DD 或 YYYY-MM） */
  period: string;
  /** 对话次数 */
  conversations: number;
  /** AI 调用次数 */
  aiCalls: number;
  /** 技能执行次数 */
  skillExecutions: number;
  /** 文件操作次数 */
  fileOperations: number;
  /** 存储使用量 (MB) */
  storageUsedMb: number;
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  /** 是否允许 */
  allowed: boolean;
  /** 配额类型 */
  quotaType: string;
  /** 当前使用量 */
  current: number;
  /** 配额限制 */
  limit: number;
  /** 剩余配额 */
  remaining: number;
  /** 重置时间 */
  resetAt?: string;
  /** 拒绝原因 */
  reason?: string;
}

// ============================================================================
// 订阅操作类型
// ============================================================================

/**
 * 创建订阅请求
 */
export interface CreateSubscriptionRequest {
  /** 用户 ID */
  userId: string;
  /** 计划 ID */
  planId: SubscriptionPlanId;
  /** 计费周期 */
  billingPeriod: BillingPeriod;
  /** 支付方式 ID */
  paymentMethodId?: string;
  /** 优惠码 */
  couponCode?: string;
  /** 是否开始试用 */
  startTrial?: boolean;
}

/**
 * 更新订阅请求
 */
export interface UpdateSubscriptionRequest {
  /** 订阅 ID */
  subscriptionId: string;
  /** 新计划 ID */
  planId?: SubscriptionPlanId;
  /** 新计费周期 */
  billingPeriod?: BillingPeriod;
  /** 是否在周期结束时取消 */
  cancelAtPeriodEnd?: boolean;
}

/**
 * 取消订阅请求
 */
export interface CancelSubscriptionRequest {
  /** 订阅 ID */
  subscriptionId: string;
  /** 是否立即取消 */
  immediately?: boolean;
  /** 取消原因 */
  reason?: string;
  /** 反馈 */
  feedback?: string;
}

// ============================================================================
// 订阅事件类型
// ============================================================================

/**
 * 订阅事件类型
 */
export type SubscriptionEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.expired"
  | "subscription.renewed"
  | "subscription.extended"
  | "subscription.trial_started"
  | "subscription.trial_ended"
  | "payment.succeeded"
  | "payment.failed"
  | "quota.exceeded"
  | "quota.warning";

/**
 * 订阅事件
 */
export interface SubscriptionEvent {
  /** 事件 ID */
  id: string;
  /** 事件类型 */
  type: SubscriptionEventType;
  /** 用户 ID */
  userId: string;
  /** 订阅 ID */
  subscriptionId?: string;
  /** 事件数据 */
  data: Record<string, unknown>;
  /** 事件时间 */
  timestamp: string;
}

// ============================================================================
// 默认计划定义
// ============================================================================

/**
 * 默认订阅计划
 *
 * 三种计划：免费版、月付版、年付版
 * 所有用户共享统一的资源限制（设备5台、技能100个、文件50MB）
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "免费版",
    description: "注册赠送600积分，邀请好友获取更多",
    price: { monthly: 0, yearly: 0 },
    features: [
      { id: "credits", name: "注册赠送积分", included: true, limit: "600积分" },
      { id: "invite", name: "邀请奖励", included: true, limit: "每人300积分" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: false,
      prioritySupport: false,
      apiAccess: false,
    },
    sortOrder: 1,
  },
  {
    id: "monthly",
    name: "月付版",
    description: "30元/月，每月2000积分，首月仅3元",
    price: { monthly: 3000, yearly: 0 },
    features: [
      { id: "credits", name: "每月积分", included: true, limit: "2000积分/月" },
      { id: "first_month", name: "首月优惠", included: true, limit: "首月3元" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: true,
      prioritySupport: false,
      apiAccess: false,
    },
    recommended: true,
    sortOrder: 2,
  },
  {
    id: "yearly",
    name: "年付版",
    description: "300元/年，每月2000积分，等效25元/月",
    price: { monthly: 0, yearly: 30000 },
    features: [
      { id: "credits", name: "每月积分", included: true, limit: "2000积分/月" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: true,
      prioritySupport: true,
      apiAccess: false,
    },
    sortOrder: 3,
  },
];

/**
 * 获取计划配额
 */
export function getPlanQuotas(planId: SubscriptionPlanId): PlanQuotas {
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  return plan?.quotas ?? DEFAULT_SUBSCRIPTION_PLANS[0].quotas;
}

/**
 * 检查是否为付费计划
 */
export function isPaidPlan(planId: SubscriptionPlanId): boolean {
  return planId !== "free";
}

/**
 * 获取计划显示价格
 */
export function getPlanDisplayPrice(planId: SubscriptionPlanId, period: BillingPeriod): string {
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) return "¥0";

  if (plan.price.monthly === 0 && plan.price.yearly === 0) return "免费";

  const price = period === "yearly" ? plan.price.yearly : plan.price.monthly;
  if (price === 0) return "—";
  return `¥${(price / 100).toFixed(0)}`;
}
