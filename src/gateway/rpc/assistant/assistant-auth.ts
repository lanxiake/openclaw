/**
 * 鐢ㄦ埛璁よ瘉 RPC 鏂规硶澶勭悊鍣? *
 * 涓?Windows 瀹㈡埛绔彁渚涚敤鎴疯璇佺浉鍏崇殑 RPC 鏂规硶
 * 鍖呮嫭娉ㄥ唽銆佺櫥褰曘€乀oken 鍒锋柊銆侀獙璇佺爜鍙戦€佺瓑
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  sendVerificationCode,
} from "../../assistant/auth/index.js";

// 鏃ュ織鏍囩
const LOG_TAG = "auth";

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * 鐢ㄦ埛璁よ瘉 RPC 鏂规硶
 */
export const authMethods: GatewayRequestHandlers = {
  /**
   * 鍙戦€侀獙璇佺爜
   *
   * 鍙傛暟:
   * - target: string - 鎵嬫満鍙锋垨閭
   * - targetType: 'phone' | 'email'
   * - purpose: 'register' | 'login' | 'reset_password' | 'bind' | 'verify'
   */
  "auth.sendCode": async ({ params, respond, context }) => {
    try {
      const target = validateStringParam(params, "target", true)!;
      const targetType = validateStringParam(params, "targetType", true) as "phone" | "email";
      const purpose = validateStringParam(params, "purpose", true) as
        | "register"
        | "login"
        | "reset_password"
        | "bind"
        | "verify";

      // 鑾峰彇瀹㈡埛绔?IP (浠?context 鑾峰彇)
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鍙戦€佸け璐?, {
            details: { errorCode: result.errorCode },
          }),
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
          error instanceof Error ? error.message : "鍙戦€侀獙璇佺爜澶辫触",
        ),
      );
    }
  },

  /**
   * 鐢ㄦ埛娉ㄥ唽
   *
   * 鍙傛暟:
   * - phone?: string - 鎵嬫満鍙?   * - email?: string - 閭
   * - code: string - 楠岃瘉鐮?   * - password?: string - 瀵嗙爜 (鍙€?
   * - displayName?: string - 鏄剧ず鍚嶇О
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "娉ㄥ唽澶辫触", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] register error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "娉ㄥ唽澶辫触"),
      );
    }
  },

  /**
   * 鐢ㄦ埛鐧诲綍
   *
   * 鍙傛暟:
   * - identifier: string - 鎵嬫満鍙锋垨閭
   * - password?: string - 瀵嗙爜 (浜岄€変竴)
   * - code?: string - 楠岃瘉鐮?(浜岄€変竴)
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鐧诲綍澶辫触", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] login error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "鐧诲綍澶辫触"),
      );
    }
  },

  /**
   * 鍒锋柊 Token
   *
   * 鍙傛暟:
   * - refreshToken: string - 鍒锋柊浠ょ墝
   */
  "auth.refreshToken": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(params, "refreshToken", true)!;
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鍒锋柊浠ょ墝澶辫触", {
            details: { errorCode: result.errorCode },
          }),
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
          error instanceof Error ? error.message : "鍒锋柊浠ょ墝澶辫触",
        ),
      );
    }
  },

  /**
   * 鐢ㄦ埛鐧诲嚭
   *
   * 鍙傛暟:
   * - refreshToken: string - 鍒锋柊浠ょ墝
   */
  "auth.logout": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(params, "refreshToken", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      await logout(refreshTokenValue, { ipAddress, userAgent });

      respond(true, { success: true });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] logout error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // 鐧诲嚭澶辫触涔熻繑鍥炴垚鍔?      respond(true, { success: true });
    }
  },

  /**
   * 鐧诲嚭鎵€鏈夎澶?   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
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
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "鐧诲嚭澶辫触"),
      );
    }
  },
};
