/**
 * 认证服务测试
 *
 * 测试用户注册、登录、Token 刷新、登出等认证流程
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  type RegisterRequest,
  type LoginRequest,
  type RefreshTokenRequest,
} from "./auth-service.js";
import {
  getUserRepository,
  getUserSessionRepository,
  getLoginAttemptRepository,
  getVerificationCodeRepository,
} from "../../db/index.js";

// 设置测试用 JWT_SECRET（auth-service 内部调用 generateAccessToken 需要）
let originalJwtSecret: string | undefined;

beforeAll(() => {
  originalJwtSecret = process.env["JWT_SECRET"];
  process.env["JWT_SECRET"] = "test-secret-key-for-auth-service-testing-minimum-32-chars";
});

afterAll(() => {
  if (originalJwtSecret !== undefined) {
    process.env["JWT_SECRET"] = originalJwtSecret;
  } else {
    delete process.env["JWT_SECRET"];
  }
});

describe("AuthService - 用户注册", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功注册新用户（手机号 + 验证码）", async () => {
    const codeRepo = getVerificationCodeRepository();
    const phone = "13800138000";

    // 创建验证码（使用仓库 API，获取自动生成的 code）
    const { code } = await codeRepo.create(phone, "phone", "register");

    const request: RegisterRequest = {
      phone,
      code,
      displayName: "测试用户",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.phone).toBe(phone);
    expect(result.user?.displayName).toBe("测试用户");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("应该成功注册新用户（邮箱 + 验证码 + 密码）", async () => {
    const codeRepo = getVerificationCodeRepository();
    const email = "test@example.com";
    const password = "StrongP@ssw0rd123";

    // 创建验证码
    const { code } = await codeRepo.create(email, "email", "register");

    const request: RegisterRequest = {
      email,
      code,
      password,
      displayName: "邮箱用户",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(email.toLowerCase());
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("应该拒绝重复注册", async () => {
    const codeRepo = getVerificationCodeRepository();
    const userRepo = getUserRepository();
    const phone = "13800138001";

    // 先创建一个用户
    await userRepo.create({
      phone,
      displayName: "已存在用户",
    });

    // 创建验证码
    const { code } = await codeRepo.create(phone, "phone", "register");

    const request: RegisterRequest = {
      phone,
      code,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("USER_EXISTS");
    expect(result.error).toContain("已注册");
  });

  it("应该拒绝无效的验证码", async () => {
    const phone = "13800138002";
    const code = "999999"; // 不存在的验证码

    const request: RegisterRequest = {
      phone,
      code,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CODE");
    expect(result.error).toContain("验证码");
  });

  it("应该拒绝弱密码", async () => {
    const codeRepo = getVerificationCodeRepository();
    const email = "weak@example.com";
    const weakPassword = "123"; // 弱密码

    // 创建验证码
    const { code } = await codeRepo.create(email, "email", "register");

    const request: RegisterRequest = {
      email,
      code,
      password: weakPassword,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("WEAK_PASSWORD");
  });

  it("应该拒绝缺少标识符的注册", async () => {
    const request: RegisterRequest = {
      code: "123456",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await register(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("MISSING_IDENTIFIER");
  });
});

describe("AuthService - 用户登录", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功使用密码登录", async () => {
    const userRepo = getUserRepository();
    const phone = "13800138010";
    const password = "StrongP@ssw0rd123";

    // 创建用户（passwordHash 字段在 mock 中直接存储）
    const user = await userRepo.create({
      phone,
      passwordHash: password,
      displayName: "密码用户",
    });

    const request: LoginRequest = {
      identifier: phone,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.id).toBe(user.id);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("应该成功使用验证码登录", async () => {
    const userRepo = getUserRepository();
    const codeRepo = getVerificationCodeRepository();
    const email = "login@example.com";

    // 创建用户
    const user = await userRepo.create({
      email,
      displayName: "验证码用户",
    });

    // 创建验证码（使用仓库 API）
    const { code } = await codeRepo.create(email, "email", "login");

    const request: LoginRequest = {
      identifier: email,
      code,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.user?.id).toBe(user.id);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("应该拒绝不存在的用户登录", async () => {
    const request: LoginRequest = {
      identifier: "nonexistent@example.com",
      password: "AnyPassword123",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("应该拒绝错误的密码", async () => {
    const userRepo = getUserRepository();
    const phone = "13800138011";
    const correctPassword = "CorrectP@ssw0rd123";
    const wrongPassword = "WrongP@ssw0rd123";

    // 创建用户
    await userRepo.create({
      phone,
      passwordHash: correctPassword,
      displayName: "测试用户",
    });

    const request: LoginRequest = {
      identifier: phone,
      password: wrongPassword,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("应该拒绝已停用的账户登录", async () => {
    const userRepo = getUserRepository();
    const phone = "13800138012";
    const password = "StrongP@ssw0rd123";

    // 创建已停用的用户
    await userRepo.create({
      phone,
      passwordHash: password,
      displayName: "停用用户",
      isActive: false,
    });

    const request: LoginRequest = {
      identifier: phone,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_DISABLED");
  });

  it("应该在多次失败后锁定账户", async () => {
    const userRepo = getUserRepository();
    const attemptRepo = getLoginAttemptRepository();
    const phone = "13800138013";
    const password = "StrongP@ssw0rd123";

    // 创建用户
    await userRepo.create({
      phone,
      passwordHash: password,
      displayName: "测试用户",
    });

    // 模拟 5 次失败登录
    for (let i = 0; i < 5; i++) {
      await attemptRepo.record({
        identifier: phone,
        identifierType: "phone",
        ipAddress: "127.0.0.1",
        success: false,
        failureReason: "invalid_credentials",
        userAgent: "Test Agent",
      });
    }

    // 尝试第 6 次登录
    const request: LoginRequest = {
      identifier: phone,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_LOCKED");
    expect(result.error).toContain("锁定");
  });

  it("应该拒绝缺少凭据的登录", async () => {
    const request: LoginRequest = {
      identifier: "test@example.com",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("MISSING_CREDENTIALS");
  });

  it("应该拒绝未设置密码的账户使用密码登录", async () => {
    const userRepo = getUserRepository();
    const phone = "13800138014";

    // 创建没有密码的用户
    await userRepo.create({
      phone,
      displayName: "无密码用户",
    });

    const request: LoginRequest = {
      identifier: phone,
      password: "AnyPassword123",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await login(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PASSWORD_NOT_SET");
  });
});

describe("AuthService - Token 刷新", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功刷新 Token", async () => {
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    // 创建用户
    const user = await userRepo.create({
      phone: "13800138020",
      displayName: "刷新用户",
    });

    // 创建会话
    const { refreshToken: oldRefreshToken } = await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    const request: RefreshTokenRequest = {
      refreshToken: oldRefreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await refreshToken(request);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.user?.id).toBe(user.id);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("应该拒绝无效的 Refresh Token", async () => {
    const request: RefreshTokenRequest = {
      refreshToken: "invalid-token",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await refreshToken(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_REFRESH_TOKEN");
  });

  it("应该拒绝已停用用户的 Token 刷新", async () => {
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    // 创建用户
    const user = await userRepo.create({
      phone: "13800138021",
      displayName: "测试用户",
      isActive: true,
    });

    // 创建会话
    const { refreshToken: token } = await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 停用用户
    await userRepo.update(user.id, { isActive: false });

    const request: RefreshTokenRequest = {
      refreshToken: token,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    };

    const result = await refreshToken(request);

    // 验证结果
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("USER_INACTIVE");
  });
});

describe("AuthService - 登出", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功登出", async () => {
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    // 创建用户和会话
    const user = await userRepo.create({
      phone: "13800138030",
      displayName: "登出用户",
    });

    const { session, refreshToken: token } = await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 登出
    const result = await logout(token, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
      userId: user.id,
    });

    // 验证结果
    expect(result.success).toBe(true);

    // 验证会话已被撤销
    const revokedSession = await sessionRepo.findById(session.id);
    expect(revokedSession?.revoked).toBe(true);
  });

  it("应该在无效 Token 时也返回成功", async () => {
    const result = await logout("invalid-token", {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    // 验证结果（登出失败也返回成功）
    expect(result.success).toBe(true);
  });
});

describe("AuthService - 登出所有设备", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("应该成功登出所有设备", async () => {
    const userRepo = getUserRepository();
    const sessionRepo = getUserSessionRepository();

    // 创建用户
    const user = await userRepo.create({
      phone: "13800138040",
      displayName: "多设备用户",
    });

    // 创建多个会话
    await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Device 1",
    });
    await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.2",
      userAgent: "Device 2",
    });
    await sessionRepo.create(user.id, {
      ipAddress: "127.0.0.3",
      userAgent: "Device 3",
    });

    // 登出所有设备
    const result = await logoutAll(user.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Admin",
    });

    // 验证结果
    expect(result.success).toBe(true);

    // 验证所有会话都已被撤销
    const sessions = await sessionRepo.findByUserId(user.id);
    expect(sessions.every((s) => s.revoked)).toBe(true);
  });

  it("应该处理不存在的用户 ID", async () => {
    const result = await logoutAll("non-existent-user-id", {
      ipAddress: "127.0.0.1",
      userAgent: "Admin",
    });

    // 验证结果（不会抛出错误）
    expect(result.success).toBe(true);
  });
});
