/**
 * 支付服务 - Payment Service
 *
 * 提供支付系统的核心功能：
 * - 订单管理（创建、查询、取消）
 * - 支付处理（发起支付、查询状态）
 * - 退款处理
 * - 支付回调处理
 *
 * 支持多种支付提供商：
 * - 模拟支付 (开发测试)
 * - 支付宝 (预留)
 * - 微信支付 (预留)
 * - Stripe (预留)
 *
 * @author OpenClaw
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import type {
  PaymentProvider,
  PaymentOrder,
  OrderStatus,
  OrderType,
  Transaction,
  TransactionType,
  TransactionStatus,
  Refund,
  RefundStatus,
  RefundReason,
  PaymentEvent,
  PaymentConfig,
  CreateOrderRequest,
  CreateRefundRequest,
  OrderQueryParams,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  QueryPaymentResponse,
  PriceInfo,
  CalculatePriceRequest,
} from "./types.js";
import { DEFAULT_PAYMENT_CONFIG } from "./types.js";

// 日志
const log = createSubsystemLogger("payment");

// ============================================================================
// 存储路径配置
// ============================================================================

/**
 * 获取支付数据目录
 */
function getPaymentDataDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".openclaw", "payment");
}

/**
 * 获取订单文件路径
 */
function getOrdersFilePath(): string {
  return path.join(getPaymentDataDir(), "orders.json");
}

/**
 * 获取交易文件路径
 */
function getTransactionsFilePath(): string {
  return path.join(getPaymentDataDir(), "transactions.json");
}

/**
 * 获取退款文件路径
 */
function getRefundsFilePath(): string {
  return path.join(getPaymentDataDir(), "refunds.json");
}

/**
 * 获取事件日志文件路径
 */
function getEventsFilePath(): string {
  return path.join(getPaymentDataDir(), "events.jsonl");
}

// ============================================================================
// 数据存储
// ============================================================================

/**
 * 订单存储
 */
interface OrderStore {
  orders: Map<string, PaymentOrder>;
  userOrders: Map<string, string[]>; // userId -> orderIds
}

/**
 * 交易存储
 */
interface TransactionStore {
  transactions: Map<string, Transaction>;
  orderTransactions: Map<string, string[]>; // orderId -> transactionIds
}

/**
 * 退款存储
 */
interface RefundStore {
  refunds: Map<string, Refund>;
  orderRefunds: Map<string, string[]>; // orderId -> refundIds
}

// 内存缓存
let orderStore: OrderStore | null = null;
let transactionStore: TransactionStore | null = null;
let refundStore: RefundStore | null = null;
let paymentConfig: PaymentConfig = DEFAULT_PAYMENT_CONFIG;

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  const dir = getPaymentDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info("创建支付数据目录", { dir });
  }
}

/**
 * 加载订单数据
 */
async function loadOrders(): Promise<OrderStore> {
  if (orderStore) {
    return orderStore;
  }

  ensureDataDir();
  const filePath = getOrdersFilePath();

  orderStore = {
    orders: new Map(),
    userOrders: new Map(),
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const order of data.orders || []) {
        orderStore.orders.set(order.id, order);
        const userOrders = orderStore.userOrders.get(order.userId) || [];
        userOrders.push(order.id);
        orderStore.userOrders.set(order.userId, userOrders);
      }
      log.info("加载订单数据", { count: orderStore.orders.size });
    } catch (error) {
      log.error("加载订单数据失败", { error });
    }
  }

  return orderStore;
}

/**
 * 保存订单数据
 */
async function saveOrders(): Promise<void> {
  if (!orderStore) return;

  ensureDataDir();
  const filePath = getOrdersFilePath();

  const data = {
    orders: Array.from(orderStore.orders.values()),
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log.debug("保存订单数据", { count: data.orders.length });
}

/**
 * 加载交易数据
 */
async function loadTransactions(): Promise<TransactionStore> {
  if (transactionStore) {
    return transactionStore;
  }

  ensureDataDir();
  const filePath = getTransactionsFilePath();

  transactionStore = {
    transactions: new Map(),
    orderTransactions: new Map(),
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const tx of data.transactions || []) {
        transactionStore.transactions.set(tx.id, tx);
        const orderTxs = transactionStore.orderTransactions.get(tx.orderId) || [];
        orderTxs.push(tx.id);
        transactionStore.orderTransactions.set(tx.orderId, orderTxs);
      }
      log.info("加载交易数据", { count: transactionStore.transactions.size });
    } catch (error) {
      log.error("加载交易数据失败", { error });
    }
  }

  return transactionStore;
}

/**
 * 保存交易数据
 */
async function saveTransactions(): Promise<void> {
  if (!transactionStore) return;

  ensureDataDir();
  const filePath = getTransactionsFilePath();

  const data = {
    transactions: Array.from(transactionStore.transactions.values()),
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log.debug("保存交易数据");
}

/**
 * 加载退款数据
 */
async function loadRefunds(): Promise<RefundStore> {
  if (refundStore) {
    return refundStore;
  }

  ensureDataDir();
  const filePath = getRefundsFilePath();

  refundStore = {
    refunds: new Map(),
    orderRefunds: new Map(),
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const refund of data.refunds || []) {
        refundStore.refunds.set(refund.id, refund);
        const orderRefunds = refundStore.orderRefunds.get(refund.orderId) || [];
        orderRefunds.push(refund.id);
        refundStore.orderRefunds.set(refund.orderId, orderRefunds);
      }
      log.info("加载退款数据", { count: refundStore.refunds.size });
    } catch (error) {
      log.error("加载退款数据失败", { error });
    }
  }

  return refundStore;
}

/**
 * 保存退款数据
 */
async function saveRefunds(): Promise<void> {
  if (!refundStore) return;

  ensureDataDir();
  const filePath = getRefundsFilePath();

  const data = {
    refunds: Array.from(refundStore.refunds.values()),
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log.debug("保存退款数据");
}

/**
 * 记录支付事件
 */
async function logPaymentEvent(event: PaymentEvent): Promise<void> {
  ensureDataDir();
  const filePath = getEventsFilePath();
  fs.appendFileSync(filePath, JSON.stringify(event) + "\n");
  log.debug("记录支付事件", { type: event.type, orderId: event.orderId });
}

// ============================================================================
// ID 生成
// ============================================================================

/**
 * 生成订单 ID
 */
function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `ord_${timestamp}_${random}`;
}

/**
 * 生成交易 ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `txn_${timestamp}_${random}`;
}

/**
 * 生成退款 ID
 */
function generateRefundId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `rfd_${timestamp}_${random}`;
}

/**
 * 生成事件 ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `evt_${timestamp}_${random}`;
}

// ============================================================================
// 订单管理
// ============================================================================

/**
 * 创建订单
 */
export async function createOrder(request: CreateOrderRequest): Promise<PaymentOrder> {
  const store = await loadOrders();
  const now = new Date();

  // 计算过期时间
  const expiresAt = new Date(now.getTime() + paymentConfig.orderExpiryMinutes * 60 * 1000);

  const order: PaymentOrder = {
    id: generateOrderId(),
    userId: request.userId,
    type: request.type,
    status: "pending",
    amount: request.amount,
    currency: request.currency,
    description: request.description,
    referenceId: request.referenceId,
    referenceType: request.referenceType,
    provider: request.provider,
    metadata: request.metadata,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  store.orders.set(order.id, order);
  const userOrders = store.userOrders.get(request.userId) || [];
  userOrders.push(order.id);
  store.userOrders.set(request.userId, userOrders);

  await saveOrders();

  log.info("创建订单", {
    orderId: order.id,
    userId: request.userId,
    amount: order.amount,
    type: order.type,
  });

  return order;
}

/**
 * 获取订单
 */
export async function getOrder(orderId: string): Promise<PaymentOrder | null> {
  const store = await loadOrders();
  return store.orders.get(orderId) || null;
}

/**
 * 获取用户订单列表
 */
export async function getUserOrders(
  userId: string,
  params: OrderQueryParams = {},
): Promise<{ orders: PaymentOrder[]; total: number }> {
  const store = await loadOrders();
  const orderIds = store.userOrders.get(userId) || [];
  let orders = orderIds
    .map((id) => store.orders.get(id))
    .filter((o): o is PaymentOrder => o !== undefined);

  // 状态过滤
  if (params.status) {
    const statusList = Array.isArray(params.status) ? params.status : [params.status];
    orders = orders.filter((o) => statusList.includes(o.status));
  }

  // 类型过滤
  if (params.type) {
    orders = orders.filter((o) => o.type === params.type);
  }

  // 时间过滤
  if (params.startDate) {
    const start = new Date(params.startDate);
    orders = orders.filter((o) => new Date(o.createdAt) >= start);
  }
  if (params.endDate) {
    const end = new Date(params.endDate);
    orders = orders.filter((o) => new Date(o.createdAt) <= end);
  }

  // 按创建时间倒序
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = orders.length;

  // 分页
  const page = params.page || 1;
  const limit = params.limit || 20;
  const start = (page - 1) * limit;
  orders = orders.slice(start, start + limit);

  return { orders, total };
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extra?: Partial<PaymentOrder>,
): Promise<PaymentOrder> {
  const store = await loadOrders();
  const order = store.orders.get(orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (extra) {
    Object.assign(order, extra);
  }

  if (status === "paid" && !order.paidAt) {
    order.paidAt = new Date().toISOString();
  }

  await saveOrders();

  log.info("更新订单状态", { orderId, status });

  return order;
}

/**
 * 取消订单
 */
export async function cancelOrder(orderId: string): Promise<PaymentOrder> {
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  if (order.status !== "pending") {
    throw new Error("只能取消待支付的订单");
  }

  return updateOrderStatus(orderId, "canceled");
}

// ============================================================================
// 支付处理
// ============================================================================

/**
 * 发起支付
 */
export async function initiatePayment(
  request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  const order = await getOrder(request.orderId);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  if (order.status !== "pending") {
    return { success: false, error: "订单状态不允许支付" };
  }

  // 检查是否过期
  if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
    await updateOrderStatus(order.id, "canceled");
    return { success: false, error: "订单已过期" };
  }

  const provider = request.provider;

  // 更新订单的支付提供商
  await updateOrderStatus(order.id, "processing", {
    provider,
    paymentMethodId: request.paymentMethodId,
  });

  // 根据提供商处理支付
  switch (provider) {
    case "mock":
      return handleMockPayment(order, request);
    case "alipay":
      return handleAlipayPayment(order, request);
    case "wechat":
      return handleWechatPayment(order, request);
    case "stripe":
      return handleStripePayment(order, request);
    default:
      return { success: false, error: "不支持的支付方式" };
  }
}

/**
 * 模拟支付处理
 */
async function handleMockPayment(
  order: PaymentOrder,
  _request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  log.info("模拟支付 - 生成支付参数", { orderId: order.id });

  // 生成模拟二维码内容
  const qrCode = `mock://pay?orderId=${order.id}&amount=${order.amount}`;

  // 模拟支付 URL
  const payUrl = `http://localhost:18789/mock-pay?orderId=${order.id}`;

  return {
    success: true,
    payUrl,
    qrCode,
    payParams: {
      orderId: order.id,
      amount: order.amount,
      provider: "mock",
      // 模拟支付会在 3 秒后自动完成
      autoCompleteMs: 3000,
    },
  };
}

/**
 * 支付宝支付处理 (预留)
 */
async function handleAlipayPayment(
  order: PaymentOrder,
  _request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  log.info("支付宝支付 - 待实现", { orderId: order.id });

  // TODO: 接入支付宝 SDK
  // 1. 生成签名
  // 2. 调用支付宝下单接口
  // 3. 返回支付参数

  return {
    success: false,
    error: "支付宝支付暂未开放",
  };
}

/**
 * 微信支付处理 (预留)
 */
async function handleWechatPayment(
  order: PaymentOrder,
  _request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  log.info("微信支付 - 待实现", { orderId: order.id });

  // TODO: 接入微信支付 SDK
  // 1. 生成签名
  // 2. 调用微信统一下单接口
  // 3. 返回支付参数或二维码

  return {
    success: false,
    error: "微信支付暂未开放",
  };
}

/**
 * Stripe 支付处理 (预留)
 */
async function handleStripePayment(
  order: PaymentOrder,
  _request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  log.info("Stripe 支付 - 待实现", { orderId: order.id });

  // TODO: 接入 Stripe SDK
  // 1. 创建 PaymentIntent
  // 2. 返回 clientSecret

  return {
    success: false,
    error: "Stripe 支付暂未开放",
  };
}

/**
 * 查询支付状态
 */
export async function queryPaymentStatus(orderId: string): Promise<QueryPaymentResponse> {
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  return {
    status: order.status,
    paid: order.status === "paid",
    paidAt: order.paidAt,
    externalOrderId: order.externalOrderId,
  };
}

/**
 * 模拟支付完成 (仅用于测试)
 */
export async function mockPaymentComplete(
  orderId: string,
  success: boolean = true,
): Promise<PaymentOrder> {
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  if (order.provider !== "mock") {
    throw new Error("只能模拟完成 mock 支付");
  }

  const now = new Date();

  if (success) {
    // 创建成功交易记录
    const txStore = await loadTransactions();
    const transaction: Transaction = {
      id: generateTransactionId(),
      orderId: order.id,
      userId: order.userId,
      type: "payment",
      status: "success",
      amount: order.amount,
      currency: order.currency,
      provider: "mock",
      externalTransactionId: `mock_${Date.now()}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    txStore.transactions.set(transaction.id, transaction);
    const orderTxs = txStore.orderTransactions.get(order.id) || [];
    orderTxs.push(transaction.id);
    txStore.orderTransactions.set(order.id, orderTxs);
    await saveTransactions();

    // 更新订单状态
    await updateOrderStatus(orderId, "paid", {
      externalOrderId: transaction.externalTransactionId,
    });

    // 记录事件
    await logPaymentEvent({
      id: generateEventId(),
      type: "payment.success",
      provider: "mock",
      orderId: order.id,
      userId: order.userId,
      data: { transactionId: transaction.id },
      timestamp: now.toISOString(),
    });

    log.info("模拟支付成功", { orderId });
  } else {
    // 创建失败交易记录
    const txStore = await loadTransactions();
    const transaction: Transaction = {
      id: generateTransactionId(),
      orderId: order.id,
      userId: order.userId,
      type: "payment",
      status: "failed",
      amount: order.amount,
      currency: order.currency,
      provider: "mock",
      failureReason: "模拟支付失败",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    txStore.transactions.set(transaction.id, transaction);
    await saveTransactions();

    // 更新订单状态
    await updateOrderStatus(orderId, "failed");

    // 记录事件
    await logPaymentEvent({
      id: generateEventId(),
      type: "payment.failed",
      provider: "mock",
      orderId: order.id,
      userId: order.userId,
      data: { reason: "模拟支付失败" },
      timestamp: now.toISOString(),
    });

    log.info("模拟支付失败", { orderId });
  }

  return (await getOrder(orderId))!;
}

// ============================================================================
// 退款处理
// ============================================================================

/**
 * 创建退款
 */
export async function createRefund(request: CreateRefundRequest): Promise<Refund> {
  const order = await getOrder(request.orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  if (order.status !== "paid" && order.status !== "partially_refunded") {
    throw new Error("订单状态不允许退款");
  }

  // 计算可退款金额
  const refundedAmount = order.refundedAmount || 0;
  const availableRefund = order.amount - refundedAmount;
  const refundAmount = request.amount || availableRefund;

  if (refundAmount > availableRefund) {
    throw new Error("退款金额超出可退金额");
  }

  // 获取交易记录
  const txStore = await loadTransactions();
  const txIds = txStore.orderTransactions.get(order.id) || [];
  const successTx = txIds
    .map((id) => txStore.transactions.get(id))
    .find((tx) => tx?.type === "payment" && tx.status === "success");

  if (!successTx) {
    throw new Error("未找到成功的支付交易");
  }

  const now = new Date();
  const refundStore = await loadRefunds();

  const refund: Refund = {
    id: generateRefundId(),
    orderId: order.id,
    transactionId: successTx.id,
    userId: order.userId,
    status: "pending",
    amount: refundAmount,
    currency: order.currency,
    reason: request.reason,
    description: request.description,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  refundStore.refunds.set(refund.id, refund);
  const orderRefunds = refundStore.orderRefunds.get(order.id) || [];
  orderRefunds.push(refund.id);
  refundStore.orderRefunds.set(order.id, orderRefunds);
  await saveRefunds();

  log.info("创建退款", {
    refundId: refund.id,
    orderId: order.id,
    amount: refundAmount,
  });

  // 处理退款 (对于模拟支付，直接成功)
  if (order.provider === "mock") {
    await processRefund(refund.id, true);
  }

  return refund;
}

/**
 * 处理退款
 */
async function processRefund(refundId: string, success: boolean): Promise<Refund> {
  const rStore = await loadRefunds();
  const refund = rStore.refunds.get(refundId);

  if (!refund) {
    throw new Error("退款不存在");
  }

  const now = new Date();

  if (success) {
    refund.status = "success";
    refund.externalRefundId = `mock_refund_${Date.now()}`;
    refund.updatedAt = now.toISOString();

    // 更新订单退款金额
    const order = await getOrder(refund.orderId);
    if (order) {
      const newRefundedAmount = (order.refundedAmount || 0) + refund.amount;
      const newStatus: OrderStatus =
        newRefundedAmount >= order.amount ? "refunded" : "partially_refunded";
      await updateOrderStatus(order.id, newStatus, {
        refundedAmount: newRefundedAmount,
      });
    }

    // 记录事件
    await logPaymentEvent({
      id: generateEventId(),
      type: "refund.success",
      provider: "mock",
      orderId: refund.orderId,
      userId: refund.userId,
      data: { refundId: refund.id, amount: refund.amount },
      timestamp: now.toISOString(),
    });

    log.info("退款成功", { refundId });
  } else {
    refund.status = "failed";
    refund.updatedAt = now.toISOString();

    // 记录事件
    await logPaymentEvent({
      id: generateEventId(),
      type: "refund.failed",
      provider: "mock",
      orderId: refund.orderId,
      userId: refund.userId,
      data: { refundId: refund.id },
      timestamp: now.toISOString(),
    });

    log.info("退款失败", { refundId });
  }

  await saveRefunds();
  return refund;
}

/**
 * 获取退款
 */
export async function getRefund(refundId: string): Promise<Refund | null> {
  const store = await loadRefunds();
  return store.refunds.get(refundId) || null;
}

/**
 * 获取订单的退款列表
 */
export async function getOrderRefunds(orderId: string): Promise<Refund[]> {
  const store = await loadRefunds();
  const refundIds = store.orderRefunds.get(orderId) || [];
  return refundIds.map((id) => store.refunds.get(id)).filter((r): r is Refund => r !== undefined);
}

// ============================================================================
// 价格计算
// ============================================================================

/**
 * 订阅计划价格 (分)
 */
const SUBSCRIPTION_PRICES: Record<string, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  basic: { monthly: 1900, yearly: 19000 }, // ¥19/月, ¥190/年
  pro: { monthly: 4900, yearly: 49000 }, // ¥49/月, ¥490/年
  enterprise: { monthly: 19900, yearly: 199000 }, // ¥199/月, ¥1990/年
};

/**
 * 计算价格
 */
export async function calculatePrice(request: CalculatePriceRequest): Promise<PriceInfo> {
  let originalPrice = 0;
  let discountAmount = 0;

  switch (request.type) {
    case "subscription": {
      const prices = SUBSCRIPTION_PRICES[request.itemId];
      if (!prices) {
        throw new Error("未知的订阅计划");
      }
      const period = request.billingPeriod || "monthly";
      originalPrice = prices[period];

      // 年付优惠 (相当于 2 个月免费)
      if (period === "yearly") {
        const monthlyTotal = prices.monthly * 12;
        discountAmount = monthlyTotal - originalPrice;
      }
      break;
    }
    case "skill": {
      // TODO: 从技能商店获取价格
      originalPrice = 0;
      break;
    }
    case "addon": {
      // TODO: 附加包价格
      originalPrice = 0;
      break;
    }
    case "topup": {
      // 充值金额就是输入的 itemId (分)
      originalPrice = parseInt(request.itemId, 10) || 0;
      break;
    }
  }

  // TODO: 优惠码处理
  if (request.couponCode) {
    // 验证优惠码并计算折扣
  }

  return {
    originalPrice,
    discountAmount,
    finalPrice: originalPrice - discountAmount,
    currency: "CNY",
    couponCode: request.couponCode,
    discountDescription: discountAmount > 0 ? "年付优惠" : undefined,
  };
}

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 获取支付配置
 */
export function getPaymentConfig(): PaymentConfig {
  return { ...paymentConfig };
}

/**
 * 更新支付配置
 */
export function updatePaymentConfig(config: Partial<PaymentConfig>): PaymentConfig {
  paymentConfig = { ...paymentConfig, ...config };
  log.info("更新支付配置", config);
  return paymentConfig;
}

/**
 * 获取可用的支付方式
 */
export function getAvailableProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];

  if (paymentConfig.providers.mock?.enabled) {
    providers.push("mock");
  }
  if (paymentConfig.providers.alipay?.enabled) {
    providers.push("alipay");
  }
  if (paymentConfig.providers.wechat?.enabled) {
    providers.push("wechat");
  }
  if (paymentConfig.providers.stripe?.enabled) {
    providers.push("stripe");
  }

  return providers;
}
