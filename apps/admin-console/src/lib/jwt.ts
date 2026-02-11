/**
 * JWT 客户端解码与过期检查工具
 *
 * 仅解码 JWT payload（不验证签名），用于前端 Token 过期检测。
 * 签名验证由后端（Gateway）完成。
 */

/**
 * JWT payload 结构（与后端 AdminAccessTokenPayload 对应）
 */
export interface JwtPayload {
  /** 管理员 ID */
  sub: string
  /** Token 类型 */
  type: string
  /** 管理员角色 */
  role: string
  /** 过期时间 (Unix 时间戳, 秒) */
  exp: number
  /** 签发时间 (Unix 时间戳, 秒) */
  iat: number
  /** 签发者 */
  iss: string
  /** 受众 */
  aud: string
}

/**
 * 解码 JWT Token（不验证签名）
 *
 * JWT 格式: header.payload.signature，payload 是 base64url 编码的 JSON。
 *
 * @param token - JWT 字符串
 * @returns 解码后的 payload，解码失败返回 null
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.warn('[jwt] Token 格式无效: 不是三段式结构')
      return null
    }

    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = atob(base64)
    const payload = JSON.parse(jsonStr)

    if (!payload.exp || !payload.sub) {
      console.warn('[jwt] Token payload 缺少必要字段')
      return null
    }

    return payload as JwtPayload
  } catch (error) {
    console.warn('[jwt] Token 解码失败:', error)
    return null
  }
}

/**
 * 检查 Token 是否已过期
 *
 * @param token - JWT 字符串
 * @returns true 表示已过期或无法解码
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload) return true

  const now = Math.floor(Date.now() / 1000)
  return now >= payload.exp
}

/**
 * 检查 Token 是否即将过期
 *
 * @param token - JWT 字符串
 * @param thresholdSeconds - 阈值秒数，默认 5 分钟 (300 秒)
 * @returns true 表示剩余时间不足阈值
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
  const payload = decodeJwt(token)
  if (!payload) return true

  const now = Math.floor(Date.now() / 1000)
  const timeLeft = payload.exp - now

  return timeLeft <= thresholdSeconds
}

/**
 * 获取 Token 剩余有效时间
 *
 * @param token - JWT 字符串
 * @returns 剩余秒数，已过期返回 0，解码失败返回 -1
 */
export function getTokenTimeLeft(token: string): number {
  const payload = decodeJwt(token)
  if (!payload) return -1

  const now = Math.floor(Date.now() / 1000)
  const timeLeft = payload.exp - now

  return Math.max(0, timeLeft)
}
