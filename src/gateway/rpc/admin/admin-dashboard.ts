/**
 * 绠＄悊鍚庡彴浠〃鐩?RPC 鏂规硶澶勭悊鍣? *
 * 鎻愪緵浠〃鐩樼粺璁℃暟鎹€佽秼鍔挎暟鎹€佸疄鏃跺姩鎬佺瓑 RPC 鏂规硶
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";
import { getAdminDashboardService } from "../../assistant/admin-console/admin-dashboard-service.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-dashboard";

/**
 * 楠岃瘉绠＄悊鍛樿韩浠? */
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
 * 绠＄悊鍚庡彴浠〃鐩?RPC 鏂规硶
 */
export const adminDashboardMethods: GatewayRequestHandlers = {
  /**
   * 鑾峰彇浠〃鐩樼粺璁℃瑙?   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   */
  "admin.dashboard.stats": async ({ params, respond, context }) => {
    try {
      // 楠岃瘉绠＄悊鍛樿韩浠?      const auth = validateAdminAuth(params);
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

      context.logGateway.info(`[${LOG_TAG}] Getting dashboard stats`, {
        adminId: auth.adminId,
      });

      const service = getAdminDashboardService();
      const stats = await service.getStats();

      respond(true, {
        success: true,
        data: stats,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Failed to get dashboard stats`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "鑾峰彇缁熻鏁版嵁澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇瓒嬪娍鏁版嵁
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - type: string - 瓒嬪娍绫诲瀷 (users | revenue | subscriptions)
   * - period?: string - 鏃堕棿鍛ㄦ湡 (7d | 30d | 90d)锛岄粯璁?30d
   */
  "admin.dashboard.trends": async ({ params, respond, context }) => {
    try {
      // 楠岃瘉绠＄悊鍛樿韩浠?      const auth = validateAdminAuth(params);
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

      const type = params["type"] as "users" | "revenue" | "subscriptions";
      const period = (params["period"] as "7d" | "30d" | "90d") || "30d";

      if (!type || !["users", "revenue", "subscriptions"].includes(type)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏃犳晥鐨勮秼鍔跨被鍨?, {
            details: { errorCode: "INVALID_TYPE" },
          }),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Getting trends`, {
        adminId: auth.adminId,
        type,
        period,
      });

      const service = getAdminDashboardService();
      const trends = await service.getTrends(type, period);

      respond(true, {
        success: true,
        data: trends,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Failed to get trends`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "鑾峰彇瓒嬪娍鏁版嵁澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇璁㈤槄鍒嗗竷鏁版嵁
   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   */
  "admin.dashboard.subscriptionDistribution": async ({ params, respond, context }) => {
    try {
      // 楠岃瘉绠＄悊鍛樿韩浠?      const auth = validateAdminAuth(params);
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

      context.logGateway.info(`[${LOG_TAG}] Getting subscription distribution`, {
        adminId: auth.adminId,
      });

      const service = getAdminDashboardService();
      const distribution = await service.getSubscriptionDistribution();

      respond(true, {
        success: true,
        data: distribution,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Failed to get subscription distribution`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "鑾峰彇璁㈤槄鍒嗗竷澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇鏈€杩戞椿鍔?   *
   * 鍙傛暟:
   * - authorization: string - Bearer Token
   * - limit?: number - 杩斿洖鏁伴噺闄愬埗锛岄粯璁?10
   */
  "admin.dashboard.activities": async ({ params, respond, context }) => {
    try {
      // 楠岃瘉绠＄悊鍛樿韩浠?      const auth = validateAdminAuth(params);
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

      const limit =
        typeof params["limit"] === "number" ? Math.min(Math.max(1, params["limit"]), 50) : 10;

      context.logGateway.info(`[${LOG_TAG}] Getting activities`, {
        adminId: auth.adminId,
        limit,
      });

      const service = getAdminDashboardService();
      const activities = await service.getActivities(limit);

      respond(true, {
        success: true,
        data: activities,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Failed to get activities`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "鑾峰彇娲诲姩鏁版嵁澶辫触",
        ),
      );
    }
  },
};
