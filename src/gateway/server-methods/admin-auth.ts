/**
 * 管理员认证 RPC 方法处理器
 *
 * 为 Admin Console 提供管理员认证相关的 RPC 方法
 * 包括登录、登出、Token 刷新等
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  adminLogoutAll,
  getAdminProfile,
  changeAdminPassword,
  updateAdminProfile,
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";

// 日志标签
const LOG_TAG = "admin-auth";

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }
  return value.trim();
}

/**
 * 从请求参数中获取 Access Token 并验证
 * 返回管理员 ID 和角色，验证失败返回 null
 */
function validateAdminAuth(
  params: Record<string, unknown>,
): { adminId: string; role: string } | null {
  const authHeader = params["authorization"] as string | undefined;
  const token = extractAdminBearerToken(authHeader);
  if (!token) return null;

  const payload = verifyAdminAccessToken(token);
  if (!payload) return null;

  return { adminId: payload.sub, role: payload.role };
}

/**
 * 管理员认证 RPC 方法
 */
export const adminAuthMethods: GatewayRequestHandlers = {
  /**
   * 管理员登录
   *
   * 参数:
   * - username: string - 用户名
   * - password: string - 密码
   * - mfaCode?: string - MFA 验证码 (可选)
   */
  "admin.login": async ({ params, respond, context }) => {
    try {
      const username = validateStringParam(params, "username", true)!;
      const password = validateStringParam(params, "password", true)!;
      const mfaCode = validateStringParam(params, "mfaCode");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Login attempt`, { username });

      const result = await adminLogin({
        username,
        password,
        mfaCode,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        context.logGateway.info(`[${LOG_TAG}] Login successful`, {
          username,
          adminId: result.admin?.id,
        });
        respond(true, {
          success: true,
          admin: result.admin,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
      } else if (result.mfaRequired) {
        respond(true, {
          success: false,
          mfaRequired: true,
          mfaMethod: result.mfaMethod,
        });
      } else {
        context.logGateway.warn(`[${LOG_TAG}] Login failed`, {
          username,
          errorCode: result.errorCode,
        });
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "登录失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Login error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "登录失败"),
      );
    }
  },

  /**
   * 刷新管理员 Token
   *
   * 参数:
   * - refreshToken: string - 刷新令牌
   */
  "admin.refreshToken": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(params, "refreshToken", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await adminRefreshToken({
        refreshToken: refreshTokenValue,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          admin: result.admin,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "刷新令牌失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Token refresh error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "刷新令牌失败",
        ),
      );
    }
  },

  /**
   * 管理员登出
   *
   * 参数:
   * - refreshToken: string - 刷新令牌
   */
  "admin.logout": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(params, "refreshToken", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      // 获取当前管理员信息用于审计
      const auth = validateAdminAuth(params);

      await adminLogout(refreshTokenValue, {
        ipAddress,
        userAgent,
        adminId: auth?.adminId,
        adminUsername: undefined, // 从会话中获取
      });

      respond(true, { success: true });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Logout error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // 登出失败也返回成功
      respond(true, { success: true });
    }
  },

  /**
   * 登出所有设备
   *
   * 参数:
   * - authorization: string - Bearer Token (用于验证身份)
   */
  "admin.logoutAll": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权访问", {
            details: { errorCode: "UNAUTHORIZED" },
          }),
        );
        return;
      }

      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await adminLogoutAll(auth.adminId, {
        ipAddress,
        userAgent,
      });

      respond(true, { success: result.success });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Logout all error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "登出失败"),
      );
    }
  },

  /**
   * 获取当前管理员信息
   *
   * 参数:
   * - authorization: string - Bearer Token
   */
  "admin.getProfile": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权访问", {
            details: { errorCode: "UNAUTHORIZED" },
          }),
        );
        return;
      }

      const admin = await getAdminProfile(auth.adminId);
      if (!admin) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "管理员不存在", {
            details: { errorCode: "ADMIN_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, admin });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get profile error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取信息失败",
        ),
      );
    }
  },

  /**
   * 验证管理员 Token
   *
   * 参数:
   * - authorization: string - Bearer Token
   */
  "admin.validateToken": async ({ params, respond }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(true, { valid: false });
        return;
      }

      // 检查管理员是否仍然有效
      const admin = await getAdminProfile(auth.adminId);
      if (!admin) {
        respond(true, { valid: false });
        return;
      }

      respond(true, {
        valid: true,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
        },
      });
    } catch {
      respond(true, { valid: false });
    }
  },

  /**
   * 修改管理员密码
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - currentPassword: string - 当前密码
   * - newPassword: string - 新密码
   */
  "admin.changePassword": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权访问", {
            details: { errorCode: "UNAUTHORIZED" },
          }),
        );
        return;
      }

      const currentPassword = validateStringParam(params, "currentPassword", true)!;
      const newPassword = validateStringParam(params, "newPassword", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Change password attempt`, {
        adminId: auth.adminId,
      });

      const result = await changeAdminPassword({
        adminId: auth.adminId,
        currentPassword,
        newPassword,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        context.logGateway.info(`[${LOG_TAG}] Password changed successfully`, {
          adminId: auth.adminId,
        });
        respond(true, { success: true, message: "密码修改成功，请重新登录" });
      } else {
        context.logGateway.warn(`[${LOG_TAG}] Change password failed`, {
          adminId: auth.adminId,
          error: result.error,
        });
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "修改密码失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Change password error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "修改密码失败",
        ),
      );
    }
  },

  /**
   * 更新管理员资料
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - displayName?: string - 显示名称
   * - email?: string - 邮箱
   */
  "admin.updateProfile": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权访问", {
            details: { errorCode: "UNAUTHORIZED" },
          }),
        );
        return;
      }

      const displayName = validateStringParam(params, "displayName");
      const email = validateStringParam(params, "email");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Update profile attempt`, {
        adminId: auth.adminId,
      });

      const result = await updateAdminProfile({
        adminId: auth.adminId,
        displayName,
        email,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        context.logGateway.info(`[${LOG_TAG}] Profile updated successfully`, {
          adminId: auth.adminId,
        });
        respond(true, { success: true, admin: result.admin });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "更新失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Update profile error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "更新资料失败",
        ),
      );
    }
  },
};
