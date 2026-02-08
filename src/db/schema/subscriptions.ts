/**
 * 订阅与计费表 Schema
 *
 * 包含套餐、技能、订阅、支付、优惠券等
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

/**
 * 套餐表
 */
export const plans = pgTable(
  "plans",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 套餐代码 (如 free, basic, pro, enterprise) */
    code: text("code").unique().notNull(),
    /** 套餐名称 */
    name: text("name").notNull(),
    /** 套餐描述 */
    description: text("description"),
    /** 月价格 (分) */
    priceMonthly: integer("price_monthly").notNull(),
    /** 年价格 (分) */
    priceYearly: integer("price_yearly").notNull(),
    /** 包含的 Token 额度 (每月) */
    tokensPerMonth: integer("tokens_per_month").notNull(),
    /** 包含的存储空间 (MB) */
    storageMb: integer("storage_mb").notNull(),
    /** 最大设备数 */
    maxDevices: integer("max_devices").notNull(),
    /** 功能列表 (JSON) */
    features: jsonb("features").$type<PlanFeatures>(),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 排序权重 */
    sortOrder: integer("sort_order").default(0).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 索引：激活状态
    index("plans_is_active_idx").on(table.isActive),
    // 索引：排序
    index("plans_sort_order_idx").on(table.sortOrder),
  ],
);

/**
 * 套餐功能接口
 */
export interface PlanFeatures {
  /** 支持的 AI 模型列表 */
  aiModels?: string[];
  /** 优先客服 */
  prioritySupport?: boolean;
  /** API 访问 */
  apiAccess?: boolean;
  /** 自定义技能数量 */
  customSkillsLimit?: number;
  /** 自定义功能列表 */
  custom?: Record<string, boolean | number | string>;
}

/**
 * 技能表
 */
export const skills = pgTable(
  "skills",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 技能代码 */
    code: text("code").unique().notNull(),
    /** 技能名称 */
    name: text("name").notNull(),
    /** 技能描述 */
    description: text("description"),
    /** 技能类型 */
    type: text("type", {
      enum: ["builtin", "premium", "addon"],
    }).notNull(),
    /** 价格 (分，0 表示免费) */
    price: integer("price").default(0).notNull(),
    /** 计费周期 */
    billingCycle: text("billing_cycle", {
      enum: ["once", "monthly", "yearly"],
    }).default("once"),
    /** 技能配置 (JSON) */
    config: jsonb("config").$type<Record<string, unknown>>(),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 索引：类型
    index("skills_type_idx").on(table.type),
    // 索引：激活状态
    index("skills_is_active_idx").on(table.isActive),
  ],
);

/**
 * 用户技能表
 *
 * 用户购买/订阅的技能
 */
export const userSkills = pgTable(
  "user_skills",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 技能 ID */
    skillId: text("skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    /** 过期时间 (null 表示永久) */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 购买时间 */
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 联合唯一索引：用户+技能
    uniqueIndex("user_skills_user_skill_unique_idx").on(table.userId, table.skillId),
    // 索引：用户 ID
    index("user_skills_user_id_idx").on(table.userId),
    // 索引：过期时间
    index("user_skills_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 订阅表
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 套餐 ID */
    planId: text("plan_id")
      .references(() => plans.id)
      .notNull(),
    /** 订阅状态 */
    status: text("status", {
      enum: ["active", "canceled", "expired", "past_due", "trialing"],
    }).notNull(),
    /** 计费周期 */
    billingCycle: text("billing_cycle", {
      enum: ["monthly", "yearly"],
    }).notNull(),
    /** 当前周期开始时间 */
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    /** 当前周期结束时间 */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    /** 取消时间 */
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** 取消原因 */
    cancelReason: text("cancel_reason"),
    /** 试用结束时间 */
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    /** 外部订阅 ID (支付平台) */
    externalSubscriptionId: text("external_subscription_id"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 索引：用户 ID
    index("subscriptions_user_id_idx").on(table.userId),
    // 索引：状态
    index("subscriptions_status_idx").on(table.status),
    // 索引：当前周期结束 (用于续费提醒)
    index("subscriptions_current_period_end_idx").on(table.currentPeriodEnd),
  ],
);

/**
 * 支付订单表
 */
export const paymentOrders = pgTable(
  "payment_orders",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 订单号 (业务唯一) */
    orderNo: text("order_no").unique().notNull(),
    /** 订单类型 */
    orderType: text("order_type", {
      enum: ["subscription", "skill", "tokens", "storage"],
    }).notNull(),
    /** 关联订阅 ID */
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    /** 关联技能 ID */
    skillId: text("skill_id").references(() => skills.id),
    /** 金额 (分) */
    amount: integer("amount").notNull(),
    /** 货币 */
    currency: text("currency").default("CNY").notNull(),
    /** 折扣金额 (分) */
    discountAmount: integer("discount_amount").default(0).notNull(),
    /** 实付金额 (分) */
    paidAmount: integer("paid_amount").notNull(),
    /** 优惠券 ID */
    couponId: text("coupon_id"),
    /** 支付方式 */
    paymentMethod: text("payment_method", {
      enum: ["wechat", "alipay", "stripe", "manual"],
    }),
    /** 支付状态 */
    paymentStatus: text("payment_status", {
      enum: ["pending", "paid", "failed", "refunded", "canceled"],
    }).notNull(),
    /** 外部支付单号 */
    externalPaymentId: text("external_payment_id"),
    /** 支付时间 */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** 退款时间 */
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    /** 退款金额 (分) */
    refundAmount: integer("refund_amount"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    /** 订单元数据 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    // 索引：用户 ID
    index("payment_orders_user_id_idx").on(table.userId),
    // 索引：支付状态
    index("payment_orders_payment_status_idx").on(table.paymentStatus),
    // 索引：订单类型
    index("payment_orders_order_type_idx").on(table.orderType),
    // 索引：创建时间
    index("payment_orders_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 优惠券表
 */
export const couponCodes = pgTable(
  "coupon_codes",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 优惠券码 */
    code: text("code").unique().notNull(),
    /** 优惠类型 */
    discountType: text("discount_type", {
      enum: ["percentage", "fixed"],
    }).notNull(),
    /** 折扣值 (百分比 或 固定金额分) */
    discountValue: integer("discount_value").notNull(),
    /** 最低消费 (分) */
    minAmount: integer("min_amount").default(0).notNull(),
    /** 最大折扣 (分) */
    maxDiscount: integer("max_discount"),
    /** 适用套餐 ID 列表 */
    applicablePlans: jsonb("applicable_plans").$type<string[]>(),
    /** 适用技能 ID 列表 */
    applicableSkills: jsonb("applicable_skills").$type<string[]>(),
    /** 总使用次数限制 */
    totalLimit: integer("total_limit"),
    /** 每用户使用次数限制 */
    perUserLimit: integer("per_user_limit").default(1).notNull(),
    /** 已使用次数 */
    usedCount: integer("used_count").default(0).notNull(),
    /** 开始时间 */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    /** 结束时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 索引：激活状态
    index("coupon_codes_is_active_idx").on(table.isActive),
    // 索引：过期时间
    index("coupon_codes_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * 关系定义
 */
export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  userSkills: many(userSkills),
}));

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkills.skillId],
    references: [skills.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  orders: many(paymentOrders),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  user: one(users, {
    fields: [paymentOrders.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [paymentOrders.subscriptionId],
    references: [subscriptions.id],
  }),
  skill: one(skills, {
    fields: [paymentOrders.skillId],
    references: [skills.id],
  }),
}));

// Zod schemas
export const insertPlanSchema = createInsertSchema(plans);
export const selectPlanSchema = createSelectSchema(plans);
export const insertSkillSchema = createInsertSchema(skills);
export const selectSkillSchema = createSelectSchema(skills);
export const insertUserSkillSchema = createInsertSchema(userSkills);
export const selectUserSkillSchema = createSelectSchema(userSkills);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const selectSubscriptionSchema = createSelectSchema(subscriptions);
export const insertPaymentOrderSchema = createInsertSchema(paymentOrders);
export const selectPaymentOrderSchema = createSelectSchema(paymentOrders);
export const insertCouponCodeSchema = createInsertSchema(couponCodes);
export const selectCouponCodeSchema = createSelectSchema(couponCodes);

// 类型导出
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type UserSkill = typeof userSkills.$inferSelect;
export type NewUserSkill = typeof userSkills.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
export type CouponCode = typeof couponCodes.$inferSelect;
export type NewCouponCode = typeof couponCodes.$inferInsert;
