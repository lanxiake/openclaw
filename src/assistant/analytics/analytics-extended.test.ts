/**
 * 扩展分析服务测试
 *
 * 测试留存分析、收入来源、用户价值、漏斗分析、活跃时段
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import {
  getUserRetention,
  getActiveHourDistribution,
  getRevenueSources,
  getUserValueMetrics,
  getFunnelAnalysis,
  listFunnelTypes,
  getSkillUsageTrend,
} from "./analytics-extended.js";

describe("analytics-extended", () => {
  beforeEach(() => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
    vi.restoreAllMocks();
  });

  describe("getUserRetention", () => {
    it("RETENTION-001: 空数据时返回结构正确", async () => {
      console.log("[TEST] ========== RETENTION-001 ==========");

      const result = await getUserRetention("month");

      expect(result).toHaveProperty("cohorts");
      expect(result).toHaveProperty("averageRetention");
      expect(result.cohorts).toBeInstanceOf(Array);
      expect(result.averageRetention).toHaveProperty("day1");
      expect(result.averageRetention).toHaveProperty("day7");
      expect(result.averageRetention).toHaveProperty("day30");
    });

    it("RETENTION-002: period 参数正确映射周数", async () => {
      console.log("[TEST] ========== RETENTION-002 ==========");

      const weekResult = await getUserRetention("week");
      const monthResult = await getUserRetention("month");

      // week → 4 周, month → 8 周 (具体数量看实现)
      expect(weekResult.cohorts.length).toBeLessThanOrEqual(4);
      expect(monthResult.cohorts.length).toBeLessThanOrEqual(8);
    });
  });

  describe("getActiveHourDistribution", () => {
    it("HOUR-001: 返回 24 个小时的分布", async () => {
      console.log("[TEST] ========== HOUR-001 ==========");

      const result = await getActiveHourDistribution();

      expect(result).toHaveLength(24);
      expect(result[0]).toHaveProperty("hour");
      expect(result[0]).toHaveProperty("count");
      expect(result[0].hour).toBe(0);
      expect(result[23].hour).toBe(23);
    });
  });

  describe("getRevenueSources", () => {
    it("REVENUE-SRC-001: 空数据时返回正确结构", async () => {
      console.log("[TEST] ========== REVENUE-SRC-001 ==========");

      const result = await getRevenueSources();

      expect(result).toHaveProperty("byPlan");
      expect(result).toHaveProperty("byPaymentMethod");
      expect(result.byPlan).toBeInstanceOf(Array);
      expect(result.byPaymentMethod).toBeInstanceOf(Array);
    });
  });

  describe("getUserValueMetrics", () => {
    it("VALUE-001: 空数据时返回零值", async () => {
      console.log("[TEST] ========== VALUE-001 ==========");

      const result = await getUserValueMetrics("month");

      expect(result).toHaveProperty("arpu");
      expect(result).toHaveProperty("arppu");
      expect(result).toHaveProperty("ltv");
      expect(result).toHaveProperty("payingUserRate");
      expect(result.arpu).toBe(0);
      expect(result.payingUserRate).toBe(0);
    });
  });

  describe("getFunnelAnalysis", () => {
    it("FUNNEL-001: 注册漏斗返回正确步骤", async () => {
      console.log("[TEST] ========== FUNNEL-001 ==========");

      const result = await getFunnelAnalysis("registration", "month");

      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("overallConversionRate");
      expect(result.steps.length).toBeGreaterThanOrEqual(2);

      // 每个步骤有必要字段
      for (const step of result.steps) {
        expect(step).toHaveProperty("name");
        expect(step).toHaveProperty("count");
        expect(step).toHaveProperty("percentage");
      }
    });

    it("FUNNEL-002: 订阅漏斗返回正确步骤", async () => {
      console.log("[TEST] ========== FUNNEL-002 ==========");

      const result = await getFunnelAnalysis("subscription", "month");

      expect(result.name).toContain("订阅");
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
    });

    it("FUNNEL-003: 技能漏斗返回正确步骤", async () => {
      console.log("[TEST] ========== FUNNEL-003 ==========");

      const result = await getFunnelAnalysis("skill_usage", "month");

      expect(result.name).toContain("技能");
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("listFunnelTypes", () => {
    it("FUNNEL-LIST-001: 返回三种漏斗类型", () => {
      console.log("[TEST] ========== FUNNEL-LIST-001 ==========");

      const funnels = listFunnelTypes();

      expect(funnels).toHaveLength(3);
      expect(funnels.map((f) => f.id)).toContain("registration");
      expect(funnels.map((f) => f.id)).toContain("subscription");
      expect(funnels.map((f) => f.id)).toContain("skill_usage");
    });
  });

  describe("getSkillUsageTrend", () => {
    it("SKILL-TREND-001: 空数据时返回空数组", async () => {
      console.log("[TEST] ========== SKILL-TREND-001 ==========");

      const result = await getSkillUsageTrend("month");

      expect(result).toBeInstanceOf(Array);
    });
  });
});
