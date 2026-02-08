/**
 * 支付模块入口
 *
 * 提供完整的支付功能：
 * - 订单管理
 * - 支付处理（微信支付、支付宝）
 * - 退款处理
 * - 优惠券系统
 * - 自动续费
 * - 支付回调处理
 *
 * @author OpenClaw
 */

// 导出类型
export * from "./types.js";

// 导出服务函数
export {
  // 订单管理
  createOrder,
  getOrder,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
  // 支付处理
  initiatePayment,
  queryPaymentStatus,
  mockPaymentComplete,
  // 退款处理
  createRefund,
  getRefund,
  getOrderRefunds,
  // 价格计算
  calculatePrice,
  // 配置管理
  getPaymentConfig,
  updatePaymentConfig,
  getAvailableProviders,
} from "./service.js";

// 导出微信支付
export {
  initWechatPay,
  getWechatPayConfig,
  createNativeOrder as createWechatNativeOrder,
  createJsapiOrder as createWechatJsapiOrder,
  createH5Order as createWechatH5Order,
  queryOrder as queryWechatOrder,
  closeOrder as closeWechatOrder,
  handleWechatPayNotification,
  createRefund as createWechatRefund,
  handleWechatPayment,
  type WechatPayConfig,
  type WechatTradeType,
  type WechatPayNotification,
  type WechatPayResult,
} from "./providers/wechat-pay.js";

// 导出支付宝支付
export {
  initAlipay,
  getAlipayConfig,
  createFaceToFaceOrder as createAlipayFaceToFaceOrder,
  createAppOrder as createAlipayAppOrder,
  createWapOrder as createAlipayWapOrder,
  createPageOrder as createAlipayPageOrder,
  queryOrder as queryAlipayOrder,
  closeOrder as closeAlipayOrder,
  handleAlipayNotification,
  createRefund as createAlipayRefund,
  handleAlipayPayment,
  type AlipayConfig,
  type AlipayTradeType,
  type AlipayNotification,
  type AlipayQueryResponse,
} from "./providers/alipay.js";

// 导出回调处理器
export {
  registerPaymentEventHandler,
  unregisterPaymentEventHandler,
  setOrderUpdateCallback,
  setTransactionRecordCallback,
  processWechatCallback,
  processAlipayCallback,
  handleSubscriptionRenewed,
  type PaymentEventHandler,
  type OrderUpdateCallback,
  type TransactionRecordCallback,
  type WechatCallbackRequest,
} from "./providers/callback-handler.js";

// 导出优惠券系统
export {
  createCoupon,
  getCoupon,
  getCouponByCode,
  updateCoupon,
  disableCoupon,
  listCoupons,
  validateCoupon,
  calculateDiscount,
  useCoupon,
  getUserCouponUsages,
  getCouponUsages,
  calculateFinalPrice,
  generateCouponCode,
  batchCreateCoupons,
  initTestCoupons,
  type Coupon,
  type CouponType,
  type CouponStatus,
  type CouponScope,
  type CouponUsage,
  type ValidateCouponRequest,
  type ValidateCouponResponse,
  type CouponErrorCode,
} from "./coupon.js";

// 导出自动续费
export {
  AutoRenewalScheduler,
  getRenewalScheduler,
  startAutoRenewal,
  stopAutoRenewal,
  DEFAULT_RENEWAL_CONFIG,
  type SubscriptionInfo,
  type RenewalTask,
  type RenewalTaskStatus,
  type RenewalNotification,
  type RenewalNotificationType,
  type RenewalConfig,
} from "./auto-renewal.js";
