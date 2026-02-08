/**
 * 验证码服务
 *
 * 处理验证码的发送和验证
 */

import { getLogger } from "../../logging/logger.js";
import { getVerificationCodeRepository, audit } from "../../db/index.js";

const logger = getLogger();

// 验证码配置
const CODE_CONFIG = {
  /** 验证码长度 */
  length: 6,
  /** 有效期 (5分钟) */
  expiresInMs: 5 * 60 * 1000,
  /** 发送间隔 (60秒) */
  sendIntervalMs: 60 * 1000,
  /** 每小时最多发送次数 */
  maxPerHour: 5,
  /** 每日最多发送次数 */
  maxPerDay: 10,
};

/**
 * 发送验证码请求
 */
export interface SendCodeRequest {
  /** 目标 (手机号/邮箱) */
  target: string;
  /** 目标类型 */
  targetType: "phone" | "email";
  /** 用途 */
  purpose: "register" | "login" | "reset_password" | "bind" | "verify";
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 发送验证码结果
 */
export interface SendCodeResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  /** 下次可发送时间 (Unix 时间戳) */
  nextSendAt?: number;
}

/**
 * 验证码发送器接口
 */
export interface CodeSender {
  /** 发送短信验证码 */
  sendSms(phone: string, code: string): Promise<boolean>;
  /** 发送邮件验证码 */
  sendEmail(email: string, code: string): Promise<boolean>;
}

// 默认发送器 (仅打印日志，用于开发环境)
const defaultSender: CodeSender = {
  async sendSms(phone: string, code: string): Promise<boolean> {
    logger.info("[code-service] [DEV] SMS verification code", {
      phone: maskPhone(phone),
      code,
    });
    console.log(`\n[开发模式] 验证码: ${code} -> ${phone}\n`);
    return true;
  },
  async sendEmail(email: string, code: string): Promise<boolean> {
    logger.info("[code-service] [DEV] Email verification code", {
      email: maskEmail(email),
      code,
    });
    console.log(`\n[开发模式] 验证码: ${code} -> ${email}\n`);
    return true;
  },
};

// 当前使用的发送器
let codeSender: CodeSender = defaultSender;

/**
 * 设置验证码发送器
 */
export function setCodeSender(sender: CodeSender): void {
  codeSender = sender;
  logger.info("[code-service] Code sender configured");
}

/**
 * 获取当前发送器
 */
export function getCodeSender(): CodeSender {
  return codeSender;
}

/**
 * 发送验证码
 */
export async function sendVerificationCode(
  request: SendCodeRequest
): Promise<SendCodeResult> {
  const codeRepo = getVerificationCodeRepository();

  try {
    // 1. 检查发送频率
    const recentCount = await codeRepo.getRecentSendCount(
      request.target,
      60 * 60 * 1000 // 1 小时
    );

    if (recentCount >= CODE_CONFIG.maxPerHour) {
      logger.warn("[code-service] Send rate limit exceeded", {
        target: maskTarget(request.target, request.targetType),
        count: recentCount,
      });
      return {
        success: false,
        error: "发送次数过多，请稍后重试",
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    // 2. 生成验证码
    const { code, expiresAt } = await codeRepo.create(
      request.target,
      request.targetType,
      request.purpose,
      CODE_CONFIG.expiresInMs
    );

    // 3. 发送验证码
    let sendResult: boolean;

    if (request.targetType === "phone") {
      sendResult = await codeSender.sendSms(request.target, code);
    } else {
      sendResult = await codeSender.sendEmail(request.target, code);
    }

    if (!sendResult) {
      logger.error("[code-service] Failed to send verification code", {
        target: maskTarget(request.target, request.targetType),
        purpose: request.purpose,
      });
      return {
        success: false,
        error: "发送失败，请稍后重试",
        errorCode: "SEND_FAILED",
      };
    }

    // 4. 记录审计日志
    await audit({
      category: "auth",
      action: "verification_code.sent",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "success",
      details: {
        targetType: request.targetType,
        purpose: request.purpose,
        target: maskTarget(request.target, request.targetType),
      },
    });

    logger.info("[code-service] Verification code sent", {
      target: maskTarget(request.target, request.targetType),
      purpose: request.purpose,
    });

    // 计算下次可发送时间
    const nextSendAt = Date.now() + CODE_CONFIG.sendIntervalMs;

    return {
      success: true,
      nextSendAt,
    };
  } catch (error) {
    logger.error("[code-service] Send code error", {
      error: error instanceof Error ? error.message : "Unknown error",
      target: maskTarget(request.target, request.targetType),
    });

    await audit({
      category: "auth",
      action: "verification_code.sent",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "failure",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: "发送失败，请稍后重试",
      errorCode: "SEND_ERROR",
    };
  }
}

/**
 * 验证验证码
 */
export async function verifyCode(
  target: string,
  code: string,
  purpose: "register" | "login" | "reset_password" | "bind" | "verify"
): Promise<boolean> {
  const codeRepo = getVerificationCodeRepository();
  return codeRepo.verify(target, code, purpose);
}

// 辅助函数

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskTarget(target: string, type: "phone" | "email"): string {
  return type === "phone" ? maskPhone(target) : maskEmail(target);
}
