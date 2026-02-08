/**
 * 自动续费调度器 - Auto Renewal Scheduler
 *
 * 提供订阅自动续费功能：
 * - 定时检查即将到期的订阅
 * - 自动发起续费支付
 * - 续费失败重试
 * - 续费通知
 *
 * @author OpenClaw
 */

import { v4 as uuidv4 } from "uuid";
import { getLogger } from "../../logging/logger.js";
import type {
  PaymentProvider,
  PaymentOrder,
  OrderStatus,
  InitiatePaymentResponse,
} from "./types.js";
import { handleSubscriptionRenewed, registerPaymentEventHandler } from "./providers/callback-handler.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 订阅信息 (简化版，实际应从订阅服务获取)
 */
export interface SubscriptionInfo {
  /** 订阅 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 订阅计划 ID */
  planId: string;
  /** 订阅计划名称 */
  planName: string;
  /** 订阅状态 */
  status: "active" | "canceled" | "expired" | "past_due";
  /** 当前周期开始时间 */
  currentPeriodStart: string;
  /** 当前周期结束时间 */
  currentPeriodEnd: string;
  /** 是否启用自动续费 */
  autoRenew: boolean;
  /** 续费价格 (分) */
  renewalPrice: number;
  /** 货币 */
  currency: "CNY" | "USD";
  /** 支付方式 */
  paymentProvider?: PaymentProvider;
  /** 支付方式 ID */
  paymentMethodId?: string;
}

/**
 * 续费任务状态
 */
export type RenewalTaskStatus =
  | "pending"       // 待处理
  | "processing"    // 处理中
  | "success"       // 成功
  | "failed"        // 失败
  | "retrying";     // 重试中

/**
 * 续费任务
 */
export interface RenewalTask {
  /** 任务 ID */
  id: string;
  /** 订阅 ID */
  subscriptionId: string;
  /** 用户 ID */
  userId: string;
  /** 状态 */
  status: RenewalTaskStatus;
  /** 订单 ID */
  orderId?: string;
  /** 续费金额 (分) */
  amount: number;
  /** 货币 */
  currency: "CNY" | "USD";
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 下次重试时间 */
  nextRetryAt?: string;
  /** 失败原因 */
  failureReason?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 完成时间 */
  completedAt?: string;
}

/**
 * 续费通知类型
 */
export type RenewalNotificationType =
  | "renewal_reminder"      // 续费提醒
  | "renewal_success"       // 续费成功
  | "renewal_failed"        // 续费失败
  | "subscription_expired"; // 订阅过期

/**
 * 续费通知
 */
export interface RenewalNotification {
  /** 类型 */
  type: RenewalNotificationType;
  /** 用户 ID */
  userId: string;
  /** 订阅 ID */
  subscriptionId: string;
  /** 消息内容 */
  message: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

/**
 * 续费配置
 */
export interface RenewalConfig {
  /** 检查间隔 (毫秒) */
  checkIntervalMs: number;
  /** 提前续费天数 */
  renewalAdvanceDays: number;
  /** 续费提醒天数 */
  reminderDays: number[];
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔 (小时) */
  retryIntervalHours: number[];
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 默认续费配置
 */
export const DEFAULT_RENEWAL_CONFIG: RenewalConfig = {
  checkIntervalMs: 60 * 60 * 1000, // 1 小时
  renewalAdvanceDays: 1,
  reminderDays: [7, 3, 1],
  maxRetries: 3,
  retryIntervalHours: [1, 6, 24],
  enabled: true,
};

// ============================================================================
// 回调类型
// ============================================================================

/**
 * 获取即将到期订阅的回调
 */
export type GetExpiringSubscriptionsCallback = (
  daysBeforeExpiry: number
) => Promise<SubscriptionInfo[]>;

/**
 * 创建订单的回调
 */
export type CreateOrderCallback = (params: {
  userId: string;
  type: "subscription";
  amount: number;
  currency: "CNY" | "USD";
  description: string;
  referenceId: string;
  referenceType: string;
  provider?: PaymentProvider;
}) => Promise<PaymentOrder>;

/**
 * 发起支付的回调
 */
export type InitiatePaymentCallback = (params: {
  orderId: string;
  provider: PaymentProvider;
  paymentMethodId?: string;
}) => Promise<InitiatePaymentResponse>;

/**
 * 更新订阅的回调
 */
export type UpdateSubscriptionCallback = (
  subscriptionId: string,
  updates: {
    currentPeriodEnd?: string;
    status?: "active" | "expired" | "past_due";
  }
) => Promise<void>;

/**
 * 发送通知的回调
 */
export type SendNotificationCallback = (
  notification: RenewalNotification
) => Promise<void>;

// ============================================================================
// 自动续费调度器
// ============================================================================

/**
 * 自动续费调度器
 */
export class AutoRenewalScheduler {
  private config: RenewalConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private tasks: Map<string, RenewalTask> = new Map();

  // 回调函数
  private getExpiringSubscriptions: GetExpiringSubscriptionsCallback | null = null;
  private createOrder: CreateOrderCallback | null = null;
  private initiatePayment: InitiatePaymentCallback | null = null;
  private updateSubscription: UpdateSubscriptionCallback | null = null;
  private sendNotification: SendNotificationCallback | null = null;

  constructor(config: Partial<RenewalConfig> = {}) {
    this.config = { ...DEFAULT_RENEWAL_CONFIG, ...config };
    logger.info("[renewal] 创建自动续费调度器", {
      checkIntervalMs: this.config.checkIntervalMs,
      renewalAdvanceDays: this.config.renewalAdvanceDays,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    getExpiringSubscriptions?: GetExpiringSubscriptionsCallback;
    createOrder?: CreateOrderCallback;
    initiatePayment?: InitiatePaymentCallback;
    updateSubscription?: UpdateSubscriptionCallback;
    sendNotification?: SendNotificationCallback;
  }): void {
    if (callbacks.getExpiringSubscriptions) {
      this.getExpiringSubscriptions = callbacks.getExpiringSubscriptions;
    }
    if (callbacks.createOrder) {
      this.createOrder = callbacks.createOrder;
    }
    if (callbacks.initiatePayment) {
      this.initiatePayment = callbacks.initiatePayment;
    }
    if (callbacks.updateSubscription) {
      this.updateSubscription = callbacks.updateSubscription;
    }
    if (callbacks.sendNotification) {
      this.sendNotification = callbacks.sendNotification;
    }
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info("[renewal] 自动续费已禁用");
      return;
    }

    if (this.checkTimer) {
      logger.warn("[renewal] 调度器已在运行");
      return;
    }

    logger.info("[renewal] 启动自动续费调度器");

    // 立即执行一次检查
    this.runCheck().catch((error) => {
      logger.error("[renewal] 初始检查失败", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });

    // 设置定时检查
    this.checkTimer = setInterval(() => {
      this.runCheck().catch((error) => {
        logger.error("[renewal] 定时检查失败", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }, this.config.checkIntervalMs);

    // 注册支付成功事件处理
    registerPaymentEventHandler("payment.success", async (event) => {
      // 检查是否是续费订单
      const task = Array.from(this.tasks.values()).find(
        (t) => t.orderId === event.orderId
      );

      if (task) {
        await this.handleRenewalSuccess(task);
      }
    });
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      logger.info("[renewal] 停止自动续费调度器");
    }
  }

  /**
   * 执行检查
   */
  async runCheck(): Promise<void> {
    logger.debug("[renewal] 开始检查续费任务");

    try {
      // 1. 处理续费提醒
      await this.sendRenewalReminders();

      // 2. 处理即将到期的订阅
      await this.processExpiringSubscriptions();

      // 3. 处理重试任务
      await this.processRetryTasks();

      logger.debug("[renewal] 续费检查完成");
    } catch (error) {
      logger.error("[renewal] 续费检查异常", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * 发送续费提醒
   */
  private async sendRenewalReminders(): Promise<void> {
    if (!this.getExpiringSubscriptions || !this.sendNotification) {
      return;
    }

    for (const days of this.config.reminderDays) {
      try {
        const subscriptions = await this.getExpiringSubscriptions(days);

        for (const sub of subscriptions) {
          if (!sub.autoRenew) {
            await this.sendNotification({
              type: "renewal_reminder",
              userId: sub.userId,
              subscriptionId: sub.id,
              message: `您的 ${sub.planName} 订阅将在 ${days} 天后到期，请及时续费。`,
              data: {
                planId: sub.planId,
                planName: sub.planName,
                expiryDate: sub.currentPeriodEnd,
                renewalPrice: sub.renewalPrice,
                currency: sub.currency,
              },
            });
          }
        }
      } catch (error) {
        logger.error("[renewal] 发送续费提醒失败", {
          days,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * 处理即将到期的订阅
   */
  private async processExpiringSubscriptions(): Promise<void> {
    if (!this.getExpiringSubscriptions) {
      logger.warn("[renewal] 未设置获取订阅回调");
      return;
    }

    const subscriptions = await this.getExpiringSubscriptions(
      this.config.renewalAdvanceDays
    );

    logger.info("[renewal] 找到即将到期的订阅", {
      count: subscriptions.length,
      advanceDays: this.config.renewalAdvanceDays,
    });

    for (const subscription of subscriptions) {
      // 只处理启用自动续费的订阅
      if (!subscription.autoRenew) {
        continue;
      }

      // 检查是否已有任务
      const existingTask = Array.from(this.tasks.values()).find(
        (t) =>
          t.subscriptionId === subscription.id &&
          (t.status === "pending" || t.status === "processing" || t.status === "retrying")
      );

      if (existingTask) {
        continue;
      }

      // 创建续费任务
      await this.createRenewalTask(subscription);
    }
  }

  /**
   * 创建续费任务
   */
  private async createRenewalTask(subscription: SubscriptionInfo): Promise<RenewalTask> {
    const task: RenewalTask = {
      id: uuidv4(),
      subscriptionId: subscription.id,
      userId: subscription.userId,
      status: "pending",
      amount: subscription.renewalPrice,
      currency: subscription.currency,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);

    logger.info("[renewal] 创建续费任务", {
      taskId: task.id,
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: task.amount,
    });

    // 立即处理任务
    await this.processRenewalTask(task, subscription);

    return task;
  }

  /**
   * 处理续费任务
   */
  private async processRenewalTask(
    task: RenewalTask,
    subscription: SubscriptionInfo
  ): Promise<void> {
    if (!this.createOrder || !this.initiatePayment) {
      logger.error("[renewal] 未设置订单/支付回调");
      return;
    }

    task.status = "processing";
    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);

    try {
      // 1. 创建订单
      const order = await this.createOrder({
        userId: subscription.userId,
        type: "subscription",
        amount: subscription.renewalPrice,
        currency: subscription.currency,
        description: `${subscription.planName} 订阅续费`,
        referenceId: subscription.id,
        referenceType: "subscription_renewal",
        provider: subscription.paymentProvider,
      });

      task.orderId = order.id;
      task.updatedAt = new Date().toISOString();
      this.tasks.set(task.id, task);

      logger.info("[renewal] 创建续费订单", {
        taskId: task.id,
        orderId: order.id,
      });

      // 2. 发起支付
      const result = await this.initiatePayment({
        orderId: order.id,
        provider: subscription.paymentProvider || "mock",
        paymentMethodId: subscription.paymentMethodId,
      });

      if (!result.success) {
        throw new Error(result.error || "支付发起失败");
      }

      // 支付已发起，等待回调
      logger.info("[renewal] 续费支付已发起", {
        taskId: task.id,
        orderId: order.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.handleRenewalFailure(task, errorMessage);
    }
  }

  /**
   * 处理续费成功
   */
  private async handleRenewalSuccess(task: RenewalTask): Promise<void> {
    task.status = "success";
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);

    logger.info("[renewal] 续费成功", {
      taskId: task.id,
      subscriptionId: task.subscriptionId,
    });

    // 更新订阅周期
    if (this.updateSubscription) {
      const nextPeriodEnd = new Date();
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await this.updateSubscription(task.subscriptionId, {
        currentPeriodEnd: nextPeriodEnd.toISOString(),
        status: "active",
      });
    }

    // 发送成功通知
    if (this.sendNotification) {
      await this.sendNotification({
        type: "renewal_success",
        userId: task.userId,
        subscriptionId: task.subscriptionId,
        message: "订阅续费成功",
        data: {
          amount: task.amount,
          currency: task.currency,
        },
      });
    }

    // 触发续费事件
    await handleSubscriptionRenewed(
      "mock", // 实际应从订单获取
      task.orderId || "",
      task.subscriptionId,
      task.amount,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  /**
   * 处理续费失败
   */
  private async handleRenewalFailure(task: RenewalTask, reason: string): Promise<void> {
    task.retryCount += 1;
    task.failureReason = reason;
    task.updatedAt = new Date().toISOString();

    if (task.retryCount < task.maxRetries) {
      // 设置重试
      task.status = "retrying";
      const retryHours = this.config.retryIntervalHours[
        Math.min(task.retryCount - 1, this.config.retryIntervalHours.length - 1)
      ];
      const nextRetry = new Date();
      nextRetry.setHours(nextRetry.getHours() + retryHours);
      task.nextRetryAt = nextRetry.toISOString();

      logger.info("[renewal] 续费失败，将重试", {
        taskId: task.id,
        retryCount: task.retryCount,
        nextRetryAt: task.nextRetryAt,
        reason,
      });
    } else {
      // 达到最大重试次数
      task.status = "failed";
      task.completedAt = new Date().toISOString();

      logger.error("[renewal] 续费最终失败", {
        taskId: task.id,
        subscriptionId: task.subscriptionId,
        reason,
      });

      // 更新订阅状态
      if (this.updateSubscription) {
        await this.updateSubscription(task.subscriptionId, {
          status: "past_due",
        });
      }

      // 发送失败通知
      if (this.sendNotification) {
        await this.sendNotification({
          type: "renewal_failed",
          userId: task.userId,
          subscriptionId: task.subscriptionId,
          message: `订阅续费失败：${reason}`,
          data: {
            failureReason: reason,
            retryCount: task.retryCount,
          },
        });
      }
    }

    this.tasks.set(task.id, task);
  }

  /**
   * 处理重试任务
   */
  private async processRetryTasks(): Promise<void> {
    const now = new Date();

    for (const task of this.tasks.values()) {
      if (
        task.status === "retrying" &&
        task.nextRetryAt &&
        new Date(task.nextRetryAt) <= now
      ) {
        logger.info("[renewal] 执行重试任务", {
          taskId: task.id,
          retryCount: task.retryCount,
        });

        // 获取订阅信息 (实际应从订阅服务获取)
        // 这里简化处理
        if (this.getExpiringSubscriptions) {
          const subscriptions = await this.getExpiringSubscriptions(30);
          const subscription = subscriptions.find(
            (s) => s.id === task.subscriptionId
          );

          if (subscription) {
            await this.processRenewalTask(task, subscription);
          } else {
            // 订阅不存在，取消任务
            task.status = "failed";
            task.failureReason = "订阅不存在";
            task.completedAt = new Date().toISOString();
            this.tasks.set(task.id, task);
          }
        }
      }
    }
  }

  /**
   * 获取任务列表
   */
  getTasks(filters?: {
    status?: RenewalTaskStatus;
    userId?: string;
    subscriptionId?: string;
  }): RenewalTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filters?.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }

    if (filters?.userId) {
      tasks = tasks.filter((t) => t.userId === filters.userId);
    }

    if (filters?.subscriptionId) {
      tasks = tasks.filter((t) => t.subscriptionId === filters.subscriptionId);
    }

    return tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): RenewalTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 手动触发续费
   */
  async triggerRenewal(subscriptionId: string): Promise<RenewalTask | null> {
    if (!this.getExpiringSubscriptions) {
      throw new Error("未设置获取订阅回调");
    }

    const subscriptions = await this.getExpiringSubscriptions(365);
    const subscription = subscriptions.find((s) => s.id === subscriptionId);

    if (!subscription) {
      throw new Error("订阅不存在");
    }

    return this.createRenewalTask(subscription);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === "success" || task.status === "failed") {
      return false;
    }

    task.status = "failed";
    task.failureReason = "手动取消";
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);

    logger.info("[renewal] 取消续费任务", { taskId });
    return true;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RenewalConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("[renewal] 更新续费配置", config);

    // 如果修改了检查间隔，重启调度器
    if (config.checkIntervalMs && this.checkTimer) {
      this.stop();
      this.start();
    }
  }

  /**
   * 获取配置
   */
  getConfig(): RenewalConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 单例
// ============================================================================

let schedulerInstance: AutoRenewalScheduler | null = null;

/**
 * 获取自动续费调度器实例
 */
export function getRenewalScheduler(): AutoRenewalScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new AutoRenewalScheduler();
  }
  return schedulerInstance;
}

/**
 * 启动自动续费
 */
export function startAutoRenewal(config?: Partial<RenewalConfig>): void {
  const scheduler = getRenewalScheduler();
  if (config) {
    scheduler.updateConfig(config);
  }
  scheduler.start();
}

/**
 * 停止自动续费
 */
export function stopAutoRenewal(): void {
  const scheduler = getRenewalScheduler();
  scheduler.stop();
}
