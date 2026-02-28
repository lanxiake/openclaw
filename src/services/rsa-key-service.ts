/**
 * RSA 密钥对服务
 *
 * 服务启动时懒加载生成 RSA-2048 密钥对
 * 公钥提供给前端加密密码，私钥仅存内存用于解密
 */

import crypto from "node:crypto";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/** RSA 密钥对 (进程内存缓存) */
let keyPair: { publicKey: string; privateKey: string } | null = null;

/**
 * 获取或生成 RSA 密钥对
 */
function getKeyPair(): { publicKey: string; privateKey: string } {
  if (!keyPair) {
    logger.info("[rsa] Generating RSA-2048 key pair...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
    keyPair = { publicKey, privateKey };
    logger.info("[rsa] RSA key pair generated successfully");
  }
  return keyPair;
}

/**
 * 获取 RSA 公钥 (PEM 格式)
 *
 * 提供给前端用于加密密码
 */
export function getPublicKeyPem(): string {
  return getKeyPair().publicKey;
}

/**
 * 使用 RSA-OAEP + SHA-256 解密密码
 *
 * @param encrypted Base64 编码的 RSA 密文
 * @returns 解密后的明文密码
 */
export function decryptPassword(encrypted: string): string {
  const { privateKey } = getKeyPair();

  const buffer = Buffer.from(encrypted, "base64");
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    buffer,
  );

  return decrypted.toString("utf8");
}

/**
 * 启发式判断密码是否为 RSA 加密格式
 *
 * RSA-2048 密文 Base64 编码后约 344 字符
 * 普通密码一般不超过 200 字符且非纯 base64
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 200) {
    return false;
  }
  // 检查是否为合法 Base64
  return /^[A-Za-z0-9+/]+=*$/.test(value);
}
