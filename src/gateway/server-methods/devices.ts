import {
  approveDevicePairing,
  type PairedDeviceCompat,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
  summarizeDeviceTokens,
  listDevicePairingByUserId,
  verifyDeviceOwnership,
  verifyPairingRequestOwnership,
} from "../../infra/device-pairing-db.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDevicePairApproveParams,
  validateDevicePairListParams,
  validateDevicePairRejectParams,
  validateDeviceTokenRevokeParams,
  validateDeviceTokenRotateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { requireDeviceAuth } from "./device-auth.js";

/**
 * 脱敏设备信息，移除 token 原文
 */
function redactPairedDevice(device: PairedDeviceCompat) {
  const { tokens, ...rest } = device;
  return {
    ...rest,
    tokens: summarizeDeviceTokens(tokens),
  };
}

export const deviceHandlers: GatewayRequestHandlers = {
  /**
   * 列出当前用户的已配对设备和待审批请求
   */
  "device.pair.list": async ({ params, respond, client }) => {
    if (!validateDevicePairListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.list params: ${formatValidationErrors(
            validateDevicePairListParams.errors,
          )}`,
        ),
      );
      return;
    }

    const userId = requireDeviceAuth(client, respond);
    if (!userId) return;

    const list = await listDevicePairingByUserId(userId);
    respond(
      true,
      {
        pending: list.pending,
        paired: list.paired.map((device) => redactPairedDevice(device)),
      },
      undefined,
    );
  },

  /**
   * 审批配对请求（需要验证请求归属当前用户）
   */
  "device.pair.approve": async ({ params, respond, context, client }) => {
    if (!validateDevicePairApproveParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.approve params: ${formatValidationErrors(
            validateDevicePairApproveParams.errors,
          )}`,
        ),
      );
      return;
    }

    const userId = requireDeviceAuth(client, respond);
    if (!userId) return;

    const { requestId } = params as { requestId: string };

    /** 归属校验: 验证配对请求属于当前用户 */
    const isOwner = await verifyPairingRequestOwnership(requestId, userId);
    if (!isOwner) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无权操作此配对请求"));
      return;
    }

    const approved = await approveDevicePairing(requestId);
    if (!approved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown requestId"));
      return;
    }
    context.logGateway.info(
      `device pairing approved device=${approved.device.deviceId} role=${approved.device.role ?? "unknown"}`,
    );
    context.broadcast(
      "device.pair.resolved",
      {
        requestId,
        deviceId: approved.device.deviceId,
        decision: "approved",
        ts: Date.now(),
      },
      { dropIfSlow: true },
    );
    respond(true, { requestId, device: redactPairedDevice(approved.device) }, undefined);
  },

  /**
   * 拒绝配对请求（需要验证请求归属当前用户）
   */
  "device.pair.reject": async ({ params, respond, context, client }) => {
    if (!validateDevicePairRejectParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.reject params: ${formatValidationErrors(
            validateDevicePairRejectParams.errors,
          )}`,
        ),
      );
      return;
    }

    const userId = requireDeviceAuth(client, respond);
    if (!userId) return;

    const { requestId } = params as { requestId: string };

    /** 归属校验: 验证配对请求属于当前用户 */
    const isOwner = await verifyPairingRequestOwnership(requestId, userId);
    if (!isOwner) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无权操作此配对请求"));
      return;
    }

    const rejected = await rejectDevicePairing(requestId);
    if (!rejected) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown requestId"));
      return;
    }
    context.broadcast(
      "device.pair.resolved",
      {
        requestId,
        deviceId: rejected.deviceId,
        decision: "rejected",
        ts: Date.now(),
      },
      { dropIfSlow: true },
    );
    respond(true, rejected, undefined);
  },

  /**
   * 轮换设备 token（需要验证设备归属当前用户）
   */
  "device.token.rotate": async ({ params, respond, context, client }) => {
    if (!validateDeviceTokenRotateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.token.rotate params: ${formatValidationErrors(
            validateDeviceTokenRotateParams.errors,
          )}`,
        ),
      );
      return;
    }

    const userId = requireDeviceAuth(client, respond);
    if (!userId) return;

    const { deviceId, role, scopes } = params as {
      deviceId: string;
      role: string;
      scopes?: string[];
    };

    /** 归属校验: 验证设备属于当前用户 */
    const isOwner = await verifyDeviceOwnership(deviceId, userId);
    if (!isOwner) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无权操作此设备"));
      return;
    }

    const entry = await rotateDeviceToken({ deviceId, role, scopes });
    if (!entry) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown deviceId/role"));
      return;
    }
    context.logGateway.info(
      `device token rotated device=${deviceId} role=${entry.role} scopes=${entry.scopes.join(",")}`,
    );
    respond(
      true,
      {
        deviceId,
        role: entry.role,
        token: entry.token,
        scopes: entry.scopes,
        rotatedAtMs: entry.rotatedAtMs ?? entry.createdAtMs,
      },
      undefined,
    );
  },

  /**
   * 撤销设备 token（需要验证设备归属当前用户）
   */
  "device.token.revoke": async ({ params, respond, context, client }) => {
    if (!validateDeviceTokenRevokeParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.token.revoke params: ${formatValidationErrors(
            validateDeviceTokenRevokeParams.errors,
          )}`,
        ),
      );
      return;
    }

    const userId = requireDeviceAuth(client, respond);
    if (!userId) return;

    const { deviceId, role } = params as { deviceId: string; role: string };

    /** 归属校验: 验证设备属于当前用户 */
    const isOwner = await verifyDeviceOwnership(deviceId, userId);
    if (!isOwner) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无权操作此设备"));
      return;
    }

    const entry = await revokeDeviceToken({ deviceId, role });
    if (!entry) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown deviceId/role"));
      return;
    }
    context.logGateway.info(`device token revoked device=${deviceId} role=${entry.role}`);
    respond(
      true,
      { deviceId, role: entry.role, revokedAtMs: entry.revokedAtMs ?? Date.now() },
      undefined,
    );
  },
};
