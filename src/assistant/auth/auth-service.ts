/**
 * 认证服务
 *
 * 处理用户注册、登录、Token 刷新等认证流程
 */

import { getLogger } from "../../logging/logger.js";
import {
  getUserRepository,
  getUserSessionRepository,
  getLoginAttemptRepository,
  getVerificationCodeRepository,
  audit,
} from "../../db/index.js";
import { verifyPassword, validatePasswordStrength } from "../../db/utils/password.js";
import { generateAccessToken, TOKEN_CONFIG } from "./jwt.js";

const logger = getLogger();

// 限流配置
const RATE_LIMIT_CONFIG = {
  /** 登录失败次数上限 (15分钟内) */
  maxLoginAttempts: 5,
  /** 登录失败检查窗口 (15分钟) */
  loginAttemptWindowMs: 15 * 60 * 1000,
  /** 账户锁定时间 (15分钟) */
  accountLockDurationMs: 15 * 60 * 1000,
  /** IP 级别失败次数上限 (1小时内) */
  maxIpAttempts: 20,
  /** IP 失败检查窗口 (1小时) */
  ipAttemptWindowMs: 60 * 60 * 1000,
  /** 验证码发送间隔 (60秒) */
  codeSendIntervalMs: 60 * 1000,
  /** 每小时最多发送验证码次数 */
  maxCodesPerHour: 5,
};

/**
 * 认证结果
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  user?: {
    id: string;
    phone?: string | null;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  /** 是否需要 MFA */
  mfaRequired?: boolean;
  /** MFA 方法 */
  mfaMethod?: string;
}

/**
 * 注册请求参数
 *
 * 密码和昵称必填，手机号或邮箱至少填一个。
 * 验证码可选（前端使用图形验证码，不经过后端校验）。
 */
export interface RegisterRequest {
  /** 手机号 */
  phone?: string;
  /** 邮箱 */
  email?: string;
  /** 密码 (必填) */
  password: string;
  /** 验证码 (可选，前端图形验证码不走后端) */
  code?: string;
  /** 显示名称 (必填) */
  displayName: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 登录请求参数
 *
 * 使用密码登录，验证码登录已移除。
 */
export interface LoginRequest {
  /** 登录标识 (手机号/邮箱) */
  identifier: string;
  /** 密码 (必填) */
  password: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 刷新 Token 请求参数
 */
export interface RefreshTokenRequest {
  /** Refresh Token */
  refreshToken: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 用户注册
 */
export async function register(request: RegisterRequest): Promise<AuthResult> {
  const userRepo = getUserRepository();
  const codeRepo = getVerificationCodeRepository();
  const sessionRepo = getUserSessionRepository();

  // 验证必填参数
  if (!request.phone && !request.email) {
    return {
      success: false,
      error: "请提供手机号或邮箱",
      errorCode: "MISSING_IDENTIFIER",
    };
  }

  if (!request.password) {
    return {
      success: false,
      error: "请设置密码",
      errorCode: "MISSING_PASSWORD",
    };
  }

  if (!request.displayName) {
    return {
      success: false,
      error: "请输入昵称",
      errorCode: "MISSING_DISPLAY_NAME",
    };
  }

  const identifier = request.phone || request.email!;
  const identifierType = request.phone ? "phone" : "email";

  try {
    // 1. 检查用户是否已存在
    const existingUser = await userRepo.findByIdentifier(identifier);
    if (existingUser) {
      logger.warn("[auth] Registration failed: user already exists", {
        identifier: maskIdentifier(identifier),
      });
      return {
        success: false,
        error: "该账号已注册",
        errorCode: "USER_EXISTS",
      };
    }

    // 2. 验证验证码 (仅在提供时校验，前端图形验证码不经过后端)
    if (request.code) {
      const codeValid = await codeRepo.verify(identifier, request.code, "register");
      if (!codeValid) {
        logger.warn("[auth] Registration failed: invalid code", {
          identifier: maskIdentifier(identifier),
        });
        return {
          success: false,
          error: "验证码错误或已过期",
          errorCode: "INVALID_CODE",
        };
      }
    }

    // 3. 验证密码强度
    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join("; "),
        errorCode: "WEAK_PASSWORD",
      };
    }

    // 4. 创建用户
    const user = await userRepo.create({
      phone: request.phone,
      email: request.email?.toLowerCase(),
      passwordHash: request.password,
      displayName: request.displayName,
      phoneVerified: !!request.phone,
      emailVerified: !!request.email,
    });

    // 5. 生成 Token
    const { accessToken, expiresIn } = generateAccessToken(user.id);
    const { session, refreshToken } = await sessionRepo.create(user.id, {
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    // 6. 记录审计日志
    await audit({
      userId: user.id,
      category: "auth",
      action: "user.register",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "success",
      details: {
        method: identifierType,
      },
    });

    logger.info("[auth] User registered successfully", {
      userId: user.id,
      method: identifierType,
    });

    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error("[auth] Registration error", {
      error: error instanceof Error ? error.message : "Unknown error",
      identifier: maskIdentifier(identifier),
    });

    await audit({
      category: "auth",
      action: "user.register",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "failure",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      riskLevel: "medium",
    });

    return {
      success: false,
      error: "注册失败，请稍后重试",
      errorCode: "REGISTRATION_ERROR",
    };
  }
}

/**
 * 用户登录
 */
export async function login(request: LoginRequest): Promise<AuthResult> {
  const userRepo = getUserRepository();
  const sessionRepo = getUserSessionRepository();
  const attemptRepo = getLoginAttemptRepository();

  // 验证必填参数
  if (!request.identifier) {
    return {
      success: false,
      error: "请提供登录账号",
      errorCode: "MISSING_IDENTIFIER",
    };
  }

  if (!request.password) {
    return {
      success: false,
      error: "请提供密码",
      errorCode: "MISSING_CREDENTIALS",
    };
  }

  const identifierType = request.identifier.includes("@") ? "email" : "phone";

  try {
    // 1. 检查 IP 级别限流
    const ipAttempts = await attemptRepo.getRecentFailureCountByIp(
      request.ipAddress || "unknown",
      RATE_LIMIT_CONFIG.ipAttemptWindowMs,
    );
    if (ipAttempts >= RATE_LIMIT_CONFIG.maxIpAttempts) {
      logger.warn("[auth] Login blocked: IP rate limit exceeded", {
        ipAddress: request.ipAddress,
        attempts: ipAttempts,
      });
      return {
        success: false,
        error: "请求过于频繁，请稍后重试",
        errorCode: "IP_RATE_LIMITED",
      };
    }

    // 2. 查找用户
    const user = await userRepo.findByIdentifier(request.identifier);

    if (!user) {
      // 记录失败尝试 (不泄露用户是否存在)
      await attemptRepo.record({
        identifier: request.identifier,
        identifierType,
        ipAddress: request.ipAddress || "unknown",
        success: false,
        failureReason: "user_not_found",
        userAgent: request.userAgent,
      });

      logger.debug("[auth] Login failed: user not found", {
        identifier: maskIdentifier(request.identifier),
      });

      return {
        success: false,
        error: "账号或密码错误",
        errorCode: "INVALID_CREDENTIALS",
      };
    }

    // 3. 检查账户状态
    if (!user.isActive) {
      return {
        success: false,
        error: "账户已被停用",
        errorCode: "ACCOUNT_DISABLED",
      };
    }

    // 4. 检查账户级别限流
    const userAttempts = await attemptRepo.getRecentFailureCount(
      request.identifier,
      request.ipAddress || "unknown",
      RATE_LIMIT_CONFIG.loginAttemptWindowMs,
    );
    if (userAttempts >= RATE_LIMIT_CONFIG.maxLoginAttempts) {
      logger.warn("[auth] Login blocked: account locked", {
        userId: user.id,
        attempts: userAttempts,
      });

      await audit({
        userId: user.id,
        category: "security",
        action: "account.locked",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        result: "failure",
        riskLevel: "high",
      });

      return {
        success: false,
        error: "登录尝试次数过多，账户已被临时锁定",
        errorCode: "ACCOUNT_LOCKED",
      };
    }

    // 5. 验证密码
    if (!user.passwordHash) {
      return {
        success: false,
        error: "该账号未设置密码，请联系管理员",
        errorCode: "PASSWORD_NOT_SET",
      };
    }
    const credentialsValid = await verifyPassword(request.password, user.passwordHash);

    if (!credentialsValid) {
      // 记录失败尝试
      await attemptRepo.record({
        identifier: request.identifier,
        identifierType,
        ipAddress: request.ipAddress || "unknown",
        success: false,
        failureReason: "invalid_credentials",
        userAgent: request.userAgent,
      });

      await audit({
        userId: user.id,
        category: "auth",
        action: "user.login",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        result: "failure",
        riskLevel: "medium",
        details: {
          method: "password",
          failureReason: "invalid_credentials",
        },
      });

      logger.debug("[auth] Login failed: invalid credentials", {
        userId: user.id,
        method: "password",
      });

      return {
        success: false,
        error: "账号或密码错误",
        errorCode: "INVALID_CREDENTIALS",
      };
    }

    // 6. 检查 MFA
    if (user.mfaEnabled) {
      // TODO: 实现 MFA 验证流程
      return {
        success: false,
        mfaRequired: true,
        mfaMethod: "totp",
        errorCode: "MFA_REQUIRED",
      };
    }

    // 7. 登录成功
    await userRepo.updateLastLogin(user.id);

    // 8. 生成 Token
    const { accessToken, expiresIn } = generateAccessToken(user.id);
    const { session, refreshToken } = await sessionRepo.create(user.id, {
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    // 9. 记录成功登录
    await attemptRepo.record({
      identifier: request.identifier,
      identifierType,
      ipAddress: request.ipAddress || "unknown",
      success: true,
      userAgent: request.userAgent,
    });

    await audit({
      userId: user.id,
      category: "auth",
      action: "user.login",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "success",
      details: {
        method: "password",
      },
    });

    logger.info("[auth] User logged in successfully", {
      userId: user.id,
      method: "password",
    });

    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error("[auth] Login error", {
      error: error instanceof Error ? error.message : "Unknown error",
      identifier: maskIdentifier(request.identifier),
    });

    return {
      success: false,
      error: "登录失败，请稍后重试",
      errorCode: "LOGIN_ERROR",
    };
  }
}

/**
 * 刷新 Token
 */
export async function refreshToken(request: RefreshTokenRequest): Promise<AuthResult> {
  const userRepo = getUserRepository();
  const sessionRepo = getUserSessionRepository();

  try {
    // 1. 查找会话
    const session = await sessionRepo.findByRefreshToken(request.refreshToken);
    if (!session) {
      logger.debug("[auth] Token refresh failed: invalid refresh token");
      return {
        success: false,
        error: "无效的刷新令牌",
        errorCode: "INVALID_REFRESH_TOKEN",
      };
    }

    // 2. 查找用户
    const user = await userRepo.findById(session.userId);
    if (!user || !user.isActive) {
      logger.warn("[auth] Token refresh failed: user not found or inactive", {
        userId: session.userId,
      });
      return {
        success: false,
        error: "用户不存在或已被停用",
        errorCode: "USER_INACTIVE",
      };
    }

    // 3. 检查是否需要轮转 Refresh Token
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    let newRefreshToken = request.refreshToken;

    if (timeUntilExpiry < TOKEN_CONFIG.refreshRotateThreshold) {
      // 轮转 Refresh Token
      const refreshResult = await sessionRepo.refresh(session.id);
      if (refreshResult) {
        newRefreshToken = refreshResult.refreshToken;
        logger.debug("[auth] Refresh token rotated", { userId: user.id });
      }
    }

    // 4. 生成新的 Access Token
    const { accessToken, expiresIn } = generateAccessToken(user.id);

    logger.debug("[auth] Token refreshed successfully", { userId: user.id });

    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error("[auth] Token refresh error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: "刷新令牌失败，请重新登录",
      errorCode: "REFRESH_ERROR",
    };
  }
}

/**
 * 登出
 */
export async function logout(
  refreshToken: string,
  options?: { ipAddress?: string; userAgent?: string; userId?: string },
): Promise<{ success: boolean }> {
  const sessionRepo = getUserSessionRepository();

  try {
    const session = await sessionRepo.findByRefreshToken(refreshToken);
    if (session) {
      await sessionRepo.revoke(session.id);

      await audit({
        userId: session.userId,
        category: "auth",
        action: "user.logout",
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        result: "success",
      });

      logger.debug("[auth] User logged out", { userId: session.userId });
    }

    return { success: true };
  } catch (error) {
    logger.error("[auth] Logout error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { success: true }; // 登出失败也返回成功
  }
}

/**
 * 登出所有设备
 */
export async function logoutAll(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string },
): Promise<{ success: boolean }> {
  const sessionRepo = getUserSessionRepository();

  try {
    await sessionRepo.revokeAllForUser(userId);

    await audit({
      userId,
      category: "auth",
      action: "user.logout_all",
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      result: "success",
      riskLevel: "medium",
    });

    logger.info("[auth] All sessions revoked for user", { userId });

    return { success: true };
  } catch (error) {
    logger.error("[auth] Logout all error", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });
    return { success: false };
  }
}

/**
 * 用户修改密码请求参数
 */
export interface ChangeUserPasswordRequest {
  /** 用户 ID */
  userId: string;
  /** 当前密码 */
  currentPassword: string;
  /** 新密码 */
  newPassword: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 用户修改密码
 *
 * 流程：验证当前密码 → 校验新密码强度 → 更新密码 → 吊销所有会话
 */
export async function changeUserPassword(
  request: ChangeUserPasswordRequest,
): Promise<{ success: boolean; error?: string }> {
  const userRepo = getUserRepository();
  const sessionRepo = getUserSessionRepository();

  try {
    // 1. 查找用户
    const user = await userRepo.findById(request.userId);
    if (!user) {
      logger.warn("[auth] Change password failed: user not found", {
        userId: request.userId,
      });
      return { success: false, error: "用户不存在" };
    }

    // 2. 验证当前密码
    if (!user.passwordHash) {
      return { success: false, error: "该账号未设置密码" };
    }

    const currentPasswordValid = await verifyPassword(request.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      logger.warn("[auth] Change password failed: invalid current password", {
        userId: request.userId,
      });

      await audit({
        userId: request.userId,
        category: "security",
        action: "user.change_password",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        result: "failure",
        riskLevel: "high",
        details: { failureReason: "invalid_current_password" },
      });

      return { success: false, error: "当前密码不正确" };
    }

    // 3. 校验新密码强度
    const validation = validatePasswordStrength(request.newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join("; ") };
    }

    // 4. 更新密码（UserRepository.update 自动哈希）
    await userRepo.update(request.userId, {
      passwordHash: request.newPassword,
    });

    // 5. 吊销所有会话（强制重新登录）
    await sessionRepo.revokeAllForUser(request.userId);

    // 6. 记录审计日志
    await audit({
      userId: request.userId,
      category: "security",
      action: "user.change_password",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      result: "success",
      riskLevel: "high",
    });

    logger.info("[auth] User password changed successfully", {
      userId: request.userId,
    });

    return { success: true };
  } catch (error) {
    logger.error("[auth] Change password error", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: request.userId,
    });

    return { success: false, error: "密码修改失败，请稍后重试" };
  }
}

/**
 * 遮蔽标识符 (用于日志)
 */
function maskIdentifier(identifier: string): string {
  if (identifier.includes("@")) {
    // 邮箱
    const [local, domain] = identifier.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  // 手机号
  return `${identifier.slice(0, 3)}****${identifier.slice(-4)}`;
}
