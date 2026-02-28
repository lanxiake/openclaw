/**
 * RSA 密码加密工具
 *
 * 使用 WebCrypto API (RSA-OAEP + SHA-256) 加密密码
 */

let cachedPublicKey: CryptoKey | null = null
let cachedPublicKeyPem: string | null = null

/**
 * 将 PEM 格式公钥导入为 CryptoKey
 */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  // 如果 PEM 没变，复用缓存
  if (cachedPublicKey && cachedPublicKeyPem === pem) {
    return cachedPublicKey
  }

  // 解析 PEM → ArrayBuffer
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')

  const binaryStr = atob(pemBody)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  const key = await crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )

  cachedPublicKey = key
  cachedPublicKeyPem = pem
  return key
}

/**
 * 使用 RSA-OAEP 加密密码
 *
 * @param password 明文密码
 * @param publicKeyPem PEM 格式 RSA 公钥
 * @returns Base64 编码的密文
 */
export async function encryptPassword(
  password: string,
  publicKeyPem: string,
): Promise<string> {
  const key = await importPublicKey(publicKeyPem)

  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    data,
  )

  // ArrayBuffer → Base64
  const bytes = new Uint8Array(encrypted)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
