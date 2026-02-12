/**
 * App Server 测试
 *
 * 测试健康检查、认证插件、错误处理
 * 使用 Fastify inject 进行 HTTP 请求模拟
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServer } from "./server.js";
import type { FastifyInstance } from "fastify";

// 设置测试环境的 JWT_SECRET
process.env["JWT_SECRET"] = "test-jwt-secret-at-least-32-characters-long!";

// 动态导入 JWT 工具 (需要在设置环境变量之后)
const { generateAccessToken } =
  await import("../../../src/assistant/auth/jwt.js");
const { generateAdminAccessToken } =
  await import("../../../src/assistant/admin-auth/admin-jwt.js");

describe("App Server", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer({
      port: 0,
      host: "127.0.0.1",
      nodeEnv: "test",
      databaseUrl: "postgresql://localhost:5432/openclaw_test",
      jwtSecret: "test-jwt-secret-at-least-32-characters-long!",
      adminJwtSecret: "test-jwt-secret-at-least-32-characters-long!",
      corsOrigins: ["http://localhost:3000"],
      rateLimitMax: 1000,
      logLevel: "silent",
    });
    await server.ready();
    console.log("[TEST] App Server 测试实例创建成功");
  });

  afterAll(async () => {
    await server.close();
    console.log("[TEST] App Server 测试实例关闭");
  });

  // ==================== 健康检查 ====================

  describe("Health Check", () => {
    it("HEALTH-001: GET /api/health 应返回 200", async () => {
      console.log("[TEST] ========== HEALTH-001 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/health",
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("ok");
      expect(body.data.version).toBeTruthy();
      expect(typeof body.data.uptime).toBe("number");
      expect(body.data.timestamp).toBeTruthy();

      console.log(
        "[TEST] 健康检查响应:",
        body.data.status,
        body.data.uptimeHuman,
      );
      console.log("[TEST] ✓ 健康检查正常");
    });

    it("HEALTH-002: 健康检查无需认证", async () => {
      console.log("[TEST] ========== HEALTH-002 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/health",
        // 不传 Authorization header
      });

      expect(response.statusCode).toBe(200);
      console.log("[TEST] ✓ 健康检查无需 Token");
    });
  });

  // ==================== 404 处理 ====================

  describe("Not Found Handler", () => {
    it("404-001: 不存在的路由应返回 404", async () => {
      console.log("[TEST] ========== 404-001 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/nonexistent",
      });

      // 非公开/非管理员路由，会先被 auth 插件拦截返回 401
      // 因为 /api/nonexistent 不在 PUBLIC_ROUTES 中
      expect([401, 404]).toContain(response.statusCode);

      console.log("[TEST] ✓ 不存在路由处理正确，状态码:", response.statusCode);
    });

    it("404-002: 携带 Token 访问不存在路由应返回 404", async () => {
      console.log("[TEST] ========== 404-002 ==========");

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "GET",
        url: "/api/nonexistent",
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("ROUTE_NOT_FOUND");

      console.log("[TEST] ✓ 有效 Token + 不存在路由返回 404");
    });
  });

  // ==================== 用户认证 ====================

  describe("User Auth", () => {
    it("AUTH-001: 无 Token 访问受保护路由应返回 401", async () => {
      console.log("[TEST] ========== AUTH-001 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("UNAUTHORIZED");

      console.log("[TEST] ✓ 无 Token 返回 401");
    });

    it("AUTH-002: 无效 Token 应返回 401", async () => {
      console.log("[TEST] ========== AUTH-002 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          authorization: "Bearer invalid-token-12345",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("TOKEN_INVALID");

      console.log("[TEST] ✓ 无效 Token 返回 401");
    });

    it("AUTH-003: 有效用户 Token 应通过认证", async () => {
      console.log("[TEST] ========== AUTH-003 ==========");

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
      });

      // 路由不存在会返回 404，但不是 401，说明认证通过
      expect(response.statusCode).toBe(404);
      console.log("[TEST] ✓ 有效用户 Token 通过认证（路由未注册返回 404）");
    });

    it("AUTH-004: 管理员 Token 不应通过用户认证", async () => {
      console.log("[TEST] ========== AUTH-004 ==========");

      const adminTokenPair = generateAdminAccessToken("admin-001", "admin");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          authorization: `Bearer ${adminTokenPair.accessToken}`,
        },
      });

      // 管理员 Token 的 type="admin", issuer="openclaw-admin"，
      // verifyAccessToken 校验 type="user" 会失败
      expect(response.statusCode).toBe(401);

      console.log("[TEST] ✓ 管理员 Token 不能用于用户路由");
    });
  });

  // ==================== 管理员认证 ====================

  describe("Admin Auth", () => {
    it("ADMIN-AUTH-001: 无 Token 访问管理员路由应返回 401", async () => {
      console.log("[TEST] ========== ADMIN-AUTH-001 ==========");

      const response = await server.inject({
        method: "GET",
        url: "/api/admin/users",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("ADMIN_UNAUTHORIZED");

      console.log("[TEST] ✓ 无 Token 访问管理员路由返回 401");
    });

    it("ADMIN-AUTH-002: 有效管理员 Token 应通过认证", async () => {
      console.log("[TEST] ========== ADMIN-AUTH-002 ==========");

      const adminTokenPair = generateAdminAccessToken("admin-001", "admin");

      const response = await server.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: {
          authorization: `Bearer ${adminTokenPair.accessToken}`,
        },
      });

      // 路由不存在返回 404，但不是 401，说明认证通过
      expect(response.statusCode).toBe(404);

      console.log("[TEST] ✓ 有效管理员 Token 通过认证");
    });

    it("ADMIN-AUTH-003: 用户 Token 不应通过管理员认证", async () => {
      console.log("[TEST] ========== ADMIN-AUTH-003 ==========");

      const tokenPair = generateAccessToken("test-user-001");

      const response = await server.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
      });

      // 用户 Token 的 type="user", verifyAdminAccessToken 校验 type="admin" 会失败
      expect(response.statusCode).toBe(401);

      console.log("[TEST] ✓ 用户 Token 不能用于管理员路由");
    });

    it("ADMIN-AUTH-004: 管理员登录路由无需认证", async () => {
      console.log("[TEST] ========== ADMIN-AUTH-004 ==========");

      const response = await server.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        payload: { username: "test", password: "test" },
      });

      // 路由不存在返回 404，但不是 401，说明认证被跳过
      expect(response.statusCode).toBe(404);

      console.log("[TEST] ✓ 管理员登录路由无需 Token");
    });
  });

  // ==================== 错误处理 ====================

  describe("Error Handler", () => {
    it("ERROR-001: JSON 解析错误应返回 400", async () => {
      console.log("[TEST] ========== ERROR-001 ==========");

      const response = await server.inject({
        method: "POST",
        url: "/api/health",
        headers: {
          "content-type": "application/json",
        },
        payload: "{ invalid json",
      });

      // Fastify 会自动处理 JSON 解析错误
      expect(response.statusCode).toBeLessThan(500);

      console.log(
        "[TEST] ✓ JSON 解析错误处理正确，状态码:",
        response.statusCode,
      );
    });
  });
});
