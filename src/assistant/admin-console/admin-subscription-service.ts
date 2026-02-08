/**
 * 管理后台订阅管理服务
 *
 * 提供订阅列表查询、订阅管理、套餐管理、订单查询等功能
 */

import { eq, and, or, gt, lt, desc, asc, like, sql, inArray } from "drizzle-orm";

import { getDatabase, type Database } from "../../db/connection.js";
import {
  subscriptions,
  plans,
  paymentOrders,
  users,
  type Subscription,
  type Plan,
  type PaymentOrder,
} from "../../db/schema/index.js";
import { getLogger } from "../../logging/logger.js";
import { adminAudit } from "../../db/repositories/admins.js";
import { generateId } from "../../db/utils/id.js";

const logger = getLogger();

/**
 * 订阅列表查询参数
 */
export interface SubscriptionListParams {
  /** 搜索关键词 (用户手机号/邮箱) */
  search?: string;
  /** 订阅状态过滤 */
  status?: "active" | "canceled" | "expired" | "past_due" | "trialing" | "all";
  /** 套餐 ID 过滤 */
  planId?: string;
  /** 分页: 页码 */
  page?: number;
  /** 分页: 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  orderBy?: "createdAt" | "currentPeriodEnd";
  /** 排序方向 */
  orderDir?: "asc" | "desc";
}

/**
 * 订阅列表项
 */
export interface SubscriptionListItem {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  planId: string;
  planName: string;
  status: "active" | "canceled" | "expired" | "past_due" | "trialing";
  billingCycle: "monthly" | "yearly";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  createdAt: Date;
}

/**
 * 订阅列表查询结果
 */
export interface SubscriptionListResult {
  subscriptions: SubscriptionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 订单列表查询参数
 */
export interface OrderListParams {
  /** 搜索关键词 (订单号/用户手机号) */
  search?: string;
  /** 订单状态过滤 */
  status?: "pending" | "paid" | "failed" | "canceled" | "refunded" | "all";
  /** 支付方式过滤 */
  paymentMethod?: string;
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
  /** 分页: 页码 */
  page?: number;
  /** 分页: 每页数量 */
  pageSize?: number;
}

/**
 * 订单列表项
 */
export interface OrderListItem {
  id: string;
  orderNo: string;
  userId: string | null;
  userName: string | null;
  userPhone: string | null;
  orderType: string;
  subscriptionId: string | null;
  amount: number;
  paidAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

/**
 * 订单列表查询结果
 */
export interface OrderListResult {
  orders: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 套餐列表项
 */
export interface PlanListItem extends Plan {
  subscriberCount: number;
}

/**
 * 管理后台订阅管理服务类
 */
export class AdminSubscriptionService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 查询订阅列表
   */
  async listSubscriptions(params: SubscriptionListParams = {}): Promise<SubscriptionListResult> {
    const {
      search,
      status = "all",
      planId,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDir = "desc",
    } = params;

    // 构建查询条件
    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(subscriptions.status, status));
    }
    if (planId) {
      conditions.push(eq(subscriptions.planId, planId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(whereClause);

    // 排序
    const orderColumn = orderBy === "currentPeriodEnd"
      ? subscriptions.currentPeriodEnd
      : subscriptions.createdAt;
    const orderFn = orderDir === "asc" ? asc : desc;

    // 分页查询
    const offset = (page - 1) * pageSize;
    const subList = await this.db
      .select()
      .from(subscriptions)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset(offset);

    // 获取关联的用户和套餐信息
    const subscriptionsWithDetails = await Promise.all(
      subList.map(async (sub) => {
        // 获取用户信息
        const [user] = await this.db
          .select({
            displayName: users.displayName,
            phone: users.phone,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, sub.userId))
          .limit(1);

        // 获取套餐信息
        const [plan] = await this.db
          .select({ name: plans.name })
          .from(plans)
          .where(eq(plans.id, sub.planId))
          .limit(1);

        // 如果有搜索条件，过滤结果
        if (search) {
          const searchLower = search.toLowerCase();
          const matches =
            user?.phone?.includes(search) ||
            user?.email?.toLowerCase().includes(searchLower) ||
            user?.displayName?.toLowerCase().includes(searchLower);
          if (!matches) {
            return null;
          }
        }

        return {
          id: sub.id,
          userId: sub.userId,
          userName: user?.displayName || null,
          userPhone: user?.phone || null,
          userEmail: user?.email || null,
          planId: sub.planId,
          planName: plan?.name || sub.planId,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          canceledAt: sub.canceledAt,
          createdAt: sub.createdAt,
        };
      })
    );

    // 过滤掉被搜索条件排除的项
    const filteredSubscriptions = subscriptionsWithDetails.filter((s): s is SubscriptionListItem => s !== null);

    return {
      subscriptions: filteredSubscriptions,
      total: search ? filteredSubscriptions.length : total,
      page,
      pageSize,
      totalPages: Math.ceil((search ? filteredSubscriptions.length : total) / pageSize),
    };
  }

  /**
   * 获取订阅详情
   */
  async getSubscriptionDetail(subscriptionId: string): Promise<Subscription | null> {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));
    return sub || null;
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(
    subscriptionId: string,
    adminId: string,
    adminUsername: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [sub] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));

      if (!sub) {
        return { success: false, error: "订阅不存在" };
      }

      if (sub.status === "canceled" || sub.status === "expired") {
        return { success: false, error: "订阅已取消或已过期" };
      }

      // 获取用户信息用于审计
      const [user] = await this.db
        .select({ displayName: users.displayName, phone: users.phone })
        .from(users)
        .where(eq(users.id, sub.userId))
        .limit(1);

      await this.db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt: new Date(),
          cancelReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      await adminAudit({
        adminId,
        adminUsername,
        action: "subscription.cancel",
        targetType: "subscription",
        targetId: subscriptionId,
        targetName: user?.displayName || user?.phone || sub.userId,
        details: { reason, planId: sub.planId },
        ipAddress,
        userAgent,
        riskLevel: "high",
      });

      logger.info("[admin-subscription] Subscription canceled", {
        subscriptionId,
        adminId,
        reason,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-subscription] Failed to cancel subscription", {
        subscriptionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "取消订阅失败" };
    }
  }

  /**
   * 延长订阅期限
   */
  async extendSubscription(
    subscriptionId: string,
    days: number,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string; newEndDate?: Date }> {
    try {
      const [sub] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));

      if (!sub) {
        return { success: false, error: "订阅不存在" };
      }

      // 获取用户信息用于审计
      const [user] = await this.db
        .select({ displayName: users.displayName, phone: users.phone })
        .from(users)
        .where(eq(users.id, sub.userId))
        .limit(1);

      const currentEnd = new Date(sub.currentPeriodEnd);
      const newEndDate = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

      await this.db
        .update(subscriptions)
        .set({
          currentPeriodEnd: newEndDate,
          status: "active", // 如果已过期，重新激活
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      await adminAudit({
        adminId,
        adminUsername,
        action: "subscription.extend",
        targetType: "subscription",
        targetId: subscriptionId,
        targetName: user?.displayName || user?.phone || sub.userId,
        details: { days, oldEndDate: currentEnd.toISOString(), newEndDate: newEndDate.toISOString() },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-subscription] Subscription extended", {
        subscriptionId,
        adminId,
        days,
        newEndDate,
      });

      return { success: true, newEndDate };
    } catch (error) {
      logger.error("[admin-subscription] Failed to extend subscription", {
        subscriptionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "延长订阅失败" };
    }
  }

  /**
   * 变更订阅套餐
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPlanId: string,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [sub] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));

      if (!sub) {
        return { success: false, error: "订阅不存在" };
      }

      const [newPlan] = await this.db
        .select()
        .from(plans)
        .where(eq(plans.id, newPlanId));

      if (!newPlan) {
        return { success: false, error: "套餐不存在" };
      }

      // 获取用户信息用于审计
      const [user] = await this.db
        .select({ displayName: users.displayName, phone: users.phone })
        .from(users)
        .where(eq(users.id, sub.userId))
        .limit(1);

      const oldPlanId = sub.planId;

      await this.db
        .update(subscriptions)
        .set({
          planId: newPlanId,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      await adminAudit({
        adminId,
        adminUsername,
        action: "subscription.change_plan",
        targetType: "subscription",
        targetId: subscriptionId,
        targetName: user?.displayName || user?.phone || sub.userId,
        details: { oldPlanId, newPlanId, newPlanName: newPlan.name },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-subscription] Subscription plan changed", {
        subscriptionId,
        adminId,
        oldPlanId,
        newPlanId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-subscription] Failed to change subscription plan", {
        subscriptionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "变更套餐失败" };
    }
  }

  /**
   * 获取套餐列表
   */
  async listPlans(): Promise<PlanListItem[]> {
    const planList = await this.db
      .select()
      .from(plans)
      .orderBy(plans.sortOrder);

    // 获取每个套餐的订阅者数量
    const plansWithCount = await Promise.all(
      planList.map(async (plan) => {
        const [{ count }] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.planId, plan.id),
              eq(subscriptions.status, "active")
            )
          );

        return {
          ...plan,
          subscriberCount: count,
        };
      })
    );

    return plansWithCount;
  }

  /**
   * 获取套餐详情
   */
  async getPlanDetail(planId: string): Promise<Plan | null> {
    const [plan] = await this.db
      .select()
      .from(plans)
      .where(eq(plans.id, planId));
    return plan || null;
  }

  /**
   * 创建套餐
   */
  async createPlan(
    data: {
      code: string;
      name: string;
      description?: string;
      priceMonthly: number;
      priceYearly: number;
      tokensPerMonth: number;
      storageMb: number;
      maxDevices: number;
      features?: Record<string, unknown>;
      sortOrder?: number;
    },
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string; plan?: Plan }> {
    try {
      // 检查代码是否已存在
      const [existing] = await this.db
        .select()
        .from(plans)
        .where(eq(plans.code, data.code));

      if (existing) {
        return { success: false, error: "套餐代码已存在" };
      }

      const id = generateId();
      const now = new Date();

      const [plan] = await this.db
        .insert(plans)
        .values({
          id,
          code: data.code,
          name: data.name,
          description: data.description,
          priceMonthly: data.priceMonthly,
          priceYearly: data.priceYearly,
          tokensPerMonth: data.tokensPerMonth,
          storageMb: data.storageMb,
          maxDevices: data.maxDevices,
          features: data.features,
          sortOrder: data.sortOrder ?? 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await adminAudit({
        adminId,
        adminUsername,
        action: "plan.create",
        targetType: "plan",
        targetId: id,
        targetName: data.name,
        details: { code: data.code },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-subscription] Plan created", {
        planId: id,
        code: data.code,
        adminId,
      });

      return { success: true, plan };
    } catch (error) {
      logger.error("[admin-subscription] Failed to create plan", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "创建套餐失败" };
    }
  }

  /**
   * 更新套餐
   */
  async updatePlan(
    planId: string,
    data: Partial<{
      name: string;
      description: string;
      priceMonthly: number;
      priceYearly: number;
      tokensPerMonth: number;
      storageMb: number;
      maxDevices: number;
      features: Record<string, unknown>;
      sortOrder: number;
      isActive: boolean;
    }>,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [existing] = await this.db
        .select()
        .from(plans)
        .where(eq(plans.id, planId));

      if (!existing) {
        return { success: false, error: "套餐不存在" };
      }

      await this.db
        .update(plans)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, planId));

      await adminAudit({
        adminId,
        adminUsername,
        action: "plan.update",
        targetType: "plan",
        targetId: planId,
        targetName: existing.name,
        details: { changes: data },
        beforeSnapshot: existing as unknown as Record<string, unknown>,
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-subscription] Plan updated", {
        planId,
        adminId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-subscription] Failed to update plan", {
        planId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "更新套餐失败" };
    }
  }

  /**
   * 查询订单列表
   */
  async listOrders(params: OrderListParams = {}): Promise<OrderListResult> {
    const {
      search,
      status = "all",
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = params;

    // 构建查询条件
    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(paymentOrders.paymentStatus, status as "pending" | "paid" | "failed" | "canceled" | "refunded"));
    }
    if (paymentMethod) {
      conditions.push(eq(paymentOrders.paymentMethod, paymentMethod as "wechat" | "alipay" | "stripe" | "manual"));
    }
    if (startDate) {
      conditions.push(gt(paymentOrders.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lt(paymentOrders.createdAt, endDate));
    }
    if (search) {
      conditions.push(like(paymentOrders.orderNo, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentOrders)
      .where(whereClause);

    // 分页查询
    const offset = (page - 1) * pageSize;
    const orderList = await this.db
      .select()
      .from(paymentOrders)
      .where(whereClause)
      .orderBy(desc(paymentOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 获取关联的用户信息
    const ordersWithDetails = await Promise.all(
      orderList.map(async (order) => {
        // 获取用户信息
        let user: { displayName: string | null; phone: string | null } | undefined;
        if (order.userId) {
          const [userResult] = await this.db
            .select({
              displayName: users.displayName,
              phone: users.phone,
            })
            .from(users)
            .where(eq(users.id, order.userId))
            .limit(1);
          user = userResult;
        }

        return {
          id: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          userName: user?.displayName || null,
          userPhone: user?.phone || null,
          orderType: order.orderType,
          subscriptionId: order.subscriptionId,
          amount: order.amount,
          paidAmount: order.paidAmount,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        };
      })
    );

    return {
      orders: ordersWithDetails,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string): Promise<PaymentOrder | null> {
    const [order] = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, orderId));
    return order || null;
  }

  /**
   * 标记订单为已退款
   */
  async refundOrder(
    orderId: string,
    adminId: string,
    adminUsername: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [order] = await this.db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.id, orderId));

      if (!order) {
        return { success: false, error: "订单不存在" };
      }

      if (order.paymentStatus !== "paid") {
        return { success: false, error: "只有已支付的订单才能退款" };
      }

      // 获取用户信息用于审计
      let user: { displayName: string | null; phone: string | null } | undefined;
      if (order.userId) {
        const [userResult] = await this.db
          .select({ displayName: users.displayName, phone: users.phone })
          .from(users)
          .where(eq(users.id, order.userId))
          .limit(1);
        user = userResult;
      }

      await this.db
        .update(paymentOrders)
        .set({
          paymentStatus: "refunded",
          refundedAt: new Date(),
          refundAmount: order.paidAmount,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, orderId));

      await adminAudit({
        adminId,
        adminUsername,
        action: "order.refund",
        targetType: "order",
        targetId: orderId,
        targetName: order.orderNo,
        details: { reason, amount: order.paidAmount, userId: order.userId },
        ipAddress,
        userAgent,
        riskLevel: "high",
      });

      logger.info("[admin-subscription] Order refunded", {
        orderId,
        orderNo: order.orderNo,
        adminId,
        amount: order.paidAmount,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-subscription] Failed to refund order", {
        orderId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "退款失败" };
    }
  }

  /**
   * 获取订阅统计信息
   */
  async getSubscriptionStats(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    monthlyRevenue: number;
    expiringThisWeek: number;
  }> {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(subscriptions);

    const [{ active }] = await this.db
      .select({ active: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    const [{ trial }] = await this.db
      .select({ trial: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "trialing"));

    const [{ expiring }] = await this.db
      .select({ expiring: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.status, ["active", "trialing"]),
          gt(subscriptions.currentPeriodEnd, now),
          lt(subscriptions.currentPeriodEnd, weekLater)
        )
      );

    // 计算本月收入
    const [{ revenue }] = await this.db
      .select({ revenue: sql<number>`coalesce(sum(paid_amount), 0)::int` })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.paymentStatus, "paid"),
          gt(paymentOrders.paidAt, startOfMonth)
        )
      );

    return {
      totalSubscriptions: total,
      activeSubscriptions: active,
      trialSubscriptions: trial,
      monthlyRevenue: revenue,
      expiringThisWeek: expiring,
    };
  }
}

// 单例
let adminSubscriptionServiceInstance: AdminSubscriptionService | null = null;

export function getAdminSubscriptionService(db?: Database): AdminSubscriptionService {
  if (!adminSubscriptionServiceInstance || db) {
    adminSubscriptionServiceInstance = new AdminSubscriptionService(db);
  }
  return adminSubscriptionServiceInstance;
}
