/**
 * 绠＄悊鍛樿璇?RPC 鏂规硶澶勭悊鍣? *
 * 涓?Admin Console 鎻愪緵绠＄悊鍛樿璇佺浉鍏崇殑 RPC 鏂规硶
 * 鍖呮嫭鐧诲綍銆佺櫥鍑恒€乀oken 鍒锋柊绛? */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  adminLogoutAll,
  getAdminProfile,
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-auth";

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
 * 浠庤姹傚弬鏁颁腑鑾峰彇 Access Token 骞堕獙璇? * 杩斿洖绠＄悊鍛?ID 鍜岃鑹诧紝楠岃瘉澶辫触杩斿洖 null
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
 * 绠＄悊鍛樿璇?RPC 鏂规硶
 */
export const adminAuthMethods: GatewayRequestHandlers = {
  /**
   * 绠＄悊鍛樼櫥褰?   *
   * 鍙傛暟:
   * - username: string - 鐢ㄦ埛鍚?   * - password: string - 瀵嗙爜
   * - mfaCode?: string - MFA 楠岃瘉鐮?(鍙€?
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鐧诲綍澶辫触", {
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
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "鐧诲綍澶辫触"),
      );
    }
  },

  /**
   * 鍒锋柊绠＄悊鍛?Token
   *
   * 鍙傛暟:
   * - refreshToken: string - 鍒锋柊浠ょ墝
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鍒锋柊浠ょ墝澶辫触", {
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
          error instanceof Error ? error.message : "鍒锋柊浠ょ墝澶辫触",
        ),
      );
    }
  },

  /**
   * 绠＄悊鍛樼櫥鍑?   *
   * 鍙傛暟:
   * - refreshToken: string - 鍒锋柊浠ょ墝
   */
  "admin.logout": async ({ params, respond, context }) => {
    try {
      const refreshTokenValue = validateStringParam(params, "refreshToken", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      // 鑾峰彇褰撳墠绠＄悊鍛樹俊鎭敤浜庡璁?      const auth = validateAdminAuth(params);

      await adminLogout(refreshTokenValue, {
        ipAddress,
        userAgent,
        adminId: auth?.adminId,
        adminUsername: undefined, // 浠庝細璇濅腑鑾峰彇
      });

      respond(true, { success: true });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Logout error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // 鐧诲嚭澶辫触涔熻繑鍥炴垚鍔?      respond(true, { success: true });
    }
  },

  /**
   * 鐧诲嚭鎵€鏈夎澶?   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token (鐢ㄤ簬楠岃瘉韬唤)
   */
  "admin.logoutAll": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏈巿鏉冭闂?, {
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
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "鐧诲嚭澶辫触"),
      );
    }
  },

  /**
   * 鑾峰彇褰撳墠绠＄悊鍛樹俊鎭?   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   */
  "admin.getProfile": async ({ params, respond, context }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏈巿鏉冭闂?, {
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
          errorShape(ErrorCodes.INVALID_REQUEST, "绠＄悊鍛樹笉瀛樺湪", {
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
          error instanceof Error ? error.message : "鑾峰彇淇℃伅澶辫触",
        ),
      );
    }
  },

  /**
   * 楠岃瘉绠＄悊鍛?Token
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   */
  "admin.validateToken": async ({ params, respond }) => {
    try {
      const auth = validateAdminAuth(params);
      if (!auth) {
        respond(true, { valid: false });
        return;
      }

      // 妫€鏌ョ鐞嗗憳鏄惁浠嶇劧鏈夋晥
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
};
