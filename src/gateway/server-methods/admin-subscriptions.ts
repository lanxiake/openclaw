/**
 * 管理后台订阅管理 RPC 方法处理器
 *
 * 提供订阅列表查询、订阅管理、套餐管理、订单查询等 RPC 方法
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
  hasAdminRole,
} from "../../assistant/admin-auth/index.js";
import {
  getAdminSubscriptionService,
  type SubscriptionListParams,
  type OrderListParams,
} from "../../assistant/admin-console/admin-subscription-service.js";
import { getAdminRepository } from "../../db/repositories/admins.js";

// 日志标签
const LOG_TAG = "admin-subscriptions";

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
 * 管理后台订阅管理 RPC 方法
 */
export const adminSubscriptionMethods: GatewayRequestHandlers = {
  /**
   * 获取订阅列表
   */
  "admin.subscriptions.list": async ({ params, respond, context }) => {
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

      const listParams: SubscriptionListParams = {
        search: validateStringParam(params, "search"),
        status: validateStringParam(params, "status") as SubscriptionListParams["status"],
        planId: validateStringParam(params, "planId"),
        page: validateNumberParam(params, "page", 1),
        pageSize: validateNumberParam(params, "pageSize", 20),
        orderBy: validateStringParam(params, "orderBy") as SubscriptionListParams["orderBy"],
        orderDir: validateStringParam(params, "orderDir") as "asc" | "desc",
      };

      const service = getAdminSubscriptionService();
      const result = await service.listSubscriptions(listParams);

      respond(true, { success: true, ...result });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List subscriptions error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取订阅列表失败",
        ),
      );
    }
  },

  /**
   * 获取订阅详情
   */
  "admin.subscriptions.get": async ({ params, respond, context }) => {
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

      const subscriptionId = validateStringParam(params, "subscriptionId", true)!;

      const service = getAdminSubscriptionService();
      const subscription = await service.getSubscriptionDetail(subscriptionId);

      if (!subscription) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "订阅不存在", {
            details: { errorCode: "SUBSCRIPTION_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, subscription });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get subscription detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取订阅详情失败",
        ),
      );
    }
  },

  /**
   * 取消订阅
   */
  "admin.subscriptions.cancel": async ({ params, respond, context }) => {
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

      const subscriptionId = validateStringParam(params, "subscriptionId", true)!;
      const reason = validateStringParam(params, "reason");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Canceling subscription`, {
        subscriptionId,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.cancelSubscription(
        subscriptionId,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "取消订阅失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Cancel subscription error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "取消订阅失败",
        ),
      );
    }
  },

  /**
   * 延长订阅期限
   */
  "admin.subscriptions.extend": async ({ params, respond, context }) => {
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

      const subscriptionId = validateStringParam(params, "subscriptionId", true)!;
      const days = validateNumberParam(params, "days", 30)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      if (days <= 0 || days > 365) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "延长天数必须在 1-365 之间"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] Extending subscription`, {
        subscriptionId,
        days,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.extendSubscription(
        subscriptionId,
        days,
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true, newEndDate: result.newEndDate });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "延长订阅失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Extend subscription error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "延长订阅失败",
        ),
      );
    }
  },

  /**
   * 变更订阅套餐
   */
  "admin.subscriptions.changePlan": async ({ params, respond, context }) => {
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
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足，仅超级管理员可变更套餐", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const subscriptionId = validateStringParam(params, "subscriptionId", true)!;
      const newPlanId = validateStringParam(params, "newPlanId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Changing subscription plan`, {
        subscriptionId,
        newPlanId,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.changeSubscriptionPlan(
        subscriptionId,
        newPlanId,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "变更套餐失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Change subscription plan error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "变更套餐失败",
        ),
      );
    }
  },

  /**
   * 获取套餐列表
   */
  "admin.plans.list": async ({ params, respond, context }) => {
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

      const service = getAdminSubscriptionService();
      const plans = await service.listPlans();

      respond(true, { success: true, plans });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List plans error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取套餐列表失败",
        ),
      );
    }
  },

  /**
   * 获取套餐详情
   */
  "admin.plans.get": async ({ params, respond, context }) => {
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

      const planId = validateStringParam(params, "planId", true)!;

      const service = getAdminSubscriptionService();
      const plan = await service.getPlanDetail(planId);

      if (!plan) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "套餐不存在", {
            details: { errorCode: "PLAN_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, plan });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get plan detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取套餐详情失败",
        ),
      );
    }
  },

  /**
   * 创建套餐
   */
  "admin.plans.create": async ({ params, respond, context }) => {
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

      const code = validateStringParam(params, "code", true)!;
      const name = validateStringParam(params, "name", true)!;
      const description = validateStringParam(params, "description");
      const priceMonthly = validateNumberParam(params, "priceMonthly", 0)!;
      const priceYearly = validateNumberParam(params, "priceYearly", 0)!;
      const tokensPerMonth = validateNumberParam(params, "tokensPerMonth", 0)!;
      const storageMb = validateNumberParam(params, "storageMb", 0)!;
      const maxDevices = validateNumberParam(params, "maxDevices", 1)!;
      const sortOrder = validateNumberParam(params, "sortOrder", 0);
      const features = params["features"] as Record<string, unknown> | undefined;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Creating plan`, {
        code,
        name,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.createPlan(
        {
          code,
          name,
          description,
          priceMonthly,
          priceYearly,
          tokensPerMonth,
          storageMb,
          maxDevices,
          features,
          sortOrder,
        },
        auth.adminId,
        auth.username,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        respond(true, { success: true, plan: result.plan });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "创建套餐失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Create plan error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "创建套餐失败",
        ),
      );
    }
  },

  /**
   * 更新套餐
   */
  "admin.plans.update": async ({ params, respond, context }) => {
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

      const planId = validateStringParam(params, "planId", true)!;
      const name = validateStringParam(params, "name");
      const description = validateStringParam(params, "description");
      const priceMonthly = validateNumberParam(params, "priceMonthly");
      const priceYearly = validateNumberParam(params, "priceYearly");
      const tokensPerMonth = validateNumberParam(params, "tokensPerMonth");
      const storageMb = validateNumberParam(params, "storageMb");
      const maxDevices = validateNumberParam(params, "maxDevices");
      const sortOrder = validateNumberParam(params, "sortOrder");
      const isActive = params["isActive"] as boolean | undefined;
      const features = params["features"] as Record<string, unknown> | undefined;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData["name"] = name;
      if (description !== undefined) updateData["description"] = description;
      if (priceMonthly !== undefined) updateData["priceMonthly"] = priceMonthly;
      if (priceYearly !== undefined) updateData["priceYearly"] = priceYearly;
      if (tokensPerMonth !== undefined) updateData["tokensPerMonth"] = tokensPerMonth;
      if (storageMb !== undefined) updateData["storageMb"] = storageMb;
      if (maxDevices !== undefined) updateData["maxDevices"] = maxDevices;
      if (sortOrder !== undefined) updateData["sortOrder"] = sortOrder;
      if (isActive !== undefined) updateData["isActive"] = isActive;
      if (features !== undefined) updateData["features"] = features;

      context.logGateway.info(`[${LOG_TAG}] Updating plan`, {
        planId,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.updatePlan(
        planId,
        updateData as Parameters<typeof service.updatePlan>[1],
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "更新套餐失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Update plan error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "更新套餐失败",
        ),
      );
    }
  },

  /**
   * 获取订单列表
   */
  "admin.orders.list": async ({ params, respond, context }) => {
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

      const listParams: OrderListParams = {
        search: validateStringParam(params, "search"),
        status: validateStringParam(params, "status") as OrderListParams["status"],
        paymentMethod: validateStringParam(params, "paymentMethod"),
        page: validateNumberParam(params, "page", 1),
        pageSize: validateNumberParam(params, "pageSize", 20),
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

      const service = getAdminSubscriptionService();
      const result = await service.listOrders(listParams);

      respond(true, { success: true, ...result });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] List orders error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取订单列表失败",
        ),
      );
    }
  },

  /**
   * 获取订单详情
   */
  "admin.orders.get": async ({ params, respond, context }) => {
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

      const orderId = validateStringParam(params, "orderId", true)!;

      const service = getAdminSubscriptionService();
      const order = await service.getOrderDetail(orderId);

      if (!order) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "订单不存在", {
            details: { errorCode: "ORDER_NOT_FOUND" },
          }),
        );
        return;
      }

      respond(true, { success: true, order });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get order detail error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取订单详情失败",
        ),
      );
    }
  },

  /**
   * 订单退款
   */
  "admin.orders.refund": async ({ params, respond, context }) => {
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
          errorShape(ErrorCodes.INVALID_REQUEST, "权限不足，仅超级管理员可执行退款", {
            details: { errorCode: "FORBIDDEN" },
          }),
        );
        return;
      }

      const orderId = validateStringParam(params, "orderId", true)!;
      const reason = validateStringParam(params, "reason");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      context.logGateway.info(`[${LOG_TAG}] Refunding order`, {
        orderId,
        adminId: auth.adminId,
      });

      const service = getAdminSubscriptionService();
      const result = await service.refundOrder(
        orderId,
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "退款失败"),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Refund order error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, error instanceof Error ? error.message : "退款失败"),
      );
    }
  },

  /**
   * 获取订阅统计信息
   */
  "admin.subscriptions.stats": async ({ params, respond, context }) => {
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

      const service = getAdminSubscriptionService();
      const stats = await service.getSubscriptionStats();

      respond(true, { success: true, stats });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] Get subscription stats error`, {
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
