/**
 * ID 生成工具测试
 *
 * 测试 UUID、短ID、订单号和验证码的生成
 */

import { describe, expect, it } from "vitest";

import { generateId, generateOrderNo, generateShortId, generateVerificationCode } from "./id.js";

describe("ID 工具", () => {
  describe("generateId", () => {
    it("ID-GEN-001: 应该生成有效的 UUID v4", () => {
      console.log("[TEST] ========== ID-GEN-001 ==========");
      const id = generateId();
      console.log("[TEST] 生成的UUID:", id);

      // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      console.log("[TEST] ✓ UUID 格式正确");
    });

    it("ID-GEN-002: 每次生成应该是唯一的", () => {
      console.log("[TEST] ========== ID-GEN-002 ==========");
      const ids = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }

      console.log("[TEST] 生成数量:", count);
      console.log("[TEST] 唯一数量:", ids.size);

      expect(ids.size).toBe(count);
      console.log("[TEST] ✓ 所有 UUID 唯一");
    });
  });

  describe("generateShortId", () => {
    it("ID-SHORT-001: 应该生成无前缀的短ID", () => {
      console.log("[TEST] ========== ID-SHORT-001 ==========");
      const id = generateShortId();
      console.log("[TEST] 生成的短ID:", id);

      expect(id).toBeTruthy();
      expect(id.length).toBeGreaterThan(6);
      // 只包含大写字母和数字（base36 大写）
      expect(id).toMatch(/^[A-Z0-9]+$/);
      console.log("[TEST] ✓ 短ID 格式正确");
    });

    it("ID-SHORT-002: 应该支持自定义前缀", () => {
      console.log("[TEST] ========== ID-SHORT-002 ==========");
      const prefix = "USR";
      const id = generateShortId(prefix);
      console.log("[TEST] 前缀:", prefix);
      console.log("[TEST] 生成的短ID:", id);

      expect(id).toMatch(new RegExp(`^${prefix}`));
      console.log("[TEST] ✓ 前缀正确");
    });
  });

  describe("generateOrderNo", () => {
    it("ID-ORDER-001: 应该生成正确格式的订单号", () => {
      console.log("[TEST] ========== ID-ORDER-001 ==========");
      const orderNo = generateOrderNo();
      console.log("[TEST] 订单号:", orderNo);

      // 格式: ORD + YYYYMMDD + ...
      expect(orderNo).toMatch(/^ORD\d{8}[A-Z0-9]+$/);
      console.log("[TEST] ✓ 订单号格式正确");
    });

    it("ID-ORDER-002: 订单号应该包含当前日期", () => {
      console.log("[TEST] ========== ID-ORDER-002 ==========");
      const orderNo = generateOrderNo();
      const now = new Date();
      const expectedDate =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");

      console.log("[TEST] 订单号:", orderNo);
      console.log("[TEST] 当前日期:", expectedDate);

      expect(orderNo.substring(3, 11)).toBe(expectedDate);
      console.log("[TEST] ✓ 日期部分正确");
    });
  });

  describe("generateVerificationCode", () => {
    it("ID-CODE-001: 应该生成6位数字验证码", () => {
      console.log("[TEST] ========== ID-CODE-001 ==========");
      const code = generateVerificationCode();
      console.log("[TEST] 验证码:", code);

      expect(code).toMatch(/^\d{6}$/);
      console.log("[TEST] ✓ 验证码格式正确");
    });

    it("ID-CODE-002: 应该支持自定义长度", () => {
      console.log("[TEST] ========== ID-CODE-002 ==========");
      const code4 = generateVerificationCode(4);
      const code8 = generateVerificationCode(8);

      console.log("[TEST] 4位验证码:", code4);
      console.log("[TEST] 8位验证码:", code8);

      expect(code4).toMatch(/^\d{4}$/);
      expect(code8).toMatch(/^\d{8}$/);
      console.log("[TEST] ✓ 自定义长度正确");
    });

    it("ID-CODE-003: 每次生成应该有随机性", () => {
      console.log("[TEST] ========== ID-CODE-003 ==========");
      const codes = new Set<string>();
      const count = 20;

      for (let i = 0; i < count; i++) {
        codes.add(generateVerificationCode());
      }

      console.log("[TEST] 生成数量:", count);
      console.log("[TEST] 唯一数量:", codes.size);

      // 由于是6位数字，20次不应该全部相同
      expect(codes.size).toBeGreaterThan(1);
      console.log("[TEST] ✓ 验证码具有随机性");
    });
  });
});
