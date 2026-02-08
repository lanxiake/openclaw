/**
 * 支付系统类型定义 - Payment Types
 *
 * 定义支付系统所需的所有类型：
 * - 支付方式
 * - 支付订单
 * - 交易记录
 * - 退款
 *
 * @author OpenClaw
 */

// ============================================================================
// 支付方式
// ============================================================================

/**
 * 支付提供商
 */
export type PaymentProvider =
  | 'alipay'      // 支付宝
  | 'wechat'      // 微信支付
  | 'stripe'      // Stripe (国际)
  | 'mock'        // 模拟支付 (开发测试)

/**
 * 支付方式详情
 */
export interface PaymentMethod {
  /** 支付方式 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 支付提供商 */
  provider: PaymentProvider
  /** 支付方式类型 (如: card, bank_account, wallet) */
  type: string
  /** 显示名称 (如: **** 1234) */
  displayName: string
  /** 是否为默认支付方式 */
  isDefault: boolean
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

// ============================================================================
// 支付订单
// ============================================================================

/**
 * 订单状态
 */
export type OrderStatus =
  | 'pending'       // 待支付
  | 'processing'    // 处理中
  | 'paid'          // 已支付
  | 'failed'        // 支付失败
  | 'canceled'      // 已取消
  | 'refunded'      // 已退款
  | 'partially_refunded'  // 部分退款

/**
 * 订单类型
 */
export type OrderType =
  | 'subscription'  // 订阅购买
  | 'skill'         // 技能购买
  | 'addon'         // 附加包购买
  | 'topup'         // 充值

/**
 * 支付订单
 */
export interface PaymentOrder {
  /** 订单 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 订单类型 */
  type: OrderType
  /** 订单状态 */
  status: OrderStatus
  /** 订单金额 (分) */
  amount: number
  /** 货币 */
  currency: 'CNY' | 'USD'
  /** 订单描述 */
  description: string
  /** 关联的业务 ID (如订阅ID、技能ID) */
  referenceId?: string
  /** 关联的业务类型 */
  referenceType?: string
  /** 支付提供商 */
  provider?: PaymentProvider
  /** 支付方式 ID */
  paymentMethodId?: string
  /** 第三方交易号 */
  externalOrderId?: string
  /** 支付时间 */
  paidAt?: string
  /** 过期时间 */
  expiresAt?: string
  /** 退款金额 (分) */
  refundedAmount?: number
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 创建订单请求
 */
export interface CreateOrderRequest {
  /** 用户 ID */
  userId: string
  /** 订单类型 */
  type: OrderType
  /** 订单金额 (分) */
  amount: number
  /** 货币 */
  currency: 'CNY' | 'USD'
  /** 订单描述 */
  description: string
  /** 关联的业务 ID */
  referenceId?: string
  /** 关联的业务类型 */
  referenceType?: string
  /** 支付提供商 */
  provider?: PaymentProvider
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 订单查询参数
 */
export interface OrderQueryParams {
  /** 用户 ID */
  userId?: string
  /** 订单状态 */
  status?: OrderStatus | OrderStatus[]
  /** 订单类型 */
  type?: OrderType
  /** 开始时间 */
  startDate?: string
  /** 结束时间 */
  endDate?: string
  /** 分页 - 页码 */
  page?: number
  /** 分页 - 每页数量 */
  limit?: number
}

// ============================================================================
// 支付交易
// ============================================================================

/**
 * 交易类型
 */
export type TransactionType =
  | 'payment'       // 支付
  | 'refund'        // 退款
  | 'chargeback'    // 拒付

/**
 * 交易状态
 */
export type TransactionStatus =
  | 'pending'       // 待处理
  | 'success'       // 成功
  | 'failed'        // 失败

/**
 * 交易记录
 */
export interface Transaction {
  /** 交易 ID */
  id: string
  /** 订单 ID */
  orderId: string
  /** 用户 ID */
  userId: string
  /** 交易类型 */
  type: TransactionType
  /** 交易状态 */
  status: TransactionStatus
  /** 交易金额 (分) */
  amount: number
  /** 货币 */
  currency: 'CNY' | 'USD'
  /** 支付提供商 */
  provider: PaymentProvider
  /** 第三方交易号 */
  externalTransactionId?: string
  /** 失败原因 */
  failureReason?: string
  /** 额外数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

// ============================================================================
// 退款
// ============================================================================

/**
 * 退款状态
 */
export type RefundStatus =
  | 'pending'       // 待处理
  | 'processing'    // 处理中
  | 'success'       // 成功
  | 'failed'        // 失败

/**
 * 退款原因
 */
export type RefundReason =
  | 'requested_by_customer'   // 用户申请
  | 'duplicate'               // 重复支付
  | 'fraudulent'              // 欺诈
  | 'subscription_canceled'   // 订阅取消
  | 'other'                   // 其他

/**
 * 退款记录
 */
export interface Refund {
  /** 退款 ID */
  id: string
  /** 订单 ID */
  orderId: string
  /** 交易 ID */
  transactionId: string
  /** 用户 ID */
  userId: string
  /** 退款状态 */
  status: RefundStatus
  /** 退款金额 (分) */
  amount: number
  /** 货币 */
  currency: 'CNY' | 'USD'
  /** 退款原因 */
  reason: RefundReason
  /** 退款说明 */
  description?: string
  /** 第三方退款号 */
  externalRefundId?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 创建退款请求
 */
export interface CreateRefundRequest {
  /** 订单 ID */
  orderId: string
  /** 退款金额 (分)，不填则全额退款 */
  amount?: number
  /** 退款原因 */
  reason: RefundReason
  /** 退款说明 */
  description?: string
}

// ============================================================================
// 支付回调
// ============================================================================

/**
 * 支付回调事件类型
 */
export type PaymentEventType =
  | 'payment.success'         // 支付成功
  | 'payment.failed'          // 支付失败
  | 'refund.success'          // 退款成功
  | 'refund.failed'           // 退款失败
  | 'subscription.renewed'    // 订阅续费

/**
 * 支付回调事件
 */
export interface PaymentEvent {
  /** 事件 ID */
  id: string
  /** 事件类型 */
  type: PaymentEventType
  /** 支付提供商 */
  provider: PaymentProvider
  /** 订单 ID */
  orderId: string
  /** 用户 ID */
  userId: string
  /** 事件数据 */
  data: Record<string, unknown>
  /** 原始数据 */
  rawData?: string
  /** 时间戳 */
  timestamp: string
}

// ============================================================================
// 支付配置
// ============================================================================

/**
 * 支付提供商配置
 */
export interface PaymentProviderConfig {
  /** 是否启用 */
  enabled: boolean
  /** 应用 ID */
  appId?: string
  /** 商户 ID */
  merchantId?: string
  /** API 密钥 */
  apiKey?: string
  /** API 密钥密文 */
  apiSecret?: string
  /** 回调 URL */
  notifyUrl?: string
  /** 是否沙箱环境 */
  sandbox?: boolean
}

/**
 * 支付系统配置
 */
export interface PaymentConfig {
  /** 默认货币 */
  defaultCurrency: 'CNY' | 'USD'
  /** 订单过期时间 (分钟) */
  orderExpiryMinutes: number
  /** 各提供商配置 */
  providers: {
    alipay?: PaymentProviderConfig
    wechat?: PaymentProviderConfig
    stripe?: PaymentProviderConfig
    mock?: PaymentProviderConfig
  }
}

/**
 * 默认支付配置
 */
export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  defaultCurrency: 'CNY',
  orderExpiryMinutes: 30,
  providers: {
    mock: {
      enabled: true,
      sandbox: true,
    },
  },
}

// ============================================================================
// 支付接口定义
// ============================================================================

/**
 * 发起支付请求
 */
export interface InitiatePaymentRequest {
  /** 订单 ID */
  orderId: string
  /** 支付提供商 */
  provider: PaymentProvider
  /** 支付方式 ID (可选) */
  paymentMethodId?: string
  /** 返回 URL (支付完成后跳转) */
  returnUrl?: string
  /** 额外参数 */
  extra?: Record<string, unknown>
}

/**
 * 发起支付响应
 */
export interface InitiatePaymentResponse {
  /** 是否成功 */
  success: boolean
  /** 支付 URL (跳转支付) */
  payUrl?: string
  /** 二维码内容 (扫码支付) */
  qrCode?: string
  /** 支付参数 (SDK 调起) */
  payParams?: Record<string, unknown>
  /** 错误信息 */
  error?: string
}

/**
 * 查询支付状态请求
 */
export interface QueryPaymentRequest {
  /** 订单 ID */
  orderId: string
}

/**
 * 查询支付状态响应
 */
export interface QueryPaymentResponse {
  /** 订单状态 */
  status: OrderStatus
  /** 是否已支付 */
  paid: boolean
  /** 支付时间 */
  paidAt?: string
  /** 第三方交易号 */
  externalOrderId?: string
}

// ============================================================================
// 价格计算
// ============================================================================

/**
 * 价格信息
 */
export interface PriceInfo {
  /** 原价 (分) */
  originalPrice: number
  /** 折扣金额 (分) */
  discountAmount: number
  /** 最终价格 (分) */
  finalPrice: number
  /** 货币 */
  currency: 'CNY' | 'USD'
  /** 应用的优惠码 */
  couponCode?: string
  /** 折扣说明 */
  discountDescription?: string
}

/**
 * 计算价格请求
 */
export interface CalculatePriceRequest {
  /** 商品类型 */
  type: OrderType
  /** 商品 ID (订阅计划ID、技能ID等) */
  itemId: string
  /** 计费周期 (订阅用) */
  billingPeriod?: 'monthly' | 'yearly'
  /** 优惠码 */
  couponCode?: string
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化金额 (分 -> 元)
 */
export function formatAmount(amountInCents: number, currency: 'CNY' | 'USD' = 'CNY'): string {
  const amount = amountInCents / 100
  if (currency === 'CNY') {
    return `¥${amount.toFixed(2)}`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * 解析金额 (元 -> 分)
 */
export function parseAmount(amountInYuan: number): number {
  return Math.round(amountInYuan * 100)
}

/**
 * 获取支付提供商显示名称
 */
export function getProviderDisplayName(provider: PaymentProvider): string {
  const names: Record<PaymentProvider, string> = {
    alipay: '支付宝',
    wechat: '微信支付',
    stripe: 'Stripe',
    mock: '模拟支付',
  }
  return names[provider] || provider
}

/**
 * 获取订单状态显示名称
 */
export function getOrderStatusDisplayName(status: OrderStatus): string {
  const names: Record<OrderStatus, string> = {
    pending: '待支付',
    processing: '处理中',
    paid: '已支付',
    failed: '支付失败',
    canceled: '已取消',
    refunded: '已退款',
    partially_refunded: '部分退款',
  }
  return names[status] || status
}
