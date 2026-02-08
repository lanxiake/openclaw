/**
 * 管理后台用户管理 RPC 方法处理器
 *
 * 提供用户列表查询、用户详情、用户状态管理等 RPC 方法
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
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

// 日志标签
const LOG_TAG = "admin-users";

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

  // 获取管理员用户名
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
 * 管理后台用户管理 RPC 方法
 */
export const adminUserMethods: GatewayRequestHandlers = {
  /**
   * 获取用户列表
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - search?: string - 搜索关键词
   * - status?: string - 状态过滤 (active/inactive/all)
   * - subscriptionStatus?: string - 订阅状态过滤
   * - page?: number - 页码
   * - pageSize?: number - 每页数量
   * - orderBy?: string - 排序字段
   * - orderDir?: string - 排序方向
   */
  "admin.users.list": async ({ params, respond, context }) => {
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

      // 验证权限 (operator 及以上可查看)
      if (!hasAdminRole("operator", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
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
          error instanceof Error ? error.message : "获取用户列表失败",
        ),
      );
    }
  },

  /**
   * 获取用户详情
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   */
  "admin.users.get": async ({ params, respond, context }) => {
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

      const userId = validateStringParam(params, "userId", true)!;

      const service = getAdminUserService();
      const user = await service.getUserDetail(userId);

      if (!user) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "用户不存在", {
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
          error instanceof Error ? error.message : "获取用户详情失败",
        ),
      );
    }
  },

  /**
   * 停用用户
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   * - reason?: string - 停用原因
   */
  "admin.users.suspend": async ({ params, respond, context }) => {
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

      // 验证权限 (admin 及以上可停用用户)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "停用失败"),
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
          error instanceof Error ? error.message : "停用用户失败",
        ),
      );
    }
  },

  /**
   * 激活用户
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   */
  "admin.users.activate": async ({ params, respond, context }) => {
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

      // 验证权限 (admin 及以上可激活用户)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "激活失败"),
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
          error instanceof Error ? error.message : "激活用户失败",
        ),
      );
    }
  },

  /**
   * 重置用户密码
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   * - newPassword: string - 新密码
   */
  "admin.users.resetPassword": async ({ params, respond, context }) => {
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

      // 验证权限 (super_admin 可重置密码)
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

      const userId = validateStringParam(params, "userId", true)!;
      const newPassword = validateStringParam(params, "newPassword", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (newPassword.length < 8) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "密码长度至少 8 位"));
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "重置密码失败"),
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
          error instanceof Error ? error.message : "重置密码失败",
        ),
      );
    }
  },

  /**
   * 解绑用户设备
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   * - deviceId: string - 设备 ID
   */
  "admin.users.unlinkDevice": async ({ params, respond, context }) => {
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

      // 验证权限 (admin 及以上可解绑设备)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "解绑设备失败"),
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
          error instanceof Error ? error.message : "解绑设备失败",
        ),
      );
    }
  },

  /**
   * 强制登出用户
   *
   * 参数:
   * - authorization: string - Bearer Token
   * - userId: string - 用户 ID
   */
  "admin.users.forceLogout": async ({ params, respond, context }) => {
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

      // 验证权限 (admin 及以上可强制登出)
      if (!hasAdminRole("admin", auth.role)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足", {
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "强制登出失败"),
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
          error instanceof Error ? error.message : "强制登出失败",
        ),
      );
    }
  },

  /**
   * 获取用户统计信息
   *
   * 参数:
   * - authorization: string - Bearer Token
   */
  "admin.users.stats": async ({ params, respond, context }) => {
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
          error instanceof Error ? error.message : "获取统计失败",
        ),
      );
    }
  },
};
