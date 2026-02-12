/**
 * 绠＄悊鍚庡彴鐢ㄦ埛绠＄悊 RPC 鏂规硶澶勭悊鍣? *
 * 鎻愪緵鐢ㄦ埛鍒楄〃鏌ヨ銆佺敤鎴疯鎯呫€佺敤鎴风姸鎬佺鐞嗙瓑 RPC 鏂规硶
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
  hasAdminRole,
} from "../../assistant/admin-auth/index.js";
import {
  getAdminUserService,
  type UserListParams,
} from "../../assistant/admin-console/admin-user-service.js";
import { getAdminRepository } from "../../db/repositories/admins.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-users";

/**
 * 楠岃瘉绠＄悊鍛樿韩浠藉苟杩斿洖绠＄悊鍛樹俊鎭? */
async function validateAdminAuth(
  params: Record<string, unknown>,
): Promise<{ adminId: string; role: string; username: string } | null> {
  const authHeader = params["authorization"] as string | undefined;
  const token = extractAdminBearerToken(authHeader);
  if (!token) return null;

  const payload = verifyAdminAccessToken(token);
  if (!payload) return null;

  // 鑾峰彇绠＄悊鍛樼敤鎴峰悕
  const adminRepo = getAdminRepository();
  const admin = await adminRepo.findById(payload.sub);
  if (!admin || admin.status !== "active") return null;

  return { adminId: payload.sub, role: payload.role, username: admin.username };
}

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
 * 楠岃瘉鏁板瓧鍙傛暟
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  defaultValue?: number,
): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(num)) {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return num;
}

/**
 * 绠＄悊鍚庡彴鐢ㄦ埛绠＄悊 RPC 鏂规硶
 */
export const adminUserMethods: GatewayRequestHandlers = {
  /**
   * 鑾峰彇鐢ㄦ埛鍒楄〃
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - search?: string - 鎼滅储鍏抽敭璇?   * - status?: string - 鐘舵€佽繃婊?(active/inactive/all)
   * - subscriptionStatus?: string - 璁㈤槄鐘舵€佽繃婊?   * - page?: number - 椤电爜
   * - pageSize?: number - 姣忛〉鏁伴噺
   * - orderBy?: string - 鎺掑簭瀛楁
   * - orderDir?: string - 鎺掑簭鏂瑰悜
   */
  "admin.users.list": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (operator 鍙婁互涓婂彲鏌ョ湅)
      if (!hasAdminRole("operator", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const listParams: UserListParams = {
        search: validateStringParam(params, "search"),
        status: validateStringParam(params, "status") as "active" | "inactive" | "all",
        subscriptionStatus: validateStringParam(params, "subscriptionStatus") as any,
        page: validateNumberParam(params, "page", 1),
        pageSize: validateNumberParam(params, "pageSize", 20),
        orderBy: validateStringParam(params, "orderBy") as
          | "createdAt"
          | "lastLoginAt"
          | "displayName",
        orderDir: validateStringParam(params, "orderDir") as "asc" | "desc",
      };

      const service = getAdminUserService();
      const result = await service.listUsers(listParams);

      respond(true, { success: true, ...result });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List users error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇鐢ㄦ埛鍒楄〃澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛璇︽儏
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   */
  "admin.users.get": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      const userId = validateStringParam(params, "userId", true)!;

      const service = getAdminUserService();
      const user = await service.getUserDetail(userId);

      if (!user) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鐢ㄦ埛涓嶅瓨鍦?, {
            details: { errorCode: "USER_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, user });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get user detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇鐢ㄦ埛璇︽儏澶辫触",
        ),
      );
    }
  },

  /**
   * 鍋滅敤鐢ㄦ埛
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   * - reason?: string - 鍋滅敤鍘熷洜
   */
  "admin.users.suspend": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (admin 鍙婁互涓婂彲鍋滅敤鐢ㄦ埛)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const userId = validateStringParam(params, "userId", true)!;
      const reason = validateStringParam(params, "reason");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Suspending user`, {
        userId,
        adminId: auth.adminId,
      });

      const service = getAdminUserService();
      const result = await service.suspendUser(
        userId,
        auth.adminId,
        auth.username,
        reason,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鍋滅敤澶辫触"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Suspend user error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鍋滅敤鐢ㄦ埛澶辫触",
        ),
      );
    }
  },

  /**
   * 婵€娲荤敤鎴?   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   */
  "admin.users.activate": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (admin 鍙婁互涓婂彲婵€娲荤敤鎴?
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const userId = validateStringParam(params, "userId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Activating user`, {
        userId,
        adminId: auth.adminId,
      });

      const service = getAdminUserService();
      const result = await service.activateUser(
        userId,
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "婵€娲诲け璐?),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Activate user error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "婵€娲荤敤鎴峰け璐?,
        ),
      );
    }
  },

  /**
   * 閲嶇疆鐢ㄦ埛瀵嗙爜
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   * - newPassword: string - 鏂板瘑鐮?   */
  "admin.users.resetPassword": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (super_admin 鍙噸缃瘑鐮?
      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻锛屼粎瓒呯骇绠＄悊鍛樺彲閲嶇疆瀵嗙爜", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const userId = validateStringParam(params, "userId", true)!;
      const newPassword = validateStringParam(params, "newPassword", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (newPassword.length < 8) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "瀵嗙爜闀垮害鑷冲皯 8 浣?));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Resetting user password`, {
        userId,
        adminId: auth.adminId,
      });

      const service = getAdminUserService();
      const result = await service.resetUserPassword(
        userId,
        newPassword,
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "閲嶇疆瀵嗙爜澶辫触"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Reset password error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "閲嶇疆瀵嗙爜澶辫触",
        ),
      );
    }
  },

  /**
   * 瑙ｇ粦鐢ㄦ埛璁惧
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   * - deviceId: string - 璁惧 ID
   */
  "admin.users.unlinkDevice": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (admin 鍙婁互涓婂彲瑙ｇ粦璁惧)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const userId = validateStringParam(params, "userId", true)!;
      const deviceId = validateStringParam(params, "deviceId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Unlinking user device`, {
        userId,
        deviceId,
        adminId: auth.adminId,
      });

      const service = getAdminUserService();
      const result = await service.unlinkUserDevice(
        userId,
        deviceId,
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "瑙ｇ粦璁惧澶辫触"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Unlink device error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "瑙ｇ粦璁惧澶辫触",
        ),
      );
    }
  },

  /**
   * 寮哄埗鐧诲嚭鐢ㄦ埛
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - userId: string - 鐢ㄦ埛 ID
   */
  "admin.users.forceLogout": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 楠岃瘉鏉冮檺 (admin 鍙婁互涓婂彲寮哄埗鐧诲嚭)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏉冮檺涓嶈冻", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const userId = validateStringParam(params, "userId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Force logout user`, {
        userId,
        adminId: auth.adminId,
      });

      const service = getAdminUserService();
      const result = await service.forceLogoutUser(
        userId,
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "寮哄埗鐧诲嚭澶辫触"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Force logout error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "寮哄埗鐧诲嚭澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛缁熻淇℃伅
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   */
  "admin.users.stats": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      const service = getAdminUserService();
      const stats = await service.getUserStats();

      respond(true, { success: true, stats });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get user stats error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇缁熻澶辫触",
        ),
      );
    }
  },
};
