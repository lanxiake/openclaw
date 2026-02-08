/**
 * 用户仓库集成测试
 *
 * 使用真实PostgreSQL数据库测试用户数据访问层的 CRUD 操作
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "../connection.js";
import type { Database } from "../connection.js";
import {
  getUserRepository,
  getUserSessionRepository,
  getVerificationCodeRepository,
  UserRepository,
  UserSessionRepository,
  VerificationCodeRepository,
} from "./users.js";

describe("UserRepository (Integration)", () => {
  let db: Database;
  let userRepo: UserRepository;
  const testUserIds: string[] = [];

  beforeAll(async () => {
    console.log("[TEST] ========== 连接真实数据库 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    console.log("[TEST] ✓ 数据库连接成功");
  });

  afterEach(async () => {
    // 清理测试数据
    console.log("[TEST] 清理测试数据...");
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch (error) {
        // 忽略删除错误
      }
    }
    testUserIds.length = 0;
  });

  afterAll(() => {
    console.log("[TEST] ========== 测试完成 ==========\n");
  });

  describe("create", () => {
    it("USER-CREATE-INT-001: 应该创建新用户", async () => {
      console.log("[TEST] ========== USER-CREATE-INT-001 ==========");
      console.log("[TEST] 测试创建新用户");

      const userData = {
        phone: `+86138${Date.now().toString().slice(-8)}`,
        email: `test-${Date.now()}@example.com`,
        passwordHash: "Test@123",
        isActive: true,
      };

      console.log("[TEST] 用户数据:", JSON.stringify(userData, null, 2));

      const user = await userRepo.create(userData);
      testUserIds.push(user.id);

      console.log("[TEST] 创建的用户ID:", user.id);
      console.log("[TEST] 密码哈希格式:", user.passwordHash?.substring(0, 20) + "...");

      expect(user.id).toBeTruthy();
      expect(user.phone).toBe(userData.phone);
      expect(user.email).toBe(userData.email);
      expect(user.passwordHash).toMatch(/^\$scrypt\$/);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 用户创建成功");
    });

    it("USER-CREATE-INT-002: 应该自动哈希明文密码", async () => {
      console.log("[TEST] ========== USER-CREATE-INT-002 ==========");
      console.log("[TEST] 测试密码自动哈希");

      const plainPassword = "MyPassword123";
      console.log("[TEST] 明文密码:", plainPassword);

      const user = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        passwordHash: plainPassword,
        isActive: true,
      });
      testUserIds.push(user.id);

      console.log("[TEST] 哈希后的密码:", user.passwordHash?.substring(0, 30) + "...");

      expect(user.passwordHash).not.toBe(plainPassword);
      expect(user.passwordHash).toMatch(/^\$scrypt\$/);
      console.log("[TEST] ✓ 密码自动哈希成功");
    });
  });

  describe("findById", () => {
    it("USER-FIND-INT-001: 应该根据ID查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-INT-001 ==========");
      console.log("[TEST] 测试根据ID查找用户");

      // 先创建用户
      const created = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        email: `find-${Date.now()}@example.com`,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(created.id);

      console.log("[TEST] 创建的用户ID:", created.id);

      // 查找用户
      const found = await userRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.phone).toBe(created.phone);
      console.log("[TEST] ✓ 用户查找成功");
    });

    it("USER-FIND-INT-002: 不存在的ID应该返回null", async () => {
      console.log("[TEST] ========== USER-FIND-INT-002 ==========");
      console.log("[TEST] 测试查找不存在的用户");

      const nonExistentId = "non-existent-id-12345";
      console.log("[TEST] 查找ID:", nonExistentId);

      const found = await userRepo.findById(nonExistentId);

      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findByPhone", () => {
    it("USER-FIND-INT-003: 应该根据手机号查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-INT-003 ==========");
      console.log("[TEST] 测试根据手机号查找用户");

      const phone = `+86138${Date.now().toString().slice(-8)}`;
      console.log("[TEST] 手机号:", phone);

      const created = await userRepo.create({
        phone,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(created.id);

      const found = await userRepo.findByPhone(phone);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.phone).toBe(phone);
      console.log("[TEST] ✓ 手机号查找成功");
    });
  });

  describe("findByEmail", () => {
    it("USER-FIND-INT-004: 应该根据邮箱查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-INT-004 ==========");
      console.log("[TEST] 测试根据邮箱查找用户");

      const email = `email-${Date.now()}@example.com`;
      console.log("[TEST] 邮箱:", email);

      const created = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        email,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(created.id);

      const found = await userRepo.findByEmail(email);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.email).toBe(email);
      console.log("[TEST] ✓ 邮箱查找成功");
    });
  });

  describe("update", () => {
    it("USER-UPDATE-INT-001: 应该更新用户信息", async () => {
      console.log("[TEST] ========== USER-UPDATE-INT-001 ==========");
      console.log("[TEST] 测试更新用户信息");

      const user = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        email: `old-${Date.now()}@example.com`,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(user.id);

      console.log("[TEST] 原始邮箱:", user.email);

      const newEmail = `new-${Date.now()}@example.com`;
      console.log("[TEST] 新邮箱:", newEmail);

      const updated = await userRepo.update(user.id, { email: newEmail });

      console.log("[TEST] 更新后的邮箱:", updated?.email);

      expect(updated).toBeTruthy();
      expect(updated?.email).toBe(newEmail);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
      console.log("[TEST] ✓ 用户信息更新成功");
    });
  });

  describe("deactivate and activate", () => {
    it("USER-STATUS-INT-001: 应该停用和激活用户", async () => {
      console.log("[TEST] ========== USER-STATUS-INT-001 ==========");
      console.log("[TEST] 测试停用和激活用户");

      const user = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(user.id);

      console.log("[TEST] 原始状态:", user.isActive);

      // 停用
      await userRepo.deactivate(user.id);
      const deactivated = await userRepo.findById(user.id);
      console.log("[TEST] 停用后状态:", deactivated?.isActive);
      expect(deactivated?.isActive).toBe(false);

      // 激活
      await userRepo.activate(user.id);
      const activated = await userRepo.findById(user.id);
      console.log("[TEST] 激活后状态:", activated?.isActive);
      expect(activated?.isActive).toBe(true);

      console.log("[TEST] ✓ 用户状态切换成功");
    });
  });
});

describe("UserSessionRepository (Integration)", () => {
  let db: Database;
  let sessionRepo: UserSessionRepository;
  let userRepo: UserRepository;
  const testUserIds: string[] = [];

  beforeAll(() => {
    db = getDatabase();
    sessionRepo = getUserSessionRepository(db);
    userRepo = getUserRepository(db);
  });

  afterEach(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch (error) {
        // 忽略
      }
    }
    testUserIds.length = 0;
  });

  describe("create and find", () => {
    it("SESSION-INT-001: 应该创建和查找会话", async () => {
      console.log("[TEST] ========== SESSION-INT-001 ==========");
      console.log("[TEST] 测试创建和查找会话");

      const user = await userRepo.create({
        phone: `+86138${Date.now().toString().slice(-8)}`,
        passwordHash: "Test@123",
        isActive: true,
      });
      testUserIds.push(user.id);

      console.log("[TEST] 用户ID:", user.id);

      const { session, refreshToken } = await sessionRepo.create(user.id, {
        userAgent: "Test Browser",
        ipAddress: "127.0.0.1",
      });

      console.log("[TEST] 会话ID:", session.id);
      console.log("[TEST] Refresh Token长度:", refreshToken.length);

      expect(session.id).toBeTruthy();
      expect(session.userId).toBe(user.id);
      expect(refreshToken).toBeTruthy();

      // 查找会话
      const found = await sessionRepo.findByRefreshToken(refreshToken);
      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(session.id);
      console.log("[TEST] ✓ 会话创建和查找成功");
    });
  });
});

describe("VerificationCodeRepository (Integration)", () => {
  let db: Database;
  let codeRepo: VerificationCodeRepository;

  beforeAll(() => {
    db = getDatabase();
    codeRepo = getVerificationCodeRepository(db);
  });

  describe("create and verify", () => {
    it("CODE-INT-001: 应该创建和验证验证码", async () => {
      console.log("[TEST] ========== CODE-INT-001 ==========");
      console.log("[TEST] 测试创建和验证验证码");

      const target = `+86138${Date.now().toString().slice(-8)}`;
      console.log("[TEST] 目标手机号:", target);

      const { code, expiresAt } = await codeRepo.create(
        target,
        "phone",
        "register"
      );

      console.log("[TEST] 生成的验证码:", code);
      console.log("[TEST] 过期时间:", expiresAt);

      expect(code).toBeTruthy();
      expect(code).toMatch(/^\d{6}$/);
      expect(expiresAt).toBeInstanceOf(Date);

      // 验证正确的验证码
      const isValid = await codeRepo.verify(target, code, "register");
      console.log("[TEST] 验证结果:", isValid);
      expect(isValid).toBe(true);

      // 验证码只能使用一次
      const secondVerify = await codeRepo.verify(target, code, "register");
      console.log("[TEST] 第二次验证:", secondVerify);
      expect(secondVerify).toBe(false);

      console.log("[TEST] ✓ 验证码创建和验证成功");
    });
  });
});
