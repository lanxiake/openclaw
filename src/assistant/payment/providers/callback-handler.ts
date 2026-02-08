/**
 * 支付回调处理器 - Payment Callback Handler
 *
 * 统一处理各支付渠道的回调通知：
 * - 微信支付回调
 * - 支付宝回调
 * - Stripe Webhook
 *
 * 核心职责：
 * - 验证回调签名
 * - 解析回调数据
 * - 更新订单状态
 * - 触发业务事件
 *
 * @author OpenClaw
 */

import { v4 as uuidv4 } from "uuid";
import { getLogger } from "../../../logging/logger.js";
import type {
  PaymentProvider,
  PaymentEvent,
  PaymentEventType,
  PaymentOrder,
  OrderStatus,
  TransactionStatus,
} from "../types.js";
import {
  handleWechatPayNotification,
  type WechatPayNotification,
  type WechatPayResult,
} from "./wechat-pay.js";
import {
  handleAlipayNotification,
} from "./alipay.js";

const logger = getLogger();

// ============================================================================
// 回调事件处理器
// ============================================================================

/**
 * 支付事件处理器类型
 */
export type PaymentEventHandler = (event: PaymentEvent) => Promise<void>;

/**
 * 事件处理器注册表
 */
const eventHandlers: Map<PaymentEventType | "*", Set<PaymentEventHandler>> = new Map();

/**
 * 注册支付事件处理器
 *
 * @param eventType - 事件类型，* 表示所有事件
 * @param handler - 处理器函数
 */
export function registerPaymentEventHandler(
  eventType: PaymentEventType | "*",
  handler: PaymentEventHandler
): void {
  let handlers = eventHandlers.get(eventType);
  if (!handlers) {
    handlers = new Set();
    eventHandlers.set(eventType, handlers);
  }
  handlers.add(handler);

  logger.debug("[callback] 注册支付事件处理器", { eventType });
}

/**
 * 注销支付事件处理器
 */
export function unregisterPaymentEventHandler(
  eventType: PaymentEventType | "*",
  handler: PaymentEventHandler
): void {
  const handlers = eventHandlers.get(eventType);
  if (handlers) {
    handlers.delete(handler);
    logger.debug("[callback] 注销支付事件处理器", { eventType });
  }
}

/**
 * 触发支付事件
 */
async function emitPaymentEvent(event: PaymentEvent): Promise<void> {
  logger.info("[callback] 触发支付事件", {
    eventId: event.id,
    type: event.type,
    orderId: event.orderId,
    provider: event.provider,
  });

  // 获取特定事件类型的处理器
  const specificHandlers = eventHandlers.get(event.type) || new Set();
  // 获取通配符处理器
  const wildcardHandlers = eventHandlers.get("*") || new Set();

  // 合并处理器
  const allHandlers = new Set([...specificHandlers, ...wildcardHandlers]);

  // 并行执行所有处理器
  const promises = Array.from(allHandlers).map(async (handler) => {
    try {
      await handler(event);
    } catch (error) {
      logger.error("[callback] 事件处理器执行失败", {
        eventId: event.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  await Promise.all(promises);
}

// ============================================================================
// 订单状态更新回调
// ============================================================================

/**
 * 订单更新函数类型
 */
export type OrderUpdateCallback = (
  orderId: string,
  status: OrderStatus,
  externalOrderId?: string,
  paidAt?: string
) => Promise<PaymentOrder | null>;

/**
 * 交易记录函数类型
 */
export type TransactionRecordCallback = (params: {
  orderId: string;
  userId: string;
  type: "payment" | "refund";
  status: TransactionStatus;
  amount: number;
  currency: "CNY" | "USD";
  provider: PaymentProvider;
  externalTransactionId?: string;
  failureReason?: string;
}) => Promise<void>;

// 存储回调
let orderUpdateCallback: OrderUpdateCallback | null = null;
let transactionRecordCallback: TransactionRecordCallback | null = null;

/**
 * 设置订单更新回调
 */
export function setOrderUpdateCallback(callback: OrderUpdateCallback): void {
  orderUpdateCallback = callback;
  logger.debug("[callback] 设置订单更新回调");
}

/**
 * 设置交易记录回调
 */
export function setTransactionRecordCallback(callback: TransactionRecordCallback): void {
  transactionRecordCallback = callback;
  logger.debug("[callback] 设置交易记录回调");
}

// ============================================================================
// 微信支付回调处理
// ============================================================================

/**
 * 微信支付回调请求
 */
export interface WechatCallbackRequest {
  /** 请求体 */
  body: WechatPayNotification;
  /** 请求头 */
  headers: {
    /** 时间戳 */
    timestamp: string;
    /** 随机串 */
    nonce: string;
    /** 签名 */
    signature: string;
    /** 证书序列号 */
    serial: string;
  };
  /** 原始请求体 */
  rawBody: string;
}

/**
 * 处理微信支付回调
 */
export async function processWechatCallback(
  request: WechatCallbackRequest
): Promise<{
  success: boolean;
  message?: string;
}> {
  logger.info("[callback] 处理微信支付回调", {
    notifyId: request.body.id,
    eventType: request.body.event_type,
  });

  try {
    // 1. 验证并解密回调数据
    const result = await handleWechatPayNotification(
      request.body,
      request.headers,
      request.rawBody
    );

    if (!result.success || !result.result) {
      logger.error("[callback] 微信回调验证失败", { error: result.error });
      return { success: false, message: result.error };
    }

    const payResult = result.result;

    // 2. 根据交易状态处理
    if (payResult.trade_state === "SUCCESS") {
      await handlePaymentSuccess(
        "wechat",
        payResult.out_trade_no,
        payResult.transaction_id,
        payResult.success_time,
        payResult.amount.total,
        {
          tradeType: payResult.trade_type,
          bankType: payResult.bank_type,
          payerOpenid: payResult.payer.openid,
        }
      );
    } else if (payResult.trade_state === "CLOSED" || payResult.trade_state === "REVOKED") {
      await handlePaymentFailed(
        "wechat",
        payResult.out_trade_no,
        payResult.trade_state_desc
      );
    } else if (payResult.trade_state === "REFUND") {
      // 退款通知单独处理
      await handleRefundSuccess(
        "wechat",
        payResult.out_trade_no,
        payResult.transaction_id,
        payResult.amount.total
      );
    }

    return { success: true };
  } catch (error) {
    logger.error("[callback] 处理微信回调异常", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : "处理失败",
    };
  }
}

// ============================================================================
// 支付宝回调处理
// ============================================================================

/**
 * 处理支付宝回调
 */
export async function processAlipayCallback(
  params: Record<string, string>
): Promise<{
  success: boolean;
  message?: string;
}> {
  logger.info("[callback] 处理支付宝回调", {
    notifyId: params.notify_id,
    tradeNo: params.trade_no,
    tradeStatus: params.trade_status,
  });

  try {
    // 1. 验证回调签名
    const result = await handleAlipayNotification(params);

    if (!result.success || !result.result) {
      logger.error("[callback] 支付宝回调验证失败", { error: result.error });
      return { success: false, message: result.error };
    }

    const { orderId, tradeNo, tradeStatus, totalAmount, buyerId } = result.result;

    // 2. 根据交易状态处理
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      await handlePaymentSuccess(
        "alipay",
        orderId,
        tradeNo,
        params.gmt_payment || new Date().toISOString(),
        Math.round(parseFloat(totalAmount) * 100), // 元转分
        {
          buyerId,
          sellerEmail: params.seller_email,
        }
      );
    } else if (tradeStatus === "TRADE_CLOSED") {
      await handlePaymentFailed("alipay", orderId, "交易已关闭");
    }

    return { success: true };
  } catch (error) {
    logger.error("[callback] 处理支付宝回调异常", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : "处理失败",
    };
  }
}

// ============================================================================
// 通用处理函数
// ============================================================================

/**
 * 处理支付成功
 */
async function handlePaymentSuccess(
  provider: PaymentProvider,
  orderId: string,
  externalOrderId: string,
  paidAt: string,
  amount: number,
  extra?: Record<string, unknown>
): Promise<void> {
  logger.info("[callback] 处理支付成功", {
    provider,
    orderId,
    externalOrderId,
    amount,
  });

  // 1. 更新订单状态
  let order: PaymentOrder | null = null;
  if (orderUpdateCallback) {
    order = await orderUpdateCallback(orderId, "paid", externalOrderId, paidAt);
  }

  // 2. 记录交易
  if (transactionRecordCallback && order) {
    await transactionRecordCallback({
      orderId,
      userId: order.userId,
      type: "payment",
      status: "success",
      amount,
      currency: order.currency,
      provider,
      externalTransactionId: externalOrderId,
    });
  }

  // 3. 触发事件
  await emitPaymentEvent({
    id: uuidv4(),
    type: "payment.success",
    provider,
    orderId,
    userId: order?.userId || "",
    data: {
      externalOrderId,
      paidAt,
      amount,
      ...extra,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * 处理支付失败
 */
async function handlePaymentFailed(
  provider: PaymentProvider,
  orderId: string,
  reason: string
): Promise<void> {
  logger.info("[callback] 处理支付失败", {
    provider,
    orderId,
    reason,
  });

  // 1. 更新订单状态
  let order: PaymentOrder | null = null;
  if (orderUpdateCallback) {
    order = await orderUpdateCallback(orderId, "failed");
  }

  // 2. 记录交易
  if (transactionRecordCallback && order) {
    await transactionRecordCallback({
      orderId,
      userId: order.userId,
      type: "payment",
      status: "failed",
      amount: order.amount,
      currency: order.currency,
      provider,
      failureReason: reason,
    });
  }

  // 3. 触发事件
  await emitPaymentEvent({
    id: uuidv4(),
    type: "payment.failed",
    provider,
    orderId,
    userId: order?.userId || "",
    data: {
      reason,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * 处理退款成功
 */
async function handleRefundSuccess(
  provider: PaymentProvider,
  orderId: string,
  refundId: string,
  refundAmount: number
): Promise<void> {
  logger.info("[callback] 处理退款成功", {
    provider,
    orderId,
    refundId,
    refundAmount,
  });

  // 1. 更新订单状态 (部分退款或全额退款)
  let order: PaymentOrder | null = null;
  if (orderUpdateCallback) {
    // 这里需要根据退款金额判断是部分退款还是全额退款
    // 简化处理：假设是全额退款
    order = await orderUpdateCallback(orderId, "refunded");
  }

  // 2. 记录交易
  if (transactionRecordCallback && order) {
    await transactionRecordCallback({
      orderId,
      userId: order.userId,
      type: "refund",
      status: "success",
      amount: refundAmount,
      currency: order.currency,
      provider,
      externalTransactionId: refundId,
    });
  }

  // 3. 触发事件
  await emitPaymentEvent({
    id: uuidv4(),
    type: "refund.success",
    provider,
    orderId,
    userId: order?.userId || "",
    data: {
      refundId,
      refundAmount,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * 处理退款失败
 */
async function handleRefundFailed(
  provider: PaymentProvider,
  orderId: string,
  reason: string
): Promise<void> {
  logger.info("[callback] 处理退款失败", {
    provider,
    orderId,
    reason,
  });

  // 获取订单信息用于事件
  let userId = "";

  // 触发事件
  await emitPaymentEvent({
    id: uuidv4(),
    type: "refund.failed",
    provider,
    orderId,
    userId,
    data: {
      reason,
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// 订阅续费处理
// ============================================================================

/**
 * 处理订阅续费成功
 */
export async function handleSubscriptionRenewed(
  provider: PaymentProvider,
  orderId: string,
  subscriptionId: string,
  amount: number,
  nextBillingDate: string
): Promise<void> {
  logger.info("[callback] 处理订阅续费成功", {
    provider,
    orderId,
    subscriptionId,
    amount,
    nextBillingDate,
  });

  // 触发事件
  await emitPaymentEvent({
    id: uuidv4(),
    type: "subscription.renewed",
    provider,
    orderId,
    userId: "", // 需要从订阅中获取
    data: {
      subscriptionId,
      amount,
      nextBillingDate,
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// 导出
// ============================================================================

export {
  emitPaymentEvent,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleRefundSuccess,
  handleRefundFailed,
};
