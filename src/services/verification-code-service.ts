/**
 * 验证码服务
 *
 * 负责验证码的生成、存储、验证和清理
 */

import { getDatabase } from "../db/connection.js";
import { verificationCodes } from "../db/schema/users.js";
import { eq, and, lt } from "drizzle-orm";
import { generateId } from "../db/utils/id.js";

/**
 * 验证码配置
 */
const VERIFICATION_CODE_CONFIG = {
  /** 验证码长度 */
  length: 6,
  /** 验证码有效期 (分钟) */
  expiryMinutes: 5,
  /** 最大尝试次数 */
  maxAttempts: 3,
  /** 同一目标的最小发送间隔 (秒) */
  minSendInterval: 60,
};

/**
 * 验证码用途类型
 */
export type VerificationPurpose = "register" | "login" | "reset_password" | "bind" | "verify";

/**
 * 目标类型
 */
export type TargetType = "phone" | "email";

/**
 * 生成随机验证码
 */
function generateCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < VERIFICATION_CODE_CONFIG.length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

/**
 * 发送验证码
 *
 * @param target 目标 (手机号或邮箱)
 * @param targetType 目标类型
 * @param purpose 用途
 * @returns 验证码 ID 和过期时间
 */
export async function sendVerificationCode(
  target: string,
  targetType: TargetType,
  purpose: VerificationPurpose
): Promise<{
  id: string;
  expiresAt: Date;
}> {
  // 1. 检查是否在最小发送间隔内
  const db = getDatabase();
  const recentCode = await db.query.verificationCodes.findFirst({
    where: and(
      eq(verificationCodes.target, target),
      eq(verificationCodes.targetType, targetType),
      eq(verificationCodes.purpose, purpose),
      eq(verificationCodes.used, false)
    ),
    orderBy: (codes, { desc }) => [desc(codes.createdAt)],
  });

  if (recentCode) {
    const timeSinceLastSend = Date.now() - recentCode.createdAt.getTime();
    if (timeSinceLastSend < VERIFICATION_CODE_CONFIG.minSendInterval * 1000) {
      const remainingSeconds = Math.ceil(
        (VERIFICATION_CODE_CONFIG.minSendInterval * 1000 - timeSinceLastSend) / 1000
      );
      throw new Error(`请等待 ${remainingSeconds} 秒后再试`);
    }
  }

  // 2. 生成验证码
  const code = generateCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_CONFIG.expiryMinutes * 60 * 1000);

  // 3. 存储验证码
  const [verificationCode] = await db
    .insert(verificationCodes)
    .values({
      id: generateId(),
      target,
      targetType,
      code,
      purpose,
      expiresAt,
      used: false,
      attempts: "0",
    })
    .returning();

  // 4. 发送验证码 (实际发送逻辑)
  await sendCodeToTarget(target, targetType, code, purpose);

  return {
    id: verificationCode.id,
    expiresAt: verificationCode.expiresAt,
  };
}

/**
 * 验证验证码
 *
 * @param target 目标 (手机号或邮箱)
 * @param targetType 目标类型
 * @param code 验证码
 * @param purpose 用途
 * @returns 是否验证成功
 */
export async function verifyCode(
  target: string,
  targetType: TargetType,
  code: string,
  purpose: VerificationPurpose
): Promise<boolean> {
  // 1. 查询最新的未使用验证码
  const db = getDatabase();
  const verificationCode = await db.query.verificationCodes.findFirst({
    where: and(
      eq(verificationCodes.target, target),
      eq(verificationCodes.targetType, targetType),
      eq(verificationCodes.purpose, purpose),
      eq(verificationCodes.used, false)
    ),
    orderBy: (codes, { desc }) => [desc(codes.createdAt)],
  });

  if (!verificationCode) {
    throw new Error("验证码不存在或已使用");
  }

  // 2. 检查是否过期
  if (new Date() > verificationCode.expiresAt) {
    throw new Error("验证码已过期");
  }

  // 3. 检查尝试次数
  const attempts = parseInt(verificationCode.attempts);
  if (attempts >= VERIFICATION_CODE_CONFIG.maxAttempts) {
    throw new Error("验证码尝试次数过多");
  }

  // 4. 验证码是否匹配
  if (verificationCode.code !== code) {
    // 增加尝试次数
    await db
      .update(verificationCodes)
      .set({
        attempts: (attempts + 1).toString(),
      })
      .where(eq(verificationCodes.id, verificationCode.id));

    const remainingAttempts = VERIFICATION_CODE_CONFIG.maxAttempts - attempts - 1;
    throw new Error(`验证码错误,还剩 ${remainingAttempts} 次尝试机会`);
  }

  // 5. 标记为已使用
  await db
    .update(verificationCodes)
    .set({
      used: true,
    })
    .where(eq(verificationCodes.id, verificationCode.id));

  return true;
}

/**
 * 清理过期验证码
 *
 * 定期调用此函数清理过期的验证码记录
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const db = getDatabase();
  const result = await db
    .delete(verificationCodes)
    .where(lt(verificationCodes.expiresAt, new Date()))
    .returning();

  return result.length;
}

/**
 * 实际发送验证码到目标
 *
 * TODO: 集成短信/邮件服务
 */
async function sendCodeToTarget(
  target: string,
  targetType: TargetType,
  code: string,
  purpose: VerificationPurpose
): Promise<void> {
  // 根据目标类型发送验证码
  if (targetType === "phone") {
    // TODO: 集成短信服务 (阿里云/腾讯云)
    console.log(`[verification] 发送短信验证码到 ${target}: ${code}`);
    // await sendSMS(target, code, purpose)
  } else if (targetType === "email") {
    // TODO: 集成邮件服务 (SendGrid/阿里云邮件)
    console.log(`[verification] 发送邮件验证码到 ${target}: ${code}`);
    // await sendEmail(target, code, purpose)
  }

  // 开发环境: 直接打印验证码
  if (process.env.NODE_ENV === "development") {
    console.log(`\n========================================`);
    console.log(`验证码: ${code}`);
    console.log(`目标: ${target} (${targetType})`);
    console.log(`用途: ${purpose}`);
    console.log(`有效期: ${VERIFICATION_CODE_CONFIG.expiryMinutes} 分钟`);
    console.log(`========================================\n`);
  }
}
