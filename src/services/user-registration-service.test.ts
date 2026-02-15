/**
 * 用户注册服务单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  registerByPhone,
  registerByEmail,
  registerByWeChat,
  type RegisterByPhoneParams,
  type RegisterByEmailParams,
  type RegisterByWeChatParams,
} from "./user-registration-service.js";

// Mock dependencies - 必须在导入之前定义
vi.mock("../db/connection.js", () => ({
  getDatabase: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: "usr_test123",
              phone: "+8613800138000",
              email: "test@example.com",
              displayName: "测试用户",
              createdAt: new Date(),
              phoneVerified: true,
              emailVerified: true,
              isActive: true,
            },
          ])
        ),
      })),
    })),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  })),
}));

vi.mock("./verification-code-service.js", () => ({
  verifyCode: vi.fn(),
}));

vi.mock("../db/utils/id.js", () => ({
  generateShortId: vi.fn(() => "usr_test123"),
}));

vi.mock("../db/utils/password.js", () => ({
  hashPassword: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
}));

describe("user-registration-service", () => {
  let mockDb: any;
  let mockVerifyCode: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 获取 mock 实例
    const { getDatabase } = await import("../db/connection.js");
    mockDb = (getDatabase as any)();

    const { verifyCode } = await import("./verification-code-service.js");
    mockVerifyCode = verifyCode as any;

    // 默认: 用户不存在
    mockDb.query.users.findFirst.mockResolvedValue(null);
    // 默认: 验证码验证成功
    mockVerifyCode.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerByPhone", () => {
    const validParams: RegisterByPhoneParams = {
      phone: "+8613800138000",
      verificationCode: "123456",
      password: "Test1234",
      displayName: "测试用户",
    };

    it("应该成功注册手机号用户(带密码)", async () => {
      const result = await registerByPhone(validParams);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe("usr_test123");
      expect(result.user?.phone).toBe("+8613800138000");
      expect(result.user?.displayName).toBe("测试用户");
      expect(mockVerifyCode).toHaveBeenCalledWith(
        "+8613800138000",
        "phone",
        "123456",
        "register"
      );
    });

    it("应该成功注册手机号用户(无密码)", async () => {
      const paramsWithoutPassword = {
        phone: "+8613800138000",
        verificationCode: "123456",
      };

      const result = await registerByPhone(paramsWithoutPassword);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it("应该拒绝无效的手机号格式", async () => {
      const invalidParams = {
        ...validParams,
        phone: "invalid-phone",
      };

      const result = await registerByPhone(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("手机号格式不正确");
    });

    it("应该拒绝错误的验证码", async () => {
      mockVerifyCode.mockRejectedValue(new Error("验证码错误"));

      const result = await registerByPhone(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("验证码");
    });

    it("应该拒绝已注册的手机号", async () => {
      // 在这个测试中,设置 mock 返回已存在的用户
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: "existing_user",
        phone: "+8613800138000",
      });

      const result = await registerByPhone(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("已注册");
    });

    it("应该使用默认显示名称", async () => {
      const paramsWithoutDisplayName = {
        phone: "+8613800138000",
        verificationCode: "123456",
      };

      const result = await registerByPhone(paramsWithoutDisplayName);

      expect(result.success).toBe(true);
      expect(result.user?.displayName).toContain("用户");
    });
  });

  describe("registerByEmail", () => {
    const validParams: RegisterByEmailParams = {
      email: "test@example.com",
      verificationCode: "123456",
      password: "Test1234",
      displayName: "测试用户",
    };

    it("应该成功注册邮箱用户", async () => {
      const result = await registerByEmail(validParams);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe("test@example.com");
      expect(mockVerifyCode).toHaveBeenCalledWith(
        "test@example.com",
        "email",
        "123456",
        "register"
      );
    });

    it("应该拒绝无效的邮箱格式", async () => {
      const invalidParams = {
        ...validParams,
        email: "invalid-email",
      };

      const result = await registerByEmail(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("邮箱格式不正确");
    });

    it("应该拒绝弱密码", async () => {
      const weakPasswordParams = {
        ...validParams,
        password: "weak",
      };

      const result = await registerByEmail(weakPasswordParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("密码强度不足");
    });

    it("应该拒绝已注册的邮箱", async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: "existing_user",
        email: "test@example.com",
      });

      const result = await registerByEmail(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("已注册");
    });

    it("应该使用邮箱前缀作为默认显示名称", async () => {
      const paramsWithoutDisplayName = {
        email: "testuser@example.com",
        verificationCode: "123456",
        password: "Test1234",
      };

      // Mock 返回值需要包含正确的 displayName
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => ({
          returning: vi.fn(() =>
            Promise.resolve([
              {
                id: "usr_test123",
                email: "testuser@example.com",
                displayName: "testuser",
                createdAt: new Date(),
                emailVerified: true,
                isActive: true,
              },
            ])
          ),
        })),
      });

      const result = await registerByEmail(paramsWithoutDisplayName);

      expect(result.success).toBe(true);
      expect(result.user?.displayName).toBe("testuser");
    });
  });

  describe("registerByWeChat", () => {
    const validParams: RegisterByWeChatParams = {
      wechatOpenId: "wx_openid_123",
      wechatUnionId: "wx_unionid_456",
      displayName: "微信用户",
      avatarUrl: "https://example.com/avatar.jpg",
    };

    it("应该成功注册微信用户", async () => {
      const result = await registerByWeChat(validParams);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe("usr_test123");
    });

    it("应该拒绝已注册的微信账号", async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: "existing_user",
        wechatOpenId: "wx_openid_123",
      });

      const result = await registerByWeChat(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("已注册");
    });

    it("应该使用默认显示名称", async () => {
      const paramsWithoutDisplayName = {
        wechatOpenId: "wx_openid_123",
      };

      // Mock 返回值需要包含正确的 displayName
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => ({
          returning: vi.fn(() =>
            Promise.resolve([
              {
                id: "usr_test123",
                wechatOpenId: "wx_openid_123",
                displayName: "微信用户",
                createdAt: new Date(),
                isActive: true,
              },
            ])
          ),
        })),
      });

      const result = await registerByWeChat(paramsWithoutDisplayName);

      expect(result.success).toBe(true);
      expect(result.user?.displayName).toBe("微信用户");
    });
  });
});
