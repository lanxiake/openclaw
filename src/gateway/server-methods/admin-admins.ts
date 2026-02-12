/**
 * 管理后台管理员管理 RPC 方法处理器
 *
 * 提供管理员列表、创建、更新、状态管理等 RPC 方法
 * 所有写操作仅限 super_admin
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
  hasAdminRole,
} from "../../assistant/admin-auth/index.js";
import {
  getAdminAdminService,
  type AdminListParams,
  type CreateAdminParams,
  type UpdateAdminParams,
} from "../../assistant/admin-console/admin-admin-service.js";
import { getAdminRepository } from "../../db/repositories/admins.js";

const LOG_TAG = "admin-admins";

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
      throw new Error(`缺少必需参数: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`参数 ${key} 必须是字符串`);
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
    throw new Error(`参数 ${key} 必须是数字`);
  }
  return num;
}

/**
 * 管理后台管理员管理 RPC 方法
 */
export const adminAdminMethods: GatewayRequestHandlers = {
  /**
   * 获取管理员列表
   */
  "admin.admins.list": async ({ params, respond, context }) => {
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

      // super_admin 可查看管理员列表
      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足，仅超级管理员可管理其他管理员", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const listParams: AdminListParams = {
        search: validateStringParam(params, "search"),
        role: validateStringParam(params, "role") as AdminListParams["role"],
        status: validateStringParam(params, "status") as AdminListParams["status"],
        page: validateNumberParam(params, "page", 1),
        pageSize: validateNumberParam(params, "pageSize", 20),
        orderBy: validateStringParam(params, "orderBy") as AdminListParams["orderBy"],
        orderDir: validateStringParam(params, "orderDir") as AdminListParams["orderDir"],
      };

      const service = getAdminAdminService();
      const result = await service.listAdmins(listParams);

      respond(true, { success: true, ...result });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List admins error`, {
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

  /**
   * 获取管理员详情
   */
  "admin.admins.get": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const adminId = validateStringParam(params, "adminId", true)!;

      const service = getAdminAdminService();
      const admin = await service.getAdminDetail(adminId);

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
      context.logGateway.error(`[${LOG_TAG}] Get admin detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取管理员详情失败",
        ),
      );
    }
  },

  /**
   * 创建管理员
   */
  "admin.admins.create": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足，仅超级管理员可创建管理员", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const username = validateStringParam(params, "username", true)!;
      const password = validateStringParam(params, "password", true)!;
      const displayName = validateStringParam(params, "displayName", true)!;
      const email = validateStringParam(params, "email");
      const phone = validateStringParam(params, "phone");
      const role = validateStringParam(params, "role", true)! as
        | "super_admin"
        | "admin"
        | "operator";

      // 验证用户名格式
      if (username.length < 3 || username.length > 50) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "用户名长度须为 3-50 位"));
        return;
      }

      // 验证密码强度
      if (password.length < 8) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "密码长度至少 8 位"));
        return;
      }

      // 验证角色值
      if (!["super_admin", "admin", "operator"].includes(role)) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无效的角色值"));
        return;
      }

      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Creating admin`, {
        username,
        role,
        operatorId: auth.adminId,
      });

      const service = getAdminAdminService();
      const result = await service.createAdmin(
        { username, password, displayName, email, phone, role },
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true, admin: result.admin });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "创建失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Create admin error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "创建管理员失败",
        ),
      );
    }
  },

  /**
   * 更新管理员信息
   */
  "admin.admins.update": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const adminId = validateStringParam(params, "adminId", true)!;
      const displayName = validateStringParam(params, "displayName");
      const email = validateStringParam(params, "email");
      const phone = validateStringParam(params, "phone");
      const role = validateStringParam(params, "role") as UpdateAdminParams["role"];
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (role && !["super_admin", "admin", "operator"].includes(role)) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无效的角色值"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Updating admin`, {
        adminId,
        operatorId: auth.adminId,
      });

      const service = getAdminAdminService();
      const result = await service.updateAdmin(
        adminId,
        { displayName, email, phone, role },
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true, admin: result.admin });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "更新失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Update admin error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "更新管理员失败",
        ),
      );
    }
  },

  /**
   * 重置管理员密码
   */
  "admin.admins.resetPassword": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足，仅超级管理员可重置密码", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const adminId = validateStringParam(params, "adminId", true)!;
      const newPassword = validateStringParam(params, "newPassword", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (newPassword.length < 8) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "密码长度至少 8 位"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Resetting admin password`, {
        adminId,
        operatorId: auth.adminId,
      });

      const service = getAdminAdminService();
      const result = await service.resetAdminPassword(
        adminId,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "重置密码失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Reset admin password error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "重置密码失败",
        ),
      );
    }
  },

  /**
   * 更新管理员状态（启用/禁用）
   */
  "admin.admins.updateStatus": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const adminId = validateStringParam(params, "adminId", true)!;
      const status = validateStringParam(params, "status", true)! as "active" | "suspended";
      const reason = validateStringParam(params, "reason");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (!["active", "suspended"].includes(status)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无效的状态值，只能是 active 或 suspended"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Updating admin status`, {
        adminId,
        status,
        operatorId: auth.adminId,
      });

      const service = getAdminAdminService();
      const result = await service.updateAdminStatus(
        adminId,
        status,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "状态更新失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Update admin status error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "更新管理员状态失败",
        ),
      );
    }
  },

  /**
   * 强制管理员登出
   */
  "admin.admins.forceLogout": async ({ params, respond, context }) => {
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

      if (!hasAdminRole("super_admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const adminId = validateStringParam(params, "adminId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Force logout admin`, {
        adminId,
        operatorId: auth.adminId,
      });

      const service = getAdminAdminService();
      const result = await service.forceLogoutAdmin(
        adminId,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "强制登出失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Force logout admin error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "强制登出失败",
        ),
      );
    }
  },
};
