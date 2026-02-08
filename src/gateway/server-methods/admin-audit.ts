/**
 * 管理后台审计日志 RPC 方法处理器
 *
 * 提供审计日志列表查询、详情查看、统计信息、导出等 RPC 方法
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../../assistant/admin-auth/index.js";
import {
  getAdminAuditService,
  type AuditLogListParams,
} from "../../assistant/admin-console/admin-audit-service.js";
import { getAdminRepository } from "../../db/repositories/admins.js";

// 日志标签
const LOG_TAG = "admin-audit";

/**
 * 验证管理员身份并返回管理员信息
 */
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
 * 验证数字参数
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
 * 管理后台审计日志 RPC 方法
 */
export const adminAuditMethods: GatewayRequestHandlers = {
  /**
   * 获取审计日志列表
   */
  "admin.auditLogs.list": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      // 处理日期参数
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
          error instanceof Error ? error.message : "获取审计日志列表失败",
        ),
      );
    }
  },

  /**
   * 获取审计日志详情
   */
  "admin.auditLogs.get": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      const logId = validateStringParam(params, "logId", true)!;

      const service = getAdminAuditService();
      const log = await service.getAuditLogDetail(logId);

      if (!log) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "日志不存在", {
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
          error instanceof Error ? error.message : "获取审计日志详情失败",
        ),
      );
    }
  },

  /**
   * 获取审计日志统计信息
   */
  "admin.auditLogs.stats": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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
          error instanceof Error ? error.message : "获取统计信息失败",
        ),
      );
    }
  },

  /**
   * 获取操作类型列表
   */
  "admin.auditLogs.actionTypes": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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
          error instanceof Error ? error.message : "获取操作类型列表失败",
        ),
      );
    }
  },

  /**
   * 导出审计日志
   */
  "admin.auditLogs.export": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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

      const format = (validateStringParam(params, "format") || "json") as "json" | "csv";

      const listParams: AuditLogListParams = {
        search: validateStringParam(params, "search"),
        adminId: validateStringParam(params, "adminId"),
        action: validateStringParam(params, "action"),
        targetType: validateStringParam(params, "targetType") as AuditLogListParams["targetType"],
        riskLevel: validateStringParam(params, "riskLevel") as AuditLogListParams["riskLevel"],
      };

      // 处理日期参数
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
          error instanceof Error ? error.message : "导出审计日志失败",
        ),
      );
    }
  },

  /**
   * 获取管理员列表（用于过滤）
   */
  "admin.auditLogs.admins": async ({ params, respond, context }) => {
    try {
      const auth = await validateAdminAuth(params);
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
          error instanceof Error ? error.message : "获取管理员列表失败",
        ),
      );
    }
  },
};
