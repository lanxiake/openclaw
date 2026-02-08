/**
 * 订阅服务 - Subscription Service
 *
 * 提供订阅系统的核心功能：
 * - 订阅管理（创建、更新、取消）
 * - 配额检查和使用量追踪
 * - 订阅状态查询
 *
 * @author OpenClaw
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  SubscriptionPlanId,
  BillingPeriod,
  SubscriptionStatus,
  UserSubscription,
  UserUsage,
  QuotaCheckResult,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  SubscriptionPlan,
  SubscriptionEvent,
  SubscriptionEventType,
} from "./types.js";
import { DEFAULT_SUBSCRIPTION_PLANS, getPlanQuotas } from "./types.js";

// 日志
const log = createSubsystemLogger("subscription");

// ============================================================================
// 存储路径配置
// ============================================================================

/**
 * 获取订阅数据目录
 */
function getSubscriptionDataDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".openclaw", "subscription");
}

/**
 * 获取订阅文件路径
 */
function getSubscriptionsFilePath(): string {
  return path.join(getSubscriptionDataDir(), "subscriptions.json");
}

/**
 * 获取使用量文件路径
 */
function getUsageFilePath(): string {
  return path.join(getSubscriptionDataDir(), "usage.json");
}

/**
 * 获取事件日志文件路径
 */
function getEventsFilePath(): string {
  return path.join(getSubscriptionDataDir(), "events.jsonl");
}

// ============================================================================
// 数据存储
// ============================================================================

/**
 * 订阅存储结构
 */
interface SubscriptionStore {
  subscriptions: Map<string, UserSubscription>;
  userSubscriptions: Map<string, string>; // userId -> subscriptionId
}

/**
 * 使用量存储结构
 */
interface UsageStore {
  daily: Map<string, UserUsage>; // userId:YYYY-MM-DD -> usage
  monthly: Map<string, UserUsage>; // userId:YYYY-MM -> usage
}

// 内存缓存
let subscriptionStore: SubscriptionStore | null = null;
let usageStore: UsageStore | null = null;

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  const dir = getSubscriptionDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info("创建订阅数据目录", { dir });
  }
}

/**
 * 加载订阅数据
 */
async function loadSubscriptions(): Promise<SubscriptionStore> {
  if (subscriptionStore) {
    return subscriptionStore;
  }

  ensureDataDir();
  const filePath = getSubscriptionsFilePath();

  subscriptionStore = {
    subscriptions: new Map(),
    userSubscriptions: new Map(),
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const sub of data.subscriptions || []) {
        subscriptionStore.subscriptions.set(sub.id, sub);
        subscriptionStore.userSubscriptions.set(sub.userId, sub.id);
      }
      log.info("加载订阅数据", { count: subscriptionStore.subscriptions.size });
    } catch (error) {
      log.error("加载订阅数据失败", { error });
    }
  }

  return subscriptionStore;
}

/**
 * 保存订阅数据
 */
async function saveSubscriptions(): Promise<void> {
  if (!subscriptionStore) return;

  ensureDataDir();
  const filePath = getSubscriptionsFilePath();

  const data = {
    subscriptions: Array.from(subscriptionStore.subscriptions.values()),
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log.debug("保存订阅数据", { count: data.subscriptions.length });
}

/**
 * 加载使用量数据
 */
async function loadUsage(): Promise<UsageStore> {
  if (usageStore) {
    return usageStore;
  }

  ensureDataDir();
  const filePath = getUsageFilePath();

  usageStore = {
    daily: new Map(),
    monthly: new Map(),
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const usage of data.daily || []) {
        usageStore.daily.set(`${usage.userId}:${usage.period}`, usage);
      }
      for (const usage of data.monthly || []) {
        usageStore.monthly.set(`${usage.userId}:${usage.period}`, usage);
      }
      log.info("加载使用量数据", {
        daily: usageStore.daily.size,
        monthly: usageStore.monthly.size,
      });
    } catch (error) {
      log.error("加载使用量数据失败", { error });
    }
  }

  return usageStore;
}

/**
 * 保存使用量数据
 */
async function saveUsage(): Promise<void> {
  if (!usageStore) return;

  ensureDataDir();
  const filePath = getUsageFilePath();

  const data = {
    daily: Array.from(usageStore.daily.values()),
    monthly: Array.from(usageStore.monthly.values()),
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log.debug("保存使用量数据");
}

/**
 * 记录订阅事件
 */
async function logSubscriptionEvent(
  type: SubscriptionEventType,
  userId: string,
  subscriptionId: string | undefined,
  data: Record<string, unknown>,
): Promise<void> {
  ensureDataDir();
  const filePath = getEventsFilePath();

  const event: SubscriptionEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    userId,
    subscriptionId,
    data,
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(filePath, JSON.stringify(event) + "\n");
  log.debug("记录订阅事件", { type, userId });
}

// ============================================================================
// 订阅管理
// ============================================================================

/**
 * 生成订阅 ID
 */
function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 计算周期结束时间
 */
function calculatePeriodEnd(start: Date, period: BillingPeriod): Date {
  const end = new Date(start);
  if (period === "monthly") {
    end.setMonth(end.getMonth() + 1);
  } else if (period === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    // lifetime - 设置为 100 年后
    end.setFullYear(end.getFullYear() + 100);
  }
  return end;
}

/**
 * 获取用户订阅
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const store = await loadSubscriptions();
  const subscriptionId = store.userSubscriptions.get(userId);
  if (!subscriptionId) {
    return null;
  }
  return store.subscriptions.get(subscriptionId) || null;
}

/**
 * 获取用户有效计划
 */
export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const subscription = await getUserSubscription(userId);

  // 如果没有订阅或订阅无效，返回免费计划
  if (!subscription || !isSubscriptionActive(subscription)) {
    return DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === "free")!;
  }

  return (
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === subscription.planId) ||
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === "free")!
  );
}

/**
 * 检查订阅是否有效
 */
export function isSubscriptionActive(subscription: UserSubscription): boolean {
  const validStatuses: SubscriptionStatus[] = ["active", "trialing"];
  if (!validStatuses.includes(subscription.status)) {
    return false;
  }

  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  return now < periodEnd;
}

/**
 * 创建订阅
 */
export async function createSubscription(
  request: CreateSubscriptionRequest,
): Promise<UserSubscription> {
  const store = await loadSubscriptions();

  // 检查用户是否已有订阅
  const existingSubId = store.userSubscriptions.get(request.userId);
  if (existingSubId) {
    const existing = store.subscriptions.get(existingSubId);
    if (existing && isSubscriptionActive(existing)) {
      throw new Error("用户已有活跃订阅，请先取消现有订阅");
    }
  }

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, request.billingPeriod);

  const subscription: UserSubscription = {
    id: generateSubscriptionId(),
    userId: request.userId,
    planId: request.planId,
    status: request.startTrial ? "trialing" : "active",
    billingPeriod: request.billingPeriod,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    trialEnd: request.startTrial
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    paymentMethodId: request.paymentMethodId,
  };

  store.subscriptions.set(subscription.id, subscription);
  store.userSubscriptions.set(request.userId, subscription.id);

  await saveSubscriptions();
  await logSubscriptionEvent("subscription.created", request.userId, subscription.id, {
    planId: request.planId,
    billingPeriod: request.billingPeriod,
  });

  log.info("创建订阅", {
    subscriptionId: subscription.id,
    userId: request.userId,
    planId: request.planId,
  });

  return subscription;
}

/**
 * 更新订阅
 */
export async function updateSubscription(
  request: UpdateSubscriptionRequest,
): Promise<UserSubscription> {
  const store = await loadSubscriptions();
  const subscription = store.subscriptions.get(request.subscriptionId);

  if (!subscription) {
    throw new Error("订阅不存在");
  }

  const now = new Date();

  if (request.planId) {
    subscription.planId = request.planId;
  }

  if (request.billingPeriod) {
    subscription.billingPeriod = request.billingPeriod;
  }

  if (request.cancelAtPeriodEnd !== undefined) {
    subscription.cancelAtPeriodEnd = request.cancelAtPeriodEnd;
  }

  subscription.updatedAt = now.toISOString();

  await saveSubscriptions();
  await logSubscriptionEvent("subscription.updated", subscription.userId, subscription.id, {
    changes: request,
  });

  log.info("更新订阅", {
    subscriptionId: subscription.id,
    changes: request,
  });

  return subscription;
}

/**
 * 取消订阅
 */
export async function cancelSubscription(
  request: CancelSubscriptionRequest,
): Promise<UserSubscription> {
  const store = await loadSubscriptions();
  const subscription = store.subscriptions.get(request.subscriptionId);

  if (!subscription) {
    throw new Error("订阅不存在");
  }

  const now = new Date();

  if (request.immediately) {
    subscription.status = "canceled";
    subscription.canceledAt = now.toISOString();
  } else {
    subscription.cancelAtPeriodEnd = true;
  }

  subscription.updatedAt = now.toISOString();

  await saveSubscriptions();
  await logSubscriptionEvent("subscription.canceled", subscription.userId, subscription.id, {
    immediately: request.immediately,
    reason: request.reason,
    feedback: request.feedback,
  });

  log.info("取消订阅", {
    subscriptionId: subscription.id,
    immediately: request.immediately,
  });

  return subscription;
}

/**
 * 续订订阅
 */
export async function renewSubscription(subscriptionId: string): Promise<UserSubscription> {
  const store = await loadSubscriptions();
  const subscription = store.subscriptions.get(subscriptionId);

  if (!subscription) {
    throw new Error("订阅不存在");
  }

  const now = new Date();
  const newPeriodStart = new Date(subscription.currentPeriodEnd);
  const newPeriodEnd = calculatePeriodEnd(newPeriodStart, subscription.billingPeriod);

  subscription.status = "active";
  subscription.currentPeriodStart = newPeriodStart.toISOString();
  subscription.currentPeriodEnd = newPeriodEnd.toISOString();
  subscription.cancelAtPeriodEnd = false;
  subscription.updatedAt = now.toISOString();

  await saveSubscriptions();
  await logSubscriptionEvent("subscription.renewed", subscription.userId, subscription.id, {
    newPeriodEnd: newPeriodEnd.toISOString(),
  });

  log.info("续订订阅", { subscriptionId });

  return subscription;
}

// ============================================================================
// 配额和使用量管理
// ============================================================================

/**
 * 获取今日日期字符串
 */
function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 获取本月字符串
 */
function getMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * 获取用户今日使用量
 */
export async function getUserDailyUsage(userId: string): Promise<UserUsage> {
  const store = await loadUsage();
  const today = getTodayString();
  const key = `${userId}:${today}`;

  let usage = store.daily.get(key);
  if (!usage) {
    usage = {
      userId,
      period: today,
      conversations: 0,
      aiCalls: 0,
      skillExecutions: 0,
      fileOperations: 0,
      storageUsedMb: 0,
      updatedAt: new Date().toISOString(),
    };
    store.daily.set(key, usage);
  }

  return usage;
}

/**
 * 获取用户本月使用量
 */
export async function getUserMonthlyUsage(userId: string): Promise<UserUsage> {
  const store = await loadUsage();
  const month = getMonthString();
  const key = `${userId}:${month}`;

  let usage = store.monthly.get(key);
  if (!usage) {
    usage = {
      userId,
      period: month,
      conversations: 0,
      aiCalls: 0,
      skillExecutions: 0,
      fileOperations: 0,
      storageUsedMb: 0,
      updatedAt: new Date().toISOString(),
    };
    store.monthly.set(key, usage);
  }

  return usage;
}

/**
 * 增加使用量
 */
export async function incrementUsage(
  userId: string,
  type: "conversations" | "aiCalls" | "skillExecutions" | "fileOperations",
  amount: number = 1,
): Promise<void> {
  const dailyUsage = await getUserDailyUsage(userId);
  const monthlyUsage = await getUserMonthlyUsage(userId);

  dailyUsage[type] += amount;
  dailyUsage.updatedAt = new Date().toISOString();

  monthlyUsage[type] += amount;
  monthlyUsage.updatedAt = new Date().toISOString();

  await saveUsage();
  log.debug("增加使用量", { userId, type, amount });
}

/**
 * 检查配额
 */
export async function checkQuota(
  userId: string,
  quotaType: "conversations" | "aiCalls" | "skills" | "devices" | "storage",
): Promise<QuotaCheckResult> {
  const plan = await getUserPlan(userId);
  const quotas = plan.quotas;

  let current = 0;
  let limit = 0;
  let resetAt: string | undefined;

  switch (quotaType) {
    case "conversations": {
      const dailyUsage = await getUserDailyUsage(userId);
      current = dailyUsage.conversations;
      limit = quotas.dailyConversations;
      // 重置时间为明天 0 点
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      resetAt = tomorrow.toISOString();
      break;
    }
    case "aiCalls": {
      const monthlyUsage = await getUserMonthlyUsage(userId);
      current = monthlyUsage.aiCalls;
      limit = quotas.monthlyAiCalls;
      // 重置时间为下月 1 号
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      resetAt = nextMonth.toISOString();
      break;
    }
    case "skills":
      // TODO: 获取用户已安装技能数量
      current = 0;
      limit = quotas.maxSkills;
      break;
    case "devices":
      // TODO: 获取用户已绑定设备数量
      current = 0;
      limit = quotas.maxDevices;
      break;
    case "storage": {
      const monthlyUsage = await getUserMonthlyUsage(userId);
      current = monthlyUsage.storageUsedMb;
      limit = quotas.storageQuotaMb;
      break;
    }
  }

  // -1 表示无限制
  const allowed = limit === -1 || current < limit;
  const remaining = limit === -1 ? -1 : Math.max(0, limit - current);

  const result: QuotaCheckResult = {
    allowed,
    quotaType,
    current,
    limit,
    remaining,
    resetAt,
    reason: allowed ? undefined : `已达到${quotaType}配额上限`,
  };

  if (!allowed) {
    await logSubscriptionEvent("quota.exceeded", userId, undefined, {
      quotaType,
      current,
      limit,
    });
  }

  return result;
}

// ============================================================================
// 计划查询
// ============================================================================

/**
 * 获取所有订阅计划
 */
export function getAllPlans(): SubscriptionPlan[] {
  return [...DEFAULT_SUBSCRIPTION_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 获取指定计划
 */
export function getPlan(planId: SubscriptionPlanId): SubscriptionPlan | null {
  return DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId) || null;
}

/**
 * 比较两个计划
 */
export function comparePlans(planIdA: SubscriptionPlanId, planIdB: SubscriptionPlanId): number {
  const planA = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planIdA);
  const planB = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planIdB);

  if (!planA || !planB) return 0;
  return planA.sortOrder - planB.sortOrder;
}

/**
 * 检查是否可以升级
 */
export function canUpgrade(
  currentPlanId: SubscriptionPlanId,
  targetPlanId: SubscriptionPlanId,
): boolean {
  return comparePlans(currentPlanId, targetPlanId) < 0;
}

/**
 * 检查是否可以降级
 */
export function canDowngrade(
  currentPlanId: SubscriptionPlanId,
  targetPlanId: SubscriptionPlanId,
): boolean {
  return comparePlans(currentPlanId, targetPlanId) > 0;
}
