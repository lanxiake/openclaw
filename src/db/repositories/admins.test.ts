/**
 * 管理员仓库测试
 *
 * 测试管理员 CRUD 操作和会话管理
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  AdminRepository,
  AdminSessionRepository,
  AdminAuditLogRepository,
  AdminLoginAttemptRepository,
  getAdminRepository,
  getAdminSessionRepository,
  getAdminAuditLogRepository,
  getAdminLoginAttemptRepository,
} from "./admins.js";

describe("AdminRepository", () => {
  let adminRepo: AdminRepository;

  beforeEach(() => {
    console.log("[TEST] ========== AdminRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    adminRepo = getAdminRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AdminRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("ADMIN-CREATE-001: 应该创建管理员", async () => {
      console.log("[TEST] ========== ADMIN-CREATE-001 ==========");
      const data = {
        username: "admin",
        email: "admin@example.com",
        passwordHash: "Admin@123",
        displayName: "测试管理员",
        role: "super_admin" as const,
        status: "active" as const,
      };
      console.log("[TEST] 管理员数据:", JSON.stringify(data, null, 2));

      const admin = await adminRepo.create(data);

      console.log("[TEST] 创建的管理员ID:", admin.id);
      console.log("[TEST] 密码哈希格式:", admin.passwordHash?.substring(0, 20) + "...");

      expect(admin.id).toBeTruthy();
      expect(admin.username).toBe(data.username);
      expect(admin.email).toBe(data.email);
      expect(admin.passwordHash).toMatch(/^\$scrypt\$/);
      expect(admin.role).toBe("super_admin");
      console.log("[TEST] ✓ 管理员创建成功");
    });

    it("ADMIN-CREATE-002: 应该自动哈希密码", async () => {
      console.log("[TEST] ========== ADMIN-CREATE-002 ==========");
      const plainPassword = "MyAdminPass@456";

      const admin = await adminRepo.create({
        username: "admin2",
        passwordHash: plainPassword,
        role: "admin" as const,
        status: "active" as const,
      });

      console.log("[TEST] 明文密码:", plainPassword);
      console.log("[TEST] 哈希结果:", admin.passwordHash?.substring(0, 30) + "...");

      expect(admin.passwordHash).not.toBe(plainPassword);
      expect(admin.passwordHash).toMatch(/^\$scrypt\$/);
      console.log("[TEST] ✓ 密码自动哈希成功");
    });
  });

  describe("findById", () => {
    it("ADMIN-FIND-001: 应该根据ID查找管理员", async () => {
      console.log("[TEST] ========== ADMIN-FIND-001 ==========");

      const created = await adminRepo.create({
        username: "findme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      console.log("[TEST] 创建的ID:", created.id);

      const found = await adminRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe("findme");
      console.log("[TEST] ✓ 管理员查找成功");
    });

    it("ADMIN-FIND-002: 不存在的ID应该返回null", async () => {
      console.log("[TEST] ========== ADMIN-FIND-002 ==========");

      const found = await adminRepo.findById("non-existent-id");

      console.log("[TEST] 查找结果:", found);
      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findByUsername", () => {
    it("ADMIN-FIND-003: 应该根据用户名查找管理员", async () => {
      console.log("[TEST] ========== ADMIN-FIND-003 ==========");

      await adminRepo.create({
        username: "uniqueadmin",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const found = await adminRepo.findByUsername("uniqueadmin");

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");
      expect(found).toBeTruthy();
      expect(found?.username).toBe("uniqueadmin");
      console.log("[TEST] ✓ 用户名查找成功");
    });
  });

  describe("update", () => {
    it("ADMIN-UPDATE-001: 应该更新管理员信息", async () => {
      console.log("[TEST] ========== ADMIN-UPDATE-001 ==========");

      const admin = await adminRepo.create({
        username: "updateme",
        email: "old@example.com",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      console.log("[TEST] 原始邮箱:", admin.email);

      const updated = await adminRepo.update(admin.id, {
        email: "new@example.com",
        displayName: "新名称",
      });

      console.log("[TEST] 更新后邮箱:", updated?.email);
      console.log("[TEST] 更新后显示名:", updated?.displayName);

      expect(updated?.email).toBe("new@example.com");
      expect(updated?.displayName).toBe("新名称");
      console.log("[TEST] ✓ 管理员信息更新成功");
    });

    it("ADMIN-UPDATE-002: 更新密码应该自动哈希", async () => {
      console.log("[TEST] ========== ADMIN-UPDATE-002 ==========");

      const admin = await adminRepo.create({
        username: "pwdupdate",
        passwordHash: "OldPass@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const newPassword = "NewPass@456";
      const updated = await adminRepo.update(admin.id, {
        passwordHash: newPassword,
      });

      console.log("[TEST] 新密码哈希:", updated?.passwordHash?.substring(0, 30) + "...");

      expect(updated?.passwordHash).not.toBe(newPassword);
      expect(updated?.passwordHash).toMatch(/^\$scrypt\$/);
      expect(updated?.passwordHash).not.toBe(admin.passwordHash);
      console.log("[TEST] ✓ 密码更新并自动哈希成功");
    });
  });

  describe("lockAccount and unlockAccount", () => {
    it("ADMIN-LOCK-001: 应该锁定账户", async () => {
      console.log("[TEST] ========== ADMIN-LOCK-001 ==========");

      const admin = await adminRepo.create({
        username: "lockme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      console.log("[TEST] 原始状态:", admin.status);

      await adminRepo.lockAccount(admin.id, 30 * 60 * 1000); // 30分钟

      const locked = await adminRepo.findById(admin.id);
      console.log("[TEST] 锁定后状态:", locked?.status);

      expect(locked?.status).toBe("locked");
      expect(locked?.lockedUntil).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 账户锁定成功");
    });

    it("ADMIN-LOCK-002: 应该解锁账户", async () => {
      console.log("[TEST] ========== ADMIN-LOCK-002 ==========");

      const admin = await adminRepo.create({
        username: "unlockme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      await adminRepo.lockAccount(admin.id, 30 * 60 * 1000);
      await adminRepo.unlockAccount(admin.id);

      const unlocked = await adminRepo.findById(admin.id);
      console.log("[TEST] 解锁后状态:", unlocked?.status);

      expect(unlocked?.status).toBe("active");
      console.log("[TEST] ✓ 账户解锁成功");
    });
  });

  describe("suspend and activate", () => {
    it("ADMIN-SUSPEND-001: 应该停用管理员", async () => {
      console.log("[TEST] ========== ADMIN-SUSPEND-001 ==========");

      const admin = await adminRepo.create({
        username: "suspendme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      await adminRepo.suspend(admin.id);

      const suspended = await adminRepo.findById(admin.id);
      console.log("[TEST] 停用后状态:", suspended?.status);

      expect(suspended?.status).toBe("suspended");
      console.log("[TEST] ✓ 管理员停用成功");
    });

    it("ADMIN-SUSPEND-002: 应该激活管理员", async () => {
      console.log("[TEST] ========== ADMIN-SUSPEND-002 ==========");

      const admin = await adminRepo.create({
        username: "activateme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "suspended" as const,
      });

      await adminRepo.activate(admin.id);

      const activated = await adminRepo.findById(admin.id);
      console.log("[TEST] 激活后状态:", activated?.status);

      expect(activated?.status).toBe("active");
      console.log("[TEST] ✓ 管理员激活成功");
    });
  });

  describe("delete", () => {
    it("ADMIN-DELETE-001: 应该删除管理员", async () => {
      console.log("[TEST] ========== ADMIN-DELETE-001 ==========");

      const admin = await adminRepo.create({
        username: "deleteme",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      await adminRepo.delete(admin.id);

      const found = await adminRepo.findById(admin.id);
      console.log("[TEST] 删除后查找:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 管理员删除成功");
    });
  });
});

describe("AdminSessionRepository", () => {
  let sessionRepo: AdminSessionRepository;
  let adminRepo: AdminRepository;

  beforeEach(() => {
    console.log("[TEST] ========== AdminSessionRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    sessionRepo = getAdminSessionRepository(db);
    adminRepo = getAdminRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AdminSessionRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("ADMIN-SESSION-001: 应该创建管理员会话", async () => {
      console.log("[TEST] ========== ADMIN-SESSION-001 ==========");

      const admin = await adminRepo.create({
        username: "sessionadmin",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const { session, refreshToken } = await sessionRepo.create(admin.id, {
        userAgent: "Test Browser",
        ipAddress: "127.0.0.1",
      });

      console.log("[TEST] 会话ID:", session.id);
      console.log("[TEST] Refresh Token长度:", refreshToken.length);

      expect(session.id).toBeTruthy();
      expect(session.adminId).toBe(admin.id);
      expect(refreshToken).toBeTruthy();
      expect(session.refreshTokenHash).toBeTruthy();
      expect(session.expiresAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 管理员会话创建成功");
    });
  });

  describe("findByRefreshToken", () => {
    it("ADMIN-SESSION-002: 应该根据Refresh Token查找会话", async () => {
      console.log("[TEST] ========== ADMIN-SESSION-002 ==========");

      const admin = await adminRepo.create({
        username: "findsession",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const { session, refreshToken } = await sessionRepo.create(admin.id, {});
      console.log("[TEST] 会话ID:", session.id);

      const found = await sessionRepo.findByRefreshToken(refreshToken);
      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(session.id);
      console.log("[TEST] ✓ 会话查找成功");
    });

    it("ADMIN-SESSION-003: 无效Token应该返回null", async () => {
      console.log("[TEST] ========== ADMIN-SESSION-003 ==========");

      const found = await sessionRepo.findByRefreshToken("invalid-token");

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("revoke", () => {
    it("ADMIN-SESSION-004: 应该撤销会话", async () => {
      console.log("[TEST] ========== ADMIN-SESSION-004 ==========");

      const admin = await adminRepo.create({
        username: "revokesession",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const { session, refreshToken } = await sessionRepo.create(admin.id, {});

      await sessionRepo.revoke(session.id);

      const found = await sessionRepo.findByRefreshToken(refreshToken);
      console.log("[TEST] 撤销后查找:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 会话撤销成功");
    });
  });

  describe("revokeAllForAdmin", () => {
    it("ADMIN-SESSION-005: 应该撤销管理员所有会话", async () => {
      console.log("[TEST] ========== ADMIN-SESSION-005 ==========");

      const admin = await adminRepo.create({
        username: "revokeall",
        passwordHash: "Test@123",
        role: "admin" as const,
        status: "active" as const,
      });

      const { refreshToken: token1 } = await sessionRepo.create(admin.id, {});
      const { refreshToken: token2 } = await sessionRepo.create(admin.id, {});

      await sessionRepo.revokeAllForAdmin(admin.id);

      const found1 = await sessionRepo.findByRefreshToken(token1);
      const found2 = await sessionRepo.findByRefreshToken(token2);

      console.log("[TEST] 会话1:", found1);
      console.log("[TEST] 会话2:", found2);

      expect(found1).toBeNull();
      expect(found2).toBeNull();
      console.log("[TEST] ✓ 所有会话撤销成功");
    });
  });
});

describe("AdminAuditLogRepository", () => {
  let auditRepo: AdminAuditLogRepository;

  beforeEach(() => {
    console.log("[TEST] ========== AdminAuditLogRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    auditRepo = getAdminAuditLogRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AdminAuditLogRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("AUDIT-CREATE-001: 应该创建审计日志", async () => {
      console.log("[TEST] ========== AUDIT-CREATE-001 ==========");

      const log = await auditRepo.create({
        adminId: "admin-1",
        adminUsername: "admin",
        action: "login",
        targetType: "admin",
        targetId: "admin-1",
        ipAddress: "127.0.0.1",
        riskLevel: "low",
      });

      console.log("[TEST] 日志ID:", log.id);
      console.log("[TEST] 操作:", log.action);

      expect(log.id).toBeTruthy();
      expect(log.action).toBe("login");
      expect(log.adminUsername).toBe("admin");
      console.log("[TEST] ✓ 审计日志创建成功");
    });
  });

  describe("findById", () => {
    it("AUDIT-FIND-001: 应该根据ID查找审计日志", async () => {
      console.log("[TEST] ========== AUDIT-FIND-001 ==========");

      const created = await auditRepo.create({
        adminId: "admin-1",
        adminUsername: "admin",
        action: "update_user",
        riskLevel: "medium",
      });

      const found = await auditRepo.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.action).toBe("update_user");
      console.log("[TEST] ✓ 审计日志查找成功");
    });
  });
});

describe("AdminLoginAttemptRepository", () => {
  let attemptRepo: AdminLoginAttemptRepository;

  beforeEach(() => {
    console.log("[TEST] ========== AdminLoginAttemptRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    attemptRepo = getAdminLoginAttemptRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AdminLoginAttemptRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("record", () => {
    it("ATTEMPT-RECORD-001: 应该记录登录尝试", async () => {
      console.log("[TEST] ========== ATTEMPT-RECORD-001 ==========");

      // 记录不应该抛错
      await expect(
        attemptRepo.record({
          username: "admin",
          ipAddress: "127.0.0.1",
          success: false,
          failureReason: "invalid_password",
          userAgent: "Test Browser",
        }),
      ).resolves.not.toThrow();

      console.log("[TEST] ✓ 登录尝试记录成功");
    });
  });
});
