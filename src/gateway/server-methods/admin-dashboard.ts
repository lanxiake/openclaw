/**
 * 管理后台仪表盘 RPC 方法处理器
 *
 * 提供仪表盘统计数据、趋势数据、实时动态等 RPC 方法
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";
import { getAdminDashboardService } from "../../assistant/admin-console/admin-dashboard-service.js";

// 日志标签
const LOG_TAG = "admin-dashboard";

/**
 * 验证管理员身份
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
 * 管理后台仪表盘 RPC 方法
 */
export const adminDashboardMethods: GatewayRequestHandlers = {
  /**
   * 获取仪表盘统计概览
   *
   * 参数:
   * - authorization: string - Bearer Token
   */
  "admin.dashboard.stats": async ({ params, respond, context }) => {
    try {
      // 验证管理员身份
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
          error instanceof Error ? error.message : "获取统计数据失败",
        ),
      );
    }
  },

  /**
   * 获取趋势数据
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - type: string - 趋势类型 (users | revenue | subscriptions)
   * - period?: string - 时间周期 (7d | 30d | 90d)，默认 30d
   */
  "admin.dashboard.trends": async ({ params, respond, context }) => {
    try {
      // 验证管理员身份
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

      const type = params["type"] as "users" | "revenue" | "subscriptions";
      const period = (params["period"] as "7d" | "30d" | "90d") || "30d";

      if (!type || !["users", "revenue", "subscriptions"].includes(type)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无效的趋势类型", {
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
          error instanceof Error ? error.message : "获取趋势数据失败",
        ),
      );
    }
  },

  /**
   * 获取订阅分布数据
   *
   * 参数:
   * - authorization: string - Bearer Token
   */
  "admin.dashboard.subscriptionDistribution": async ({ params, respond, context }) => {
    try {
      // 验证管理员身份
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
          error instanceof Error ? error.message : "获取订阅分布失败",
        ),
      );
    }
  },

  /**
   * 获取最近活动
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - limit?: number - 返回数量限制，默认 10
   */
  "admin.dashboard.activities": async ({ params, respond, context }) => {
    try {
      // 验证管理员身份
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
          error instanceof Error ? error.message : "获取活动数据失败",
        ),
      );
    }
  },
};
