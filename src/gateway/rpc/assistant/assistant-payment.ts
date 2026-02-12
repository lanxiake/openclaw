/**
 * 鏀粯 RPC 鏂规硶 - Payment RPC Methods
 *
 * 鎻愪緵鏀粯鐩稿叧鐨?Gateway RPC 鎺ュ彛锛? * - 璁㈠崟绠＄悊
 * - 鏀粯澶勭悊
 * - 閫€娆惧鐞? * - 浠锋牸鏌ヨ
 * - 浼樻儬鍒哥鐞? * - 鑷姩缁垂绠＄悊
 *
 * @author OpenClaw
 */

import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
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
  // 浼樻儬鍒?  createCoupon,
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
  // 鑷姩缁垂
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

// 鏃ュ織
const log = createSubsystemLogger("payment-rpc");

// ============================================================================
// 杈呭姪鍑芥暟
// ============================================================================

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * 楠岃瘉鏁板瓧鍙傛暟
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
 * 楠岃瘉甯冨皵鍙傛暟
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
// RPC 鏂规硶瀹氫箟
// ============================================================================

/**
 * 鏀粯 RPC 鏂规硶闆嗗悎
 */
export const paymentMethods: GatewayRequestHandlers = {
  /**
   * 鍒涘缓鏀粯璁㈠崟
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
      const message = error instanceof Error ? error.message : "鍒涘缓璁㈠崟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇璁㈠崟璇︽儏
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "璁㈠崟涓嶅瓨鍦?));
        return;
      }

      respond(true, { success: true, order }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇璁㈠崟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛璁㈠崟鍒楄〃
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
      const message = error instanceof Error ? error.message : "鑾峰彇璁㈠崟鍒楄〃澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鍙栨秷璁㈠崟
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
      const message = error instanceof Error ? error.message : "鍙栨秷璁㈠崟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鍙戣捣鏀粯
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
      const message = error instanceof Error ? error.message : "鍙戣捣鏀粯澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鏌ヨ鏀粯鐘舵€?   */
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
      const message = error instanceof Error ? error.message : "鏌ヨ澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 妯℃嫙鏀粯瀹屾垚 (浠呭紑鍙戞祴璇曠敤)
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
      const message = error instanceof Error ? error.message : "妯℃嫙鏀粯澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鐢宠閫€娆?   */
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
      const message = error instanceof Error ? error.message : "鍒涘缓閫€娆惧け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇閫€娆捐鎯?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "閫€娆句笉瀛樺湪"));
        return;
      }

      respond(true, { success: true, refund }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇閫€娆惧け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇璁㈠崟鐨勯€€娆惧垪琛?   */
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
      const message = error instanceof Error ? error.message : "鑾峰彇閫€娆惧垪琛ㄥけ璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 璁＄畻浠锋牸
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
      const message = error instanceof Error ? error.message : "璁＄畻浠锋牸澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇鍙敤鐨勬敮浠樻柟寮?   */
  "payment.getProviders": ({ respond }) => {
    log.info("RPC: payment.getProviders");
    const providers = getAvailableProviders();
    respond(true, { success: true, providers }, undefined);
  },

  /**
   * 鑾峰彇鏀粯閰嶇疆 (鍏紑閮ㄥ垎)
   */
  "payment.getConfig": ({ respond }) => {
    log.info("RPC: payment.getConfig");
    const config = getPaymentConfig();

    // 鍙繑鍥炲叕寮€淇℃伅锛屼笉杩斿洖瀵嗛挜
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
   * 蹇嵎璐拱璁㈤槄
   *
   * 涓€绔欏紡鍒涘缓璁㈠崟骞跺彂璧锋敮浠?   */
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

      // 1. 璁＄畻浠锋牸
      const price = await calculatePrice({
        type: "subscription",
        itemId: planId,
        billingPeriod,
        couponCode,
      });

      if (price.finalPrice === 0) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "鍏嶈垂璁″垝鏃犻渶璐拱"));
        return;
      }

      // 2. 鍒涘缓璁㈠崟
      const order = await createOrder({
        userId,
        type: "subscription",
        amount: price.finalPrice,
        currency: price.currency,
        description: `璁㈤槄 ${planId} (${billingPeriod === "yearly" ? "骞翠粯" : "鏈堜粯"})`,
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

      // 3. 鍙戣捣鏀粯
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
      const message = error instanceof Error ? error.message : "璐拱澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  // ==========================================================================
  // 浼樻儬鍒哥鐞?  // ==========================================================================

  /**
   * 鍒涘缓浼樻儬鍒?   */
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
      const message = error instanceof Error ? error.message : "鍒涘缓浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇浼樻儬鍒歌鎯?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "浼樻儬鍒镐笉瀛樺湪"));
        return;
      }

      respond(true, { success: true, coupon }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鏇存柊浼樻儬鍒?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "浼樻儬鍒镐笉瀛樺湪"));
        return;
      }

      respond(true, { success: true, coupon }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鏇存柊浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 绂佺敤浼樻儬鍒?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "浼樻儬鍒镐笉瀛樺湪"));
        return;
      }

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "绂佺敤浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇浼樻儬鍒稿垪琛?   */
  "payment.coupon.list": async ({ params, respond }) => {
    try {
      log.info("RPC: payment.coupon.list");

      const coupons = listCoupons({
        status: validateStringParam(params, "status") as CouponStatus | undefined,
        type: validateStringParam(params, "type") as CouponType | undefined,
      });

      respond(true, { success: true, coupons }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇浼樻儬鍒稿垪琛ㄥけ璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 楠岃瘉浼樻儬鍒?   */
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
      const message = error instanceof Error ? error.message : "楠岃瘉浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 浣跨敤浼樻儬鍒?   */
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "浣跨敤浼樻儬鍒稿け璐?));
        return;
      }

      respond(true, { success: true, usage }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "浣跨敤浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛浼樻儬鍒镐娇鐢ㄨ褰?   */
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
      const message = error instanceof Error ? error.message : "鑾峰彇浣跨敤璁板綍澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鎵归噺鐢熸垚浼樻儬鍒?   */
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
      const message = error instanceof Error ? error.message : "鎵归噺鐢熸垚浼樻儬鍒稿け璐?;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 璁＄畻鏈€缁堜环鏍硷紙鍚紭鎯犲埜锛?   */
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
      const message = error instanceof Error ? error.message : "璁＄畻浠锋牸澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  // ==========================================================================
  // 鑷姩缁垂绠＄悊
  // ==========================================================================

  /**
   * 鑾峰彇缁垂浠诲姟鍒楄〃
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
      const message = error instanceof Error ? error.message : "鑾峰彇缁垂浠诲姟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇缁垂浠诲姟璇︽儏
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缁垂浠诲姟涓嶅瓨鍦?));
        return;
      }

      respond(true, { success: true, task }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇缁垂浠诲姟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鎵嬪姩瑙﹀彂缁垂
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
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "瑙﹀彂缁垂澶辫触"));
        return;
      }

      respond(true, { success: true, task }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "瑙﹀彂缁垂澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鍙栨秷缁垂浠诲姟
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "鍙栨秷浠诲姟澶辫触"));
        return;
      }

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鍙栨秷浠诲姟澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鍚姩鑷姩缁垂鏈嶅姟
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
      const message = error instanceof Error ? error.message : "鍚姩鑷姩缁垂澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鍋滄鑷姩缁垂鏈嶅姟
   */
  "payment.renewal.stop": async ({ respond }) => {
    try {
      log.info("RPC: payment.renewal.stop");

      stopAutoRenewal();

      respond(true, { success: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鍋滄鑷姩缁垂澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鑾峰彇缁垂閰嶇疆
   */
  "payment.renewal.getConfig": async ({ respond }) => {
    try {
      log.info("RPC: payment.renewal.getConfig");

      const scheduler = getRenewalScheduler();
      const config = scheduler.getConfig();

      respond(true, { success: true, config }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "鑾峰彇缁垂閰嶇疆澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * 鏇存柊缁垂閰嶇疆
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
      const message = error instanceof Error ? error.message : "鏇存柊缁垂閰嶇疆澶辫触";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },
};

/**
 * 鑾峰彇鎵€鏈夋敮浠?RPC 鏂规硶鍚? */
export function getPaymentMethodNames(): string[] {
  return Object.keys(paymentMethods);
}
