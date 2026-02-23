/**
 * 设备仓库测试
 *
 * 测试 DeviceRepository 和 DevicePairingRequestRepository 的 CRUD 操作
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  getDeviceRepository,
  getDevicePairingRequestRepository,
  DeviceRepository,
  DevicePairingRequestRepository,
} from "./devices.js";
import { getUserRepository, UserRepository } from "./users.js";

describe("DeviceRepository", () => {
  let deviceRepo: DeviceRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeEach(async () => {
    console.log("[TEST] ========== DeviceRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    deviceRepo = getDeviceRepository(db);
    userRepo = getUserRepository(db);
    clearMockDatabase();

    // 创建测试用户
    const user = await userRepo.create({
      phone: "+8613800138000",
      passwordHash: "Test@123",
      isActive: true,
    });
    testUserId = user.id;
    console.log("[TEST] 测试用户ID:", testUserId);
  });

  afterEach(() => {
    console.log("[TEST] ========== DeviceRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("DEVICE-CREATE-001: 应该创建设备", async () => {
      console.log("[TEST] ========== DEVICE-CREATE-001 ==========");
      console.log("[TEST] 测试创建设备");

      const device = await deviceRepo.create({
        deviceId: "test-device-001",
        publicKey: "test-public-key",
        userId: testUserId,
        displayName: "测试设备",
        platform: "iOS",
        role: "user",
        scopes: ["read", "write"],
        isActive: true,
        approvedAt: new Date(),
      });

      console.log("[TEST] 创建的设备ID:", device.id);
      console.log("[TEST] 设备deviceId:", device.deviceId);

      expect(device.id).toBeTruthy();
      expect(device.deviceId).toBe("test-device-001");
      expect(device.userId).toBe(testUserId);
      expect(device.displayName).toBe("测试设备");
      expect(device.platform).toBe("iOS");
      expect(device.isActive).toBe(true);
      console.log("[TEST] ✓ 设备创建成功");
    });
  });

  describe("findByDeviceId", () => {
    it("DEVICE-FIND-001: 应该根据设备ID查找设备", async () => {
      console.log("[TEST] ========== DEVICE-FIND-001 ==========");
      console.log("[TEST] 测试根据设备ID查找设备");

      const deviceId = "test-device-002";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-public-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const found = await deviceRepo.findByDeviceId(deviceId);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.deviceId).toBe(deviceId);
      console.log("[TEST] ✓ 设备查找成功");
    });

    it("DEVICE-FIND-002: 不存在的设备ID应该返回null", async () => {
      console.log("[TEST] ========== DEVICE-FIND-002 ==========");
      console.log("[TEST] 测试查找不存在的设备");

      const found = await deviceRepo.findByDeviceId("non-existent");

      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findByUserId", () => {
    it("DEVICE-FIND-003: 应该获取用户的所有设备", async () => {
      console.log("[TEST] ========== DEVICE-FIND-003 ==========");
      console.log("[TEST] 测试获取用户的所有设备");

      // 创建多个设备
      await deviceRepo.create({
        deviceId: "device-a",
        publicKey: "key-a",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });
      await deviceRepo.create({
        deviceId: "device-b",
        publicKey: "key-b",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const devices = await deviceRepo.findByUserId(testUserId);

      console.log("[TEST] 查找到的设备数量:", devices.length);

      expect(devices).toHaveLength(2);
      expect(devices.every((d) => d.userId === testUserId)).toBe(true);
      console.log("[TEST] ✓ 获取用户设备列表成功");
    });
  });

  describe("update", () => {
    it("DEVICE-UPDATE-001: 应该更新设备信息", async () => {
      console.log("[TEST] ========== DEVICE-UPDATE-001 ==========");
      console.log("[TEST] 测试更新设备信息");

      const deviceId = "test-device-003";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        displayName: "旧名称",
        isActive: true,
        approvedAt: new Date(),
      });

      const updated = await deviceRepo.update(deviceId, {
        displayName: "新名称",
        role: "admin",
      });

      console.log("[TEST] 更新后的名称:", updated?.displayName);
      console.log("[TEST] 更新后的角色:", updated?.role);

      expect(updated?.displayName).toBe("新名称");
      expect(updated?.role).toBe("admin");
      console.log("[TEST] ✓ 设备更新成功");
    });
  });

  describe("revoke", () => {
    it("DEVICE-REVOKE-001: 应该撤销设备", async () => {
      console.log("[TEST] ========== DEVICE-REVOKE-001 ==========");
      console.log("[TEST] 测试撤销设备");

      const deviceId = "test-device-004";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      await deviceRepo.revoke(deviceId);

      const found = await deviceRepo.findByDeviceId(deviceId);

      console.log("[TEST] 撤销后isActive:", found?.isActive);
      console.log("[TEST] 撤销后revokedAt:", found?.revokedAt);

      expect(found?.isActive).toBe(false);
      expect(found?.revokedAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 设备撤销成功");
    });
  });

  describe("delete", () => {
    it("DEVICE-DELETE-001: 应该删除设备", async () => {
      console.log("[TEST] ========== DEVICE-DELETE-001 ==========");
      console.log("[TEST] 测试删除设备");

      const deviceId = "test-device-005";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      await deviceRepo.delete(deviceId);

      const found = await deviceRepo.findByDeviceId(deviceId);

      console.log("[TEST] 删除后查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 设备删除成功");
    });
  });

  describe("ensureToken", () => {
    it("DEVICE-TOKEN-001: 应该生成设备令牌", async () => {
      console.log("[TEST] ========== DEVICE-TOKEN-001 ==========");
      console.log("[TEST] 测试生成设备令牌");

      const deviceId = "test-device-006";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const result = await deviceRepo.ensureToken(deviceId, "user", ["read", "write"]);

      console.log("[TEST] 生成的令牌长度:", result.token.length);
      console.log("[TEST] 是否新令牌:", result.isNew);

      expect(result.token).toBeTruthy();
      expect(result.token.length).toBe(32);
      expect(result.isNew).toBe(true);
      console.log("[TEST] ✓ 令牌生成成功");
    });

    it("DEVICE-TOKEN-002: 已有令牌时应该返回现有令牌", async () => {
      console.log("[TEST] ========== DEVICE-TOKEN-002 ==========");
      console.log("[TEST] 测试返回现有令牌");

      const deviceId = "test-device-007";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      // 第一次生成
      const first = await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      // 第二次应该返回相同令牌
      const second = await deviceRepo.ensureToken(deviceId, "user", ["read"]);

      console.log("[TEST] 第一次令牌:", first.token.substring(0, 8) + "...");
      console.log("[TEST] 第二次令牌:", second.token.substring(0, 8) + "...");

      expect(second.token).toBe(first.token);
      expect(second.isNew).toBe(false);
      console.log("[TEST] ✓ 返回现有令牌成功");
    });
  });

  describe("verifyToken", () => {
    it("DEVICE-VERIFY-001: 应该验证有效令牌", async () => {
      console.log("[TEST] ========== DEVICE-VERIFY-001 ==========");
      console.log("[TEST] 测试验证有效令牌");

      const deviceId = "test-device-008";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const { token } = await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      const result = await deviceRepo.verifyToken(deviceId, token, "user");

      console.log("[TEST] 验证结果:", result.valid);

      expect(result.valid).toBe(true);
      expect(result.device).toBeTruthy();
      expect(result.tokenInfo).toBeTruthy();
      console.log("[TEST] ✓ 令牌验证成功");
    });

    it("DEVICE-VERIFY-002: 应该拒绝无效令牌", async () => {
      console.log("[TEST] ========== DEVICE-VERIFY-002 ==========");
      console.log("[TEST] 测试拒绝无效令牌");

      const deviceId = "test-device-009";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      const result = await deviceRepo.verifyToken(deviceId, "invalid-token", "user");

      console.log("[TEST] 验证结果:", result.valid);

      expect(result.valid).toBe(false);
      console.log("[TEST] ✓ 正确拒绝无效令牌");
    });
  });

  describe("revokeToken", () => {
    it("DEVICE-REVOKE-TOKEN-001: 应该撤销令牌", async () => {
      console.log("[TEST] ========== DEVICE-REVOKE-TOKEN-001 ==========");
      console.log("[TEST] 测试撤销令牌");

      const deviceId = "test-device-010";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const { token } = await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      await deviceRepo.revokeToken(deviceId, "user");

      const result = await deviceRepo.verifyToken(deviceId, token, "user");

      console.log("[TEST] 撤销后验证结果:", result.valid);

      expect(result.valid).toBe(false);
      console.log("[TEST] ✓ 令牌撤销成功");
    });
  });

  describe("revokeAllTokens", () => {
    it("DEVICE-REVOKE-ALL-001: 应该撤销设备的所有令牌", async () => {
      const deviceId = "test-device-revoke-all";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      await deviceRepo.ensureToken(deviceId, "admin", ["read", "write"]);

      const revokedCount = await deviceRepo.revokeAllTokens(deviceId);

      expect(revokedCount).toBe(2);

      const device = await deviceRepo.findByDeviceId(deviceId);
      for (const tokenInfo of Object.values(device!.tokens!)) {
        expect(tokenInfo.revokedAtMs).toBeTruthy();
      }
    });

    it("DEVICE-REVOKE-ALL-002: 无令牌时返回 0", async () => {
      const deviceId = "test-device-no-tokens";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      const revokedCount = await deviceRepo.revokeAllTokens(deviceId);
      expect(revokedCount).toBe(0);
    });

    it("DEVICE-REVOKE-ALL-003: 已撤销的令牌不重复计数", async () => {
      const deviceId = "test-device-partial-revoke";
      await deviceRepo.create({
        deviceId,
        publicKey: "test-key",
        userId: testUserId,
        isActive: true,
        approvedAt: new Date(),
      });

      await deviceRepo.ensureToken(deviceId, "user", ["read"]);
      await deviceRepo.ensureToken(deviceId, "admin", ["write"]);

      /** 先撤销一个 */
      await deviceRepo.revokeToken(deviceId, "user");

      const revokedCount = await deviceRepo.revokeAllTokens(deviceId);

      /** 只有 admin 被新撤销 */
      expect(revokedCount).toBe(1);
    });
  });
});

describe("DevicePairingRequestRepository", () => {
  let pairingRepo: DevicePairingRequestRepository;
  let deviceRepo: DeviceRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeEach(async () => {
    console.log("[TEST] ========== DevicePairingRequestRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    pairingRepo = getDevicePairingRequestRepository(db);
    deviceRepo = getDeviceRepository(db);
    userRepo = getUserRepository(db);
    clearMockDatabase();

    // 创建测试用户
    const user = await userRepo.create({
      phone: "+8613800138001",
      passwordHash: "Test@123",
      isActive: true,
    });
    testUserId = user.id;
    console.log("[TEST] 测试用户ID:", testUserId);
  });

  afterEach(() => {
    console.log("[TEST] ========== DevicePairingRequestRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("PAIRING-CREATE-001: 应该创建配对请求", async () => {
      console.log("[TEST] ========== PAIRING-CREATE-001 ==========");
      console.log("[TEST] 测试创建配对请求");

      const request = await pairingRepo.create({
        deviceId: "pairing-device-001",
        publicKey: "test-public-key",
        userId: testUserId,
        displayName: "测试设备",
        platform: "Android",
        requestedRole: "user",
        requestedScopes: ["read", "write"],
      });

      console.log("[TEST] 创建的请求ID:", request.requestId);
      console.log("[TEST] 状态:", request.status);

      expect(request.requestId).toBeTruthy();
      expect(request.deviceId).toBe("pairing-device-001");
      expect(request.status).toBe("pending");
      expect(request.expiresAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 配对请求创建成功");
    });
  });

  describe("findByRequestId", () => {
    it("PAIRING-FIND-001: 应该根据请求ID查找", async () => {
      console.log("[TEST] ========== PAIRING-FIND-001 ==========");
      console.log("[TEST] 测试根据请求ID查找");

      const created = await pairingRepo.create({
        deviceId: "pairing-device-002",
        publicKey: "test-key",
        userId: testUserId,
      });

      const found = await pairingRepo.findByRequestId(created.requestId);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.requestId).toBe(created.requestId);
      console.log("[TEST] ✓ 请求查找成功");
    });
  });

  describe("approve", () => {
    it("PAIRING-APPROVE-001: 应该批准配对请求并创建设备", async () => {
      console.log("[TEST] ========== PAIRING-APPROVE-001 ==========");
      console.log("[TEST] 测试批准配对请求");

      const request = await pairingRepo.create({
        deviceId: "pairing-device-003",
        publicKey: "test-key",
        userId: testUserId,
        requestedRole: "user",
        requestedScopes: ["read"],
      });

      const device = await pairingRepo.approve(request.requestId, testUserId, "user", [
        "read",
        "write",
      ]);

      console.log("[TEST] 创建的设备ID:", device?.deviceId);

      expect(device).toBeTruthy();
      expect(device?.deviceId).toBe("pairing-device-003");
      expect(device?.userId).toBe(testUserId);
      expect(device?.isActive).toBe(true);

      // 检查请求状态已更新
      const updatedRequest = await pairingRepo.findByRequestId(request.requestId);
      expect(updatedRequest?.status).toBe("approved");

      console.log("[TEST] ✓ 配对批准成功");
    });
  });

  describe("reject", () => {
    it("PAIRING-REJECT-001: 应该拒绝配对请求", async () => {
      console.log("[TEST] ========== PAIRING-REJECT-001 ==========");
      console.log("[TEST] 测试拒绝配对请求");

      const request = await pairingRepo.create({
        deviceId: "pairing-device-004",
        publicKey: "test-key",
        userId: testUserId,
      });

      const result = await pairingRepo.reject(request.requestId, "不认识此设备");

      console.log("[TEST] 拒绝结果:", result);

      expect(result).toBe(true);

      const updatedRequest = await pairingRepo.findByRequestId(request.requestId);
      expect(updatedRequest?.status).toBe("rejected");
      expect(updatedRequest?.reason).toBe("不认识此设备");

      console.log("[TEST] ✓ 配对拒绝成功");
    });
  });
});
