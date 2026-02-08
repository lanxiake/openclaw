/**
 * 设备管理 RPC 方法处理器
 *
 * 为 Windows 客户端提供设备管理相关的 RPC 方法
 * 包括设备绑定、解绑、列表、配额查询等
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  linkDevice,
  unlinkDevice,
  listUserDevices,
  getDeviceQuota,
  setPrimaryDevice,
  updateDeviceAlias,
  checkDevicePaired,
  getDeviceInfo,
  getUserIdByDeviceId,
} from "../../assistant/device/index.js";

// 日志标签
const LOG_TAG = "device";

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
 * 验证布尔参数
 */
function validateBooleanParam(params: Record<string, unknown>, key: string): boolean | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Parameter ${key} must be a boolean`);
  }
  return value;
}

/**
 * 设备管理 RPC 方法
 */
export const deviceMethods: GatewayRequestHandlers = {
  /**
   * 获取用户设备列表
   *
   * 参数:
   * - userId: string - 用户 ID
   */
  "device.list": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;

      const result = await listUserDevices(userId);

      respond(true, {
        success: result.success,
        devices: result.devices,
        quota: result.quota,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] list error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取设备列表失败",
        ),
      );
    }
  },

  /**
   * 绑定设备到用户
   *
   * 参数:
   * - userId: string - 用户 ID
   * - deviceId: string - 设备 ID
   * - alias?: string - 设备别名
   * - setAsPrimary?: boolean - 是否设为主设备
   */
  "device.link": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;
      const deviceId = validateStringParam(params, "deviceId", true)!;
      const alias = validateStringParam(params, "alias");
      const setAsPrimary = validateBooleanParam(params, "setAsPrimary");
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await linkDevice({
        userId,
        deviceId,
        alias,
        setAsPrimary,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          device: result.device,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "绑定设备失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] link error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "绑定设备失败",
        ),
      );
    }
  },

  /**
   * 解绑设备
   *
   * 参数:
   * - userId: string - 用户 ID
   * - deviceId: string - 设备 ID
   */
  "device.unlink": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;
      const deviceId = validateStringParam(params, "deviceId", true)!;
      const ipAddress = params["ipAddress"] as string | undefined;
      const userAgent = params["userAgent"] as string | undefined;

      const result = await unlinkDevice({
        userId,
        deviceId,
        ipAddress,
        userAgent,
      });

      if (result.success) {
        respond(true, {
          success: true,
          device: result.device,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "解绑设备失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] unlink error`, {
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
   * 获取设备配额
   *
   * 参数:
   * - userId: string - 用户 ID
   */
  "device.quota": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;

      const quota = await getDeviceQuota(userId);

      respond(true, {
        success: true,
        quota,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] quota error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取设备配额失败",
        ),
      );
    }
  },

  /**
   * 设置主设备
   *
   * 参数:
   * - userId: string - 用户 ID
   * - deviceId: string - 设备 ID
   */
  "device.setPrimary": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;
      const deviceId = validateStringParam(params, "deviceId", true)!;

      const result = await setPrimaryDevice(userId, deviceId);

      if (result.success) {
        respond(true, {
          success: true,
          device: result.device,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "设置主设备失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] setPrimary error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "设置主设备失败",
        ),
      );
    }
  },

  /**
   * 更新设备别名
   *
   * 参数:
   * - userId: string - 用户 ID
   * - deviceId: string - 设备 ID
   * - alias: string - 新别名
   */
  "device.updateAlias": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true)!;
      const deviceId = validateStringParam(params, "deviceId", true)!;
      const alias = validateStringParam(params, "alias", true)!;

      const result = await updateDeviceAlias(userId, deviceId, alias);

      if (result.success) {
        respond(true, {
          success: true,
          device: result.device,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "更新设备别名失败", {
            details: { errorCode: result.errorCode },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] updateAlias error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "更新设备别名失败",
        ),
      );
    }
  },

  /**
   * 检查设备是否已配对
   *
   * 参数:
   * - deviceId: string - 设备 ID
   */
  "device.checkPaired": async ({ params, respond, context }) => {
    try {
      const deviceId = validateStringParam(params, "deviceId", true)!;

      const isPaired = await checkDevicePaired(deviceId);

      respond(true, {
        success: true,
        isPaired,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] checkPaired error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "检查设备配对状态失败",
        ),
      );
    }
  },

  /**
   * 获取设备详细信息
   *
   * 参数:
   * - deviceId: string - 设备 ID
   */
  "device.info": async ({ params, respond, context }) => {
    try {
      const deviceId = validateStringParam(params, "deviceId", true)!;

      const deviceInfo = await getDeviceInfo(deviceId);

      if (deviceInfo) {
        respond(true, {
          success: true,
          device: deviceInfo,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "设备不存在或未配对", {
            details: { errorCode: "DEVICE_NOT_FOUND" },
          }),
        );
      }
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] info error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取设备信息失败",
        ),
      );
    }
  },

  /**
   * 根据设备 ID 获取关联的用户 ID
   *
   * 参数:
   * - deviceId: string - 设备 ID
   */
  "device.getUser": async ({ params, respond, context }) => {
    try {
      const deviceId = validateStringParam(params, "deviceId", true)!;

      const userId = await getUserIdByDeviceId(deviceId);

      respond(true, {
        success: true,
        userId,
      });
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] getUser error`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "获取用户信息失败",
        ),
      );
    }
  },
};
