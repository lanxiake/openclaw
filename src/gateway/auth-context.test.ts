/**
 * auth-context 工具函数测试
 *
 * 测试从 RPC 请求参数中提取认证上下文的功能
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { extractUserContext, extractAdminContext } from "./auth-context.js";

// Mock JWT 验证函数
vi.mock("../assistant/auth/jwt.js", () => ({
  verifyAccessToken: vi.fn(),
  extractBearerToken: vi.fn(),
}));

vi.mock("../assistant/admin-auth/admin-jwt.js", () => ({
  verifyAdminAccessToken: vi.fn(),
  extractAdminBearerToken: vi.fn(),
}));

// 导入 mock 后的函数，方便设置返回值
import { verifyAccessToken, extractBearerToken } from "../assistant/auth/jwt.js";
import {
  verifyAdminAccessToken,
  extractAdminBearerToken,
} from "../assistant/admin-auth/admin-jwt.js";

describe("auth-context", () => {
  beforeEach(() => {
    console.log("[TEST] ========== auth-context 测试开始 ==========");
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log("[TEST] ========== auth-context 测试结束 ==========\n");
  });

  describe("extractUserContext", () => {
    it("AUTH-CTX-001: 通过 Bearer Token 提取用户上下文", () => {
      console.log("[TEST] ========== AUTH-CTX-001 ==========");
      console.log("[TEST] 测试通过 Bearer Token 提取用户上下文");

      const params = { authorization: "Bearer valid-user-token" };
      console.log("[TEST] params:", JSON.stringify(params));

      // 配置 mock
      vi.mocked(extractBearerToken).mockReturnValue("valid-user-token");
      vi.mocked(verifyAccessToken).mockReturnValue({
        sub: "user-123",
        type: "user",
        aud: "openclaw-api",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: "openclaw-gateway",
      });

      const ctx = extractUserContext(params);

      console.log("[TEST] 提取的上下文:", JSON.stringify(ctx));

      expect(ctx).not.toBeNull();
      expect(ctx!.userId).toBe("user-123");
      expect(ctx!.type).toBe("user");

      console.log("[TEST] ✓ 成功通过 Bearer Token 提取用户上下文");
    });

    it("AUTH-CTX-002: authorization 参数缺失时返回 null", () => {
      console.log("[TEST] ========== AUTH-CTX-002 ==========");
      console.log("[TEST] 测试 authorization 缺失");

      const params = {};
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractBearerToken).mockReturnValue(null);

      const ctx = extractUserContext(params);

      console.log("[TEST] 返回:", ctx);

      expect(ctx).toBeNull();

      console.log("[TEST] ✓ authorization 缺失时正确返回 null");
    });

    it("AUTH-CTX-003: Token 验证失败时返回 null", () => {
      console.log("[TEST] ========== AUTH-CTX-003 ==========");
      console.log("[TEST] 测试无效 Token");

      const params = { authorization: "Bearer invalid-token" };
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractBearerToken).mockReturnValue("invalid-token");
      vi.mocked(verifyAccessToken).mockReturnValue(null);

      const ctx = extractUserContext(params);

      console.log("[TEST] 返回:", ctx);

      expect(ctx).toBeNull();

      console.log("[TEST] ✓ Token 无效时正确返回 null");
    });

    it("AUTH-CTX-004: 通过 userId 参数直接提取用户上下文", () => {
      console.log("[TEST] ========== AUTH-CTX-004 ==========");
      console.log("[TEST] 测试通过 userId 参数提取上下文（向后兼容）");

      const params = { userId: "user-fallback-456" };
      console.log("[TEST] params:", JSON.stringify(params));

      // authorization 不存在，不调用 token 相关函数
      vi.mocked(extractBearerToken).mockReturnValue(null);

      const ctx = extractUserContext(params);

      console.log("[TEST] 提取的上下文:", JSON.stringify(ctx));

      expect(ctx).not.toBeNull();
      expect(ctx!.userId).toBe("user-fallback-456");
      expect(ctx!.type).toBe("user");

      console.log("[TEST] ✓ 成功通过 userId 参数提取用户上下文");
    });

    it("AUTH-CTX-005: Bearer Token 优先于 userId 参数", () => {
      console.log("[TEST] ========== AUTH-CTX-005 ==========");
      console.log("[TEST] 测试 Token 优先级高于 userId 参数");

      const params = {
        authorization: "Bearer valid-token",
        userId: "user-param-789",
      };
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractBearerToken).mockReturnValue("valid-token");
      vi.mocked(verifyAccessToken).mockReturnValue({
        sub: "user-from-token-999",
        type: "user",
        aud: "openclaw-api",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: "openclaw-gateway",
      });

      const ctx = extractUserContext(params);

      console.log("[TEST] 提取的上下文:", JSON.stringify(ctx));

      // Token 中的 userId 应该优先
      expect(ctx!.userId).toBe("user-from-token-999");

      console.log("[TEST] ✓ Bearer Token 优先于 userId 参数");
    });

    it("AUTH-CTX-006: authorization 和 userId 都缺失时返回 null", () => {
      console.log("[TEST] ========== AUTH-CTX-006 ==========");
      console.log("[TEST] 测试两者都缺失");

      const params = { someOtherParam: "value" };
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractBearerToken).mockReturnValue(null);

      const ctx = extractUserContext(params);

      console.log("[TEST] 返回:", ctx);

      expect(ctx).toBeNull();

      console.log("[TEST] ✓ 两者缺失时正确返回 null");
    });
  });

  describe("extractAdminContext", () => {
    it("AUTH-CTX-007: 通过 Bearer Token 提取管理员上下文", () => {
      console.log("[TEST] ========== AUTH-CTX-007 ==========");
      console.log("[TEST] 测试通过 Bearer Token 提取管理员上下文");

      const params = { authorization: "Bearer valid-admin-token" };
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractAdminBearerToken).mockReturnValue("valid-admin-token");
      vi.mocked(verifyAdminAccessToken).mockReturnValue({
        sub: "admin-001",
        type: "admin",
        role: "super_admin",
        aud: "openclaw-admin-api",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 1800,
        iss: "openclaw-admin",
      });

      const ctx = extractAdminContext(params);

      console.log("[TEST] 提取的上下文:", JSON.stringify(ctx));

      expect(ctx).not.toBeNull();
      expect(ctx!.adminId).toBe("admin-001");
      expect(ctx!.role).toBe("super_admin");
      expect(ctx!.type).toBe("admin");

      console.log("[TEST] ✓ 成功通过 Bearer Token 提取管理员上下文");
    });

    it("AUTH-CTX-008: authorization 缺失时返回 null", () => {
      console.log("[TEST] ========== AUTH-CTX-008 ==========");
      console.log("[TEST] 测试管理员 authorization 缺失");

      const params = {};
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractAdminBearerToken).mockReturnValue(null);

      const ctx = extractAdminContext(params);

      console.log("[TEST] 返回:", ctx);

      expect(ctx).toBeNull();

      console.log("[TEST] ✓ 缺失时正确返回 null");
    });

    it("AUTH-CTX-009: 管理员 Token 验证失败时返回 null", () => {
      console.log("[TEST] ========== AUTH-CTX-009 ==========");
      console.log("[TEST] 测试管理员 Token 无效");

      const params = { authorization: "Bearer expired-admin-token" };
      console.log("[TEST] params:", JSON.stringify(params));

      vi.mocked(extractAdminBearerToken).mockReturnValue("expired-admin-token");
      vi.mocked(verifyAdminAccessToken).mockReturnValue(null);

      const ctx = extractAdminContext(params);

      console.log("[TEST] 返回:", ctx);

      expect(ctx).toBeNull();

      console.log("[TEST] ✓ Token 无效时正确返回 null");
    });

    it("AUTH-CTX-010: 管理员上下文包含角色信息", () => {
      console.log("[TEST] ========== AUTH-CTX-010 ==========");
      console.log("[TEST] 测试管理员角色信息保留");

      const testCases = [
        { role: "operator", desc: "运营人员" },
        { role: "admin", desc: "管理员" },
        { role: "super_admin", desc: "超级管理员" },
      ];

      for (const tc of testCases) {
        console.log(`[TEST] 测试角色: ${tc.role} (${tc.desc})`);

        vi.mocked(extractAdminBearerToken).mockReturnValue("token");
        vi.mocked(verifyAdminAccessToken).mockReturnValue({
          sub: "admin-role-test",
          type: "admin",
          role: tc.role,
          aud: "openclaw-admin-api",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 1800,
          iss: "openclaw-admin",
        });

        const ctx = extractAdminContext({ authorization: "Bearer token" });

        expect(ctx!.role).toBe(tc.role);
        console.log(`[TEST] ✓ 角色 ${tc.role} 正确保留`);
      }

      console.log("[TEST] ✓ 所有角色信息正确保留");
    });
  });
});
