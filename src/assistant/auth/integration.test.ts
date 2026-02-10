/**
 * 认证服务前后端集成测试
 *
 * 测试用户认证和管理员认证的完整流程，包括：
 * 1. 用户注册 -> 登录 -> Token 刷新 -> 登出
 * 2. 管理员登录 -> Token 刷新 -> 登出
 * 3. Token 验证和过期处理
 * 4. 并发登录和会话管理
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enableMockDatabase,
  disableMockDatabase,
  clearMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import {
  register,
  login,
  refreshToken,
  logout,
  type RegisterRequest,
  type LoginRequest,
  type RefreshTokenRequest,
} from "./auth-service.js";
import {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  type AdminLoginRequest,
  type AdminRefreshTokenRequest,
} from "../admin-auth/admin-auth-service.js";
import {
  getUserRepository,
  getAdminRepository,
  getUserSessionRepository,
  getAdminSessionRepository,
  getVerificationCodeRepository,
} from "../../db/index.js";

describe("认证服务集成测试 - 用户完整流程", () => {
  beforeEach(async () => {
    enableMockDatabase();
    const db = getMockDatabase();

    const userRepo = getUserRepository(db);
    const codeRepo = getVerificationCodeRepository(db);
    const sessionRepo = getUserSessionRepository(db);

    clearMockDatabase();

    await userRepo.deleteAll?.();
    await codeRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("用户完整流程：注册 -> 登录 -> 刷新Token -> 登出", async () => {
    const codeRepo = getVerificationCodeRepository();
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    const phone = "13800138100";
    const password = "StrongP@ssw0rd123";
    const code = "123456";

    // 第1步：创建验证码
    console.log("[集成测试] 步骤1: 创建验证码");
    await codeRepo.create({
      target: phone,
      targetType: "phone",
      code,
      purpose: "register",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // 第2步：用户注册
    console.log("[集成测试] 步骤2: 用户注册");
    const registerReq: RegisterRequest = {
      phone,
      code,
      password,
      displayName: "集成测试用户",
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const registerResult = await register(registerReq);
    expect(registerResult.success).toBe(true);
    expect(registerResult.user).toBeDefined();
    expect(registerResult.accessToken).toBeDefined();
    expect(registerResult.refreshToken).toBeDefined();
    const userId = registerResult.user!.id;
    const refreshToken1 = registerResult.refreshToken!;
    console.log("[集成测试] 注册成功: userId=", userId);

    // 第3步：用户再次登录
    console.log("[集成测试] 步骤3: 用户登录");
    const loginReq: LoginRequest = {
      identifier: phone,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const loginResult = await login(loginReq);
    expect(loginResult.success).toBe(true);
    expect(loginResult.user?.id).toBe(userId);
    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.refreshToken).toBeDefined();
    console.log("[集成测试] 登录成功");

    // 第4步：刷新Token
    console.log("[集成测试] 步骤4: 刷新Token");
    const refreshReq: RefreshTokenRequest = {
      refreshToken: loginResult.refreshToken!,
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const refreshResult = await refreshToken(refreshReq);
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.user?.id).toBe(userId);
    expect(refreshResult.accessToken).toBeDefined();
    expect(refreshResult.refreshToken).toBeDefined();
    console.log("[集成测试] Token刷新成功");

    // 第5步：登出
    console.log("[集成测试] 步骤5: 用户登出");
    const logoutResult = await logout(refreshResult.refreshToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
      userId,
    });
    expect(logoutResult.success).toBe(true);
    console.log("[集成测试] 登出成功");

    // 验证会话已撤销
    const sessions = await sessionRepo.findByUserId(userId);
    expect(sessions.every((s) => s.revoked)).toBe(true);
    console.log("[集成测试] 会话已撤销");
  });

  it("用户完整流程：邮箱验证码注册 -> 登录 -> 刷新Token -> 登出", async () => {
    const codeRepo = getVerificationCodeRepository();
    const userRepo = getUserRepository();

    const email = "integration-test@example.com";
    const password = "StrongP@ssw0rd123";
    const code = "654321";

    // 第1步：创建验证码
    console.log("[集成测试] 邮箱流程: 步骤1 创建验证码");
    await codeRepo.create({
      target: email,
      targetType: "email",
      code,
      purpose: "register",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // 第2步：注册
    console.log("[集成测试] 邮箱流程: 步骤2 用户注册");
    const registerReq: RegisterRequest = {
      email,
      code,
      password,
      displayName: "邮箱测试用户",
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const registerResult = await register(registerReq);
    expect(registerResult.success).toBe(true);
    expect(registerResult.user?.email).toBe(email.toLowerCase());
    const userId = registerResult.user!.id;
    console.log("[集成测试] 邮箱注册成功");

    // 第3步：登录
    console.log("[集成测试] 邮箱流程: 步骤3 用户登录");
    const loginReq: LoginRequest = {
      identifier: email,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const loginResult = await login(loginReq);
    expect(loginResult.success).toBe(true);
    expect(loginResult.user?.id).toBe(userId);
    console.log("[集成测试] 邮箱登录成功");
  });
});

describe("认证服务集成测试 - 管理员完整流程", () => {
  beforeEach(async () => {
    enableMockDatabase();
    const db = getMockDatabase();

    const adminRepo = getAdminRepository(db);
    const sessionRepo = getAdminSessionRepository(db);

    clearMockDatabase();

    await adminRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("管理员完整流程：登录 -> 刷新Token -> 登出", async () => {
    const adminRepo = getAdminRepository();
    const sessionRepo = getAdminSessionRepository();

    const username = "integration-admin";
    const password = "AdminP@ssw0rd123";

    // 第1步：创建管理员
    console.log("[集成测试] 管理员流程: 步骤1 创建管理员账户");
    const admin = await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "集成测试管理员",
      role: "admin",
      status: "active",
    });
    const adminId = admin.id;
    console.log("[集成测试] 管理员创建成功: adminId=", adminId);

    // 第2步：管理员登录
    console.log("[集成测试] 管理员流程: 步骤2 管理员登录");
    const loginReq: AdminLoginRequest = {
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const loginResult = await adminLogin(loginReq);
    expect(loginResult.success).toBe(true);
    expect(loginResult.admin?.id).toBe(adminId);
    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.refreshToken).toBeDefined();
    console.log("[集成测试] 管理员登录成功");

    // 第3步：刷新Token
    console.log("[集成测试] 管理员流程: 步骤3 刷新Token");
    const refreshReq: AdminRefreshTokenRequest = {
      refreshToken: loginResult.refreshToken!,
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    };
    const refreshResult = await adminRefreshToken(refreshReq);
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.admin?.id).toBe(adminId);
    expect(refreshResult.accessToken).toBeDefined();
    expect(refreshResult.refreshToken).toBeDefined();
    console.log("[集成测试] 管理员Token刷新成功");

    // 第4步：登出
    console.log("[集成测试] 管理员流程: 步骤4 管理员登出");
    const logoutResult = await adminLogout(refreshResult.refreshToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
      adminId,
      adminUsername: username,
    });
    expect(logoutResult.success).toBe(true);
    console.log("[集成测试] 管理员登出成功");

    // 验证会话已撤销
    const sessions = await sessionRepo.findByAdminId(adminId);
    expect(sessions.every((s) => s.revoked)).toBe(true);
    console.log("[集成测试] 管理员会话已撤销");
  });
});

describe("认证服务集成测试 - 并发和边界情况", () => {
  beforeEach(async () => {
    enableMockDatabase();
    const db = getMockDatabase();

    const userRepo = getUserRepository(db);
    const codeRepo = getVerificationCodeRepository(db);
    const sessionRepo = getUserSessionRepository(db);

    clearMockDatabase();

    await userRepo.deleteAll?.();
    await codeRepo.deleteAll?.();
    await sessionRepo.deleteAll?.();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("多设备登录和会话管理", async () => {
    const codeRepo = getVerificationCodeRepository();
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    const phone = "13800138200";
    const password = "StrongP@ssw0rd123";
    const code = "111111";

    // 注册用户
    console.log("[集成测试] 多设备流程: 用户注册");
    await codeRepo.create({
      target: phone,
      targetType: "phone",
      code,
      purpose: "register",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const registerResult = await register({
      phone,
      code,
      password,
      displayName: "多设备用户",
      ipAddress: "127.0.0.1",
      userAgent: "Device 1",
    });
    expect(registerResult.success).toBe(true);
    const userId = registerResult.user!.id;

    // 从3个不同的设备登录
    console.log("[集成测试] 多设备流程: 从3个设备登录");
    const devices = [
      { ipAddress: "192.168.1.1", userAgent: "Mobile iOS" },
      { ipAddress: "192.168.1.2", userAgent: "Mobile Android" },
      { ipAddress: "192.168.1.3", userAgent: "Desktop Windows" },
    ];

    const tokens: string[] = [];
    for (const device of devices) {
      const loginResult = await login({
        identifier: phone,
        password,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      });
      expect(loginResult.success).toBe(true);
      tokens.push(loginResult.refreshToken!);
      console.log("[集成测试] 登录成功:", device.userAgent);
    }

    // 验证会话数量
    const sessions = await sessionRepo.findByUserId(userId);
    expect(sessions.length).toBe(3);
    console.log("[集成测试] 验证: 用户有3个活跃会话");

    // 登出第一个设备
    console.log("[集成测试] 多设备流程: 登出Device 1");
    const logoutResult = await logout(tokens[0], {
      ipAddress: devices[0].ipAddress,
      userAgent: devices[0].userAgent,
      userId,
    });
    expect(logoutResult.success).toBe(true);

    // 验证剩余会话
    const remainingSessions = await sessionRepo.findByUserId(userId);
    const activeSessions = remainingSessions.filter((s) => !s.revoked);
    expect(activeSessions.length).toBe(2);
    console.log("[集成测试] 验证: 登出后剩余2个活跃会话");
  });
});
