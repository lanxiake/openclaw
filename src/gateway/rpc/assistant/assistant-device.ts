/**
 * 璁惧绠＄悊 RPC 鏂规硶澶勭悊鍣? *
 * 涓?Windows 瀹㈡埛绔彁渚涜澶囩鐞嗙浉鍏崇殑 RPC 鏂规硶
 * 鍖呮嫭璁惧缁戝畾銆佽В缁戙€佸垪琛ㄣ€侀厤棰濇煡璇㈢瓑
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
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

// 鏃ュ織鏍囩
const LOG_TAG = "device";

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
 * 楠岃瘉甯冨皵鍙傛暟
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
 * 璁惧绠＄悊 RPC 鏂规硶
 */
export const deviceMethods: GatewayRequestHandlers = {
  /**
   * 鑾峰彇鐢ㄦ埛璁惧鍒楄〃
   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
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
          error instanceof Error ? error.message : "鑾峰彇璁惧鍒楄〃澶辫触",
        ),
      );
    }
  },

  /**
   * 缁戝畾璁惧鍒扮敤鎴?   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
   * - deviceId: string - 璁惧 ID
   * - alias?: string - 璁惧鍒悕
   * - setAsPrimary?: boolean - 鏄惁璁句负涓昏澶?   */
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "缁戝畾璁惧澶辫触", {
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
          error instanceof Error ? error.message : "缁戝畾璁惧澶辫触",
        ),
      );
    }
  },

  /**
   * 瑙ｇ粦璁惧
   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
   * - deviceId: string - 璁惧 ID
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "瑙ｇ粦璁惧澶辫触", {
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
          error instanceof Error ? error.message : "瑙ｇ粦璁惧澶辫触",
        ),
      );
    }
  },

  /**
   * 鑾峰彇璁惧閰嶉
   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
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
          error instanceof Error ? error.message : "鑾峰彇璁惧閰嶉澶辫触",
        ),
      );
    }
  },

  /**
   * 璁剧疆涓昏澶?   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
   * - deviceId: string - 璁惧 ID
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "璁剧疆涓昏澶囧け璐?, {
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
          error instanceof Error ? error.message : "璁剧疆涓昏澶囧け璐?,
        ),
      );
    }
  },

  /**
   * 鏇存柊璁惧鍒悕
   *
   * 鍙傛暟:
   * - userId: string - 鐢ㄦ埛 ID
   * - deviceId: string - 璁惧 ID
   * - alias: string - 鏂板埆鍚?   */
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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鏇存柊璁惧鍒悕澶辫触", {
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
          error instanceof Error ? error.message : "鏇存柊璁惧鍒悕澶辫触",
        ),
      );
    }
  },

  /**
   * 妫€鏌ヨ澶囨槸鍚﹀凡閰嶅
   *
   * 鍙傛暟:
   * - deviceId: string - 璁惧 ID
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
          error instanceof Error ? error.message : "妫€鏌ヨ澶囬厤瀵圭姸鎬佸け璐?,
        ),
      );
    }
  },

  /**
   * 鑾峰彇璁惧璇︾粏淇℃伅
   *
   * 鍙傛暟:
   * - deviceId: string - 璁惧 ID
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
          errorShape(ErrorCodes.INVALID_REQUEST, "璁惧涓嶅瓨鍦ㄦ垨鏈厤瀵?, {
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
          error instanceof Error ? error.message : "鑾峰彇璁惧淇℃伅澶辫触",
        ),
      );
    }
  },

  /**
   * 鏍规嵁璁惧 ID 鑾峰彇鍏宠仈鐨勭敤鎴?ID
   *
   * 鍙傛暟:
   * - deviceId: string - 璁惧 ID
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
          error instanceof Error ? error.message : "鑾峰彇鐢ㄦ埛淇℃伅澶辫触",
        ),
      );
    }
  },
};
