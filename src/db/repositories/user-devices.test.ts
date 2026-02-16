/**
 * 用户设备仓库测试
 *
 * 测试 UserDeviceRepository 的 CRUD 操作
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
  seedMockTable,
} from "../mock-connection.js";
import {
  getUserDeviceRepository,
  getUserRepository,
  UserDeviceRepository,
  UserRepository,
} from "./users.js";

describe("UserDeviceRepository", () => {
  let deviceRepo: UserDeviceRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeEach(async () => {
    console.log("[TEST] ========== UserDeviceRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    deviceRepo = getUserDeviceRepository(db);
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
    console.log("[TEST] ========== UserDeviceRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("linkDevice", () => {
    it("DEVICE-LINK-001: 应该关联设备到用户", async () => {
      console.log("[TEST] ========== DEVICE-LINK-001 ==========");
      console.log("[TEST] 测试关联设备到用户");

      const deviceId = "test-device-001";
      console.log("[TEST] 设备ID:", deviceId);

      const device = await deviceRepo.linkDevice(testUserId, deviceId);

      console.log("[TEST] 关联结果ID:", device.id);
      console.log("[TEST] 关联的用户ID:", device.userId);
      console.log("[TEST] 关联的设备ID:", device.deviceId);

      expect(device.id).toBeTruthy();
      expect(device.userId).toBe(testUserId);
      expect(device.deviceId).toBe(deviceId);
      expect(device.isPrimary).toBe(false);
      expect(device.linkedAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 设备关联成功");
    });

    it("DEVICE-LINK-002: 应该支持设置别名和主设备", async () => {
      console.log("[TEST] ========== DEVICE-LINK-002 ==========");
      console.log("[TEST] 测试设置别名和主设备");

      const deviceId = "test-device-002";
      const alias = "我的手机";
      console.log("[TEST] 设备ID:", deviceId);
      console.log("[TEST] 别名:", alias);

      const device = await deviceRepo.linkDevice(testUserId, deviceId, {
        alias,
        isPrimary: true,
      });

      console.log("[TEST] 关联结果别名:", device.alias);
      console.log("[TEST] 是否主设备:", device.isPrimary);

      expect(device.alias).toBe(alias);
      expect(device.isPrimary).toBe(true);
      console.log("[TEST] ✓ 别名和主设备设置成功");
    });
  });

  describe("unlinkDevice", () => {
    it("DEVICE-UNLINK-001: 应该解除设备关联", async () => {
      console.log("[TEST] ========== DEVICE-UNLINK-001 ==========");
      console.log("[TEST] 测试解除设备关联");

      const deviceId = "test-device-003";
      await deviceRepo.linkDevice(testUserId, deviceId);
      console.log("[TEST] 已关联设备:", deviceId);

      await deviceRepo.unlinkDevice(testUserId, deviceId);
      console.log("[TEST] 已解除关联");

      const found = await deviceRepo.findByDeviceId(deviceId);
      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 设备解除关联成功");
    });
  });

  describe("findByUserId", () => {
    it("DEVICE-FIND-001: 应该获取用户的所有设备", async () => {
      console.log("[TEST] ========== DEVICE-FIND-001 ==========");
      console.log("[TEST] 测试获取用户的所有设备");

      // 关联多个设备
      await deviceRepo.linkDevice(testUserId, "device-a");
      await deviceRepo.linkDevice(testUserId, "device-b");
      await deviceRepo.linkDevice(testUserId, "device-c");
      console.log("[TEST] 已关联3个设备");

      const devices = await deviceRepo.findByUserId(testUserId);
      console.log("[TEST] 查找到的设备数量:", devices.length);

      expect(devices).toHaveLength(3);
      expect(devices.every((d) => d.userId === testUserId)).toBe(true);
      console.log("[TEST] ✓ 获取用户设备列表成功");
    });

    it("DEVICE-FIND-002: 无设备时应该返回空数组", async () => {
      console.log("[TEST] ========== DEVICE-FIND-002 ==========");
      console.log("[TEST] 测试无设备时返回空数组");

      const devices = await deviceRepo.findByUserId(testUserId);
      console.log("[TEST] 查找结果:", devices);

      expect(devices).toEqual([]);
      console.log("[TEST] ✓ 正确返回空数组");
    });
  });

  describe("findByDeviceId", () => {
    it("DEVICE-FIND-003: 应该根据设备ID查找关联", async () => {
      console.log("[TEST] ========== DEVICE-FIND-003 ==========");
      console.log("[TEST] 测试根据设备ID查找关联");

      const deviceId = "test-device-004";
      await deviceRepo.linkDevice(testUserId, deviceId);
      console.log("[TEST] 已关联设备:", deviceId);

      const found = await deviceRepo.findByDeviceId(deviceId);
      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.deviceId).toBe(deviceId);
      expect(found?.userId).toBe(testUserId);
      console.log("[TEST] ✓ 设备查找成功");
    });

    it("DEVICE-FIND-004: 不存在的设备ID应该返回null", async () => {
      console.log("[TEST] ========== DEVICE-FIND-004 ==========");
      console.log("[TEST] 测试查找不存在的设备");

      const found = await deviceRepo.findByDeviceId("non-existent-device");
      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("updateLastActive", () => {
    it("DEVICE-ACTIVE-001: 应该更新设备最后活跃时间", async () => {
      console.log("[TEST] ========== DEVICE-ACTIVE-001 ==========");
      console.log("[TEST] 测试更新设备最后活跃时间");

      const deviceId = "test-device-005";
      const device = await deviceRepo.linkDevice(testUserId, deviceId);
      console.log("[TEST] 初始lastActiveAt:", device.lastActiveAt);

      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      await deviceRepo.updateLastActive(testUserId, deviceId);

      const updated = await deviceRepo.findByDeviceId(deviceId);
      console.log("[TEST] 更新后lastActiveAt:", updated?.lastActiveAt);

      expect(updated?.lastActiveAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 最后活跃时间更新成功");
    });
  });

  describe("setPrimaryDevice", () => {
    it("DEVICE-PRIMARY-001: 应该设置主设备", async () => {
      console.log("[TEST] ========== DEVICE-PRIMARY-001 ==========");
      console.log("[TEST] 测试设置主设备");

      // 关联多个设备
      await deviceRepo.linkDevice(testUserId, "device-x");
      await deviceRepo.linkDevice(testUserId, "device-y");
      console.log("[TEST] 已关联2个设备");

      // 设置 device-y 为主设备
      await deviceRepo.setPrimaryDevice(testUserId, "device-y");
      console.log("[TEST] 设置 device-y 为主设备");

      const deviceX = await deviceRepo.findByDeviceId("device-x");
      const deviceY = await deviceRepo.findByDeviceId("device-y");

      console.log("[TEST] device-x isPrimary:", deviceX?.isPrimary);
      console.log("[TEST] device-y isPrimary:", deviceY?.isPrimary);

      expect(deviceX?.isPrimary).toBe(false);
      expect(deviceY?.isPrimary).toBe(true);
      console.log("[TEST] ✓ 主设备设置成功");
    });
  });

  describe("update", () => {
    it("DEVICE-UPDATE-001: 应该更新设备别名", async () => {
      console.log("[TEST] ========== DEVICE-UPDATE-001 ==========");
      console.log("[TEST] 测试更新设备别名");

      const deviceId = "test-device-006";
      await deviceRepo.linkDevice(testUserId, deviceId, { alias: "旧别名" });
      console.log("[TEST] 原始别名: 旧别名");

      const newAlias = "新别名";
      const updated = await deviceRepo.update(deviceId, { alias: newAlias });
      console.log("[TEST] 更新后别名:", updated.alias);

      expect(updated.alias).toBe(newAlias);
      console.log("[TEST] ✓ 设备别名更新成功");
    });

    it("DEVICE-UPDATE-002: 应该更新设备主设备状态", async () => {
      console.log("[TEST] ========== DEVICE-UPDATE-002 ==========");
      console.log("[TEST] 测试更新设备主设备状态");

      const deviceId = "test-device-007";
      await deviceRepo.linkDevice(testUserId, deviceId, { isPrimary: false });
      console.log("[TEST] 原始isPrimary: false");

      const updated = await deviceRepo.update(deviceId, { isPrimary: true });
      console.log("[TEST] 更新后isPrimary:", updated.isPrimary);

      expect(updated.isPrimary).toBe(true);
      console.log("[TEST] ✓ 设备主设备状态更新成功");
    });
  });

  describe("delete", () => {
    it("DEVICE-DELETE-001: 应该删除设备关联", async () => {
      console.log("[TEST] ========== DEVICE-DELETE-001 ==========");
      console.log("[TEST] 测试删除设备关联");

      const deviceId = "test-device-008";
      await deviceRepo.linkDevice(testUserId, deviceId);
      console.log("[TEST] 已关联设备:", deviceId);

      await deviceRepo.delete(deviceId);
      console.log("[TEST] 已删除设备关联");

      const found = await deviceRepo.findByDeviceId(deviceId);
      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 设备关联删除成功");
    });
  });
});
