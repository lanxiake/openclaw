/**
 * 订阅与计费数据访问层
 */

import { eq, and, gte, lte, desc, sql, lt, or, inArray } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  plans,
  skills,
  userSkills,
  subscriptions,
  paymentOrders,
  couponCodes,
  type Plan,
  type NewPlan,
  type Skill,
  type NewSkill,
  type UserSkill,
  type Subscription,
  type NewSubscription,
  type PaymentOrder,
  type NewPaymentOrder,
  type CouponCode,
} from "../schema/index.js";
import { generateId, generateOrderNo } from "../utils/id.js";
import { getLogger } from "../../shared/logging/logger.js";

const logger = getLogger();

/**
 * 套餐仓库类
 */
export class PlanRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 获取所有激活的套餐
   */
  async findActive(): Promise<Plan[]> {
    return this.db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
  }

  /**
   * 根据代码获取套餐
   */
  async findByCode(code: string): Promise<Plan | null> {
    const [plan] = await this.db.select().from(plans).where(eq(plans.code, code));
    return plan ?? null;
  }

  /**
   * 根据 ID 获取套餐
   */
  async findById(id: string): Promise<Plan | null> {
    const [plan] = await this.db.select().from(plans).where(eq(plans.id, id));
    return plan ?? null;
  }

  /**
   * 创建套餐
   */
  async create(data: Omit<NewPlan, "id" | "createdAt" | "updatedAt">): Promise<Plan> {
    const id = generateId();
    const now = new Date();

    const [plan] = await this.db
      .insert(plans)
      .values({
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[plan-repo] Plan created", { planId: id, code: data.code });
    return plan;
  }

  /**
   * 更新套餐
   */
  async update(id: string, data: Partial<Omit<NewPlan, "id" | "createdAt">>): Promise<Plan | null> {
    const [plan] = await this.db
      .update(plans)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))
      .returning();

    return plan ?? null;
  }
}

/**
 * 技能仓库类
 */
export class SkillRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 获取所有激活的技能
   */
  async findActive(): Promise<Skill[]> {
    return this.db.select().from(skills).where(eq(skills.isActive, true));
  }

  /**
   * 根据类型获取技能
   */
  async findByType(type: "builtin" | "premium" | "addon"): Promise<Skill[]> {
    return this.db
      .select()
      .from(skills)
      .where(and(eq(skills.type, type), eq(skills.isActive, true)));
  }

  /**
   * 根据代码获取技能
   */
  async findByCode(code: string): Promise<Skill | null> {
    const [skill] = await this.db.select().from(skills).where(eq(skills.code, code));
    return skill ?? null;
  }

  /**
   * 创建技能
   */
  async create(data: Omit<NewSkill, "id" | "createdAt" | "updatedAt">): Promise<Skill> {
    const id = generateId();
    const now = new Date();

    const [skill] = await this.db
      .insert(skills)
      .values({
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[skill-repo] Skill created", { skillId: id, code: data.code });
    return skill;
  }
}

/**
 * 用户技能仓库类
 */
export class UserSkillRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 为用户添加技能
   */
  async addSkill(userId: string, skillId: string, expiresAt?: Date): Promise<UserSkill> {
    const id = generateId();

    const [userSkill] = await this.db
      .insert(userSkills)
      .values({
        id,
        userId,
        skillId,
        expiresAt,
        isActive: true,
        purchasedAt: new Date(),
      })
      .returning();

    logger.info("[user-skill-repo] Skill added to user", { userId, skillId });
    return userSkill;
  }

  /**
   * 获取用户的所有技能
   */
  async findByUserId(userId: string): Promise<UserSkill[]> {
    return this.db.select().from(userSkills).where(eq(userSkills.userId, userId));
  }

  /**
   * 获取用户的有效技能
   */
  async findActiveByUserId(userId: string): Promise<UserSkill[]> {
    return this.db
      .select()
      .from(userSkills)
      .where(
        and(
          eq(userSkills.userId, userId),
          eq(userSkills.isActive, true),
          sql`(${userSkills.expiresAt} IS NULL OR ${userSkills.expiresAt} > NOW())`,
        ),
      );
  }

  /**
   * 检查用户是否拥有技能
   */
  async hasSkill(userId: string, skillId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkills)
      .where(
        and(
          eq(userSkills.userId, userId),
          eq(userSkills.skillId, skillId),
          eq(userSkills.isActive, true),
          sql`(${userSkills.expiresAt} IS NULL OR ${userSkills.expiresAt} > NOW())`,
        ),
      );
    return (result?.count ?? 0) > 0;
  }

  /**
   * 停用用户技能
   */
  async deactivate(userId: string, skillId: string): Promise<void> {
    await this.db
      .update(userSkills)
      .set({ isActive: false })
      .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)));
    logger.info("[user-skill-repo] Skill deactivated", { userId, skillId });
  }

  /**
   * 获取用户有效技能数量
   */
  async countActiveSkills(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkills)
      .where(
        and(
          eq(userSkills.userId, userId),
          eq(userSkills.isActive, true),
          sql`(${userSkills.expiresAt} IS NULL OR ${userSkills.expiresAt} > NOW())`,
        ),
      );
    return result?.count ?? 0;
  }
}

/**
 * 订阅仓库类
 */
export class SubscriptionRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建订阅
   */
  async create(
    data: Omit<NewSubscription, "id" | "createdAt" | "updatedAt">,
  ): Promise<Subscription> {
    const id = generateId();
    const now = new Date();

    const [sub] = await this.db
      .insert(subscriptions)
      .values({
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[subscription-repo] Subscription created", {
      subscriptionId: id,
      userId: data.userId,
      planId: data.planId,
    });
    return sub;
  }

  /**
   * 获取用户当前有效订阅
   */
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return sub ?? null;
  }

  /**
   * 获取用户所有订阅历史
   */
  async findByUserId(userId: string): Promise<Subscription[]> {
    return this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  /**
   * 更新订阅状态
   */
  async updateStatus(
    id: string,
    status: "active" | "canceled" | "expired" | "past_due" | "trialing",
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id));

    logger.info("[subscription-repo] Subscription status updated", {
      subscriptionId: id,
      status,
    });
  }

  /**
   * 取消订阅
   */
  async cancel(id: string, reason?: string): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id));

    logger.info("[subscription-repo] Subscription canceled", {
      subscriptionId: id,
      reason,
    });
  }

  /**
   * 续期订阅
   */
  async renew(id: string, newPeriodEnd: Date): Promise<Subscription | null> {
    const [sub] = await this.db
      .update(subscriptions)
      .set({
        currentPeriodStart: new Date(),
        currentPeriodEnd: newPeriodEnd,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    if (sub) {
      logger.info("[subscription-repo] Subscription renewed", {
        subscriptionId: id,
        newPeriodEnd: newPeriodEnd.toISOString(),
      });
    }
    return sub ?? null;
  }

  /**
   * 获取即将过期的订阅
   */
  async findExpiringSoon(daysAhead: number = 7): Promise<Subscription[]> {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.status, ["active", "trialing"]),
          gte(subscriptions.currentPeriodEnd, now),
          lte(subscriptions.currentPeriodEnd, future),
        ),
      );
  }

  /**
   * 获取已过期的订阅 (用于自动处理)
   */
  async findExpired(): Promise<Subscription[]> {
    const now = new Date();

    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.status, ["active", "trialing"]),
          lt(subscriptions.currentPeriodEnd, now),
        ),
      );
  }

  /**
   * 根据 ID 获取订阅
   */
  async findById(id: string): Promise<Subscription | null> {
    const [sub] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return sub ?? null;
  }

  /**
   * 更新订阅
   */
  async update(
    id: string,
    data: Partial<Omit<NewSubscription, "id" | "createdAt">>,
  ): Promise<Subscription | null> {
    const [sub] = await this.db
      .update(subscriptions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    if (sub) {
      logger.info("[subscription-repo] Subscription updated", { subscriptionId: id });
    }
    return sub ?? null;
  }
}

/**
 * 支付订单仓库类
 */
export class PaymentOrderRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建支付订单
   */
  async create(
    data: Omit<NewPaymentOrder, "id" | "orderNo" | "createdAt" | "updatedAt">,
  ): Promise<PaymentOrder> {
    const id = generateId();
    const orderNo = generateOrderNo();
    const now = new Date();

    const [order] = await this.db
      .insert(paymentOrders)
      .values({
        ...data,
        id,
        orderNo,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[payment-order-repo] Order created", {
      orderId: id,
      orderNo,
      userId: data.userId,
      amount: data.amount,
    });
    return order;
  }

  /**
   * 根据订单号获取订单
   */
  async findByOrderNo(orderNo: string): Promise<PaymentOrder | null> {
    const [order] = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderNo, orderNo));
    return order ?? null;
  }

  /**
   * 根据 ID 获取订单
   */
  async findById(id: string): Promise<PaymentOrder | null> {
    const [order] = await this.db.select().from(paymentOrders).where(eq(paymentOrders.id, id));
    return order ?? null;
  }

  /**
   * 更新支付状态为已支付
   */
  async markPaid(id: string, externalPaymentId: string): Promise<PaymentOrder | null> {
    const [order] = await this.db
      .update(paymentOrders)
      .set({
        paymentStatus: "paid",
        externalPaymentId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, id))
      .returning();

    if (order) {
      logger.info("[payment-order-repo] Order paid", {
        orderId: id,
        externalPaymentId,
      });
    }
    return order ?? null;
  }

  /**
   * 标记支付失败
   */
  async markFailed(id: string): Promise<void> {
    await this.db
      .update(paymentOrders)
      .set({
        paymentStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, id));

    logger.warn("[payment-order-repo] Order payment failed", { orderId: id });
  }

  /**
   * 处理退款
   */
  async refund(id: string, refundAmount: number): Promise<void> {
    await this.db
      .update(paymentOrders)
      .set({
        paymentStatus: "refunded",
        refundedAt: new Date(),
        refundAmount,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, id));

    logger.info("[payment-order-repo] Order refunded", {
      orderId: id,
      refundAmount,
    });
  }

  /**
   * 获取用户订单历史
   */
  async findByUserId(userId: string, limit: number = 50): Promise<PaymentOrder[]> {
    return this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.userId, userId))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(limit);
  }

  /**
   * 获取待支付的过期订单 (用于自动取消)
   */
  async findExpiredPending(expiryMinutes: number = 30): Promise<PaymentOrder[]> {
    const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);

    return this.db
      .select()
      .from(paymentOrders)
      .where(and(eq(paymentOrders.paymentStatus, "pending"), lt(paymentOrders.createdAt, cutoff)));
  }

  /**
   * 取消订单
   */
  async cancel(id: string): Promise<void> {
    await this.db
      .update(paymentOrders)
      .set({
        paymentStatus: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, id));

    logger.info("[payment-order-repo] Order canceled", { orderId: id });
  }
}

/**
 * 优惠券仓库类
 */
export class CouponRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 根据代码获取优惠券
   */
  async findByCode(code: string): Promise<CouponCode | null> {
    const [coupon] = await this.db
      .select()
      .from(couponCodes)
      .where(eq(couponCodes.code, code.toUpperCase()));
    return coupon ?? null;
  }

  /**
   * 验证优惠券是否可用
   */
  async validate(
    code: string,
    userId: string,
    amount: number,
  ): Promise<{ valid: boolean; error?: string; coupon?: CouponCode }> {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      return { valid: false, error: "优惠券不存在" };
    }
    if (!coupon.isActive) {
      return { valid: false, error: "优惠券已失效" };
    }
    if (coupon.startsAt && coupon.startsAt > new Date()) {
      return { valid: false, error: "优惠券尚未生效" };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, error: "优惠券已过期" };
    }
    if (coupon.totalLimit && coupon.usedCount >= coupon.totalLimit) {
      return { valid: false, error: "优惠券已达使用上限" };
    }
    if (amount < coupon.minAmount) {
      return { valid: false, error: `最低消费 ¥${coupon.minAmount / 100}` };
    }

    // TODO: 检查用户使用次数

    return { valid: true, coupon };
  }

  /**
   * 使用优惠券
   */
  async use(id: string): Promise<void> {
    await this.db
      .update(couponCodes)
      .set({
        usedCount: sql`${couponCodes.usedCount} + 1`,
      })
      .where(eq(couponCodes.id, id));
  }

  /**
   * 计算折扣金额
   */
  calculateDiscount(coupon: CouponCode, amount: number): number {
    let discount: number;

    if (coupon.discountType === "percentage") {
      discount = Math.floor((amount * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }

    // 应用最大折扣限制
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }

    // 确保折扣不超过订单金额
    return Math.min(discount, amount);
  }
}

// 导出单例工厂函数
export function getPlanRepository(db?: Database): PlanRepository {
  return new PlanRepository(db);
}

export function getSkillRepository(db?: Database): SkillRepository {
  return new SkillRepository(db);
}

export function getUserSkillRepository(db?: Database): UserSkillRepository {
  return new UserSkillRepository(db);
}

export function getSubscriptionRepository(db?: Database): SubscriptionRepository {
  return new SubscriptionRepository(db);
}

export function getPaymentOrderRepository(db?: Database): PaymentOrderRepository {
  return new PaymentOrderRepository(db);
}

export function getCouponRepository(db?: Database): CouponRepository {
  return new CouponRepository(db);
}
