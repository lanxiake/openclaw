/**
 * JWT 工具测试
 *
 * 测试 JWT token 的生成、验证、解码和提取功能
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decodeToken,
  extractBearerToken,
  generateAccessToken,
  getJwtSecret,
  isTokenExpiringSoon,
  TOKEN_CONFIG,
  verifyAccessToken,
} from "./jwt.js";

describe("JWT utils", () => {
  // 保存原始环境变量
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    console.log("[TEST] ========== JWT测试开始 ==========");
    originalJwtSecret = process.env["JWT_SECRET"];
    // 设置测试用的 JWT_SECRET
    process.env["JWT_SECRET"] = "test-secret-key-for-jwt-testing-minimum-32-chars";
  });

  afterEach(() => {
    console.log("[TEST] ========== JWT测试结束 ==========\n");
    // 恢复原始环境变量
    if (originalJwtSecret) {
      process.env["JWT_SECRET"] = originalJwtSecret;
    } else {
      delete process.env["JWT_SECRET"];
    }
  });

  describe("getJwtSecret", () => {
    it("JWT-SECRET-001: 应该返回环境变量中的JWT密钥", () => {
      console.log("[TEST] ========== JWT-SECRET-001 ==========");
      console.log("[TEST] 测试获取JWT密钥");

      const secret = getJwtSecret();

      console.log("[TEST] 获取到的密钥长度:", secret.length);
      expect(secret).toBe("test-secret-key-for-jwt-testing-minimum-32-chars");
      expect(secret.length).toBeGreaterThanOrEqual(32);
      console.log("[TEST] ✓ JWT密钥获取成功");
    });

    it("JWT-SECRET-002: 当JWT_SECRET未设置时应该抛出错误", () => {
      console.log("[TEST] ========== JWT-SECRET-002 ==========");
      console.log("[TEST] 测试未设置JWT_SECRET的情况");

      delete process.env["JWT_SECRET"];

      console.log("[TEST] 尝试获取JWT密钥...");
      expect(() => getJwtSecret()).toThrow("JWT_SECRET environment variable is not set");
      console.log("[TEST] ✓ 正确抛出错误");
    });
  });

  describe("generateAccessToken", () => {
    it("JWT-GEN-001: 应该生成有效的访问令牌", () => {
      console.log("[TEST] ========== JWT-GEN-001 ==========");
      console.log("[TEST] 测试生成访问令牌");

      const userId = "user-123";
      console.log("[TEST] 用户ID:", userId);

      const result = generateAccessToken(userId);

      console.log("[TEST] 生成的token长度:", result.accessToken.length);
      console.log("[TEST] 过期时间(秒):", result.expiresIn);

      expect(result.accessToken).toBeTruthy();
      expect(result.accessToken.split(".")).toHaveLength(3); // JWT 格式: header.payload.signature
      expect(result.expiresIn).toBe(900); // 15分钟 = 900秒
      console.log("[TEST] ✓ 访问令牌生成成功");
    });

    it("JWT-GEN-002: 应该支持自定义过期时间", () => {
      console.log("[TEST] ========== JWT-GEN-002 ==========");
      console.log("[TEST] 测试自定义过期时间");

      const userId = "user-456";
      const customExpiry = "1h";
      console.log("[TEST] 用户ID:", userId);
      console.log("[TEST] 自定义过期时间:", customExpiry);

      const result = generateAccessToken(userId, { expiresIn: customExpiry });

      console.log("[TEST] 过期时间(秒):", result.expiresIn);
      expect(result.expiresIn).toBe(3600); // 1小时 = 3600秒
      console.log("[TEST] ✓ 自定义过期时间设置成功");
    });

    it("JWT-GEN-003: 生成的token应该包含正确的payload", () => {
      console.log("[TEST] ========== JWT-GEN-003 ==========");
      console.log("[TEST] 测试token payload内容");

      const userId = "user-789";
      console.log("[TEST] 用户ID:", userId);

      const result = generateAccessToken(userId);
      const decoded = decodeToken(result.accessToken);

      console.log("[TEST] 解码后的payload:", JSON.stringify(decoded, null, 2));

      expect(decoded).toBeTruthy();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.type).toBe("user");
      expect(decoded?.iss).toBe(TOKEN_CONFIG.issuer);
      expect(decoded?.aud).toBe(TOKEN_CONFIG.audience);
      console.log("[TEST] ✓ Token payload验证成功");
    });
  });

  describe("verifyAccessToken", () => {
    it("JWT-VERIFY-001: 应该验证有效的访问令牌", () => {
      console.log("[TEST] ========== JWT-VERIFY-001 ==========");
      console.log("[TEST] 测试验证有效token");

      const userId = "user-valid";
      console.log("[TEST] 用户ID:", userId);

      const { accessToken } = generateAccessToken(userId);
      console.log("[TEST] 生成token:", accessToken.substring(0, 50) + "...");

      const payload = verifyAccessToken(accessToken);

      console.log("[TEST] 验证结果:", payload ? "成功" : "失败");
      expect(payload).toBeTruthy();
      expect(payload?.sub).toBe(userId);
      expect(payload?.type).toBe("user");
      console.log("[TEST] ✓ Token验证成功");
    });

    it("JWT-VERIFY-002: 应该拒绝无效的token", () => {
      console.log("[TEST] ========== JWT-VERIFY-002 ==========");
      console.log("[TEST] 测试验证无效token");

      const invalidToken = "invalid.token.string";
      console.log("[TEST] 无效token:", invalidToken);

      const payload = verifyAccessToken(invalidToken);

      console.log("[TEST] 验证结果:", payload ? "成功" : "失败");
      expect(payload).toBeNull();
      console.log("[TEST] ✓ 正确拒绝无效token");
    });

    it("JWT-VERIFY-003: 应该拒绝过期的token", async () => {
      console.log("[TEST] ========== JWT-VERIFY-003 ==========");
      console.log("[TEST] 测试验证过期token");

      const userId = "user-expired";
      console.log("[TEST] 用户ID:", userId);

      // 生成一个1秒后过期的token
      const { accessToken } = generateAccessToken(userId, { expiresIn: "1s" });
      console.log("[TEST] 生成1秒过期的token");

      // 等待token过期
      console.log("[TEST] 等待2秒让token过期...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const payload = verifyAccessToken(accessToken);

      console.log("[TEST] 验证结果:", payload ? "成功" : "失败");
      expect(payload).toBeNull();
      console.log("[TEST] ✓ 正确拒绝过期token");
    });

    it("JWT-VERIFY-004: 应该拒绝错误签名的token", () => {
      console.log("[TEST] ========== JWT-VERIFY-004 ==========");
      console.log("[TEST] 测试验证错误签名的token");

      const userId = "user-wrong-sig";
      console.log("[TEST] 用户ID:", userId);

      // 使用不同的密钥生成token
      const originalSecret = process.env["JWT_SECRET"];
      process.env["JWT_SECRET"] = "different-secret-key-for-testing-purposes";
      const { accessToken } = generateAccessToken(userId);
      console.log("[TEST] 使用不同密钥生成token");

      // 恢复原密钥后验证
      process.env["JWT_SECRET"] = originalSecret;
      console.log("[TEST] 恢复原密钥后验证");

      const payload = verifyAccessToken(accessToken);

      console.log("[TEST] 验证结果:", payload ? "成功" : "失败");
      expect(payload).toBeNull();
      console.log("[TEST] ✓ 正确拒绝错误签名的token");
    });
  });

  describe("decodeToken", () => {
    it("JWT-DECODE-001: 应该解码有效的token", () => {
      console.log("[TEST] ========== JWT-DECODE-001 ==========");
      console.log("[TEST] 测试解码token");

      const userId = "user-decode";
      console.log("[TEST] 用户ID:", userId);

      const { accessToken } = generateAccessToken(userId);
      const decoded = decodeToken(accessToken);

      console.log("[TEST] 解码结果:", JSON.stringify(decoded, null, 2));
      expect(decoded).toBeTruthy();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.type).toBe("user");
      console.log("[TEST] ✓ Token解码成功");
    });

    it("JWT-DECODE-002: 应该返回null对于无效token", () => {
      console.log("[TEST] ========== JWT-DECODE-002 ==========");
      console.log("[TEST] 测试解码无效token");

      const invalidToken = "not-a-valid-jwt";
      console.log("[TEST] 无效token:", invalidToken);

      const decoded = decodeToken(invalidToken);

      console.log("[TEST] 解码结果:", decoded);
      expect(decoded).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("isTokenExpiringSoon", () => {
    it("JWT-EXPIRING-001: 应该检测即将过期的token", () => {
      console.log("[TEST] ========== JWT-EXPIRING-001 ==========");
      console.log("[TEST] 测试检测即将过期的token");

      const userId = "user-expiring";
      console.log("[TEST] 用户ID:", userId);

      // 生成一个1分钟后过期的token
      const { accessToken } = generateAccessToken(userId, { expiresIn: "1m" });
      console.log("[TEST] 生成1分钟过期的token");

      // 检查是否即将过期 (阈值5分钟)
      const expiringSoon = isTokenExpiringSoon(accessToken, 5 * 60);

      console.log("[TEST] 是否即将过期:", expiringSoon);
      expect(expiringSoon).toBe(true);
      console.log("[TEST] ✓ 正确检测到即将过期");
    });

    it("JWT-EXPIRING-002: 应该识别未即将过期的token", () => {
      console.log("[TEST] ========== JWT-EXPIRING-002 ==========");
      console.log("[TEST] 测试识别未即将过期的token");

      const userId = "user-not-expiring";
      console.log("[TEST] 用户ID:", userId);

      // 生成一个1小时后过期的token
      const { accessToken } = generateAccessToken(userId, { expiresIn: "1h" });
      console.log("[TEST] 生成1小时过期的token");

      // 检查是否即将过期 (阈值5分钟)
      const expiringSoon = isTokenExpiringSoon(accessToken, 5 * 60);

      console.log("[TEST] 是否即将过期:", expiringSoon);
      expect(expiringSoon).toBe(false);
      console.log("[TEST] ✓ 正确识别未即将过期");
    });

    it("JWT-EXPIRING-003: 对于无效token应该返回true", () => {
      console.log("[TEST] ========== JWT-EXPIRING-003 ==========");
      console.log("[TEST] 测试无效token的过期检测");

      const invalidToken = "invalid-token";
      console.log("[TEST] 无效token:", invalidToken);

      const expiringSoon = isTokenExpiringSoon(invalidToken);

      console.log("[TEST] 是否即将过期:", expiringSoon);
      expect(expiringSoon).toBe(true);
      console.log("[TEST] ✓ 无效token返回true");
    });
  });

  describe("extractBearerToken", () => {
    it("JWT-EXTRACT-001: 应该从Authorization header提取token", () => {
      console.log("[TEST] ========== JWT-EXTRACT-001 ==========");
      console.log("[TEST] 测试提取Bearer token");

      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token";
      const authHeader = `Bearer ${token}`;
      console.log("[TEST] Authorization header:", authHeader);

      const extracted = extractBearerToken(authHeader);

      console.log("[TEST] 提取的token:", extracted);
      expect(extracted).toBe(token);
      console.log("[TEST] ✓ Token提取成功");
    });

    it("JWT-EXTRACT-002: 应该返回null对于无效格式", () => {
      console.log("[TEST] ========== JWT-EXTRACT-002 ==========");
      console.log("[TEST] 测试无效格式的header");

      const invalidHeaders = [
        "InvalidFormat token",
        "Bearer",
        "Bearer token extra",
        "token-without-bearer",
      ];

      for (const header of invalidHeaders) {
        console.log("[TEST] 测试header:", header);
        const extracted = extractBearerToken(header);
        console.log("[TEST] 提取结果:", extracted);
        expect(extracted).toBeNull();
      }

      console.log("[TEST] ✓ 所有无效格式正确返回null");
    });

    it("JWT-EXTRACT-003: 应该返回null对于undefined header", () => {
      console.log("[TEST] ========== JWT-EXTRACT-003 ==========");
      console.log("[TEST] 测试undefined header");

      const extracted = extractBearerToken(undefined);

      console.log("[TEST] 提取结果:", extracted);
      expect(extracted).toBeNull();
      console.log("[TEST] ✓ undefined header返回null");
    });

    it("JWT-EXTRACT-004: 应该不区分大小写Bearer关键字", () => {
      console.log("[TEST] ========== JWT-EXTRACT-004 ==========");
      console.log("[TEST] 测试不区分大小写");

      const token = "test.token.value";
      const headers = ["bearer " + token, "BEARER " + token, "Bearer " + token];

      for (const header of headers) {
        console.log("[TEST] 测试header:", header);
        const extracted = extractBearerToken(header);
        console.log("[TEST] 提取结果:", extracted);
        expect(extracted).toBe(token);
      }

      console.log("[TEST] ✓ 所有大小写格式都能正确提取");
    });
  });
});
