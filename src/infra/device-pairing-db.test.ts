import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { clearMockDatabase, enableMockDatabase } from "../db/mock-connection.js";
import {
  approveDevicePairing,
  getPairedDevice,
  requestDevicePairing,
  rotateDeviceToken,
  verifyDeviceToken,
} from "./device-pairing-db.js";

describe("device-pairing-db adapter", () => {
  beforeEach(() => {
    enableMockDatabase();
  });

  afterEach(() => {
    clearMockDatabase();
  });

  test("request -> approve -> getPairedDevice flow", async () => {
    // 1. 发起配对请求
    const result = await requestDevicePairing({
      deviceId: "device-1",
      publicKey: "public-key-1",
      role: "operator",
      scopes: ["operator.admin"],
    });

    expect(result.status).toBe("pending");
    expect(result.created).toBe(true);
    expect(result.request.deviceId).toBe("device-1");
    expect(result.request.requestId).toBeTruthy();

    // 2. 批准配对
    const approved = await approveDevicePairing(result.request.requestId);
    expect(approved).not.toBeNull();
    expect(approved!.device.deviceId).toBe("device-1");
    expect(approved!.device.publicKey).toBe("public-key-1");

    // 3. 查询已配对设备
    const paired = await getPairedDevice("device-1");
    expect(paired).not.toBeNull();
    expect(paired!.deviceId).toBe("device-1");
    expect(paired!.publicKey).toBe("public-key-1");
  });

  test("rotateDeviceToken updates token scopes", async () => {
    // 配对设备
    const result = await requestDevicePairing({
      deviceId: "device-2",
      publicKey: "public-key-2",
      role: "operator",
      scopes: ["operator.admin"],
    });
    await approveDevicePairing(result.request.requestId);

    // 轮换令牌 (指定新 scopes)
    const rotated = await rotateDeviceToken({
      deviceId: "device-2",
      role: "operator",
      scopes: ["operator.read"],
    });

    expect(rotated).not.toBeNull();
    expect(rotated!.role).toBe("operator");
    expect(rotated!.scopes).toEqual(["operator.read"]);
  });

  test("getPairedDevice returns null for non-existent device", async () => {
    const paired = await getPairedDevice("non-existent");
    expect(paired).toBeNull();
  });

  test("approveDevicePairing returns null for non-existent request", async () => {
    const result = await approveDevicePairing("non-existent-request-id");
    expect(result).toBeNull();
  });

  describe("verifyDeviceToken", () => {
    test("valid token returns ok with deviceId", async () => {
      // 配对设备并获取 token
      const result = await requestDevicePairing({
        deviceId: "device-verify-1",
        publicKey: "pk-verify-1",
        role: "operator",
        scopes: ["operator.admin"],
      });
      const approved = await approveDevicePairing(result.request.requestId);
      expect(approved).not.toBeNull();

      // 获取设备 token
      const device = await getPairedDevice("device-verify-1");
      expect(device).not.toBeNull();
      const tokenInfo = device!.tokens?.["operator"];
      expect(tokenInfo).toBeTruthy();

      // 验证 token — 应返回 ok + deviceId（设备未绑定用户，userId 应为 undefined）
      const verifyResult = await verifyDeviceToken({
        deviceId: "device-verify-1",
        token: tokenInfo!.token,
        role: "operator",
      });
      expect(verifyResult.ok).toBe(true);
      expect(verifyResult.deviceId).toBe("device-verify-1");
      expect(verifyResult.userId).toBeUndefined();
    });

    test("invalid token returns not ok", async () => {
      // 配对设备
      const result = await requestDevicePairing({
        deviceId: "device-verify-2",
        publicKey: "pk-verify-2",
        role: "operator",
        scopes: ["operator.admin"],
      });
      await approveDevicePairing(result.request.requestId);

      // 使用错误 token 验证
      const verifyResult = await verifyDeviceToken({
        deviceId: "device-verify-2",
        token: "wrong-token",
        role: "operator",
      });
      expect(verifyResult.ok).toBe(false);
      expect(verifyResult.reason).toBeTruthy();
    });

    test("non-existent device returns not ok", async () => {
      const verifyResult = await verifyDeviceToken({
        deviceId: "non-existent-device",
        token: "any-token",
      });
      expect(verifyResult.ok).toBe(false);
    });
  });
});
