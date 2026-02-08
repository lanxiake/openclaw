/**
 * 支付宝支付集成 - Alipay Integration
 *
 * 基于支付宝开放平台 API v3 实现：
 * - 当面付（扫码支付）
 * - APP 支付
 * - 手机网站支付
 * - 电脑网站支付
 *
 * 参考文档：https://opendocs.alipay.com/open/
 *
 * @author OpenClaw
 */

import * as crypto from "node:crypto";
import { getLogger } from "../../../logging/logger.js";
import type {
  PaymentOrder,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentProviderConfig,
} from "../types.js";

const logger = getLogger();

/**
 * 支付宝配置
 */
export interface AlipayConfig extends PaymentProviderConfig {
  /** 应用 ID */
  appId: string;
  /** 应用私钥 (PEM 格式) */
  privateKey: string;
  /** 支付宝公钥 (PEM 格式) */
  alipayPublicKey: string;
  /** 回调通知 URL */
  notifyUrl: string;
  /** 同步返回 URL */
  returnUrl?: string;
  /** 网关地址 */
  gateway?: string;
  /** 是否沙箱环境 */
  sandbox?: boolean;
  /** 签名类型 */
  signType?: "RSA2" | "RSA";
}

/**
 * 支付宝支付产品类型
 */
export type AlipayTradeType =
  | "FACE_TO_FACE" // 当面付（扫码）
  | "APP" // APP 支付
  | "WAP" // 手机网站支付
  | "PAGE"; // 电脑网站支付

/**
 * 支付宝统一下单请求
 */
interface AlipayOrderRequest {
  /** 商户订单号 */
  out_trade_no: string;
  /** 订单总金额 (元) */
  total_amount: string;
  /** 订单标题 */
  subject: string;
  /** 订单描述 */
  body?: string;
  /** 产品码 */
  product_code: string;
  /** 超时时间 */
  timeout_express?: string;
  /** 扩展参数 */
  extend_params?: {
    /** 花呗分期 */
    hb_fq_num?: string;
    /** 花呗分期卖家承担手续费比例 */
    hb_fq_seller_percent?: string;
  };
}

/**
 * 支付宝下单响应
 */
interface AlipayOrderResponse {
  /** 支付宝交易号 */
  trade_no?: string;
  /** 商户订单号 */
  out_trade_no: string;
  /** 二维码链接 (当面付) */
  qr_code?: string;
  /** 状态码 */
  code: string;
  /** 状态信息 */
  msg: string;
  /** 业务返回码 */
  sub_code?: string;
  /** 业务返回信息 */
  sub_msg?: string;
}

/**
 * 支付宝异步通知
 */
export interface AlipayNotification {
  /** 通知时间 */
  notify_time: string;
  /** 通知类型 */
  notify_type: string;
  /** 通知 ID */
  notify_id: string;
  /** 签名类型 */
  sign_type: string;
  /** 签名 */
  sign: string;
  /** 支付宝交易号 */
  trade_no: string;
  /** 商户订单号 */
  out_trade_no: string;
  /** 交易状态 */
  trade_status: "WAIT_BUYER_PAY" | "TRADE_CLOSED" | "TRADE_SUCCESS" | "TRADE_FINISHED";
  /** 订单金额 */
  total_amount: string;
  /** 实收金额 */
  receipt_amount?: string;
  /** 买家支付宝账号 */
  buyer_logon_id?: string;
  /** 买家用户 ID */
  buyer_id?: string;
  /** 交易创建时间 */
  gmt_create?: string;
  /** 交易付款时间 */
  gmt_payment?: string;
  /** 卖家收款账号 */
  seller_email?: string;
  /** 应用 ID */
  app_id: string;
}

/**
 * 支付宝查询响应
 */
export interface AlipayQueryResponse {
  /** 商户订单号 */
  out_trade_no: string;
  /** 支付宝交易号 */
  trade_no: string;
  /** 交易状态 */
  trade_status: "WAIT_BUYER_PAY" | "TRADE_CLOSED" | "TRADE_SUCCESS" | "TRADE_FINISHED";
  /** 订单金额 */
  total_amount: string;
  /** 买家用户 ID */
  buyer_user_id?: string;
  /** 交易创建时间 */
  send_pay_date?: string;
  /** 状态码 */
  code: string;
  /** 状态信息 */
  msg: string;
}

// 支付宝网关地址
const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";
const ALIPAY_SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

// 存储配置
let alipayConfig: AlipayConfig | null = null;

/**
 * 初始化支付宝支付
 */
export function initAlipay(config: AlipayConfig): void {
  alipayConfig = config;
  logger.info("[alipay] 初始化支付宝支付", {
    appId: config.appId,
    sandbox: config.sandbox,
  });
}

/**
 * 获取支付宝配置
 */
export function getAlipayConfig(): AlipayConfig | null {
  return alipayConfig;
}

/**
 * 格式化日期
 */
function formatDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 生成签名
 */
function generateSign(
  params: Record<string, string>,
  privateKey: string,
  signType: "RSA2" | "RSA" = "RSA2",
): string {
  // 1. 按字母顺序排序参数
  const sortedKeys = Object.keys(params).sort();

  // 2. 拼接参数
  const signStr = sortedKeys
    .filter((key) => params[key] !== undefined && params[key] !== "" && key !== "sign")
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  // 3. 签名
  const algorithm = signType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";
  const sign = crypto.createSign(algorithm);
  sign.update(signStr, "utf8");

  return sign.sign(privateKey, "base64");
}

/**
 * 验证签名
 */
function verifySign(
  params: Record<string, string>,
  sign: string,
  publicKey: string,
  signType: "RSA2" | "RSA" = "RSA2",
): boolean {
  // 1. 按字母顺序排序参数
  const sortedKeys = Object.keys(params).sort();

  // 2. 拼接参数 (排除 sign 和 sign_type)
  const signStr = sortedKeys
    .filter(
      (key) =>
        params[key] !== undefined && params[key] !== "" && key !== "sign" && key !== "sign_type",
    )
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  // 3. 验证签名
  const algorithm = signType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";
  const verify = crypto.createVerify(algorithm);
  verify.update(signStr, "utf8");

  return verify.verify(publicKey, sign, "base64");
}

/**
 * 构建公共请求参数
 */
function buildCommonParams(method: string): Record<string, string> {
  if (!alipayConfig) {
    throw new Error("支付宝未初始化");
  }

  return {
    app_id: alipayConfig.appId,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: alipayConfig.signType || "RSA2",
    timestamp: formatDate(),
    version: "1.0",
    notify_url: alipayConfig.notifyUrl,
  };
}

/**
 * 发送支付宝 API 请求
 */
async function sendAlipayRequest<T>(
  method: string,
  bizContent: Record<string, unknown>,
): Promise<T> {
  if (!alipayConfig) {
    throw new Error("支付宝未初始化");
  }

  const gateway = alipayConfig.sandbox
    ? ALIPAY_SANDBOX_GATEWAY
    : alipayConfig.gateway || ALIPAY_GATEWAY;

  // 构建请求参数
  const params = buildCommonParams(method);
  params.biz_content = JSON.stringify(bizContent);

  // 生成签名
  params.sign = generateSign(params, alipayConfig.privateKey, alipayConfig.signType || "RSA2");

  logger.debug("[alipay] 发送请求", { method, bizContent });

  // 发送请求
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const response = await fetch(gateway, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("[alipay] API 请求失败", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`支付宝 API 错误: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  // 支付宝响应格式：{ method_response: {...}, sign: "..." }
  const responseKey = method.replace(/\./g, "_") + "_response";
  const responseData = result[responseKey];

  if (!responseData) {
    throw new Error("支付宝响应格式错误");
  }

  if (responseData.code !== "10000") {
    logger.error("[alipay] 业务请求失败", {
      code: responseData.code,
      msg: responseData.msg,
      subCode: responseData.sub_code,
      subMsg: responseData.sub_msg,
    });
    throw new Error(`支付宝业务错误: ${responseData.sub_msg || responseData.msg}`);
  }

  return responseData as T;
}

/**
 * 创建当面付订单（扫码支付）
 */
export async function createFaceToFaceOrder(order: PaymentOrder): Promise<InitiatePaymentResponse> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const bizContent = {
      out_trade_no: order.id,
      total_amount: (order.amount / 100).toFixed(2), // 分转元
      subject: order.description,
      timeout_express: "30m",
    };

    const response = await sendAlipayRequest<AlipayOrderResponse>(
      "alipay.trade.precreate",
      bizContent,
    );

    if (!response.qr_code) {
      return { success: false, error: "获取支付二维码失败" };
    }

    logger.info("[alipay] 当面付订单创建成功", {
      orderId: order.id,
      tradeNo: response.trade_no,
    });

    return {
      success: true,
      qrCode: response.qr_code,
    };
  } catch (error) {
    logger.error("[alipay] 当面付订单创建失败", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "创建订单失败",
    };
  }
}

/**
 * 创建 APP 支付订单
 */
export async function createAppOrder(order: PaymentOrder): Promise<InitiatePaymentResponse> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const bizContent: AlipayOrderRequest = {
      out_trade_no: order.id,
      total_amount: (order.amount / 100).toFixed(2),
      subject: order.description,
      product_code: "QUICK_MSECURITY_PAY",
      timeout_express: "30m",
    };

    // APP 支付需要返回完整的请求字符串给客户端
    const params = buildCommonParams("alipay.trade.app.pay");
    params.biz_content = JSON.stringify(bizContent);
    params.sign = generateSign(params, alipayConfig.privateKey, alipayConfig.signType || "RSA2");

    // 构建 orderStr
    const orderStr = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    logger.info("[alipay] APP 订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      payParams: {
        orderStr,
      },
    };
  } catch (error) {
    logger.error("[alipay] APP 订单创建失败", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "创建订单失败",
    };
  }
}

/**
 * 创建手机网站支付订单
 */
export async function createWapOrder(
  order: PaymentOrder,
  quitUrl?: string,
): Promise<InitiatePaymentResponse> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const bizContent = {
      out_trade_no: order.id,
      total_amount: (order.amount / 100).toFixed(2),
      subject: order.description,
      product_code: "QUICK_WAP_WAY",
      quit_url: quitUrl || alipayConfig.returnUrl,
      timeout_express: "30m",
    };

    // 手机网站支付返回表单 HTML
    const params = buildCommonParams("alipay.trade.wap.pay");
    if (alipayConfig.returnUrl) {
      params.return_url = alipayConfig.returnUrl;
    }
    params.biz_content = JSON.stringify(bizContent);
    params.sign = generateSign(params, alipayConfig.privateKey, alipayConfig.signType || "RSA2");

    const gateway = alipayConfig.sandbox
      ? ALIPAY_SANDBOX_GATEWAY
      : alipayConfig.gateway || ALIPAY_GATEWAY;

    // 构建跳转 URL
    const payUrl = `${gateway}?${Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")}`;

    logger.info("[alipay] 手机网站订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      payUrl,
    };
  } catch (error) {
    logger.error("[alipay] 手机网站订单创建失败", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "创建订单失败",
    };
  }
}

/**
 * 创建电脑网站支付订单
 */
export async function createPageOrder(order: PaymentOrder): Promise<InitiatePaymentResponse> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const bizContent = {
      out_trade_no: order.id,
      total_amount: (order.amount / 100).toFixed(2),
      subject: order.description,
      product_code: "FAST_INSTANT_TRADE_PAY",
      timeout_express: "30m",
    };

    const params = buildCommonParams("alipay.trade.page.pay");
    if (alipayConfig.returnUrl) {
      params.return_url = alipayConfig.returnUrl;
    }
    params.biz_content = JSON.stringify(bizContent);
    params.sign = generateSign(params, alipayConfig.privateKey, alipayConfig.signType || "RSA2");

    const gateway = alipayConfig.sandbox
      ? ALIPAY_SANDBOX_GATEWAY
      : alipayConfig.gateway || ALIPAY_GATEWAY;

    // 构建跳转 URL
    const payUrl = `${gateway}?${Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")}`;

    logger.info("[alipay] 电脑网站订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      payUrl,
    };
  } catch (error) {
    logger.error("[alipay] 电脑网站订单创建失败", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "创建订单失败",
    };
  }
}

/**
 * 查询订单状态
 */
export async function queryOrder(orderId: string): Promise<AlipayQueryResponse | null> {
  if (!alipayConfig) {
    throw new Error("支付宝未配置");
  }

  try {
    const response = await sendAlipayRequest<AlipayQueryResponse>("alipay.trade.query", {
      out_trade_no: orderId,
    });

    logger.debug("[alipay] 查询订单状态", {
      orderId,
      tradeStatus: response.trade_status,
    });

    return response;
  } catch (error) {
    logger.error("[alipay] 查询订单失败", {
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}

/**
 * 关闭订单
 */
export async function closeOrder(orderId: string): Promise<boolean> {
  if (!alipayConfig) {
    throw new Error("支付宝未配置");
  }

  try {
    await sendAlipayRequest<{ trade_no: string; out_trade_no: string }>("alipay.trade.close", {
      out_trade_no: orderId,
    });

    logger.info("[alipay] 关闭订单成功", { orderId });
    return true;
  } catch (error) {
    logger.error("[alipay] 关闭订单失败", {
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

/**
 * 验证异步通知
 */
export function verifyNotification(params: Record<string, string>): boolean {
  if (!alipayConfig) {
    logger.warn("[alipay] 无法验证通知：支付宝未配置");
    return false;
  }

  const sign = params.sign;
  if (!sign) {
    logger.warn("[alipay] 通知缺少签名");
    return false;
  }

  const signType = (params.sign_type as "RSA2" | "RSA") || "RSA2";

  try {
    const isValid = verifySign(params, sign, alipayConfig.alipayPublicKey, signType);

    if (!isValid) {
      logger.warn("[alipay] 通知签名验证失败");
    }

    return isValid;
  } catch (error) {
    logger.error("[alipay] 验证签名异常", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * 处理支付宝异步通知
 */
export async function handleAlipayNotification(params: Record<string, string>): Promise<{
  success: boolean;
  result?: {
    orderId: string;
    tradeNo: string;
    tradeStatus: string;
    totalAmount: string;
    buyerId?: string;
  };
  error?: string;
}> {
  // 验证签名
  if (!verifyNotification(params)) {
    return { success: false, error: "签名验证失败" };
  }

  const notification: AlipayNotification = params as unknown as AlipayNotification;

  logger.info("[alipay] 收到异步通知", {
    orderId: notification.out_trade_no,
    tradeNo: notification.trade_no,
    tradeStatus: notification.trade_status,
    totalAmount: notification.total_amount,
  });

  return {
    success: true,
    result: {
      orderId: notification.out_trade_no,
      tradeNo: notification.trade_no,
      tradeStatus: notification.trade_status,
      totalAmount: notification.total_amount,
      buyerId: notification.buyer_id,
    },
  };
}

/**
 * 申请退款
 */
export async function createRefund(params: {
  orderId: string;
  refundId: string;
  amount: number;
  refundAmount: number;
  reason?: string;
}): Promise<{
  success: boolean;
  refundId?: string;
  error?: string;
}> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const response = await sendAlipayRequest<{
      trade_no: string;
      out_trade_no: string;
      buyer_logon_id: string;
      fund_change: string;
      refund_fee: string;
    }>("alipay.trade.refund", {
      out_trade_no: params.orderId,
      out_request_no: params.refundId,
      refund_amount: (params.refundAmount / 100).toFixed(2),
      refund_reason: params.reason || "用户申请退款",
    });

    logger.info("[alipay] 退款申请成功", {
      orderId: params.orderId,
      refundId: params.refundId,
      refundFee: response.refund_fee,
      fundChange: response.fund_change,
    });

    return {
      success: response.fund_change === "Y",
      refundId: params.refundId,
    };
  } catch (error) {
    logger.error("[alipay] 退款申请失败", {
      orderId: params.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "退款申请失败",
    };
  }
}

/**
 * 查询退款状态
 */
export async function queryRefund(
  orderId: string,
  refundId: string,
): Promise<{
  success: boolean;
  status?: "SUCCESS" | "PROCESSING" | "FAILED";
  refundAmount?: string;
  error?: string;
} | null> {
  if (!alipayConfig) {
    return { success: false, error: "支付宝未配置" };
  }

  try {
    const response = await sendAlipayRequest<{
      out_trade_no: string;
      out_request_no: string;
      refund_status?: "REFUND_SUCCESS";
      total_amount: string;
      refund_amount: string;
    }>("alipay.trade.fastpay.refund.query", {
      out_trade_no: orderId,
      out_request_no: refundId,
    });

    const status = response.refund_status === "REFUND_SUCCESS" ? "SUCCESS" : "PROCESSING";

    logger.debug("[alipay] 查询退款状态", {
      orderId,
      refundId,
      status,
      refundAmount: response.refund_amount,
    });

    return {
      success: true,
      status,
      refundAmount: response.refund_amount,
    };
  } catch (error) {
    logger.error("[alipay] 查询退款失败", {
      orderId,
      refundId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}

/**
 * 支付宝支付入口
 */
export async function handleAlipayPayment(
  order: PaymentOrder,
  request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  if (!alipayConfig?.enabled) {
    return { success: false, error: "支付宝支付未启用" };
  }

  // 根据 extra 参数决定支付方式
  const tradeType = (request.extra?.tradeType as AlipayTradeType) || "FACE_TO_FACE";

  switch (tradeType) {
    case "FACE_TO_FACE":
      return createFaceToFaceOrder(order);

    case "APP":
      return createAppOrder(order);

    case "WAP":
      const quitUrl = request.extra?.quitUrl as string | undefined;
      return createWapOrder(order, quitUrl);

    case "PAGE":
      return createPageOrder(order);

    default:
      return { success: false, error: "不支持的支付宝支付方式" };
  }
}
