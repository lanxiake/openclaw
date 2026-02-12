/**
 * UsageQuotaRepository 测试
 *
 * 测试用量配额的 CRUD 操作、findCurrent、incrementUsage，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { UsageQuotaRepository, getUsageQuotaRepository } from "./usage-quotas.js";

describe("UsageQuotaRepository", () => {
  let quotaRepo: UsageQuotaRepository;
  const testUserId = "user-quota-test-001";

  // 当前周期：本月 1 号到下月 1 号
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  beforeEach(() => {
    console.log("[TEST] ========== UsageQuotaRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    quotaRepo = getUsageQuotaRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UsageQuotaRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("QUOTA-CREATE-001: 应该创建配额记录", async () => {
      console.log("[TEST] ========== QUOTA-CREATE-001 ==========");

      const quota = await quotaRepo.create({
        quotaType: "tokens",
        periodStart,
        periodEnd,
        limitValue: 100000,
      });

      console.log("[TEST] 配额ID:", quota.id);
      console.log("[TEST] 配额 userId:", quota.userId);

      expect(quota.id).toBeTruthy();
      expect(quota.userId).toBe(testUserId);
      expect(quota.quotaType).toBe("tokens");
      expect(quota.limitValue).toBe(100000);
      expect(quota.usedValue).toBe(0);

      console.log("[TEST] ✓ 配额创建成功");
    });
  });

  describe("findById", () => {
    it("QUOTA-FIND-001: 应该根据 ID 查找配额", async () => {
      console.log("[TEST] ========== QUOTA-FIND-001 ==========");

      const created = await quotaRepo.create({
        quotaType: "storage",
        periodStart,
        periodEnd,
        limitValue: 5120,
      });

      const found = await quotaRepo.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.quotaType).toBe("storage");

      console.log("[TEST] ✓ 查找配额成功");
    });
  });

  describe("findCurrent", () => {
    it("QUOTA-CURRENT-001: 应该查找当前有效期的配额", async () => {
      console.log("[TEST] ========== QUOTA-CURRENT-001 ==========");

      await quotaRepo.create({
        quotaType: "tokens",
        periodStart,
        periodEnd,
        limitValue: 100000,
        usedValue: 5000,
      });

      const current = await quotaRepo.findCurrent("tokens");

      console.log("[TEST] 当前配额:", current?.quotaType, current?.usedValue);

      expect(current).toBeTruthy();
      expect(current?.quotaType).toBe("tokens");
      expect(current?.usedValue).toBe(5000);

      console.log("[TEST] ✓ findCurrent 正常");
    });

    it("QUOTA-CURRENT-002: 过期配额不应返回", async () => {
      console.log("[TEST] ========== QUOTA-CURRENT-002 ==========");

      // 创建上个月的配额
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

      await quotaRepo.create({
        quotaType: "tokens",
        periodStart: lastMonthStart,
        periodEnd: lastMonthEnd,
        limitValue: 100000,
      });

      const current = await quotaRepo.findCurrent("tokens");

      expect(current).toBeNull();

      console.log("[TEST] ✓ 过期配额不返回");
    });
  });

  describe("findAll", () => {
    it("QUOTA-FIND-002: 应该返回当前用户的所有配额", async () => {
      console.log("[TEST] ========== QUOTA-FIND-002 ==========");

      await quotaRepo.create({
        quotaType: "tokens",
        periodStart,
        periodEnd,
        limitValue: 100000,
      });
      await quotaRepo.create({
        quotaType: "storage",
        periodStart,
        periodEnd,
        limitValue: 5120,
      });

      const all = await quotaRepo.findAll();

      expect(all.length).toBe(2);

      console.log("[TEST] ✓ findAll 正常");
    });
  });

  describe("incrementUsage", () => {
    it("QUOTA-INCREMENT-001: 应该原子递增使用量", async () => {
      console.log("[TEST] ========== QUOTA-INCREMENT-001 ==========");

      await quotaRepo.create({
        quotaType: "tokens",
        periodStart,
        periodEnd,
        limitValue: 100000,
        usedValue: 1000,
      });

      const updated = await quotaRepo.incrementUsage("tokens", 500);

      console.log("[TEST] 递增后使用量:", updated?.usedValue);

      expect(updated).toBeTruthy();
      expect(updated?.usedValue).toBe(1500);

      console.log("[TEST] ✓ 原子递增成功");
    });
  });

  describe("tenant isolation", () => {
    it("QUOTA-TENANT-001: 不同用户的配额应该隔离", async () => {
      console.log("[TEST] ========== QUOTA-TENANT-001 ==========");

      const userAQuota = await quotaRepo.create({
        quotaType: "tokens",
        periodStart,
        periodEnd,
        limitValue: 100000,
      });

      const db = getMockDatabase();
      const userBRepo = getUsageQuotaRepository(db, "user-B-different");

      const foundByB = await userBRepo.findById(userAQuota.id);
      const userBAll = await userBRepo.findAll();

      expect(foundByB).toBeNull();
      expect(userBAll.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
