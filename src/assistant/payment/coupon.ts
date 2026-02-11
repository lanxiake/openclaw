/**
 * 优惠券系统 - Coupon System
 *
 * 提供完整的优惠券功能：
 * - 优惠券生成与管理
 * - 优惠券验证与使用
 * - 折扣计算
 * - 使用记录追踪
 *
 * @author OpenClaw
 */

import { v4 as uuidv4 } from "uuid";
import { getLogger } from "../../shared/logging/logger.js";
import type { OrderType, PriceInfo } from "./types.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 优惠券类型
 */
export type CouponType =
  | "percentage" // 百分比折扣
  | "fixed" // 固定金额减免
  | "trial" // 试用期
  | "free_month"; // 免费月份

/**
 * 优惠券状态
 */
export type CouponStatus =
  | "active" // 有效
  | "expired" // 已过期
  | "depleted" // 已用尽
  | "disabled"; // 已禁用

/**
 * 优惠券适用范围
 */
export interface CouponScope {
  /** 适用的订单类型 */
  orderTypes?: OrderType[];
  /** 适用的订阅计划 ID */
  planIds?: string[];
  /** 适用的技能 ID */
  skillIds?: string[];
  /** 最低订单金额 (分) */
  minOrderAmount?: number;
  /** 是否仅限首单 */
  firstOrderOnly?: boolean;
  /** 是否仅限新用户 */
  newUserOnly?: boolean;
}

/**
 * 优惠券
 */
export interface Coupon {
  /** 优惠券 ID */
  id: string;
  /** 优惠码 */
  code: string;
  /** 优惠券名称 */
  name: string;
  /** 优惠券描述 */
  description?: string;
  /** 优惠券类型 */
  type: CouponType;
  /** 优惠值 (百分比或金额) */
  value: number;
  /** 最大折扣金额 (分)，用于百分比折扣 */
  maxDiscount?: number;
  /** 状态 */
  status: CouponStatus;
  /** 适用范围 */
  scope: CouponScope;
  /** 总数量 (-1 表示无限) */
  totalCount: number;
  /** 已使用数量 */
  usedCount: number;
  /** 每用户使用次数限制 */
  perUserLimit: number;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 优惠券使用记录
 */
export interface CouponUsage {
  /** 记录 ID */
  id: string;
  /** 优惠券 ID */
  couponId: string;
  /** 优惠码 */
  couponCode: string;
  /** 用户 ID */
  userId: string;
  /** 订单 ID */
  orderId: string;
  /** 折扣金额 (分) */
  discountAmount: number;
  /** 使用时间 */
  usedAt: string;
}

/**
 * 验证优惠券请求
 */
export interface ValidateCouponRequest {
  /** 优惠码 */
  code: string;
  /** 用户 ID */
  userId: string;
  /** 订单类型 */
  orderType: OrderType;
  /** 订单金额 (分) */
  orderAmount: number;
  /** 商品 ID (订阅计划/技能) */
  itemId?: string;
}

/**
 * 验证优惠券响应
 */
export interface ValidateCouponResponse {
  /** 是否有效 */
  valid: boolean;
  /** 优惠券信息 */
  coupon?: Coupon;
  /** 折扣金额 (分) */
  discountAmount?: number;
  /** 最终价格 (分) */
  finalPrice?: number;
  /** 错误信息 */
  error?: string;
  /** 错误码 */
  errorCode?: CouponErrorCode;
}

/**
 * 优惠券错误码
 */
export type CouponErrorCode =
  | "NOT_FOUND" // 优惠券不存在
  | "EXPIRED" // 已过期
  | "NOT_STARTED" // 未开始
  | "DEPLETED" // 已用尽
  | "DISABLED" // 已禁用
  | "LIMIT_EXCEEDED" // 超出使用次数
  | "MIN_AMOUNT_NOT_MET" // 未达到最低金额
  | "SCOPE_MISMATCH" // 不适用于当前订单
  | "FIRST_ORDER_ONLY" // 仅限首单
  | "NEW_USER_ONLY"; // 仅限新用户

// ============================================================================
// 内存存储 (生产环境应使用数据库)
// ============================================================================

const coupons: Map<string, Coupon> = new Map();
const couponsByCode: Map<string, string> = new Map(); // code -> id
const couponUsages: CouponUsage[] = [];

// ============================================================================
// 优惠券管理
// ============================================================================

/**
 * 创建优惠券
 */
export function createCoupon(params: {
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  scope?: CouponScope;
  totalCount?: number;
  perUserLimit?: number;
  startTime?: string;
  endTime: string;
}): Coupon {
  const id = uuidv4();
  const now = new Date().toISOString();

  // 检查优惠码是否已存在
  if (couponsByCode.has(params.code.toUpperCase())) {
    throw new Error(`优惠码 ${params.code} 已存在`);
  }

  const coupon: Coupon = {
    id,
    code: params.code.toUpperCase(),
    name: params.name,
    description: params.description,
    type: params.type,
    value: params.value,
    maxDiscount: params.maxDiscount,
    status: "active",
    scope: params.scope || {},
    totalCount: params.totalCount ?? -1,
    usedCount: 0,
    perUserLimit: params.perUserLimit ?? 1,
    startTime: params.startTime || now,
    endTime: params.endTime,
    createdAt: now,
    updatedAt: now,
  };

  coupons.set(id, coupon);
  couponsByCode.set(coupon.code, id);

  logger.info("[coupon] 创建优惠券", {
    id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
  });

  return coupon;
}

/**
 * 获取优惠券
 */
export function getCoupon(id: string): Coupon | null {
  return coupons.get(id) || null;
}

/**
 * 通过优惠码获取优惠券
 */
export function getCouponByCode(code: string): Coupon | null {
  const id = couponsByCode.get(code.toUpperCase());
  if (!id) return null;
  return coupons.get(id) || null;
}

/**
 * 更新优惠券
 */
export function updateCoupon(
  id: string,
  updates: Partial<
    Pick<
      Coupon,
      "name" | "description" | "status" | "scope" | "totalCount" | "perUserLimit" | "endTime"
    >
  >,
): Coupon | null {
  const coupon = coupons.get(id);
  if (!coupon) return null;

  const updatedCoupon: Coupon = {
    ...coupon,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  coupons.set(id, updatedCoupon);

  logger.info("[coupon] 更新优惠券", {
    id,
    updates: Object.keys(updates),
  });

  return updatedCoupon;
}

/**
 * 禁用优惠券
 */
export function disableCoupon(id: string): boolean {
  const coupon = coupons.get(id);
  if (!coupon) return false;

  coupon.status = "disabled";
  coupon.updatedAt = new Date().toISOString();
  coupons.set(id, coupon);

  logger.info("[coupon] 禁用优惠券", { id, code: coupon.code });
  return true;
}

/**
 * 获取所有优惠券
 */
export function listCoupons(filters?: { status?: CouponStatus; type?: CouponType }): Coupon[] {
  let result = Array.from(coupons.values());

  if (filters?.status) {
    result = result.filter((c) => c.status === filters.status);
  }

  if (filters?.type) {
    result = result.filter((c) => c.type === filters.type);
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ============================================================================
// 优惠券验证与使用
// ============================================================================

/**
 * 验证优惠券
 */
export async function validateCoupon(
  request: ValidateCouponRequest,
  context?: {
    isFirstOrder?: boolean;
    isNewUser?: boolean;
  },
): Promise<ValidateCouponResponse> {
  const { code, userId, orderType, orderAmount, itemId } = request;
  const { isFirstOrder = false, isNewUser = false } = context || {};

  logger.debug("[coupon] 验证优惠券", {
    code,
    userId,
    orderType,
    orderAmount,
  });

  // 1. 查找优惠券
  const coupon = getCouponByCode(code);
  if (!coupon) {
    return {
      valid: false,
      error: "优惠券不存在",
      errorCode: "NOT_FOUND",
    };
  }

  // 2. 检查状态
  if (coupon.status === "disabled") {
    return {
      valid: false,
      error: "优惠券已禁用",
      errorCode: "DISABLED",
    };
  }

  if (coupon.status === "depleted") {
    return {
      valid: false,
      error: "优惠券已用完",
      errorCode: "DEPLETED",
    };
  }

  // 3. 检查时间
  const now = new Date();
  const startTime = new Date(coupon.startTime);
  const endTime = new Date(coupon.endTime);

  if (now < startTime) {
    return {
      valid: false,
      error: "优惠券活动未开始",
      errorCode: "NOT_STARTED",
    };
  }

  if (now > endTime) {
    return {
      valid: false,
      error: "优惠券已过期",
      errorCode: "EXPIRED",
    };
  }

  // 4. 检查使用次数
  if (coupon.totalCount !== -1 && coupon.usedCount >= coupon.totalCount) {
    return {
      valid: false,
      error: "优惠券已用完",
      errorCode: "DEPLETED",
    };
  }

  // 5. 检查用户使用次数
  const userUsageCount = couponUsages.filter(
    (u) => u.couponId === coupon.id && u.userId === userId,
  ).length;

  if (userUsageCount >= coupon.perUserLimit) {
    return {
      valid: false,
      error: "已达到使用次数上限",
      errorCode: "LIMIT_EXCEEDED",
    };
  }

  // 6. 检查适用范围
  const { scope } = coupon;

  // 检查订单类型
  if (scope.orderTypes && scope.orderTypes.length > 0) {
    if (!scope.orderTypes.includes(orderType)) {
      return {
        valid: false,
        error: "优惠券不适用于当前订单类型",
        errorCode: "SCOPE_MISMATCH",
      };
    }
  }

  // 检查最低金额
  if (scope.minOrderAmount && orderAmount < scope.minOrderAmount) {
    return {
      valid: false,
      error: `订单金额需满 ${(scope.minOrderAmount / 100).toFixed(2)} 元`,
      errorCode: "MIN_AMOUNT_NOT_MET",
    };
  }

  // 检查首单限制
  if (scope.firstOrderOnly && !isFirstOrder) {
    return {
      valid: false,
      error: "优惠券仅限首单使用",
      errorCode: "FIRST_ORDER_ONLY",
    };
  }

  // 检查新用户限制
  if (scope.newUserOnly && !isNewUser) {
    return {
      valid: false,
      error: "优惠券仅限新用户使用",
      errorCode: "NEW_USER_ONLY",
    };
  }

  // 检查商品限制
  if (itemId) {
    if (scope.planIds && scope.planIds.length > 0 && !scope.planIds.includes(itemId)) {
      return {
        valid: false,
        error: "优惠券不适用于当前订阅计划",
        errorCode: "SCOPE_MISMATCH",
      };
    }

    if (scope.skillIds && scope.skillIds.length > 0 && !scope.skillIds.includes(itemId)) {
      return {
        valid: false,
        error: "优惠券不适用于当前技能",
        errorCode: "SCOPE_MISMATCH",
      };
    }
  }

  // 7. 计算折扣
  const discountAmount = calculateDiscount(coupon, orderAmount);
  const finalPrice = Math.max(0, orderAmount - discountAmount);

  logger.info("[coupon] 优惠券验证通过", {
    code,
    userId,
    discountAmount,
    finalPrice,
  });

  return {
    valid: true,
    coupon,
    discountAmount,
    finalPrice,
  };
}

/**
 * 计算折扣金额
 */
export function calculateDiscount(coupon: Coupon, orderAmount: number): number {
  let discount = 0;

  switch (coupon.type) {
    case "percentage":
      // 百分比折扣
      discount = Math.floor(orderAmount * (coupon.value / 100));
      // 检查最大折扣限制
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      break;

    case "fixed":
      // 固定金额减免
      discount = coupon.value;
      break;

    case "trial":
      // 试用期 (不直接影响金额)
      discount = 0;
      break;

    case "free_month":
      // 免费月份 (按订单金额全额减免)
      discount = orderAmount;
      break;

    default:
      discount = 0;
  }

  // 确保折扣不超过订单金额
  return Math.min(discount, orderAmount);
}

/**
 * 使用优惠券
 */
export async function useCoupon(params: {
  couponId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
}): Promise<CouponUsage | null> {
  const { couponId, userId, orderId, discountAmount } = params;

  const coupon = coupons.get(couponId);
  if (!coupon) {
    logger.error("[coupon] 优惠券不存在", { couponId });
    return null;
  }

  // 更新使用次数
  coupon.usedCount += 1;
  coupon.updatedAt = new Date().toISOString();

  // 检查是否用尽
  if (coupon.totalCount !== -1 && coupon.usedCount >= coupon.totalCount) {
    coupon.status = "depleted";
  }

  coupons.set(couponId, coupon);

  // 记录使用
  const usage: CouponUsage = {
    id: uuidv4(),
    couponId,
    couponCode: coupon.code,
    userId,
    orderId,
    discountAmount,
    usedAt: new Date().toISOString(),
  };

  couponUsages.push(usage);

  logger.info("[coupon] 使用优惠券", {
    couponId,
    code: coupon.code,
    userId,
    orderId,
    discountAmount,
  });

  return usage;
}

/**
 * 获取用户优惠券使用记录
 */
export function getUserCouponUsages(userId: string): CouponUsage[] {
  return couponUsages.filter((u) => u.userId === userId);
}

/**
 * 获取优惠券使用记录
 */
export function getCouponUsages(couponId: string): CouponUsage[] {
  return couponUsages.filter((u) => u.couponId === couponId);
}

// ============================================================================
// 价格计算
// ============================================================================

/**
 * 计算最终价格
 */
export async function calculateFinalPrice(params: {
  originalPrice: number;
  currency: "CNY" | "USD";
  couponCode?: string;
  userId: string;
  orderType: OrderType;
  itemId?: string;
  isFirstOrder?: boolean;
  isNewUser?: boolean;
}): Promise<PriceInfo> {
  const {
    originalPrice,
    currency,
    couponCode,
    userId,
    orderType,
    itemId,
    isFirstOrder,
    isNewUser,
  } = params;

  let discountAmount = 0;
  let discountDescription: string | undefined;
  let appliedCouponCode: string | undefined;

  // 如果有优惠码，验证并计算折扣
  if (couponCode) {
    const validation = await validateCoupon(
      {
        code: couponCode,
        userId,
        orderType,
        orderAmount: originalPrice,
        itemId,
      },
      { isFirstOrder, isNewUser },
    );

    if (validation.valid && validation.discountAmount) {
      discountAmount = validation.discountAmount;
      appliedCouponCode = couponCode;

      if (validation.coupon) {
        discountDescription = `${validation.coupon.name}: `;
        if (validation.coupon.type === "percentage") {
          discountDescription += `${validation.coupon.value}% 折扣`;
        } else if (validation.coupon.type === "fixed") {
          discountDescription += `立减 ${(validation.coupon.value / 100).toFixed(2)} 元`;
        } else if (validation.coupon.type === "free_month") {
          discountDescription += "免费使用";
        }
      }
    }
  }

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    currency,
    couponCode: appliedCouponCode,
    discountDescription,
  };
}

// ============================================================================
// 批量生成优惠码
// ============================================================================

/**
 * 生成随机优惠码
 */
export function generateCouponCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 批量生成优惠券
 */
export function batchCreateCoupons(params: {
  count: number;
  prefix?: string;
  name: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  scope?: CouponScope;
  perUserLimit?: number;
  endTime: string;
}): Coupon[] {
  const { count, prefix = "", ...rest } = params;
  const coupons: Coupon[] = [];

  for (let i = 0; i < count; i++) {
    let code: string;
    let attempts = 0;

    // 生成唯一优惠码
    do {
      code = prefix + generateCouponCode(8);
      attempts++;
    } while (couponsByCode.has(code) && attempts < 100);

    if (attempts >= 100) {
      throw new Error("无法生成唯一优惠码");
    }

    const coupon = createCoupon({
      code,
      totalCount: 1,
      ...rest,
    });

    coupons.push(coupon);
  }

  logger.info("[coupon] 批量生成优惠券", {
    count,
    prefix,
    type: params.type,
    value: params.value,
  });

  return coupons;
}

// ============================================================================
// 初始化默认优惠券 (开发测试用)
// ============================================================================

/**
 * 初始化测试优惠券
 */
export function initTestCoupons(): void {
  // 新用户首月 5 折
  createCoupon({
    code: "NEWUSER50",
    name: "新用户专享",
    description: "新用户首月订阅 5 折",
    type: "percentage",
    value: 50,
    scope: {
      orderTypes: ["subscription"],
      newUserOnly: true,
      firstOrderOnly: true,
    },
    totalCount: -1,
    perUserLimit: 1,
    endTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // 固定金额减免
  createCoupon({
    code: "SAVE10",
    name: "立减 10 元",
    description: "订单满 50 元立减 10 元",
    type: "fixed",
    value: 1000, // 10 元 = 1000 分
    scope: {
      minOrderAmount: 5000, // 50 元
    },
    totalCount: 1000,
    perUserLimit: 3,
    endTime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // 免费试用
  createCoupon({
    code: "FREETRIAL",
    name: "免费试用月",
    description: "专业版一个月免费试用",
    type: "free_month",
    value: 1,
    scope: {
      orderTypes: ["subscription"],
      planIds: ["pro"],
      newUserOnly: true,
    },
    totalCount: 100,
    perUserLimit: 1,
    endTime: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  });

  logger.info("[coupon] 初始化测试优惠券完成");
}
