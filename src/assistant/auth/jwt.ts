/**
 * JWT 工具模块
 *
 * 处理用户访问令牌的生成、验证和刷新
 */

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from "jsonwebtoken";

import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// Token 配置
export const TOKEN_CONFIG = {
  /** Access Token 有效期 (15 分钟) */
  accessTokenExpiresIn: "15m",
  /** Refresh Token 有效期 (7 天) */
  refreshTokenExpiresIn: 7 * 24 * 60 * 60 * 1000, // 毫秒
  /** Refresh Token 轮转阈值 (剩余 2 天时自动轮转) */
  refreshRotateThreshold: 2 * 24 * 60 * 60 * 1000, // 毫秒
  /** 每个用户最多活跃会话数 */
  maxSessionsPerUser: 5,
  /** 令牌签发者 */
  issuer: "openclaw-gateway",
  /** 令牌受众 */
  audience: "openclaw-api",
};

/**
 * User Access Token 负载结构
 */
export interface UserAccessTokenPayload {
  /** 用户 ID */
  sub: string;
  /** Token 类型 */
  type: "user";
  /** 受众 */
  aud: string;
  /** 签发时间 (Unix 时间戳) */
  iat: number;
  /** 过期时间 (Unix 时间戳) */
  exp: number;
  /** 签发者 */
  iss: string;
}

/**
 * Token 对
 */
export interface TokenPair {
  /** 访问令牌 */
  accessToken: string;
  /** 过期时间 (秒) */
  expiresIn: number;
}

/**
 * 从环境变量获取 JWT 密钥
 */
export function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. " +
        "Please configure a secure random string for JWT signing.",
    );
  }
  if (secret.length < 32) {
    logger.warn("[jwt] JWT_SECRET is too short, recommend at least 32 characters");
  }
  return secret;
}

/**
 * 生成 User Access Token
 *
 * @param userId 用户 ID
 * @param options 可选配置
 * @returns Token 对 (accessToken + expiresIn)
 */
export function generateAccessToken(userId: string, options?: { expiresIn?: string }): TokenPair {
  const secret = getJwtSecret();
  const expiresIn = options?.expiresIn || TOKEN_CONFIG.accessTokenExpiresIn;

  const signOptions: SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    issuer: TOKEN_CONFIG.issuer,
    audience: TOKEN_CONFIG.audience,
  };

  const payload = {
    sub: userId,
    type: "user" as const,
  };

  const accessToken = jwt.sign(payload, secret, signOptions);

  // 计算过期秒数
  const expiresInSeconds = parseExpiresIn(expiresIn);

  logger.debug("[jwt] Access token generated", { userId, expiresIn });

  return {
    accessToken,
    expiresIn: expiresInSeconds,
  };
}

/**
 * 验证 Access Token
 *
 * @param token JWT 字符串
 * @returns 验证后的负载，验证失败返回 null
 */
export function verifyAccessToken(token: string): UserAccessTokenPayload | null {
  try {
    const secret = getJwtSecret();

    const verifyOptions: VerifyOptions = {
      issuer: TOKEN_CONFIG.issuer,
      audience: TOKEN_CONFIG.audience,
    };

    const decoded = jwt.verify(token, secret, verifyOptions) as JwtPayload;

    // 验证 token 类型
    if (decoded.type !== "user") {
      logger.warn("[jwt] Invalid token type", { type: decoded.type });
      return null;
    }

    return {
      sub: decoded.sub as string,
      type: "user",
      aud: decoded.aud as string,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
      iss: decoded.iss as string,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug("[jwt] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn("[jwt] Invalid token", {
        error: error.message,
      });
    } else {
      logger.error("[jwt] Token verification error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return null;
  }
}

/**
 * 解码 Token (不验证)
 *
 * @param token JWT 字符串
 * @returns 解码后的负载
 */
export function decodeToken(token: string): UserAccessTokenPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded) return null;

    return {
      sub: decoded.sub as string,
      type: decoded.type as "user",
      aud: decoded.aud as string,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
      iss: decoded.iss as string,
    };
  } catch {
    return null;
  }
}

/**
 * 检查 Token 是否即将过期
 *
 * @param token JWT 字符串
 * @param thresholdSeconds 阈值秒数 (默认 5 分钟)
 * @returns 是否即将过期
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds: number = 5 * 60): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded.exp - now;

  return timeLeft <= thresholdSeconds;
}

/**
 * 从 Authorization header 提取 Token
 *
 * @param authHeader Authorization header 值
 * @returns Token 字符串，格式不正确返回 null
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * 解析过期时间字符串为秒数
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    // 默认返回 15 分钟
    return 900;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      return 900;
  }
}
