/**
 * TenantScopedRepository 基类测试
 *
 * 测试多租户隔离基础设施
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { TenantScopedRepository, getTenantScopedRepository } from "./tenant-scope.js";

describe("TenantScopedRepository", () => {
  beforeEach(() => {
    console.log("[TEST] ========== TenantScopedRepository测试开始 ==========");
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== TenantScopedRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("constructor", () => {
    it("TENANT-SCOPE-001: 应该正确构造并存储 userId", () => {
      console.log("[TEST] ========== TENANT-SCOPE-001 ==========");
      console.log("[TEST] 测试正常构造 TenantScopedRepository");

      const db = getMockDatabase();
      const userId = "user-123";
      console.log("[TEST] userId:", userId);

      const repo = new TenantScopedRepository(db, userId);

      console.log("[TEST] tenantId:", repo.tenantId);

      expect(repo.tenantId).toBe(userId);
      console.log("[TEST] ✓ TenantScopedRepository 构造成功");
    });

    it("TENANT-SCOPE-002: userId 为空字符串时应该抛出异常", () => {
      console.log("[TEST] ========== TENANT-SCOPE-002 ==========");
      console.log("[TEST] 测试 userId 为空字符串");

      const db = getMockDatabase();
      const emptyUserId = "";
      console.log("[TEST] userId:", `"${emptyUserId}"`);

      expect(() => {
        new TenantScopedRepository(db, emptyUserId);
      }).toThrow("[TenantScopedRepository] userId is required");

      console.log("[TEST] ✓ 正确抛出异常");
    });

    it("TENANT-SCOPE-003: userId 为 undefined 时应该抛出异常", () => {
      console.log("[TEST] ========== TENANT-SCOPE-003 ==========");
      console.log("[TEST] 测试 userId 为 undefined");

      const db = getMockDatabase();
      console.log("[TEST] userId: undefined");

      expect(() => {
        // @ts-expect-error 测试 undefined 情况
        new TenantScopedRepository(db, undefined);
      }).toThrow("[TenantScopedRepository] userId is required");

      console.log("[TEST] ✓ 正确抛出异常");
    });

    it("TENANT-SCOPE-004: userId 为 null 时应该抛出异常", () => {
      console.log("[TEST] ========== TENANT-SCOPE-004 ==========");
      console.log("[TEST] 测试 userId 为 null");

      const db = getMockDatabase();
      console.log("[TEST] userId: null");

      expect(() => {
        // @ts-expect-error 测试 null 情况
        new TenantScopedRepository(db, null);
      }).toThrow("[TenantScopedRepository] userId is required");

      console.log("[TEST] ✓ 正确抛出异常");
    });
  });

  describe("tenantId getter", () => {
    it("TENANT-SCOPE-005: tenantId 应该返回构造时传入的 userId", () => {
      console.log("[TEST] ========== TENANT-SCOPE-005 ==========");
      console.log("[TEST] 测试 tenantId getter");

      const db = getMockDatabase();
      const userId = "user-abc-123";
      console.log("[TEST] 构造时 userId:", userId);

      const repo = new TenantScopedRepository(db, userId);

      console.log("[TEST] tenantId getter 返回:", repo.tenantId);

      expect(repo.tenantId).toBe(userId);
      console.log("[TEST] ✓ tenantId getter 正确返回 userId");
    });
  });

  describe("factory function", () => {
    it("TENANT-SCOPE-006: getTenantScopedRepository 应该创建实例", () => {
      console.log("[TEST] ========== TENANT-SCOPE-006 ==========");
      console.log("[TEST] 测试工厂函数");

      const db = getMockDatabase();
      const userId = "user-factory-test";
      console.log("[TEST] userId:", userId);

      const repo = getTenantScopedRepository(db, userId);

      console.log("[TEST] 创建的实例 tenantId:", repo.tenantId);

      expect(repo).toBeInstanceOf(TenantScopedRepository);
      expect(repo.tenantId).toBe(userId);
      console.log("[TEST] ✓ 工厂函数正确创建实例");
    });
  });
});
