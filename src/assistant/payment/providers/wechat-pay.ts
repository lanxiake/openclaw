/**
 * 微信支付集成 - WeChat Pay Integration
 *
 * 基于微信支付 API v3 实现：
 * - Native 支付（扫码支付）
 * - JSAPI 支付（公众号/小程序）
 * - H5 支付
 * - APP 支付
 *
 * 参考文档：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/
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
  PaymentEvent,
} from "../types.js";

const logger = getLogger();

/**
 * 微信支付配置
 */
export interface WechatPayConfig extends PaymentProviderConfig {
  /** 应用 ID (公众号/小程序/APP) */
  appId: string;
  /** 商户 ID */
  mchId: string;
  /** API v3 密钥 */
  apiV3Key: string;
  /** 商户私钥 (PEM 格式) */
  privateKey: string;
  /** 商户证书序列号 */
  serialNo: string;
  /** 微信支付平台证书 (PEM 格式) */
  platformCert?: string;
  /** 回调通知 URL */
  notifyUrl: string;
  /** 是否沙箱环境 */
  sandbox?: boolean;
}

/**
 * 微信支付交易类型
 */
export type WechatTradeType = "NATIVE" | "JSAPI" | "H5" | "APP";

/**
 * 微信支付下单请求
 */
interface WechatUnifiedOrderRequest {
  /** 应用 ID */
  appid: string;
  /** 商户 ID */
  mchid: string;
  /** 商品描述 */
  description: string;
  /** 商户订单号 */
  out_trade_no: string;
  /** 通知地址 */
  notify_url: string;
  /** 订单金额 */
  amount: {
    /** 总金额 (分) */
    total: number;
    /** 货币类型 */
    currency: "CNY";
  };
  /** 支付者信息 (JSAPI 必填) */
  payer?: {
    /** 用户 OpenID */
    openid: string;
  };
  /** 场景信息 (H5 必填) */
  scene_info?: {
    /** 用户终端 IP */
    payer_client_ip: string;
    /** H5 场景信息 */
    h5_info?: {
      type: "Wap" | "iOS" | "Android";
    };
  };
}

/**
 * 微信支付下单响应
 */
interface WechatUnifiedOrderResponse {
  /** 预支付交易会话标识 (JSAPI/APP) */
  prepay_id?: string;
  /** 二维码链接 (NATIVE) */
  code_url?: string;
  /** 支付跳转链接 (H5) */
  h5_url?: string;
}

/**
 * 微信支付回调通知
 */
export interface WechatPayNotification {
  /** 通知 ID */
  id: string;
  /** 通知创建时间 */
  create_time: string;
  /** 通知类型 */
  event_type: string;
  /** 通知数据类型 */
  resource_type: string;
  /** 通知数据 */
  resource: {
    /** 加密算法 */
    algorithm: string;
    /** 加密数据 */
    ciphertext: string;
    /** 随机串 */
    nonce: string;
    /** 附加数据 */
    associated_data?: string;
  };
  /** 回调摘要 */
  summary: string;
}

/**
 * 解密后的支付结果
 */
export interface WechatPayResult {
  /** 商户订单号 */
  out_trade_no: string;
  /** 微信支付订单号 */
  transaction_id: string;
  /** 交易类型 */
  trade_type: WechatTradeType;
  /** 交易状态 */
  trade_state: "SUCCESS" | "REFUND" | "NOTPAY" | "CLOSED" | "REVOKED" | "USERPAYING" | "PAYERROR";
  /** 交易状态描述 */
  trade_state_desc: string;
  /** 付款银行 */
  bank_type: string;
  /** 支付完成时间 */
  success_time: string;
  /** 订单金额 */
  amount: {
    total: number;
    payer_total: number;
    currency: string;
    payer_currency: string;
  };
  /** 支付者 */
  payer: {
    openid: string;
  };
}

// 微信支付 API 基础 URL
const WECHAT_PAY_API_BASE = "https://api.mch.weixin.qq.com";
const WECHAT_PAY_SANDBOX_API_BASE = "https://api.mch.weixin.qq.com/sandboxnew";

// 存储配置
let wechatPayConfig: WechatPayConfig | null = null;

/**
 * 初始化微信支付
 */
export function initWechatPay(config: WechatPayConfig): void {
  wechatPayConfig = config;
  logger.info("[wechat-pay] 初始化微信支付", {
    appId: config.appId,
    mchId: config.mchId,
    sandbox: config.sandbox,
  });
}

/**
 * 获取微信支付配置
 */
export function getWechatPayConfig(): WechatPayConfig | null {
  return wechatPayConfig;
}

/**
 * 生成随机字符串
 */
function generateNonceStr(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取当前时间戳 (秒)
 */
function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 生成签名
 * 使用 SHA256 with RSA 签名
 */
function generateSignature(
  method: string,
  url: string,
  timestamp: number,
  nonceStr: string,
  body: string,
  privateKey: string,
): string {
  const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  return sign.sign(privateKey, "base64");
}

/**
 * 生成 Authorization 头
 */
function generateAuthorizationHeader(method: string, url: string, body: string = ""): string {
  if (!wechatPayConfig) {
    throw new Error("微信支付未初始化");
  }

  const timestamp = getTimestamp();
  const nonceStr = generateNonceStr();
  const signature = generateSignature(
    method,
    url,
    timestamp,
    nonceStr,
    body,
    wechatPayConfig.privateKey,
  );

  return `WECHATPAY2-SHA256-RSA2048 mchid="${wechatPayConfig.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${wechatPayConfig.serialNo}"`;
}

/**
 * 发送微信支付 API 请求
 */
async function sendWechatPayRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!wechatPayConfig) {
    throw new Error("微信支付未初始化");
  }

  const baseUrl = wechatPayConfig.sandbox ? WECHAT_PAY_SANDBOX_API_BASE : WECHAT_PAY_API_BASE;

  const url = `${baseUrl}${path}`;
  const bodyStr = body ? JSON.stringify(body) : "";
  const authorization = generateAuthorizationHeader(method, path, bodyStr);

  logger.debug("[wechat-pay] 发送请求", { method, path });

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("[wechat-pay] API 请求失败", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`微信支付 API 错误: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * 创建 Native 支付订单（扫码支付）
 */
export async function createNativeOrder(order: PaymentOrder): Promise<InitiatePaymentResponse> {
  if (!wechatPayConfig) {
    return { success: false, error: "微信支付未配置" };
  }

  try {
    const request: WechatUnifiedOrderRequest = {
      appid: wechatPayConfig.appId,
      mchid: wechatPayConfig.mchId,
      description: order.description,
      out_trade_no: order.id,
      notify_url: wechatPayConfig.notifyUrl,
      amount: {
        total: order.amount,
        currency: "CNY",
      },
    };

    const response = await sendWechatPayRequest<WechatUnifiedOrderResponse>(
      "POST",
      "/v3/pay/transactions/native",
      request as unknown as Record<string, unknown>,
    );

    if (!response.code_url) {
      return { success: false, error: "获取支付二维码失败" };
    }

    logger.info("[wechat-pay] Native 订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      qrCode: response.code_url,
    };
  } catch (error) {
    logger.error("[wechat-pay] Native 订单创建失败", {
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
 * 创建 JSAPI 支付订单（公众号/小程序支付）
 */
export async function createJsapiOrder(
  order: PaymentOrder,
  openid: string,
): Promise<InitiatePaymentResponse> {
  if (!wechatPayConfig) {
    return { success: false, error: "微信支付未配置" };
  }

  try {
    const request: WechatUnifiedOrderRequest = {
      appid: wechatPayConfig.appId,
      mchid: wechatPayConfig.mchId,
      description: order.description,
      out_trade_no: order.id,
      notify_url: wechatPayConfig.notifyUrl,
      amount: {
        total: order.amount,
        currency: "CNY",
      },
      payer: {
        openid,
      },
    };

    const response = await sendWechatPayRequest<WechatUnifiedOrderResponse>(
      "POST",
      "/v3/pay/transactions/jsapi",
      request as unknown as Record<string, unknown>,
    );

    if (!response.prepay_id) {
      return { success: false, error: "获取预支付 ID 失败" };
    }

    // 生成小程序/公众号调起支付的参数
    const timestamp = getTimestamp();
    const nonceStr = generateNonceStr();
    const packageStr = `prepay_id=${response.prepay_id}`;

    const paySign = generateSignature(
      "POST",
      "/v3/pay/transactions/jsapi",
      timestamp,
      nonceStr,
      packageStr,
      wechatPayConfig.privateKey,
    );

    logger.info("[wechat-pay] JSAPI 订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      payParams: {
        appId: wechatPayConfig.appId,
        timeStamp: String(timestamp),
        nonceStr,
        package: packageStr,
        signType: "RSA",
        paySign,
      },
    };
  } catch (error) {
    logger.error("[wechat-pay] JSAPI 订单创建失败", {
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
 * 创建 H5 支付订单
 */
export async function createH5Order(
  order: PaymentOrder,
  clientIp: string,
): Promise<InitiatePaymentResponse> {
  if (!wechatPayConfig) {
    return { success: false, error: "微信支付未配置" };
  }

  try {
    const request: WechatUnifiedOrderRequest = {
      appid: wechatPayConfig.appId,
      mchid: wechatPayConfig.mchId,
      description: order.description,
      out_trade_no: order.id,
      notify_url: wechatPayConfig.notifyUrl,
      amount: {
        total: order.amount,
        currency: "CNY",
      },
      scene_info: {
        payer_client_ip: clientIp,
        h5_info: {
          type: "Wap",
        },
      },
    };

    const response = await sendWechatPayRequest<WechatUnifiedOrderResponse>(
      "POST",
      "/v3/pay/transactions/h5",
      request as unknown as Record<string, unknown>,
    );

    if (!response.h5_url) {
      return { success: false, error: "获取 H5 支付链接失败" };
    }

    logger.info("[wechat-pay] H5 订单创建成功", {
      orderId: order.id,
    });

    return {
      success: true,
      payUrl: response.h5_url,
    };
  } catch (error) {
    logger.error("[wechat-pay] H5 订单创建失败", {
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
export async function queryOrder(orderId: string): Promise<WechatPayResult | null> {
  if (!wechatPayConfig) {
    throw new Error("微信支付未配置");
  }

  try {
    const response = await sendWechatPayRequest<WechatPayResult>(
      "GET",
      `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${wechatPayConfig.mchId}`,
    );

    logger.debug("[wechat-pay] 查询订单状态", {
      orderId,
      tradeState: response.trade_state,
    });

    return response;
  } catch (error) {
    logger.error("[wechat-pay] 查询订单失败", {
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
  if (!wechatPayConfig) {
    throw new Error("微信支付未配置");
  }

  try {
    await sendWechatPayRequest<void>("POST", `/v3/pay/transactions/out-trade-no/${orderId}/close`, {
      mchid: wechatPayConfig.mchId,
    });

    logger.info("[wechat-pay] 关闭订单成功", { orderId });
    return true;
  } catch (error) {
    logger.error("[wechat-pay] 关闭订单失败", {
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

/**
 * 解密回调通知数据
 */
export function decryptNotification(
  ciphertext: string,
  nonce: string,
  associatedData: string,
): WechatPayResult {
  if (!wechatPayConfig) {
    throw new Error("微信支付未配置");
  }

  const key = Buffer.from(wechatPayConfig.apiV3Key, "utf-8");
  const iv = Buffer.from(nonce, "utf-8");
  const authTag = Buffer.from(ciphertext.slice(-24), "base64");
  const encryptedData = Buffer.from(ciphertext.slice(0, -24), "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, "utf-8"));

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString("utf-8"));
}

/**
 * 验证回调签名
 */
export function verifyNotificationSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  _serial: string,
): boolean {
  if (!wechatPayConfig || !wechatPayConfig.platformCert) {
    logger.warn("[wechat-pay] 无法验证签名：缺少平台证书");
    // 没有平台证书时，暂时跳过验证
    return true;
  }

  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(message);

  return verify.verify(wechatPayConfig.platformCert, signature, "base64");
}

/**
 * 处理微信支付回调
 */
export async function handleWechatPayNotification(
  notification: WechatPayNotification,
  headers: {
    timestamp: string;
    nonce: string;
    signature: string;
    serial: string;
  },
  rawBody: string,
): Promise<{
  success: boolean;
  result?: WechatPayResult;
  error?: string;
}> {
  // 验证签名
  const isValid = verifyNotificationSignature(
    headers.timestamp,
    headers.nonce,
    rawBody,
    headers.signature,
    headers.serial,
  );

  if (!isValid) {
    logger.error("[wechat-pay] 回调签名验证失败");
    return { success: false, error: "签名验证失败" };
  }

  // 解密通知数据
  try {
    const result = decryptNotification(
      notification.resource.ciphertext,
      notification.resource.nonce,
      notification.resource.associated_data || "",
    );

    logger.info("[wechat-pay] 收到支付回调", {
      orderId: result.out_trade_no,
      tradeState: result.trade_state,
      transactionId: result.transaction_id,
    });

    return { success: true, result };
  } catch (error) {
    logger.error("[wechat-pay] 解密回调数据失败", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "解密失败",
    };
  }
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
  if (!wechatPayConfig) {
    return { success: false, error: "微信支付未配置" };
  }

  try {
    const request = {
      out_trade_no: params.orderId,
      out_refund_no: params.refundId,
      reason: params.reason || "用户申请退款",
      notify_url: wechatPayConfig.notifyUrl.replace("/notify", "/refund-notify"),
      amount: {
        refund: params.refundAmount,
        total: params.amount,
        currency: "CNY",
      },
    };

    const response = await sendWechatPayRequest<{
      refund_id: string;
      out_refund_no: string;
      status: string;
    }>("POST", "/v3/refund/domestic/refunds", request);

    logger.info("[wechat-pay] 退款申请成功", {
      orderId: params.orderId,
      refundId: response.refund_id,
      status: response.status,
    });

    return {
      success: true,
      refundId: response.refund_id,
    };
  } catch (error) {
    logger.error("[wechat-pay] 退款申请失败", {
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
 * 微信支付入口
 */
export async function handleWechatPayment(
  order: PaymentOrder,
  request: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  if (!wechatPayConfig?.enabled) {
    return { success: false, error: "微信支付未启用" };
  }

  // 根据 extra 参数决定支付方式
  const tradeType = (request.extra?.tradeType as WechatTradeType) || "NATIVE";

  switch (tradeType) {
    case "NATIVE":
      return createNativeOrder(order);

    case "JSAPI":
      const openid = request.extra?.openid as string;
      if (!openid) {
        return { success: false, error: "JSAPI 支付需要提供 openid" };
      }
      return createJsapiOrder(order, openid);

    case "H5":
      const clientIp = (request.extra?.clientIp as string) || "127.0.0.1";
      return createH5Order(order, clientIp);

    case "APP":
      // APP 支付与 JSAPI 类似，但不需要 openid
      return createNativeOrder(order);

    default:
      return { success: false, error: "不支持的微信支付方式" };
  }
}
