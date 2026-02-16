/**
 * 用户信息 CRUD 测试
 *
 * 测试 GET/PUT /api/users/me 端点
 * 使用依赖注入的 mock UserRepository 隔离数据库依赖
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import type { User } from "../../../../../src/db/schema/index.js";
import type { UserRepository } from "../../../../../src/db/repositories/users.js";
import { registerUsersRoutes } from "./index.js";
import { registerAuthPlugin } from "../../plugins/auth.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";

// 设置测试环境的 JWT_SECRET
process.env["JWT_SECRET"] = "test-jwt-secret-at-least-32-characters-long!";

// 动态导入 JWT 工具 (需要在设置环境变量之后)
const { generateAccessToken } = await import(
  "../../../../../src/assistant/auth/jwt.js"
);

/**
 * 创建测试用的完整用户对象
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-001",
    phone: "13800138000",
    email: "test@example.com",
    wechatOpenId: null,
    wechatUnionId: null,
    passwordHash: "$scrypt$secret-hash",
    displayName: "测试用户",
    avatarUrl: "https://example.com/avatar.png",
    mfaSecret: "mfa-secret-key",
    mfaBackupCodes: ["code1", "code2"],
    mfaEnabled: false,
    isActive: true,
    emailVerified: true,
    phoneVerified: true,
    lastLoginAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    preferences: { language: "zh-CN", theme: "light" },
    metadata: null,
    ...overrides,
  };
}

describe("User CRUD /api/users/me", () => {
  let server: FastifyInstance;
  let mockFindById: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // 创建 mock repository
    mockFindById = vi.fn();
    mockUpdate = vi.fn();

    const mockUserRepo: Partial<UserRepository> = {
      findById: mockFindById,
      update: mockUpdate,
    };

    // 创建测试用 Fastify 实例
    server = Fastify({ logger: false });

    // 注册错误处理
    registerErrorHandler(server);

    // 注册认证插件
    registerAuthPlugin(server, {} as never);

    // 注册用户路由（注入 mock repository）
    registerUsersRoutes(server, {
      userRepository: mockUserRepo as UserRepository,
    });

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== GET /api/users/me ====================

  describe("GET /api/users/me", () => {
    it("USER-GET-001: 无 token 返回 401", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("USER-GET-002: 有效 token 返回完整用户信息", async () => {
      const mockUser = createMockUser();
      mockFindById.mockResolvedValue(mockUser);

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("test-user-001");
      expect(body.data.displayName).toBe("测试用户");
      expect(body.data.email).toBe("test@example.com");
    });

    it("USER-GET-003: 用户不存在返回 404", async () => {
      mockFindById.mockResolvedValue(null);

      const tokenPair = generateAccessToken("non-existent-user");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("USER_NOT_FOUND");
    });

    it("USER-GET-004: 响应不包含敏感字段", async () => {
      const mockUser = createMockUser();
      mockFindById.mockResolvedValue(mockUser);

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // 敏感字段不应出现在响应中
      expect(body.data.passwordHash).toBeUndefined();
      expect(body.data.mfaSecret).toBeUndefined();
      expect(body.data.mfaBackupCodes).toBeUndefined();
    });
  });

  // ==================== PUT /api/users/me ====================

  describe("PUT /api/users/me", () => {
    it("USER-PUT-001: 无 token 返回 401", async () => {
      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        payload: { displayName: "新名字" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("USER-PUT-002: 更新 displayName 成功", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, displayName: "新名字" };
      mockFindById.mockResolvedValue(mockUser);
      mockUpdate.mockResolvedValue(updatedUser);

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: { displayName: "新名字" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe("新名字");
    });

    it("USER-PUT-003: 更新 avatar 成功", async () => {
      const mockUser = createMockUser();
      const newAvatar = "https://example.com/new-avatar.png";
      const updatedUser = { ...mockUser, avatarUrl: newAvatar };
      mockFindById.mockResolvedValue(mockUser);
      mockUpdate.mockResolvedValue(updatedUser);

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: { avatar: newAvatar },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.avatarUrl).toBe(newAvatar);
    });

    it("USER-PUT-004: displayName 过长返回 400", async () => {
      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: { displayName: "a".repeat(101) }, // 超过 100 字符
      });

      expect(response.statusCode).toBe(400);
    });

    it("USER-PUT-005: 空 body 返回 400", async () => {
      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("USER-PUT-006: 用户不存在返回 404", async () => {
      mockFindById.mockResolvedValue(null);

      const tokenPair = generateAccessToken("non-existent-user");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: { displayName: "新名字" },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("USER_NOT_FOUND");
    });

    it("USER-PUT-007: 响应不包含敏感字段", async () => {
      const mockUser = createMockUser();
      mockFindById.mockResolvedValue(mockUser);
      mockUpdate.mockResolvedValue(mockUser);

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "PUT",
        url: "/api/users/me",
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        payload: { displayName: "新名字" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.passwordHash).toBeUndefined();
      expect(body.data.mfaSecret).toBeUndefined();
      expect(body.data.mfaBackupCodes).toBeUndefined();
    });
  });
});
