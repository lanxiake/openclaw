/**
 * 用户认证 RPC 方法处理器
 *
 * 为 Windows 客户端提供用户认证相关的 RPC 方法
 * 包括注册、登录、Token 刷新、验证码发送等
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  sendVerificationCode,
} from "../../assistant/auth/index.js";

// 日志标签
const LOG_TAG = "auth";

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false
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
 * 用户认证 RPC 方法
 */
export const authMethods: GatewayRequestHandlers = {
  /**
   * 发送验证码
   *
   * 参数:
   * - target: string - 手机号或邮箱
   * - targetType: 'phone' | 'email'
   * - purpose: 'register' | 'login' | 'reset_password' | 'bind' | 'verify'
   */
  "auth.sendCode": async ({ params, respond, context }) => {
    try {
      const target = validateStringParam(params, "target", true)!;
      const targetType = validateStringParam(params, "targetType", true) as
        | "phone"
        | "email";
      const purpose = validateStringParam(params, "purpose", true) as
        | "register"
        | "login"
        | "reset_password"
        | "bind"
        | "verify";

      // 获取客户端 IP (从 context 获取)
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await sendVerificationCode({
        target,
        targetType,
        purpose,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          nextSendAt: result.nextSendAt,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "发送失败", {
            details: { errorCode: result.errorCode },
          })
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] sendCode error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "发送验证码失败"
        )
      );
    }
  },

  /**
   * 用户注册
   *
   * 参数:
   * - phone?: string - 手机号
   * - email?: string - 邮箱
   * - code: string - 验证码
   * - password?: string - 密码 (可选)
   * - displayName?: string - 显示名称
   */
  "auth.register": async ({ params, respond, context }) => {
    try {
      const phone = validateStringParam(params, "phone");
      const email = validateStringParam(params, "email");
      const code = validateStringParam(params, "code", true)!;
      const password = validateStringParam(params, "password");
      const displayName = validateStringParam(params, "displayName");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await register({
        phone,
        email,
        code,
        password,
        displayName,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "注册失败", {
            details: { errorCode: result.errorCode },
          })
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] register error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "注册失败"
        )
      );
    }
  },

  /**
   * 用户登录
   *
   * 参数:
   * - identifier: string - 手机号或邮箱
   * - password?: string - 密码 (二选一)
   * - code?: string - 验证码 (二选一)
   */
  "auth.login": async ({ params, respond, context }) => {
    try {
      const identifier = validateStringParam(params, "identifier", true)!;
      const password = validateStringParam(params, "password");
      const code = validateStringParam(params, "code");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await login({
        identifier,
        password,
        code,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          user: result.user,
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
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "登录失败", {
            details: { errorCode: result.errorCode },
          })
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] login error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "登录失败"
        )
      );
    }
  },

  /**
   * 刷新 Token
   *
   * 参数:
   * - refreshToken: string - 刷新令牌
   */
  "auth.refreshToken": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(
        params,
        "refreshToken",
        true
      )!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await refreshToken({
        refreshToken: refreshTokenValue,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            result.error || "刷新令牌失败",
            { details: { errorCode: result.errorCode } }
          )
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] refreshToken error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "刷新令牌失败"
        )
      );
    }
  },

  /**
   * 用户登出
   *
   * 参数:
   * - refreshToken: string - 刷新令牌
   */
  "auth.logout": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(
        params,
        "refreshToken",
        true
      )!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      await logout(refreshTokenValue, { ipAddress, userAgent });

      respond(true, { success: true });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] logout error`, {
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
   * - userId: string - 用户 ID
   */
  "auth.logoutAll": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await logoutAll(userId, { ipAddress, userAgent });

      respond(true, { success: result.success });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] logoutAll error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "登出失败"
        )
      );
    }
  },
};
