/**
 * 密码哈希工具
 *
 * 使用 scrypt (Node.js 内置 crypto 实现)
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";

// 配置参数
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384; // N: CPU/内存成本参数 (2^14)
const SCRYPT_BLOCK_SIZE = 8; // r: 块大小
const SCRYPT_PARALLELIZATION = 1; // p: 并行化参数
const SCRYPT_MAXMEM = 128 * 1024 * 1024; // 128MB

/**
 * 封装 scrypt 为 Promise
 */
function scryptAsync(
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * 生成密码哈希
 *
 * 使用 scrypt 算法，输出格式: $scrypt$N$r$p$salt$hash
 *
 * @param password 明文密码
 * @returns 哈希后的密码字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAXMEM,
  });

  return `$scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

/**
 * 验证密码
 *
 * @param password 明文密码
 * @param hash 存储的哈希值
 * @returns 是否匹配
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split("$");
    if (parts.length !== 7 || parts[1] !== "scrypt") {
      return false;
    }

    const N = parseInt(parts[2], 10);
    const r = parseInt(parts[3], 10);
    const p = parseInt(parts[4], 10);
    const salt = Buffer.from(parts[5], "base64");
    const storedKey = Buffer.from(parts[6], "base64");

    const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}

/**
 * 检查密码强度
 *
 * @param password 密码
 * @returns 验证结果
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("密码长度至少 8 位");
  }
  if (password.length > 128) {
    errors.push("密码长度不能超过 128 位");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("密码需包含小写字母");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("密码需包含大写字母");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("密码需包含数字");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生成 Refresh Token
 *
 * @returns 随机生成的 token 字符串
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * 哈希 Refresh Token (用于存储)
 *
 * 使用 SHA-256 单向哈希
 *
 * @param token 原始 token
 * @returns 哈希后的字符串
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
