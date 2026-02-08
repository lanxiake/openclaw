/**
 * 支付 RPC 方法 - Payment RPC Methods
 *
 * 提供支付相关的 Gateway RPC 接口：
 * - 订单管理
 * - 支付处理
 * - 退款处理
 * - 价格查询
 * - 优惠券管理
 * - 自动续费管理
 *
 * @author OpenClaw
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  createOrder,
  getOrder,
  getUserOrders,
  cancelOrder,
  initiatePayment,
  queryPaymentStatus,
  mockPaymentComplete,
  createRefund,
  getRefund,
  getOrderRefunds,
  calculatePrice,
  getPaymentConfig,
  getAvailableProviders,
  // 优惠券
  createCoupon,
  getCoupon,
  getCouponByCode,
  updateCoupon,
  disableCoupon,
  listCoupons,
  validateCoupon,
  useCoupon,
  getUserCouponUsages,
  batchCreateCoupons,
  calculateFinalPrice,
  // 自动续费
  getRenewalScheduler,
  startAutoRenewal,
  stopAutoRenewal,
} from "../../assistant/payment/index.js";
import type {
  OrderQueryParams,
  PaymentProvider,
  CouponType,
  CouponStatus,
  CouponScope,
  OrderType,
} from "../../assistant/payment/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// 日志
const log = createSubsystemLogger("payment-rpc");

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证字符串参数
 */
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
 * 验证数字参数
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

/**
 * 验证布尔参数
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

// ============================================================================
// RPC 方法定义
// ============================================================================

/**
 * 支付 RPC 方法集合
 */
export const paymentMethods: GatewayRequestHandlers = {
  /**
   * 创建支付订单
   */
  "payment.createOrder": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId", true);
      const type = validateStringParam(params, "type", true) as "subscription" | "skill" | "addon";
      const amount = validateNumberParam(params, "amount", true);
      const currency = (validateStringParam(params, "currency") ?? "CNY") as "CNY" | "USD";
      const description = validateStringParam(params, "description") ?? "";
      const referenceId = validateStringParam(params, "referenceId");
      const referenceType = validateStringParam(params, "referenceType");
      const provider = validateStringParam(params, "provider") as PaymentProvider | undefined;

      if (!userId || !type || amount === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.createOrder", { userId, type });

      const order = await createOrder({
        userId,
        type,
        amount,
        currency,
        description,
        referenceId,
        referenceType,
        provider,
        metadata: params.metadata as Record<string, unknown> | undefined,
      });

      respond(true, { success: true, order }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建订单失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取订单详情
   */
  "payment.getOrder": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.getOrder", { orderId });

      const order = await getOrder(orderId);
      if (!order) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "订单不存在"));
        return;
      }

      respond(true, { success: true, order }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取订单失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取用户订单列表
   */
  "payment.getUserOrders": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing userId"));
        return;
      }

      log.info("RPC: payment.getUserOrders", { userId });

      const queryParams: OrderQueryParams = {
        status: validateStringParam(params, "status") as OrderQueryParams["status"],
        type: validateStringParam(params, "type") as OrderQueryParams["type"],
        page: validateNumberParam(params, "page"),
        limit: validateNumberParam(params, "limit"),
      };

      const result = await getUserOrders(userId, queryParams);
      respond(true, { success: true, ...result }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取订单列表失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 取消订单
   */
  "payment.cancelOrder": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.cancelOrder", { orderId });

      const order = await cancelOrder(orderId);
      respond(true, { success: true, order }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "取消订单失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 发起支付
   */
  "payment.initiatePayment": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);
      const provider = validateStringParam(params, "provider", true) as PaymentProvider;

      if (!orderId || !provider) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.initiatePayment", { orderId, provider });

      const result = await initiatePayment({
        orderId,
        provider,
        returnUrl: validateStringParam(params, "returnUrl"),
      });

      respond(true, result, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "发起支付失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 查询支付状态
   */
  "payment.queryStatus": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.queryStatus", { orderId });

      const status = await queryPaymentStatus(orderId);
      respond(true, { success: true, ...status }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "查询失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 模拟支付完成 (仅开发测试用)
   */
  "payment.mockComplete": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);
      const success = validateBooleanParam(params, "success") ?? true;

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.mockComplete", { orderId, success });

      const order = await mockPaymentComplete(orderId, success);
      respond(true, { success: true, order }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "模拟支付失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 申请退款
   */
  "payment.createRefund": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);
      const reason = validateStringParam(params, "reason");
      const amount = validateNumberParam(params, "amount");

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.createRefund", { orderId });

      const refund = await createRefund({
        orderId,
        reason:
          (reason as
            | "requested_by_customer"
            | "duplicate"
            | "fraudulent"
            | "subscription_canceled"
            | "other") ?? "requested_by_customer",
        amount,
      });

      respond(true, { success: true, refund }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建退款失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取退款详情
   */
  "payment.getRefund": async ({ params, respond }) => {
    try {
      const refundId = validateStringParam(params, "refundId", true);

      if (!refundId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing refundId"));
        return;
      }

      log.info("RPC: payment.getRefund", { refundId });

      const refund = await getRefund(refundId);
      if (!refund) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "退款不存在"));
        return;
      }

      respond(true, { success: true, refund }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取退款失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取订单的退款列表
   */
  "payment.getOrderRefunds": async ({ params, respond }) => {
    try {
      const orderId = validateStringParam(params, "orderId", true);

      if (!orderId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing orderId"));
        return;
      }

      log.info("RPC: payment.getOrderRefunds", { orderId });

      const refunds = await getOrderRefunds(orderId);
      respond(true, { success: true, refunds }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取退款列表失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 计算价格
   */
  "payment.calculatePrice": async ({ params, respond }) => {
    try {
      const type = validateStringParam(params, "type", true) as "subscription" | "skill" | "addon";
      const itemId = validateStringParam(params, "itemId", true);
      const billingPeriod = validateStringParam(params, "billingPeriod") as
        | "monthly"
        | "yearly"
        | undefined;
      const couponCode = validateStringParam(params, "couponCode");

      if (!type || !itemId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.calculatePrice", { type, itemId });

      const price = await calculatePrice({
        type,
        itemId,
        billingPeriod,
        couponCode,
      });

      respond(true, { success: true, price }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "计算价格失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取可用的支付方式
   */
  "payment.getProviders": ({ respond }) => {
    log.info("RPC: payment.getProviders");
    const providers = getAvailableProviders();
    respond(true, { success: true, providers }, undefined);
  },

  /**
   * 获取支付配置 (公开部分)
   */
  "payment.getConfig": ({ respond }) => {
    log.info("RPC: payment.getConfig");
    const config = getPaymentConfig();

    // 只返回公开信息，不返回密钥
    const providers: Record<string, { enabled: boolean; sandbox?: boolean }> = {};
    for (const [key, value] of Object.entries(config.providers)) {
      if (value?.enabled) {
        providers[key] = { enabled: true, sandbox: value.sandbox };
      }
    }

    respond(
      true,
      {
        success: true,
        config: {
          defaultCurrency: config.defaultCurrency,
          orderExpiryMinutes: config.orderExpiryMinutes,
          providers,
        },
      },
      undefined,
    );
  },

  /**
   * 快捷购买订阅
   *
   * 一站式创建订单并发起支付
   */
  "payment.purchaseSubscription": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId", true);
      const planId = validateStringParam(params, "planId", true);
      const billingPeriod = (validateStringParam(params, "billingPeriod") ?? "monthly") as
        | "monthly"
        | "yearly";
      const provider = validateStringParam(params, "provider", true) as PaymentProvider;
      const couponCode = validateStringParam(params, "couponCode");

      if (!userId || !planId || !provider) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.purchaseSubscription", { userId, planId });

      // 1. 计算价格
      const price = await calculatePrice({
        type: "subscription",
        itemId: planId,
        billingPeriod,
        couponCode,
      });

      if (price.finalPrice === 0) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "免费计划无需购买"));
        return;
      }

      // 2. 创建订单
      const order = await createOrder({
        userId,
        type: "subscription",
        amount: price.finalPrice,
        currency: price.currency,
        description: `订阅 ${planId} (${billingPeriod === "yearly" ? "年付" : "月付"})`,
        referenceId: planId,
        referenceType: "subscription_plan",
        provider,
        metadata: {
          planId,
          billingPeriod,
          couponCode,
          priceInfo: price,
        },
      });

      // 3. 发起支付
      const paymentResult = await initiatePayment({
        orderId: order.id,
        provider,
      });

      respond(
        true,
        {
          success: true,
          order,
          price,
          payment: paymentResult,
        },
        undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "购买失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  // ==========================================================================
  // 优惠券管理
  // ==========================================================================

  /**
   * 创建优惠券
   */
  "payment.coupon.create": async ({ params, respond }) => {
    try {
      const code = validateStringParam(params, "code", true);
      const name = validateStringParam(params, "name", true);
      const type = validateStringParam(params, "type", true) as CouponType;
      const value = validateNumberParam(params, "value", true);
      const endTime = validateStringParam(params, "endTime", true);

      if (!code || !name || !type || value === undefined || !endTime) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.coupon.create", { code, type, value });

      const coupon = createCoupon({
        code,
        name,
        description: validateStringParam(params, "description"),
        type,
        value,
        maxDiscount: validateNumberParam(params, "maxDiscount"),
        scope: params.scope as CouponScope | undefined,
        totalCount: validateNumberParam(params, "totalCount"),
        perUserLimit: validateNumberParam(params, "perUserLimit"),
        startTime: validateStringParam(params, "startTime"),
        endTime,
      });

      respond(true, { success: true, coupon }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取优惠券详情
   */
  "payment.coupon.get": async ({ params, respond }) => {
    try {
      const id = validateStringParam(params, "id");
      const code = validateStringParam(params, "code");

      if (!id && !code) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing id or code"));
        return;
      }

      log.info("RPC: payment.coupon.get", { id, code });

      const coupon = id ? getCoupon(id) : getCouponByCode(code!);
      if (!coupon) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "优惠券不存在"));
        return;
      }

      respond(true, { success: true, coupon }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 更新优惠券
   */
  "payment.coupon.update": async ({ params, respond }) => {
    try {
      const id = validateStringParam(params, "id", true);

      if (!id) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing id"));
        return;
      }

      log.info("RPC: payment.coupon.update", { id });

      const coupon = updateCoupon(id, {
        name: validateStringParam(params, "name"),
        description: validateStringParam(params, "description"),
        status: validateStringParam(params, "status") as CouponStatus | undefined,
        scope: params.scope as CouponScope | undefined,
        totalCount: validateNumberParam(params, "totalCount"),
        perUserLimit: validateNumberParam(params, "perUserLimit"),
        endTime: validateStringParam(params, "endTime"),
      });

      if (!coupon) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "优惠券不存在"));
        return;
      }

      respond(true, { success: true, coupon }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 禁用优惠券
   */
  "payment.coupon.disable": async ({ params, respond }) => {
    try {
      const id = validateStringParam(params, "id", true);

      if (!id) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing id"));
        return;
      }

      log.info("RPC: payment.coupon.disable", { id });

      const success = disableCoupon(id);
      if (!success) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "优惠券不存在"));
        return;
      }

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "禁用优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取优惠券列表
   */
  "payment.coupon.list": async ({ params, respond }) => {
    try {
      log.info("RPC: payment.coupon.list");

      const coupons = listCoupons({
        status: validateStringParam(params, "status") as CouponStatus | undefined,
        type: validateStringParam(params, "type") as CouponType | undefined,
      });

      respond(true, { success: true, coupons }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取优惠券列表失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 验证优惠券
   */
  "payment.coupon.validate": async ({ params, respond }) => {
    try {
      const code = validateStringParam(params, "code", true);
      const userId = validateStringParam(params, "userId", true);
      const orderType = validateStringParam(params, "orderType", true) as OrderType;
      const orderAmount = validateNumberParam(params, "orderAmount", true);

      if (!code || !userId || !orderType || orderAmount === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.coupon.validate", { code, userId, orderType });

      const result = await validateCoupon(
        {
          code,
          userId,
          orderType,
          orderAmount,
          itemId: validateStringParam(params, "itemId"),
        },
        {
          isFirstOrder: validateBooleanParam(params, "isFirstOrder"),
          isNewUser: validateBooleanParam(params, "isNewUser"),
        },
      );

      respond(true, { success: true, ...result }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "验证优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 使用优惠券
   */
  "payment.coupon.use": async ({ params, respond }) => {
    try {
      const couponId = validateStringParam(params, "couponId", true);
      const userId = validateStringParam(params, "userId", true);
      const orderId = validateStringParam(params, "orderId", true);
      const discountAmount = validateNumberParam(params, "discountAmount", true);

      if (!couponId || !userId || !orderId || discountAmount === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.coupon.use", { couponId, userId, orderId });

      const usage = await useCoupon({
        couponId,
        userId,
        orderId,
        discountAmount,
      });

      if (!usage) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "使用优惠券失败"));
        return;
      }

      respond(true, { success: true, usage }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "使用优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取用户优惠券使用记录
   */
  "payment.coupon.userUsages": async ({ params, respond }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing userId"));
        return;
      }

      log.info("RPC: payment.coupon.userUsages", { userId });

      const usages = getUserCouponUsages(userId);
      respond(true, { success: true, usages }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取使用记录失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 批量生成优惠券
   */
  "payment.coupon.batchCreate": async ({ params, respond }) => {
    try {
      const count = validateNumberParam(params, "count", true);
      const name = validateStringParam(params, "name", true);
      const type = validateStringParam(params, "type", true) as CouponType;
      const value = validateNumberParam(params, "value", true);
      const endTime = validateStringParam(params, "endTime", true);

      if (!count || !name || !type || value === undefined || !endTime) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.coupon.batchCreate", { count, type, value });

      const coupons = batchCreateCoupons({
        count,
        prefix: validateStringParam(params, "prefix"),
        name,
        description: validateStringParam(params, "description"),
        type,
        value,
        maxDiscount: validateNumberParam(params, "maxDiscount"),
        scope: params.scope as CouponScope | undefined,
        perUserLimit: validateNumberParam(params, "perUserLimit"),
        endTime,
      });

      respond(true, { success: true, count: coupons.length, coupons }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量生成优惠券失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 计算最终价格（含优惠券）
   */
  "payment.coupon.calculateFinalPrice": async ({ params, respond }) => {
    try {
      const originalPrice = validateNumberParam(params, "originalPrice", true);
      const currency = (validateStringParam(params, "currency") ?? "CNY") as "CNY" | "USD";
      const userId = validateStringParam(params, "userId", true);
      const orderType = validateStringParam(params, "orderType", true) as OrderType;

      if (originalPrice === undefined || !userId || !orderType) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      log.info("RPC: payment.coupon.calculateFinalPrice", { userId, orderType, originalPrice });

      const priceInfo = await calculateFinalPrice({
        originalPrice,
        currency,
        couponCode: validateStringParam(params, "couponCode"),
        userId,
        orderType,
        itemId: validateStringParam(params, "itemId"),
        isFirstOrder: validateBooleanParam(params, "isFirstOrder"),
        isNewUser: validateBooleanParam(params, "isNewUser"),
      });

      respond(true, { success: true, priceInfo }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "计算价格失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  // ==========================================================================
  // 自动续费管理
  // ==========================================================================

  /**
   * 获取续费任务列表
   */
  "payment.renewal.getTasks": async ({ params, respond }) => {
    try {
      log.info("RPC: payment.renewal.getTasks");

      const scheduler = getRenewalScheduler();
      const tasks = scheduler.getTasks({
        status: validateStringParam(params, "status") as
          | "pending"
          | "processing"
          | "success"
          | "failed"
          | "retrying"
          | undefined,
        userId: validateStringParam(params, "userId"),
        subscriptionId: validateStringParam(params, "subscriptionId"),
      });

      respond(true, { success: true, tasks }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取续费任务失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取续费任务详情
   */
  "payment.renewal.getTask": async ({ params, respond }) => {
    try {
      const taskId = validateStringParam(params, "taskId", true);

      if (!taskId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing taskId"));
        return;
      }

      log.info("RPC: payment.renewal.getTask", { taskId });

      const scheduler = getRenewalScheduler();
      const task = scheduler.getTask(taskId);

      if (!task) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "续费任务不存在"));
        return;
      }

      respond(true, { success: true, task }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取续费任务失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 手动触发续费
   */
  "payment.renewal.trigger": async ({ params, respond }) => {
    try {
      const subscriptionId = validateStringParam(params, "subscriptionId", true);

      if (!subscriptionId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing subscriptionId"));
        return;
      }

      log.info("RPC: payment.renewal.trigger", { subscriptionId });

      const scheduler = getRenewalScheduler();
      const task = await scheduler.triggerRenewal(subscriptionId);

      if (!task) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "触发续费失败"));
        return;
      }

      respond(true, { success: true, task }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "触发续费失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 取消续费任务
   */
  "payment.renewal.cancelTask": async ({ params, respond }) => {
    try {
      const taskId = validateStringParam(params, "taskId", true);

      if (!taskId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing taskId"));
        return;
      }

      log.info("RPC: payment.renewal.cancelTask", { taskId });

      const scheduler = getRenewalScheduler();
      const success = scheduler.cancelTask(taskId);

      if (!success) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "取消任务失败"));
        return;
      }

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "取消任务失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 启动自动续费服务
   */
  "payment.renewal.start": async ({ params, respond }) => {
    try {
      log.info("RPC: payment.renewal.start");

      startAutoRenewal({
        enabled: true,
        checkIntervalMs: validateNumberParam(params, "checkIntervalMs"),
        renewalAdvanceDays: validateNumberParam(params, "renewalAdvanceDays"),
        maxRetries: validateNumberParam(params, "maxRetries"),
      });

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动自动续费失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 停止自动续费服务
   */
  "payment.renewal.stop": async ({ respond }) => {
    try {
      log.info("RPC: payment.renewal.stop");

      stopAutoRenewal();

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "停止自动续费失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 获取续费配置
   */
  "payment.renewal.getConfig": async ({ respond }) => {
    try {
      log.info("RPC: payment.renewal.getConfig");

      const scheduler = getRenewalScheduler();
      const config = scheduler.getConfig();

      respond(true, { success: true, config }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取续费配置失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 更新续费配置
   */
  "payment.renewal.updateConfig": async ({ params, respond }) => {
    try {
      log.info("RPC: payment.renewal.updateConfig");

      const scheduler = getRenewalScheduler();
      scheduler.updateConfig({
        enabled: validateBooleanParam(params, "enabled"),
        checkIntervalMs: validateNumberParam(params, "checkIntervalMs"),
        renewalAdvanceDays: validateNumberParam(params, "renewalAdvanceDays"),
        maxRetries: validateNumberParam(params, "maxRetries"),
      });

      const config = scheduler.getConfig();
      respond(true, { success: true, config }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新续费配置失败";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },
};

/**
 * 获取所有支付 RPC 方法名
 */
export function getPaymentMethodNames(): string[] {
  return Object.keys(paymentMethods);
}
