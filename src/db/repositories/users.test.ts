/**
 * 用户仓库测试
 *
 * 测试用户数据访问层的 CRUD 操作
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
  getUserRepository,
  getUserSessionRepository,
  getVerificationCodeRepository,
  UserRepository,
  UserSessionRepository,
  VerificationCodeRepository,
} from "./users.js";

describe("UserRepository", () => {
  let userRepo: UserRepository;

  beforeEach(() => {
    console.log("[TEST] ========== UserRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    userRepo = getUserRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UserRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("USER-CREATE-001: 应该创建新用户", async () => {
      console.log("[TEST] ========== USER-CREATE-001 ==========");
      console.log("[TEST] 测试创建新用户");

      const userData = {
        phone: "+8613800138000",
        email: "test@example.com",
        passwordHash: "Test@123",
        isActive: true,
      };

      console.log("[TEST] 用户数据:", JSON.stringify(userData, null, 2));

      const user = await userRepo.create(userData);

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

    it("USER-CREATE-002: 应该自动哈希明文密码", async () => {
      console.log("[TEST] ========== USER-CREATE-002 ==========");
      console.log("[TEST] 测试密码自动哈希");

      const plainPassword = "MyPassword123";
      console.log("[TEST] 明文密码:", plainPassword);

      const user = await userRepo.create({
        phone: "+8613800138001",
        passwordHash: plainPassword,
        isActive: true,
      });

      console.log("[TEST] 哈希后的密码:", user.passwordHash?.substring(0, 30) + "...");

      expect(user.passwordHash).not.toBe(plainPassword);
      expect(user.passwordHash).toMatch(/^\$scrypt\$/);
      console.log("[TEST] ✓ 密码自动哈希成功");
    });

    it("USER-CREATE-003: 应该支持创建无密码用户", async () => {
      console.log("[TEST] ========== USER-CREATE-003 ==========");
      console.log("[TEST] 测试创建无密码用户");

      const user = await userRepo.create({
        phone: "+8613800138002",
        isActive: true,
      });

      console.log("[TEST] 用户ID:", user.id);
      console.log("[TEST] 密码哈希:", user.passwordHash);

      expect(user.id).toBeTruthy();
      expect(user.passwordHash).toBeUndefined();
      console.log("[TEST] ✓ 无密码用户创建成功");
    });
  });

  describe("findById", () => {
    it("USER-FIND-001: 应该根据ID查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-001 ==========");
      console.log("[TEST] 测试根据ID查找用户");

      // 先创建用户
      const created = await userRepo.create({
        phone: "+8613800138003",
        email: "find@example.com",
        passwordHash: "Test@123",
        isActive: true,
      });

      console.log("[TEST] 创建的用户ID:", created.id);

      // 查找用户
      const found = await userRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.phone).toBe(created.phone);
      console.log("[TEST] ✓ 用户查找成功");
    });

    it("USER-FIND-002: 不存在的ID应该返回null", async () => {
      console.log("[TEST] ========== USER-FIND-002 ==========");
      console.log("[TEST] 测试查找不存在的用户");

      const nonExistentId = "non-existent-id";
      console.log("[TEST] 查找ID:", nonExistentId);

      const found = await userRepo.findById(nonExistentId);

      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findByPhone", () => {
    it("USER-FIND-003: 应该根据手机号查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-003 ==========");
      console.log("[TEST] 测试根据手机号查找用户");

      const phone = "+8613800138004";
      console.log("[TEST] 手机号:", phone);

      await userRepo.create({
        phone,
        passwordHash: "Test@123",
        isActive: true,
      });

      const found = await userRepo.findByPhone(phone);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.phone).toBe(phone);
      console.log("[TEST] ✓ 手机号查找成功");
    });
  });

  describe("findByEmail", () => {
    it("USER-FIND-004: 应该根据邮箱查找用户", async () => {
      console.log("[TEST] ========== USER-FIND-004 ==========");
      console.log("[TEST] 测试根据邮箱查找用户");

      const email = "email@example.com";
      console.log("[TEST] 邮箱:", email);

      await userRepo.create({
        phone: "+8613800138005",
        email,
        passwordHash: "Test@123",
        isActive: true,
      });

      const found = await userRepo.findByEmail(email);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.email).toBe(email);
      console.log("[TEST] ✓ 邮箱查找成功");
    });

    it("USER-FIND-005: 邮箱查找应该不区分大小写", async () => {
      console.log("[TEST] ========== USER-FIND-005 ==========");
      console.log("[TEST] 测试邮箱大小写不敏感");

      const email = "CaseSensitive@Example.COM";
      console.log("[TEST] 原始邮箱:", email);

      await userRepo.create({
        phone: "+8613800138006",
        email,
        passwordHash: "Test@123",
        isActive: true,
      });

      const found = await userRepo.findByEmail(email.toLowerCase());

      console.log("[TEST] 使用小写查找:", email.toLowerCase());
      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      console.log("[TEST] ✓ 大小写不敏感查找成功");
    });
  });

  describe("findByIdentifier", () => {
    it("USER-FIND-006: 应该识别并查找邮箱", async () => {
      console.log("[TEST] ========== USER-FIND-006 ==========");
      console.log("[TEST] 测试通过标识符查找邮箱");

      const email = "identifier@example.com";
      console.log("[TEST] 邮箱标识符:", email);

      await userRepo.create({
        phone: "+8613800138007",
        email,
        passwordHash: "Test@123",
        isActive: true,
      });

      const found = await userRepo.findByIdentifier(email);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.email).toBe(email);
      console.log("[TEST] ✓ 邮箱标识符查找成功");
    });

    it("USER-FIND-007: 应该识别并查找手机号", async () => {
      console.log("[TEST] ========== USER-FIND-007 ==========");
      console.log("[TEST] 测试通过标识符查找手机号");

      const phone = "+8613800138008";
      console.log("[TEST] 手机号标识符:", phone);

      await userRepo.create({
        phone,
        passwordHash: "Test@123",
        isActive: true,
      });

      const found = await userRepo.findByIdentifier(phone);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.phone).toBe(phone);
      console.log("[TEST] ✓ 手机号标识符查找成功");
    });
  });

  describe("update", () => {
    it("USER-UPDATE-001: 应该更新用户信息", async () => {
      console.log("[TEST] ========== USER-UPDATE-001 ==========");
      console.log("[TEST] 测试更新用户信息");

      const user = await userRepo.create({
        phone: "+8613800138009",
        email: "old@example.com",
        passwordHash: "Test@123",
        isActive: true,
      });

      console.log("[TEST] 原始邮箱:", user.email);

      const newEmail = "new@example.com";
      console.log("[TEST] 新邮箱:", newEmail);

      const updated = await userRepo.update(user.id, { email: newEmail });

      console.log("[TEST] 更新后的邮箱:", updated?.email);

      expect(updated).toBeTruthy();
      expect(updated?.email).toBe(newEmail);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
      console.log("[TEST] ✓ 用户信息更新成功");
    });

    it("USER-UPDATE-002: 更新密码应该自动哈希", async () => {
      console.log("[TEST] ========== USER-UPDATE-002 ==========");
      console.log("[TEST] 测试更新密码自动哈希");

      const user = await userRepo.create({
        phone: "+8613800138010",
        passwordHash: "OldPassword@123",
        isActive: true,
      });

      console.log("[TEST] 原密码哈希:", user.passwordHash?.substring(0, 30) + "...");

      const newPassword = "NewPassword@456";
      console.log("[TEST] 新明文密码:", newPassword);

      const updated = await userRepo.update(user.id, {
        passwordHash: newPassword,
      });

      console.log("[TEST] 新密码哈希:", updated?.passwordHash?.substring(0, 30) + "...");

      expect(updated?.passwordHash).not.toBe(newPassword);
      expect(updated?.passwordHash).toMatch(/^\$scrypt\$/);
      expect(updated?.passwordHash).not.toBe(user.passwordHash);
      console.log("[TEST] ✓ 密码更新并自动哈希成功");
    });
  });

  describe("deactivate and activate", () => {
    it("USER-STATUS-001: 应该停用用户", async () => {
      console.log("[TEST] ========== USER-STATUS-001 ==========");
      console.log("[TEST] 测试停用用户");

      const user = await userRepo.create({
        phone: "+8613800138011",
        passwordHash: "Test@123",
        isActive: true,
      });

      console.log("[TEST] 原始状态:", user.isActive);

      await userRepo.deactivate(user.id);

      const deactivated = await userRepo.findById(user.id);

      console.log("[TEST] 停用后状态:", deactivated?.isActive);

      expect(deactivated?.isActive).toBe(false);
      console.log("[TEST] ✓ 用户停用成功");
    });

    it("USER-STATUS-002: 应该激活用户", async () => {
      console.log("[TEST] ========== USER-STATUS-002 ==========");
      console.log("[TEST] 测试激活用户");

      const user = await userRepo.create({
        phone: "+8613800138012",
        passwordHash: "Test@123",
        isActive: false,
      });

      console.log("[TEST] 原始状态:", user.isActive);

      await userRepo.activate(user.id);

      const activated = await userRepo.findById(user.id);

      console.log("[TEST] 激活后状态:", activated?.isActive);

      expect(activated?.isActive).toBe(true);
      console.log("[TEST] ✓ 用户激活成功");
    });
  });
});

describe("UserSessionRepository", () => {
  let sessionRepo: UserSessionRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    console.log("[TEST] ========== UserSessionRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    sessionRepo = getUserSessionRepository(db);
    userRepo = getUserRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UserSessionRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("SESSION-CREATE-001: 应该创建会话", async () => {
      console.log("[TEST] ========== SESSION-CREATE-001 ==========");
      console.log("[TEST] 测试创建会话");

      const user = await userRepo.create({
        phone: "+8613800138013",
        passwordHash: "Test@123",
        isActive: true,
      });

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
      expect(session.refreshTokenHash).toBeTruthy();
      expect(session.expiresAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 会话创建成功");
    });
  });

  describe("findByRefreshToken", () => {
    it("SESSION-FIND-001: 应该根据Refresh Token查找会话", async () => {
      console.log("[TEST] ========== SESSION-FIND-001 ==========");
      console.log("[TEST] 测试根据Refresh Token查找会话");

      const user = await userRepo.create({
        phone: "+8613800138014",
        passwordHash: "Test@123",
        isActive: true,
      });

      const { session, refreshToken } = await sessionRepo.create(user.id, {});

      console.log("[TEST] 创建的会话ID:", session.id);
      console.log("[TEST] Refresh Token:", refreshToken.substring(0, 20) + "...");

      const found = await sessionRepo.findByRefreshToken(refreshToken);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(session.id);
      console.log("[TEST] ✓ 会话查找成功");
    });

    it("SESSION-FIND-002: 无效Token应该返回null", async () => {
      console.log("[TEST] ========== SESSION-FIND-002 ==========");
      console.log("[TEST] 测试无效Token查找");

      const invalidToken = "invalid-refresh-token";
      console.log("[TEST] 无效Token:", invalidToken);

      const found = await sessionRepo.findByRefreshToken(invalidToken);

      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("revoke", () => {
    it("SESSION-REVOKE-001: 应该撤销会话", async () => {
      console.log("[TEST] ========== SESSION-REVOKE-001 ==========");
      console.log("[TEST] 测试撤销会话");

      const user = await userRepo.create({
        phone: "+8613800138015",
        passwordHash: "Test@123",
        isActive: true,
      });

      const { session, refreshToken } = await sessionRepo.create(user.id, {});

      console.log("[TEST] 会话ID:", session.id);

      await sessionRepo.revoke(session.id);

      const found = await sessionRepo.findByRefreshToken(refreshToken);

      console.log("[TEST] 撤销后查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 会话撤销成功");
    });
  });
});

describe("VerificationCodeRepository", () => {
  let codeRepo: VerificationCodeRepository;

  beforeEach(() => {
    console.log("[TEST] ========== VerificationCodeRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    codeRepo = getVerificationCodeRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== VerificationCodeRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("CODE-CREATE-001: 应该创建验证码", async () => {
      console.log("[TEST] ========== CODE-CREATE-001 ==========");
      console.log("[TEST] 测试创建验证码");

      const target = "+8613800138016";
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
      console.log("[TEST] ✓ 验证码创建成功");
    });
  });

  describe("verify", () => {
    it("CODE-VERIFY-001: 应该验证正确的验证码", async () => {
      console.log("[TEST] ========== CODE-VERIFY-001 ==========");
      console.log("[TEST] 测试验证正确的验证码");

      const target = "+8613800138017";
      const { code } = await codeRepo.create(target, "phone", "login");

      console.log("[TEST] 目标:", target);
      console.log("[TEST] 验证码:", code);

      const isValid = await codeRepo.verify(target, code, "login");

      console.log("[TEST] 验证结果:", isValid);

      expect(isValid).toBe(true);
      console.log("[TEST] ✓ 验证码验证成功");
    });

    it("CODE-VERIFY-002: 应该拒绝错误的验证码", async () => {
      console.log("[TEST] ========== CODE-VERIFY-002 ==========");
      console.log("[TEST] 测试验证错误的验证码");

      const target = "+8613800138018";
      await codeRepo.create(target, "phone", "login");

      const wrongCode = "000000";
      console.log("[TEST] 错误验证码:", wrongCode);

      const isValid = await codeRepo.verify(target, wrongCode, "login");

      console.log("[TEST] 验证结果:", isValid);

      expect(isValid).toBe(false);
      console.log("[TEST] ✓ 正确拒绝错误验证码");
    });

    it("CODE-VERIFY-003: 验证码只能使用一次", async () => {
      console.log("[TEST] ========== CODE-VERIFY-003 ==========");
      console.log("[TEST] 测试验证码单次使用");

      const target = "+8613800138019";
      const { code } = await codeRepo.create(target, "phone", "login");

      console.log("[TEST] 验证码:", code);

      // 第一次验证
      const firstVerify = await codeRepo.verify(target, code, "login");
      console.log("[TEST] 第一次验证:", firstVerify);

      // 第二次验证
      const secondVerify = await codeRepo.verify(target, code, "login");
      console.log("[TEST] 第二次验证:", secondVerify);

      expect(firstVerify).toBe(true);
      expect(secondVerify).toBe(false);
      console.log("[TEST] ✓ 验证码单次使用限制成功");
    });
  });
});
