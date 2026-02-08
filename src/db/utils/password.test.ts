/**
 * 密码工具测试
 *
 * 测试密码哈希、验证和强度检查功能
 */

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password.js";

describe("password utils", () => {
  describe("hashPassword", () => {
    it("PWD-HASH-001: 应该正确哈希正常密码", async () => {
      console.log("[TEST] ========== PWD-HASH-001 ==========");
      const password = "Test@123";
      console.log("[TEST] 输入密码:", password);

      const hash = await hashPassword(password);
      console.log("[TEST] 生成哈希:", hash.substring(0, 50) + "...");

      expect(hash).toMatch(/^\$scrypt\$/);
      expect(hash.split("$")).toHaveLength(7);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-HASH-002: 应该能哈希空密码", async () => {
      console.log("[TEST] ========== PWD-HASH-002 ==========");
      const password = "";
      console.log("[TEST] 输入密码: (空字符串)");

      const hash = await hashPassword(password);
      console.log("[TEST] 生成哈希:", hash.substring(0, 50) + "...");

      expect(hash).toMatch(/^\$scrypt\$/);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-HASH-003: 应该能哈希长密码", async () => {
      console.log("[TEST] ========== PWD-HASH-003 ==========");
      const password = "A".repeat(128);
      console.log("[TEST] 输入密码长度:", password.length);

      const hash = await hashPassword(password);
      console.log("[TEST] 生成哈希:", hash.substring(0, 50) + "...");

      expect(hash).toMatch(/^\$scrypt\$/);
      console.log("[TEST] 测试状态: ✅ PASS");
    });
  });

  describe("verifyPassword", () => {
    it("PWD-VERIFY-001: 应该验证正确密码", async () => {
      console.log("[TEST] ========== PWD-VERIFY-001 ==========");
      const password = "Test@123";
      const hash = await hashPassword(password);
      console.log("[TEST] 原始密码:", password);
      console.log("[TEST] 哈希值:", hash.substring(0, 50) + "...");

      const result = await verifyPassword(password, hash);
      console.log("[TEST] 验证结果:", result);

      expect(result).toBe(true);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VERIFY-002: 应该拒绝错误密码", async () => {
      console.log("[TEST] ========== PWD-VERIFY-002 ==========");
      const password = "Test@123";
      const wrongPassword = "Wrong@123";
      const hash = await hashPassword(password);
      console.log("[TEST] 正确密码:", password);
      console.log("[TEST] 错误密码:", wrongPassword);

      const result = await verifyPassword(wrongPassword, hash);
      console.log("[TEST] 验证结果:", result);

      expect(result).toBe(false);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VERIFY-003: 应该拒绝无效哈希格式", async () => {
      console.log("[TEST] ========== PWD-VERIFY-003 ==========");
      const password = "Test@123";
      const invalidHash = "invalid-hash-format";
      console.log("[TEST] 密码:", password);
      console.log("[TEST] 无效哈希:", invalidHash);

      const result = await verifyPassword(password, invalidHash);
      console.log("[TEST] 验证结果:", result);

      expect(result).toBe(false);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VERIFY-004: 应该拒绝空密码验证", async () => {
      console.log("[TEST] ========== PWD-VERIFY-004 ==========");
      const password = "Test@123";
      const hash = await hashPassword(password);
      console.log("[TEST] 原始密码:", password);
      console.log("[TEST] 验证密码: (空字符串)");

      const result = await verifyPassword("", hash);
      console.log("[TEST] 验证结果:", result);

      expect(result).toBe(false);
      console.log("[TEST] 测试状态: ✅ PASS");
    });
  });

  describe("validatePasswordStrength", () => {
    it("PWD-VALID-001: 应该接受强密码", () => {
      console.log("[TEST] ========== PWD-VALID-001 ==========");
      const password = "Test@123";
      console.log("[TEST] 输入密码:", password);

      const result = validatePasswordStrength(password);
      console.log("[TEST] 验证结果:", JSON.stringify(result, null, 2));

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VALID-002: 应该拒绝太短的密码", () => {
      console.log("[TEST] ========== PWD-VALID-002 ==========");
      const password = "Test@1";
      console.log("[TEST] 输入密码:", password);

      const result = validatePasswordStrength(password);
      console.log("[TEST] 验证结果:", JSON.stringify(result, null, 2));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("密码长度至少 8 位");
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VALID-003: 应该拒绝缺少小写字母的密码", () => {
      console.log("[TEST] ========== PWD-VALID-003 ==========");
      const password = "TEST@123";
      console.log("[TEST] 输入密码:", password);

      const result = validatePasswordStrength(password);
      console.log("[TEST] 验证结果:", JSON.stringify(result, null, 2));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("密码需包含小写字母");
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VALID-004: 应该拒绝缺少大写字母的密码", () => {
      console.log("[TEST] ========== PWD-VALID-004 ==========");
      const password = "test@123";
      console.log("[TEST] 输入密码:", password);

      const result = validatePasswordStrength(password);
      console.log("[TEST] 验证结果:", JSON.stringify(result, null, 2));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("密码需包含大写字母");
      console.log("[TEST] 测试状态: ✅ PASS");
    });

    it("PWD-VALID-005: 应该拒绝缺少数字的密码", () => {
      console.log("[TEST] ========== PWD-VALID-005 ==========");
      const password = "Test@abc";
      console.log("[TEST] 输入密码:", password);

      const result = validatePasswordStrength(password);
      console.log("[TEST] 验证结果:", JSON.stringify(result, null, 2));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("密码需包含数字");
      console.log("[TEST] 测试状态: ✅ PASS");
    });
  });
});
