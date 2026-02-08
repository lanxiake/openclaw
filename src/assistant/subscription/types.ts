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
export type SubscriptionPlanId = "free" | "pro" | "team" | "enterprise";

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
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "免费版",
    description: "适合个人用户体验基础功能",
    price: { monthly: 0, yearly: 0 },
    features: [
      { id: "conversations", name: "AI 对话", included: true, limit: "每日 20 次" },
      { id: "skills", name: "基础技能", included: true, limit: "最多 5 个" },
      { id: "devices", name: "设备数量", included: true, limit: "1 台设备" },
      { id: "storage", name: "存储空间", included: true, limit: "100 MB" },
      { id: "premium_skills", name: "高级技能", included: false },
      { id: "priority_support", name: "优先支持", included: false },
      { id: "api_access", name: "API 访问", included: false },
    ],
    quotas: {
      dailyConversations: 20,
      monthlyAiCalls: 500,
      maxSkills: 5,
      maxDevices: 1,
      storageQuotaMb: 100,
      premiumSkills: false,
      prioritySupport: false,
      apiAccess: false,
    },
    sortOrder: 1,
  },
  {
    id: "pro",
    name: "专业版",
    description: "适合个人用户深度使用",
    price: { monthly: 2900, yearly: 29000 }, // 29元/月，290元/年
    features: [
      { id: "conversations", name: "AI 对话", included: true, limit: "无限制" },
      { id: "skills", name: "全部技能", included: true, limit: "无限制" },
      { id: "devices", name: "设备数量", included: true, limit: "3 台设备" },
      { id: "storage", name: "存储空间", included: true, limit: "5 GB" },
      { id: "premium_skills", name: "高级技能", included: true },
      { id: "priority_support", name: "优先支持", included: true },
      { id: "api_access", name: "API 访问", included: false },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: -1,
      maxDevices: 3,
      storageQuotaMb: 5120,
      premiumSkills: true,
      prioritySupport: true,
      apiAccess: false,
    },
    recommended: true,
    sortOrder: 2,
  },
  {
    id: "team",
    name: "团队版",
    description: "适合小型团队协作使用",
    price: { monthly: 9900, yearly: 99000 }, // 99元/月，990元/年
    features: [
      { id: "conversations", name: "AI 对话", included: true, limit: "无限制" },
      { id: "skills", name: "全部技能", included: true, limit: "无限制" },
      { id: "devices", name: "设备数量", included: true, limit: "10 台设备" },
      { id: "storage", name: "存储空间", included: true, limit: "50 GB" },
      { id: "premium_skills", name: "高级技能", included: true },
      { id: "priority_support", name: "优先支持", included: true },
      { id: "api_access", name: "API 访问", included: true },
      { id: "team_management", name: "团队管理", included: true },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: -1,
      maxDevices: 10,
      storageQuotaMb: 51200,
      premiumSkills: true,
      prioritySupport: true,
      apiAccess: true,
    },
    sortOrder: 3,
  },
  {
    id: "enterprise",
    name: "企业版",
    description: "适合大型企业定制需求",
    price: { monthly: -1, yearly: -1 }, // 联系销售
    features: [
      { id: "conversations", name: "AI 对话", included: true, limit: "无限制" },
      { id: "skills", name: "全部技能", included: true, limit: "无限制" },
      { id: "devices", name: "设备数量", included: true, limit: "无限制" },
      { id: "storage", name: "存储空间", included: true, limit: "无限制" },
      { id: "premium_skills", name: "高级技能", included: true },
      { id: "priority_support", name: "专属支持", included: true },
      { id: "api_access", name: "API 访问", included: true },
      { id: "team_management", name: "团队管理", included: true },
      { id: "sso", name: "SSO 单点登录", included: true },
      { id: "audit_log", name: "审计日志", included: true },
      { id: "custom_deployment", name: "私有部署", included: true },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: -1,
      maxDevices: -1,
      storageQuotaMb: -1,
      premiumSkills: true,
      prioritySupport: true,
      apiAccess: true,
    },
    sortOrder: 4,
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
export function getPlanDisplayPrice(
  planId: SubscriptionPlanId,
  period: BillingPeriod
): string {
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) return "¥0";

  if (plan.price.monthly === -1) return "联系销售";
  if (plan.price.monthly === 0) return "免费";

  const price = period === "yearly" ? plan.price.yearly : plan.price.monthly;
  return `¥${(price / 100).toFixed(0)}`;
}
