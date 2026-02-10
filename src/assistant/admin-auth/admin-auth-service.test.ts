/**
 * 管理员认证服务测试
 *
 * 测试管理员登录、Token 刷新、登出等认证流程
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  adminLogoutAll,
  getAdminProfile,
  type AdminLoginRequest,
  type AdminRefreshTokenRequest,
} from "./admin-auth-service.js";
import {
  getAdminRepository,
  getAdminSessionRepository,
  getAdminLoginAttemptRepository,
} from "../../db/index.js";

describe("AdminAuthService - 管理员登录", () => {
  beforeEach(async () => {
    // 启用 Mock 数据库
    enableMockDatabase();
    const db = getMockDatabase();

    // 清空相关表
    const adminRepo = getAdminRepository(db);
    const sessionRepo = getAdminSessionRepository(db);
    const attemptRepo = getAdminLoginAttemptRepository(db);

    clearMockDatabase();

    await adminRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
    await attemptRepo.deleteAll?.();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功使用密码登录", async () => {
    const adminRepo = getAdminRepository();
    const username = "admin001";
    const password = "AdminP@ssw0rd123";

    // 创建管理员
    const admin = await adminRepo.create({
      username,
      passwordHash: password, // Repository 会自动哈希
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.admin).toBeDefined();
    expect(result.admin?.id).toBe(admin.id);
    expect(result.admin?.username).toBe(username);
    expect(result.admin?.role).toBe("admin");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("应该拒绝不存在的管理员登录", async () => {
    const request: AdminLoginRequest = {
      username: "nonexistent",
      password: "AnyPassword123",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
    expect(result.error).toContain("用户名或密码错误");
  });

  it("应该拒绝错误的密码", async () => {
    const adminRepo = getAdminRepository();
    const username = "admin002";
    const correctPassword = "CorrectP@ssw0rd123";
    const wrongPassword = "WrongP@ssw0rd123";

    // 创建管理员
    await adminRepo.create({
      username,
      passwordHash: correctPassword,
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    const request: AdminLoginRequest = {
      username,
      password: wrongPassword,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("应该拒绝已停用的管理员登录", async () => {
    const adminRepo = getAdminRepository();
    const username = "admin003";
    const password = "AdminP@ssw0rd123";

    // 创建已停用的管理员
    await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "停用管理员",
      role: "admin",
      status: "suspended",
    });

    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_SUSPENDED");
    expect(result.error).toContain("停用");
  });

  it("应该拒绝已锁定的管理员登录", async () => {
    const adminRepo = getAdminRepository();
    const username = "admin004";
    const password = "AdminP@ssw0rd123";

    // 创建管理员
    const admin = await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    // 锁定账户 30 分钟
    await adminRepo.lockAccount(admin.id, 30 * 60 * 1000);

    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_LOCKED");
    expect(result.error).toContain("锁定");
  });

  it("应该在多次失败后自动锁定账户", async () => {
    const adminRepo = getAdminRepository();
    const attemptRepo = getAdminLoginAttemptRepository();
    const username = "admin005";
    const password = "AdminP@ssw0rd123";

    // 创建管理员
    await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    // 模拟 5 次失败登录
    for (let i = 0; i < 5; i++) {
      await attemptRepo.record({
        username,
        ipAddress: "127.0.0.1",
        success: false,
        failureReason: "invalid_password",
        userAgent: "Test Agent",
      });
    }

    // 尝试第 6 次登录
    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_LOCKED");
    expect(result.error).toContain("锁定");
  });

  it("应该在 IP 请求过多时拒绝登录", async () => {
    const attemptRepo = getAdminLoginAttemptRepository();
    const ipAddress = "192.168.1.100";

    // 模拟 20 次失败登录（来自同一 IP）
    for (let i = 0; i < 20; i++) {
      await attemptRepo.record({
        username: `user${i}`,
        ipAddress,
        success: false,
        failureReason: "invalid_credentials",
        userAgent: "Test Agent",
      });
    }

    // 尝试登录
    const request: AdminLoginRequest = {
      username: "admin006",
      password: "AnyPassword123",
      ipAddress,
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("IP_RATE_LIMITED");
    expect(result.error).toContain("频繁");
  });

  it("应该拒绝缺少凭据的登录", async () => {
    const request: AdminLoginRequest = {
      username: "",
      password: "",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("MISSING_CREDENTIALS");
  });

  it("应该在启用 MFA 时要求验证码", async () => {
    const adminRepo = getAdminRepository();
    const username = "admin007";
    const password = "AdminP@ssw0rd123";

    // 创建启用了 MFA 的管理员
    await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "MFA 管理员",
      role: "admin",
      status: "active",
      mfaEnabled: true,
      mfaSecret: "test-secret",
    });

    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.mfaRequired).toBe(true);
    expect(result.mfaMethod).toBe("totp");
    expect(result.errorCode).toBe("MFA_REQUIRED");
  });

  it("应该支持不同的管理员角色", async () => {
    const adminRepo = getAdminRepository();
    const username = "superadmin";
    const password = "SuperP@ssw0rd123";

    // 创建超级管理员
    await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "超级管理员",
      role: "super_admin",
      status: "active",
    });

    const request: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminLogin(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.admin?.role).toBe("super_admin");
  });
});

describe("AdminAuthService - Token 刷新", () => {
  beforeEach(async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    await adminRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  it("应该成功刷新 Token", async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    // 创建管理员
    const admin = await adminRepo.create({
      username: "admin010",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "刷新测试",
      role: "admin",
      status: "active",
    });

    // 创建会话
    const { refreshToken: oldRefreshToken } = await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    const request: AdminRefreshTokenRequest = {
      refreshToken: oldRefreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminRefreshToken(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.admin?.id).toBe(admin.id);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("应该拒绝无效的 Refresh Token", async () => {
    const request: AdminRefreshTokenRequest = {
      refreshToken: "invalid-token",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminRefreshToken(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_REFRESH_TOKEN");
  });

  it("应该拒绝已停用管理员的 Token 刷新", async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    // 创建管理员
    const admin = await adminRepo.create({
      username: "admin011",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    // 创建会话
    const { refreshToken: token } = await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 停用管理员
    await adminRepo.suspend(admin.id);

    const request: AdminRefreshTokenRequest = {
      refreshToken: token,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await adminRefreshToken(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ADMIN_INACTIVE");
  });
});

describe("AdminAuthService - 登出", () => {
  beforeEach(async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    await adminRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  it("应该成功登出", async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    // 创建管理员和会话
    const admin = await adminRepo.create({
      username: "admin020",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "登出测试",
      role: "admin",
      status: "active",
    });

    const { session, refreshToken: token } = await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 登出
    const result = await adminLogout(token, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
      adminId: admin.id,
      adminUsername: admin.username,
    });

    // 验证结果
    expect(result.success).toBe(true);

    // 验证会话已被撤销
    const revokedSession = await sessionRepo.findById(session.id);
    expect(revokedSession?.revoked).toBe(true);
  });

  it("应该在无效 Token 时也返回成功", async () => {
    const result = await adminLogout("invalid-token", {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 验证结果（登出失败也返回成功）
    expect(result.success).toBe(true);
  });
});

describe("AdminAuthService - 登出所有设备", () => {
  beforeEach(async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    await adminRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  it("应该成功登出所有设备", async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    // 创建管理员
    const admin = await adminRepo.create({
      username: "admin030",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "多设备管理员",
      role: "admin",
      status: "active",
    });

    // 创建多个会话
    await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Device 1",
    });
    await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.2",
      userAgent: "Device 2",
    });
    await sessionRepo.create(admin.id, {
      ipAddress: "127.0.0.3",
      userAgent: "Device 3",
    });

    // 登出所有设备
    const result = await adminLogoutAll(admin.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Admin",
      adminUsername: admin.username,
    });

    // 验证结果
    expect(result.success).toBe(true);

    // 验证所有会话都已被撤销
    const sessions = await sessionRepo.findByAdminId(admin.id);
    expect(sessions.every((s) => s.revoked)).toBe(true);
  });

  it("应该处理不存在的管理员 ID", async () => {
    const result = await adminLogoutAll("non-existent-admin-id", {
      ipAddress: "127.0.0.1",
      userAgent: "Admin",
      adminUsername: "unknown",
    });

    // 验证结果（不会抛出错误）
    expect(result.success).toBe(true);
  });
});

describe("AdminAuthService - 获取管理员信息", () => {
  beforeEach(async () => {
    const adminRepo = getAdminRepository();
    await adminRepo.deleteAll?.();
  });

  it("应该成功获取管理员信息", async () => {
    const adminRepo = getAdminRepository();

    // 创建管理员
    const admin = await adminRepo.create({
      username: "admin040",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "测试管理员",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      permissions: {
        users: { read: true, write: true },
        settings: { read: true, write: false },
      },
    });

    const profile = await getAdminProfile(admin.id);

    // 验证结果
    expect(profile).toBeDefined();
    expect(profile?.id).toBe(admin.id);
    expect(profile?.username).toBe("admin040");
    expect(profile?.displayName).toBe("测试管理员");
    expect(profile?.email).toBe("admin@example.com");
    expect(profile?.role).toBe("admin");
    expect(profile?.permissions).toBeDefined();
  });

  it("应该在管理员不存在时返回 null", async () => {
    const profile = await getAdminProfile("non-existent-id");

    // 验证结果
    expect(profile).toBeNull();
  });

  it("应该在管理员已停用时返回 null", async () => {
    const adminRepo = getAdminRepository();

    // 创建已停用的管理员
    const admin = await adminRepo.create({
      username: "admin041",
      passwordHash: "AdminP@ssw0rd123",
      displayName: "停用管理员",
      role: "admin",
      status: "suspended",
    });

    const profile = await getAdminProfile(admin.id);

    // 验证结果
    expect(profile).toBeNull();
  });
});
