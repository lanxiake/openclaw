/**
 * 设备配对端到端集成测试
 *
 * 测试完整的设备配对流程：
 * 1. 发起配对请求
 * 2. 批准配对
 * 3. 查询已配对设备
 * 4. 轮换设备令牌
 * 5. 撤销设备令牌
 *
 * 使用 mock 数据库，无需真实 PostgreSQL 连接
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearMockDatabase,
  enableMockDatabase,
  disableMockDatabase,
} from "../db/mock-connection.js";
import {
  requestDevicePairing,
  approveDevicePairing,
  rejectDevicePairing,
  getPairedDevice,
  listDevicePairing,
  rotateDeviceToken,
  revokeDeviceToken,
  listDevicesByUserId,
  verifyDeviceToken,
} from "../infra/device-pairing-db.js";

describe("设备配对端到端集成测试", () => {
  beforeEach(() => {
    enableMockDatabase();
  });

  afterEach(() => {
    clearMockDatabase();
    disableMockDatabase();
  });

  describe("完整配对流程", () => {
    it("INT-PAIR-001: 发起配对请求 -> 批准 -> 查询设备", async () => {
      // 1. 发起配对请求
      const pairResult = await requestDevicePairing({
        deviceId: "test-device-001",
        publicKey: "test-public-key-001",
        displayName: "测试设备",
        platform: "windows",
        role: "user",
        scopes: ["chat.read", "chat.write"],
      });

      expect(pairResult.status).toBe("pending");
      expect(pairResult.created).toBe(true);
      expect(pairResult.request.deviceId).toBe("test-device-001");
      expect(pairResult.request.requestId).toBeTruthy();

      const requestId = pairResult.request.requestId;

      // 2. 批准配对
      const approveResult = await approveDevicePairing(requestId);

      expect(approveResult).not.toBeNull();
      expect(approveResult!.device.deviceId).toBe("test-device-001");
      expect(approveResult!.device.publicKey).toBe("test-public-key-001");
      expect(approveResult!.device.displayName).toBe("测试设备");
      expect(approveResult!.device.platform).toBe("windows");

      // 3. 查询已配对设备
      const pairedDevice = await getPairedDevice("test-device-001");

      expect(pairedDevice).not.toBeNull();
      expect(pairedDevice!.deviceId).toBe("test-device-001");
      expect(pairedDevice!.publicKey).toBe("test-public-key-001");
    });

    it("INT-PAIR-002: 发起配对请求 -> 拒绝", async () => {
      // 1. 发起配对请求
      const pairResult = await requestDevicePairing({
        deviceId: "test-device-002",
        publicKey: "test-public-key-002",
      });

      expect(pairResult.status).toBe("pending");
      const requestId = pairResult.request.requestId;

      // 2. 拒绝配对
      const rejectResult = await rejectDevicePairing(requestId);

      expect(rejectResult).not.toBeNull();
      expect(rejectResult!.deviceId).toBe("test-device-002");

      // 3. 确认设备未被配对
      const pairedDevice = await getPairedDevice("test-device-002");
      expect(pairedDevice).toBeNull();
    });

    it("INT-PAIR-003: 批准不存在的请求返回 null", async () => {
      const result = await approveDevicePairing("non-existent-request-id");
      expect(result).toBeNull();
    });

    it("INT-PAIR-004: 查询不存在的设备返回 null", async () => {
      const result = await getPairedDevice("non-existent-device");
      expect(result).toBeNull();
    });
  });

  describe("设备列表查询", () => {
    it("INT-LIST-001: 列出所有配对请求和已配对设备", async () => {
      // 创建多个配对请求
      await requestDevicePairing({
        deviceId: "device-a",
        publicKey: "key-a",
      });
      await requestDevicePairing({
        deviceId: "device-b",
        publicKey: "key-b",
      });

      // 批准其中一个
      const result = await requestDevicePairing({
        deviceId: "device-c",
        publicKey: "key-c",
      });
      await approveDevicePairing(result.request.requestId);

      // 查询列表
      const list = await listDevicePairing();

      // 应该有 2 个 pending，1 个 paired
      expect(list.pending.length).toBe(2);
      expect(list.paired.length).toBe(1);
      expect(list.paired[0].deviceId).toBe("device-c");
    });
  });

  describe("设备令牌管理", () => {
    it("INT-TOKEN-001: 轮换设备令牌", async () => {
      // 先配对设备
      const pairResult = await requestDevicePairing({
        deviceId: "token-test-device",
        publicKey: "token-test-key",
        role: "user",
        scopes: ["chat.read"],
      });
      await approveDevicePairing(pairResult.request.requestId);

      // 轮换令牌
      const rotateResult = await rotateDeviceToken({
        deviceId: "token-test-device",
        role: "user",
        scopes: ["chat.read", "chat.write"], // 更新 scopes
      });

      expect(rotateResult).not.toBeNull();
      expect(rotateResult!.role).toBe("user");
      expect(rotateResult!.scopes).toContain("chat.write");
    });

    it("INT-TOKEN-002: 验证设备令牌", async () => {
      // 配对设备
      const pairResult = await requestDevicePairing({
        deviceId: "verify-test-device",
        publicKey: "verify-test-key",
        role: "operator",
      });
      const approved = await approveDevicePairing(pairResult.request.requestId);

      // 获取令牌
      const token = approved!.device.tokens?.operator?.token;
      expect(token).toBeTruthy();

      // 验证令牌
      const verifyResult = await verifyDeviceToken({
        deviceId: "verify-test-device",
        token: token!,
        role: "operator",
        scopes: [],
      });

      expect(verifyResult.ok).toBe(true);
    });

    it("INT-TOKEN-003: 撤销设备令牌", async () => {
      // 配对设备
      const pairResult = await requestDevicePairing({
        deviceId: "revoke-test-device",
        publicKey: "revoke-test-key",
        role: "user",
      });
      const approved = await approveDevicePairing(pairResult.request.requestId);
      const token = approved!.device.tokens?.user?.token;

      // 撤销令牌
      const revokeResult = await revokeDeviceToken({
        deviceId: "revoke-test-device",
        role: "user",
      });

      // 返回被撤销的令牌信息（带 revokedAtMs）
      expect(revokeResult).not.toBeNull();
      expect(revokeResult!.revokedAtMs).toBeTruthy();

      // 验证令牌应该失败
      const verifyResult = await verifyDeviceToken({
        deviceId: "revoke-test-device",
        token: token!,
        role: "user",
        scopes: [],
      });
      expect(verifyResult.ok).toBe(false);
      expect(verifyResult.reason).toBe("token-invalid");
    });
  });

  describe("用户-设备关联", () => {
    it("INT-USER-001: 配对时指定 userId", async () => {
      // 配对设备时指定 userId
      const pairResult = await requestDevicePairing({
        deviceId: "user-link-device",
        publicKey: "user-link-key",
        userId: "user-123",
      });
      await approveDevicePairing(pairResult.request.requestId);

      // 验证设备关联了 userId
      const device = await getPairedDevice("user-link-device");
      expect(device!.userId).toBe("user-123");
    });

    it("INT-USER-002: 按 userId 查询设备列表", async () => {
      // 配对多个设备并关联到同一用户
      for (const deviceId of ["user-device-1", "user-device-2", "user-device-3"]) {
        const result = await requestDevicePairing({
          deviceId,
          publicKey: `key-${deviceId}`,
          userId: "user-456",
        });
        await approveDevicePairing(result.request.requestId);
      }

      // 配对一个不属于该用户的设备
      const otherResult = await requestDevicePairing({
        deviceId: "other-user-device",
        publicKey: "other-key",
        userId: "user-789",
      });
      await approveDevicePairing(otherResult.request.requestId);

      // 查询用户设备
      const userDevices = await listDevicesByUserId("user-456");

      expect(userDevices.length).toBe(3);
      expect(userDevices.every((d) => d.userId === "user-456")).toBe(true);
    });
  });

  describe("边界情况", () => {
    it("INT-EDGE-001: 重复配对请求创建新请求", async () => {
      // 第一次请求
      const first = await requestDevicePairing({
        deviceId: "duplicate-device",
        publicKey: "duplicate-key",
      });
      expect(first.created).toBe(true);
      expect(first.status).toBe("pending");

      // 第二次请求（相同 deviceId，不同 publicKey）
      // 当前实现会创建新的请求
      const second = await requestDevicePairing({
        deviceId: "duplicate-device",
        publicKey: "duplicate-key-2",
      });

      // 当前实现：每次都创建新请求
      expect(second.status).toBe("pending");
      expect(second.request.deviceId).toBe("duplicate-device");
    });

    it("INT-EDGE-002: 批准后设备可被查询", async () => {
      // 配对设备
      const pairResult = await requestDevicePairing({
        deviceId: "query-after-approve",
        publicKey: "query-key",
      });

      // 批准前查询应该返回 null
      const beforeApprove = await getPairedDevice("query-after-approve");
      expect(beforeApprove).toBeNull();

      // 批准
      await approveDevicePairing(pairResult.request.requestId);

      // 批准后查询应该返回设备
      const afterApprove = await getPairedDevice("query-after-approve");
      expect(afterApprove).not.toBeNull();
      expect(afterApprove!.deviceId).toBe("query-after-approve");
    });
  });
});
