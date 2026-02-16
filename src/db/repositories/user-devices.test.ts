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
