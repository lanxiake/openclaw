/**
 * 管理员认证服务
 *
 * 处理管理员登录、Token 刷新等认证流程
 */

import { getLogger } from "../../logging/logger.js";
import {
  getAdminRepository,
  getAdminSessionRepository,
  getAdminLoginAttemptRepository,
  adminAudit,
  type AdminPermissions,
} from "../../db/index.js";
import { verifyPassword, validatePasswordStrength } from "../../db/utils/password.js";
import {
  generateAdminAccessToken,
  ADMIN_TOKEN_CONFIG,
  type AdminAccessTokenPayload,
} from "./admin-jwt.js";

const logger = getLogger();

// 限流配置
const RATE_LIMIT_CONFIG = {
  /** 登录失败次数上限 (15分钟内) */
  maxLoginAttempts: 5,
  /** 登录失败检查窗口 (15分钟) */
  loginAttemptWindowMs: 15 * 60 * 1000,
  /** 账户锁定时间 (30分钟) */
  accountLockDurationMs: 30 * 60 * 1000,
  /** IP 级别失败次数上限 (1小时内) */
  maxIpAttempts: 20,
  /** IP 失败检查窗口 (1小时) */
  ipAttemptWindowMs: 60 * 60 * 1000,
};

/**
 * 管理员认证结果
 */
export interface AdminAuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  admin?: {
    id: string;
    username: string;
    displayName: string;
    email?: string | null;
    role: string;
    avatarUrl?: string | null;
    permissions?: AdminPermissions | null;
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
 * 管理员登录请求参数
 */
export interface AdminLoginRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** MFA 验证码 (可选) */
  mfaCode?: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 刷新 Token 请求参数
 */
export interface AdminRefreshTokenRequest {
  /** Refresh Token */
  refreshToken: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 管理员登录
 */
export async function adminLogin(request: AdminLoginRequest): Promise<AdminAuthResult> {
  const adminRepo = getAdminRepository();
  const sessionRepo = getAdminSessionRepository();
  const attemptRepo = getAdminLoginAttemptRepository();

  // 验证必填参数
  if (!request.username || !request.password) {
    return {
      success: false,
      error: "请提供用户名和密码",
      errorCode: "MISSING_CREDENTIALS",
    };
  }

  try {
    // 1. 检查 IP 级别限流
    const ipAttempts = await attemptRepo.getRecentFailureCountByIp(
      request.ipAddress || "unknown",
      RATE_LIMIT_CONFIG.ipAttemptWindowMs,
    );
    if (ipAttempts >= RATE_LIMIT_CONFIG.maxIpAttempts) {
      logger.warn("[admin-auth] Login blocked: IP rate limit exceeded", {
        ipAddress: request.ipAddress,
        attempts: ipAttempts,
      });
      return {
        success: false,
        error: "请求过于频繁，请稍后重试",
        errorCode: "IP_RATE_LIMITED",
      };
    }

    // 2. 查找管理员
    const admin = await adminRepo.findByUsername(request.username);

    if (!admin) {
      // 记录失败尝试 (不泄露用户是否存在)
      await attemptRepo.record({
        username: request.username,
        ipAddress: request.ipAddress || "unknown",
        success: false,
        failureReason: "user_not_found",
        userAgent: request.userAgent,
      });

      logger.debug("[admin-auth] Login failed: admin not found", {
        username: request.username,
      });

      return {
        success: false,
        error: "用户名或密码错误",
        errorCode: "INVALID_CREDENTIALS",
      };
    }

    // 3. 检查账户状态
    if (admin.status === "suspended") {
      await adminAudit({
        adminId: admin.id,
        adminUsername: admin.username,
        action: "admin.login",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        riskLevel: "medium",
        details: { failureReason: "account_suspended" },
      });

      return {
        success: false,
        error: "账户已被停用",
        errorCode: "ACCOUNT_SUSPENDED",
      };
    }

    // 4. 检查账户是否被锁定
    if (admin.status === "locked") {
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        const remainingMs = admin.lockedUntil.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        return {
          success: false,
          error: `账户已被锁定，请 ${remainingMinutes} 分钟后重试`,
          errorCode: "ACCOUNT_LOCKED",
        };
      }
      // 锁定时间已过，自动解锁
      await adminRepo.unlockAccount(admin.id);
    }

    // 5. 检查账户级别限流
    const userAttempts = await attemptRepo.getRecentFailureCount(
      request.username,
      RATE_LIMIT_CONFIG.loginAttemptWindowMs,
    );
    if (userAttempts >= RATE_LIMIT_CONFIG.maxLoginAttempts) {
      // 锁定账户
      await adminRepo.lockAccount(admin.id, RATE_LIMIT_CONFIG.accountLockDurationMs);

      await adminAudit({
        adminId: admin.id,
        adminUsername: admin.username,
        action: "admin.account_locked",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        riskLevel: "high",
        details: { reason: "too_many_failed_attempts" },
      });

      logger.warn("[admin-auth] Account locked due to too many failed attempts", {
        adminId: admin.id,
        attempts: userAttempts,
      });

      return {
        success: false,
        error: "登录尝试次数过多，账户已被临时锁定",
        errorCode: "ACCOUNT_LOCKED",
      };
    }

    // 6. 验证密码
    const passwordValid = await verifyPassword(request.password, admin.passwordHash);
    if (!passwordValid) {
      // 记录失败尝试
      await attemptRepo.record({
        username: request.username,
        ipAddress: request.ipAddress || "unknown",
        success: false,
        failureReason: "invalid_password",
        userAgent: request.userAgent,
      });

      // 增加失败计数
      await adminRepo.incrementFailedAttempts(admin.id);

      await adminAudit({
        adminId: admin.id,
        adminUsername: admin.username,
        action: "admin.login",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        riskLevel: "medium",
        details: { failureReason: "invalid_password" },
      });

      logger.debug("[admin-auth] Login failed: invalid password", {
        adminId: admin.id,
      });

      return {
        success: false,
        error: "用户名或密码错误",
        errorCode: "INVALID_CREDENTIALS",
      };
    }

    // 7. 检查 MFA
    if (admin.mfaEnabled) {
      if (!request.mfaCode) {
        return {
          success: false,
          mfaRequired: true,
          mfaMethod: "totp",
          error: "请输入 MFA 验证码",
          errorCode: "MFA_REQUIRED",
        };
      }
      // TODO: 验证 MFA 验证码
      // const mfaValid = verifyTOTP(admin.mfaSecret, request.mfaCode);
      // if (!mfaValid) { ... }
    }

    // 8. 登录成功
    await adminRepo.updateLastLogin(admin.id, request.ipAddress);

    // 9. 生成 Token
    const { accessToken, expiresIn } = generateAdminAccessToken(admin.id, admin.role);
    const { refreshToken } = await sessionRepo.create(admin.id, {
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    // 10. 记录成功登录
    await attemptRepo.record({
      username: request.username,
      ipAddress: request.ipAddress || "unknown",
      success: true,
      userAgent: request.userAgent,
    });

    await adminAudit({
      adminId: admin.id,
      adminUsername: admin.username,
      action: "admin.login",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      riskLevel: "low",
      details: { method: "password" },
    });

    logger.info("[admin-auth] Admin logged in successfully", {
      adminId: admin.id,
      username: admin.username,
    });

    return {
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        email: admin.email,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        permissions: admin.permissions,
      },
      accessToken,
      refreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error("[admin-auth] Login error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      username: request.username,
    });
    // 临时调试：将详细错误打印到标准错误
    console.error("[admin-auth] LOGIN_ERROR detail:", error);

    return {
      success: false,
      error: "登录失败，请稍后重试",
      errorCode: "LOGIN_ERROR",
    };
  }
}

/**
 * 刷新管理员 Token
 */
export async function adminRefreshToken(
  request: AdminRefreshTokenRequest,
): Promise<AdminAuthResult> {
  const adminRepo = getAdminRepository();
  const sessionRepo = getAdminSessionRepository();

  try {
    // 1. 查找会话
    const session = await sessionRepo.findByRefreshToken(request.refreshToken);
    if (!session) {
      logger.debug("[admin-auth] Token refresh failed: invalid refresh token");
      return {
        success: false,
        error: "无效的刷新令牌",
        errorCode: "INVALID_REFRESH_TOKEN",
      };
    }

    // 2. 查找管理员
    const admin = await adminRepo.findById(session.adminId);
    if (!admin || admin.status !== "active") {
      logger.warn("[admin-auth] Token refresh failed: admin not found or inactive", {
        adminId: session.adminId,
      });
      return {
        success: false,
        error: "管理员不存在或已被停用",
        errorCode: "ADMIN_INACTIVE",
      };
    }

    // 3. 检查是否需要轮转 Refresh Token
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    let newRefreshToken = request.refreshToken;

    if (timeUntilExpiry < ADMIN_TOKEN_CONFIG.refreshRotateThreshold) {
      // 轮转 Refresh Token
      const refreshResult = await sessionRepo.refresh(session.id);
      if (refreshResult) {
        newRefreshToken = refreshResult.refreshToken;
        logger.debug("[admin-auth] Refresh token rotated", { adminId: admin.id });
      }
    } else {
      // 更新最后活跃时间
      await sessionRepo.updateLastActive(session.id);
    }

    // 4. 生成新的 Access Token
    const { accessToken, expiresIn } = generateAdminAccessToken(admin.id, admin.role);

    logger.debug("[admin-auth] Token refreshed successfully", { adminId: admin.id });

    return {
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        email: admin.email,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        permissions: admin.permissions,
      },
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  } catch (error) {
    logger.error("[admin-auth] Token refresh error", {
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
 * 管理员登出
 */
export async function adminLogout(
  refreshToken: string,
  options?: { ipAddress?: string; userAgent?: string; adminId?: string; adminUsername?: string },
): Promise<{ success: boolean }> {
  const sessionRepo = getAdminSessionRepository();

  try {
    const session = await sessionRepo.findByRefreshToken(refreshToken);
    if (session) {
      await sessionRepo.revoke(session.id);

      if (options?.adminUsername) {
        await adminAudit({
          adminId: session.adminId,
          adminUsername: options.adminUsername,
          action: "admin.logout",
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          riskLevel: "low",
        });
      }

      logger.debug("[admin-auth] Admin logged out", { adminId: session.adminId });
    }

    return { success: true };
  } catch (error) {
    logger.error("[admin-auth] Logout error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { success: true }; // 登出失败也返回成功
  }
}

/**
 * 登出管理员所有设备
 */
export async function adminLogoutAll(
  adminId: string,
  options?: { ipAddress?: string; userAgent?: string; adminUsername?: string },
): Promise<{ success: boolean }> {
  const sessionRepo = getAdminSessionRepository();

  try {
    await sessionRepo.revokeAllForAdmin(adminId);

    if (options?.adminUsername) {
      await adminAudit({
        adminId,
        adminUsername: options.adminUsername,
        action: "admin.logout_all",
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        riskLevel: "medium",
      });
    }

    logger.info("[admin-auth] All sessions revoked for admin", { adminId });

    return { success: true };
  } catch (error) {
    logger.error("[admin-auth] Logout all error", {
      error: error instanceof Error ? error.message : "Unknown error",
      adminId,
    });
    return { success: false };
  }
}

/**
 * 获取管理员信息 (通过 Access Token 解析的 ID)
 */
export async function getAdminProfile(adminId: string): Promise<AdminAuthResult["admin"] | null> {
  const adminRepo = getAdminRepository();

  try {
    const admin = await adminRepo.findById(adminId);
    if (!admin || admin.status !== "active") {
      return null;
    }

    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      permissions: admin.permissions,
    };
  } catch (error) {
    logger.error("[admin-auth] Get profile error", {
      error: error instanceof Error ? error.message : "Unknown error",
      adminId,
    });
    return null;
  }
}

/**
 * 修改管理员密码参数
 */
export interface ChangeAdminPasswordRequest {
  /** 管理员 ID */
  adminId: string;
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
 * 修改管理员密码
 *
 * 验证旧密码、校验新密码强度、更新密码、吊销所有会话、记录审计日志
 */
export async function changeAdminPassword(
  request: ChangeAdminPasswordRequest,
): Promise<{ success: boolean; error?: string }> {
  const adminRepo = getAdminRepository();
  const sessionRepo = getAdminSessionRepository();

  try {
    // 1. 查找管理员
    const admin = await adminRepo.findById(request.adminId);
    if (!admin || admin.status !== "active") {
      logger.warn("[admin-auth] Change password failed: admin not found or inactive", {
        adminId: request.adminId,
      });
      return { success: false, error: "管理员不存在或已被停用" };
    }

    // 2. 验证当前密码
    const passwordValid = await verifyPassword(request.currentPassword, admin.passwordHash);
    if (!passwordValid) {
      logger.debug("[admin-auth] Change password failed: current password incorrect", {
        adminId: request.adminId,
      });

      await adminAudit({
        adminId: admin.id,
        adminUsername: admin.username,
        action: "admin.change_password",
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        riskLevel: "medium",
        details: { failureReason: "invalid_current_password" },
      });

      return { success: false, error: "当前密码错误" };
    }

    // 3. 校验新密码强度
    const strengthCheck = validatePasswordStrength(request.newPassword);
    if (!strengthCheck.valid) {
      return { success: false, error: strengthCheck.errors.join("；") };
    }

    // 4. 更新密码（Repository 自动哈希 + 设置 passwordChangedAt）
    await adminRepo.update(admin.id, { passwordHash: request.newPassword });

    // 5. 吊销所有会话（强制重新登录）
    await sessionRepo.revokeAllForAdmin(admin.id);

    // 6. 记录审计日志
    await adminAudit({
      adminId: admin.id,
      adminUsername: admin.username,
      action: "admin.change_password",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      riskLevel: "high",
      details: { method: "self_change" },
    });

    logger.info("[admin-auth] Admin password changed successfully", {
      adminId: admin.id,
      username: admin.username,
    });

    return { success: true };
  } catch (error) {
    logger.error("[admin-auth] Change password error", {
      error: error instanceof Error ? error.message : "Unknown error",
      adminId: request.adminId,
    });
    return { success: false, error: "修改密码失败，请稍后重试" };
  }
}

/**
 * 更新管理员资料参数
 */
export interface UpdateAdminProfileRequest {
  /** 管理员 ID */
  adminId: string;
  /** 显示名称 */
  displayName?: string;
  /** 邮箱 */
  email?: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 更新管理员资料
 *
 * 允许管理员修改自己的显示名称和邮箱
 */
export async function updateAdminProfile(
  request: UpdateAdminProfileRequest,
): Promise<{ success: boolean; error?: string; admin?: AdminAuthResult["admin"] }> {
  const adminRepo = getAdminRepository();

  try {
    // 1. 查找管理员
    const admin = await adminRepo.findById(request.adminId);
    if (!admin || admin.status !== "active") {
      logger.warn("[admin-auth] Update profile failed: admin not found or inactive", {
        adminId: request.adminId,
      });
      return { success: false, error: "管理员不存在或已被停用" };
    }

    // 2. 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (request.displayName !== undefined) {
      updateData.displayName = request.displayName.trim();
    }
    if (request.email !== undefined) {
      updateData.email = request.email.trim().toLowerCase() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "没有需要更新的内容" };
    }

    // 3. 更新资料
    const updated = await adminRepo.update(admin.id, updateData);
    if (!updated) {
      return { success: false, error: "更新失败" };
    }

    // 4. 记录审计日志
    await adminAudit({
      adminId: admin.id,
      adminUsername: admin.username,
      action: "admin.update_profile",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      riskLevel: "low",
      details: { updatedFields: Object.keys(updateData) },
    });

    logger.info("[admin-auth] Admin profile updated", {
      adminId: admin.id,
      updatedFields: Object.keys(updateData),
    });

    return {
      success: true,
      admin: {
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        email: updated.email,
        role: updated.role,
        avatarUrl: updated.avatarUrl,
        permissions: updated.permissions,
      },
    };
  } catch (error) {
    logger.error("[admin-auth] Update profile error", {
      error: error instanceof Error ? error.message : "Unknown error",
      adminId: request.adminId,
    });
    return { success: false, error: "更新资料失败，请稍后重试" };
  }
}
