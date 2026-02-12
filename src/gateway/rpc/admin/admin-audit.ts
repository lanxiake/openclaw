/**
 * 绠＄悊鍚庡彴瀹¤鏃ュ織 RPC 鏂规硶澶勭悊鍣? *
 * 鎻愪緵瀹¤鏃ュ織鍒楄〃鏌ヨ銆佽鎯呮煡鐪嬨€佺粺璁′俊鎭€佸鍑虹瓑 RPC 鏂规硶
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";
import {
  getAdminAuditService,
  type AuditLogListParams,
} from "../../assistant/admin-console/admin-audit-service.js";
import { getAdminRepository } from "../../db/repositories/admins.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-audit";

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
 * 绠＄悊鍚庡彴瀹¤鏃ュ織 RPC 鏂规硶
 */
export const adminAuditMethods: GatewayRequestHandlers = {
  /**
   * 鑾峰彇瀹¤鏃ュ織鍒楄〃
   */
  "admin.auditLogs.list": async ({ params, respond, context }) => {
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

      const listParams: AuditLogListParams = {
        search: validateStringParam(params, "search"),
        adminId: validateStringParam(params, "adminId"),
        action: validateStringParam(params, "action"),
        targetType: validateStringParam(params, "targetType") as AuditLogListParams["targetType"],
        riskLevel: validateStringParam(params, "riskLevel") as AuditLogListParams["riskLevel"],
        page: validateNumberParam(params, "page", 1),
        pageSize: validateNumberParam(params, "pageSize", 20),
        orderBy: validateStringParam(params, "orderBy") as AuditLogListParams["orderBy"],
        orderDir: validateStringParam(params, "orderDir") as "asc" | "desc",
      };

      // 澶勭悊鏃ユ湡鍙傛暟
      const startDateStr = validateStringParam(params, "startDate");
      const endDateStr = validateStringParam(params, "endDate");
      if (startDateStr) {
        listParams.startDate = new Date(startDateStr);
      }
      if (endDateStr) {
        listParams.endDate = new Date(endDateStr);
      }

      const service = getAdminAuditService();
      const result = await service.listAuditLogs(listParams);

      respond(true, { success: true, ...result });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List audit logs error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇瀹¤鏃ュ織鍒楄〃澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇瀹¤鏃ュ織璇︽儏
   */
  "admin.auditLogs.get": async ({ params, respond, context }) => {
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

      const logId = validateStringParam(params, "logId", true)!;

      const service = getAdminAuditService();
      const log = await service.getAuditLogDetail(logId);

      if (!log) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "鏃ュ織涓嶅瓨鍦?, {
            details: { errorCode: "LOG_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, log });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get audit log detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇瀹¤鏃ュ織璇︽儏澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇瀹¤鏃ュ織缁熻淇℃伅
   */
  "admin.auditLogs.stats": async ({ params, respond, context }) => {
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

      const service = getAdminAuditService();
      const stats = await service.getAuditLogStats();

      respond(true, { success: true, stats });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get audit log stats error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇缁熻淇℃伅澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇鎿嶄綔绫诲瀷鍒楄〃
   */
  "admin.auditLogs.actionTypes": async ({ params, respond, context }) => {
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

      const service = getAdminAuditService();
      const actionTypes = await service.getActionTypes();

      respond(true, { success: true, actionTypes });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get action types error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇鎿嶄綔绫诲瀷鍒楄〃澶辫触",
        ),
      );
    }
  },

  /**
   * 瀵煎嚭瀹¤鏃ュ織
   */
  "admin.auditLogs.export": async ({ params, respond, context }) => {
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

      const format = (validateStringParam(params, "format") || "json") as "json" | "csv";

      const listParams: AuditLogListParams = {
        search: validateStringParam(params, "search"),
        adminId: validateStringParam(params, "adminId"),
        action: validateStringParam(params, "action"),
        targetType: validateStringParam(params, "targetType") as AuditLogListParams["targetType"],
        riskLevel: validateStringParam(params, "riskLevel") as AuditLogListParams["riskLevel"],
      };

      // 澶勭悊鏃ユ湡鍙傛暟
      const startDateStr = validateStringParam(params, "startDate");
      const endDateStr = validateStringParam(params, "endDate");
      if (startDateStr) {
        listParams.startDate = new Date(startDateStr);
      }
      if (endDateStr) {
        listParams.endDate = new Date(endDateStr);
      }

      context.logGateway.info(`[${LOG_TAG}] Exporting audit logs`, {
        format,
        adminId: auth.adminId,
      });

      const service = getAdminAuditService();
      const result = await service.exportAuditLogs(listParams, format);

      respond(true, {
        success: true,
        data: result.data,
        filename: result.filename,
        format,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Export audit logs error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "瀵煎嚭瀹¤鏃ュ織澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇绠＄悊鍛樺垪琛紙鐢ㄤ簬杩囨护锛?   */
  "admin.auditLogs.admins": async ({ params, respond, context }) => {
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

      const service = getAdminAuditService();
      const admins = await service.getAdminList();

      respond(true, { success: true, admins });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get admin list error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "鑾峰彇绠＄悊鍛樺垪琛ㄥけ璐?,
        ),
      );
    }
  },
};
