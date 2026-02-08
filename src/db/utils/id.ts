/**
 * UUID 生成工具
 *
 * 使用 Node.js 内置的 crypto.randomUUID()
 */

import { randomUUID } from "node:crypto";

/**
 * 生成 UUID v4
 *
 * @returns 新生成的 UUID 字符串
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * 生成短 ID (用于订单号等场景)
 *
 * 格式: 时间戳(base36) + 随机字符串
 *
 * @param prefix 前缀 (可选)
 * @returns 短 ID 字符串
 */
export function generateShortId(prefix?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return prefix ? `${prefix}${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * 生成订单号
 *
 * 格式: ORD + YYYYMMDD + 时间戳(base36) + 随机字符串
 *
 * @returns 订单号字符串
 */
export function generateOrderNo(): string {
  const now = new Date();
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const timestamp = now.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD${dateStr}${timestamp}${random}`;
}

/**
 * 生成验证码
 *
 * @param length 验证码长度 (默认 6)
 * @returns 数字验证码字符串
 */
export function generateVerificationCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}
