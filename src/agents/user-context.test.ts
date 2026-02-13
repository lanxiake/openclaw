/**
 * user-context.ts 单元测试
 *
 * 测试用户 Agent 上下文加载和权限检查功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadUserAgentContext,
  hasDevicePermission,
  hasQuotaAvailable,
  type UserAgentContext,
  type UserDevice,
  type UserQuota,
} from "./user-context.js";
import { DEFAULT_USER_ID } from "../routing/session-key.js";

// Mock 数据库连接和仓库
vi.mock("../db/connection.js", () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock("../db/repositories/assistant-configs.js", () => ({
  getAssistantConfigRepository: vi.fn(() => ({
    findDefault: vi.fn().mockResolvedValue(null),
  })),
}));

/**
 * 创建测试用的用户上下文
 */
function createTestUserContext(overrides: Partial<UserAgentContext> = {}): UserAgentContext {
  return {
    userId: "test-user-123",
    isDefaultUser: false,
    devices: [],
    assistantConfig: undefined,
    quotas: [],
    loadedAt: new Date(),
    ...overrides,
  };
}

/**
 * 创建测试用的设备
 */
function createTestDevice(deviceId: string): UserDevice {
  return {
    deviceId,
    deviceName: `Device ${deviceId}`,
    deviceType: "desktop",
    isOnline: true,
  };
}

/**
 * 创建测试用的配额
 */
function createTestQuota(quotaType: string, remaining: number, total: number = 100): UserQuota {
  return {
    quotaType,
    totalValue: total,
    usedValue: total - remaining,
    remainingValue: remaining,
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

describe("loadUserAgentContext", () => {
  describe("默认用户处理", () => {
    it("应该为空 userId 返回默认用户上下文", async () => {
      const context = await loadUserAgentContext("");
      expect(context.isDefaultUser).toBe(true);
      expect(context.userId).toBe(DEFAULT_USER_ID);
    });

    it("应该为 undefined userId 返回默认用户上下文", async () => {
      const context = await loadUserAgentContext(undefined);
      expect(context.isDefaultUser).toBe(true);
    });

    it("应该为 null userId 返回默认用户上下文", async () => {
      const context = await loadUserAgentContext(null);
      expect(context.isDefaultUser).toBe(true);
    });

    it("应该为 'default' userId 返回默认用户上下文", async () => {
      const context = await loadUserAgentContext("default");
      expect(context.isDefaultUser).toBe(true);
    });

    it("默认用户上下文应该有空的设备和配额列表", async () => {
      const context = await loadUserAgentContext("");
      expect(context.devices).toEqual([]);
      expect(context.quotas).toEqual([]);
      expect(context.assistantConfig).toBeUndefined();
    });
  });

  describe("普通用户处理", () => {
    it("应该为有效 userId 返回非默认用户上下文", async () => {
      const context = await loadUserAgentContext("user-123");
      expect(context.isDefaultUser).toBe(false);
      expect(context.userId).toBe("user-123");
    });

    it("应该规范化 userId（小写、去空格）", async () => {
      const context = await loadUserAgentContext("  USER-ABC  ");
      expect(context.userId).toBe("user-abc");
    });

    it("应该设置 loadedAt 时间戳", async () => {
      const before = new Date();
      const context = await loadUserAgentContext("user-123");
      const after = new Date();

      expect(context.loadedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(context.loadedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});

describe("hasDevicePermission", () => {
  describe("默认用户", () => {
    it("应该允许默认用户操作任何设备", () => {
      const context = createTestUserContext({ isDefaultUser: true });
      expect(hasDevicePermission(context, "any-device")).toBe(true);
    });
  });

  describe("普通用户", () => {
    it("应该允许用户操作自己的设备", () => {
      const context = createTestUserContext({
        devices: [createTestDevice("device-1"), createTestDevice("device-2")],
      });

      expect(hasDevicePermission(context, "device-1")).toBe(true);
      expect(hasDevicePermission(context, "device-2")).toBe(true);
    });

    it("应该拒绝用户操作不属于自己的设备", () => {
      const context = createTestUserContext({
        devices: [createTestDevice("device-1")],
      });

      expect(hasDevicePermission(context, "device-2")).toBe(false);
      expect(hasDevicePermission(context, "unknown-device")).toBe(false);
    });

    it("应该在无设备时拒绝所有设备操作", () => {
      const context = createTestUserContext({ devices: [] });

      expect(hasDevicePermission(context, "any-device")).toBe(false);
    });

    it("应该精确匹配设备 ID", () => {
      const context = createTestUserContext({
        devices: [createTestDevice("device-1")],
      });

      expect(hasDevicePermission(context, "device-1")).toBe(true);
      expect(hasDevicePermission(context, "device-10")).toBe(false);
      expect(hasDevicePermission(context, "Device-1")).toBe(false); // 大小写敏感
    });
  });
});

describe("hasQuotaAvailable", () => {
  describe("默认用户", () => {
    it("应该允许默认用户无限使用配额", () => {
      const context = createTestUserContext({ isDefaultUser: true, quotas: [] });

      expect(hasQuotaAvailable(context, "web_search", 1000)).toBe(true);
      expect(hasQuotaAvailable(context, "image_generation", 1000)).toBe(true);
    });
  });

  describe("普通用户", () => {
    it("应该在配额充足时允许操作", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 50)],
      });

      expect(hasQuotaAvailable(context, "web_search", 1)).toBe(true);
      expect(hasQuotaAvailable(context, "web_search", 50)).toBe(true);
    });

    it("应该在配额不足时拒绝操作", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 5)],
      });

      expect(hasQuotaAvailable(context, "web_search", 6)).toBe(false);
      expect(hasQuotaAvailable(context, "web_search", 100)).toBe(false);
    });

    it("应该在配额为零时拒绝操作", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 0)],
      });

      expect(hasQuotaAvailable(context, "web_search", 1)).toBe(false);
    });

    it("应该在无配额记录时允许操作", () => {
      const context = createTestUserContext({ quotas: [] });

      expect(hasQuotaAvailable(context, "web_search", 1)).toBe(true);
      expect(hasQuotaAvailable(context, "unknown_quota", 1)).toBe(true);
    });

    it("应该区分不同类型的配额", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 50), createTestQuota("image_generation", 0)],
      });

      expect(hasQuotaAvailable(context, "web_search", 10)).toBe(true);
      expect(hasQuotaAvailable(context, "image_generation", 1)).toBe(false);
    });

    it("应该精确匹配配额类型", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 50)],
      });

      expect(hasQuotaAvailable(context, "web_search", 1)).toBe(true);
      expect(hasQuotaAvailable(context, "Web_Search", 1)).toBe(true); // 无配额记录，允许
      expect(hasQuotaAvailable(context, "web_search_v2", 1)).toBe(true); // 无配额记录，允许
    });
  });

  describe("边界情况", () => {
    it("应该正确处理 amount 为 0 的情况", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 0)],
      });

      expect(hasQuotaAvailable(context, "web_search", 0)).toBe(true);
    });

    it("应该正确处理大数值配额", () => {
      const context = createTestUserContext({
        quotas: [createTestQuota("web_search", 1000000, 1000000)],
      });

      expect(hasQuotaAvailable(context, "web_search", 999999)).toBe(true);
      expect(hasQuotaAvailable(context, "web_search", 1000000)).toBe(true);
      expect(hasQuotaAvailable(context, "web_search", 1000001)).toBe(false);
    });
  });
});
