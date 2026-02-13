/**
 * tool-guard.ts 单元测试
 *
 * 测试工具调用权限校验功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkToolPermission,
  createToolGuard,
  checkToolPermissionFromContext,
  wrapToolWithUserContextGuard,
  type ToolPermissionResult,
} from "./tool-guard.js";
import type { UserAgentContext } from "./user-context.js";
import { runWithUserContext } from "./user-context-store.js";
import type { AnyAgentTool } from "./pi-tools.types.js";

/**
 * 创建测试用的用户上下文
 */
function createTestUserContext(overrides: Partial<UserAgentContext> = {}): UserAgentContext {
  return {
    userId: "test-user-123",
    isDefaultUser: false,
    devices: [
      { deviceId: "device-1", deviceName: "Test Device 1", deviceType: "desktop", isOnline: true },
      { deviceId: "device-2", deviceName: "Test Device 2", deviceType: "mobile", isOnline: false },
    ],
    assistantConfig: undefined,
    quotas: [
      {
        quotaType: "web_search",
        totalValue: 100,
        usedValue: 50,
        remainingValue: 50,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        quotaType: "image_generation",
        totalValue: 10,
        usedValue: 10,
        remainingValue: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ],
    loadedAt: new Date(),
    ...overrides,
  };
}

describe("checkToolPermission", () => {
  describe("无用户上下文时", () => {
    it("应该允许所有操作", () => {
      const result = checkToolPermission("exec", { deviceId: "any-device" }, undefined);
      expect(result.allowed).toBe(true);
    });
  });

  describe("默认用户时", () => {
    it("应该允许所有操作", () => {
      const context = createTestUserContext({ isDefaultUser: true });
      const result = checkToolPermission("exec", { deviceId: "any-device" }, context);
      expect(result.allowed).toBe(true);
    });

    it("应该允许配额工具操作", () => {
      const context = createTestUserContext({ isDefaultUser: true, quotas: [] });
      const result = checkToolPermission("web_search", {}, context);
      expect(result.allowed).toBe(true);
    });
  });

  describe("设备权限校验", () => {
    it("应该允许用户操作自己的设备", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("exec", { deviceId: "device-1" }, context);
      expect(result.allowed).toBe(true);
    });

    it("应该拒绝用户操作不属于自己的设备", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("exec", { deviceId: "unknown-device" }, context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Permission denied");
      expect(result.reason).toContain("unknown-device");
    });

    it("应该支持多种设备 ID 参数名", () => {
      const context = createTestUserContext();

      // deviceId
      expect(checkToolPermission("exec", { deviceId: "device-1" }, context).allowed).toBe(true);

      // device_id
      expect(checkToolPermission("exec", { device_id: "device-1" }, context).allowed).toBe(true);

      // device
      expect(checkToolPermission("exec", { device: "device-1" }, context).allowed).toBe(true);

      // targetDevice
      expect(checkToolPermission("exec", { targetDevice: "device-1" }, context).allowed).toBe(true);
    });

    it("应该允许无设备 ID 的操作", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("exec", {}, context);
      expect(result.allowed).toBe(true);
    });

    it("应该对所有设备权限工具进行校验", () => {
      const context = createTestUserContext();
      const deviceTools = [
        "exec",
        "process",
        "file_read",
        "file_write",
        "file_delete",
        "shell",
        "terminal",
        "browser",
        "screenshot",
      ];

      for (const tool of deviceTools) {
        const result = checkToolPermission(tool, { deviceId: "unknown-device" }, context);
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe("配额校验", () => {
    it("应该允许配额充足的操作", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("web_search", {}, context);
      expect(result.allowed).toBe(true);
    });

    it("应该拒绝配额不足的操作", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("image_generation", {}, context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Quota exceeded");
    });

    it("应该允许无配额记录的操作", () => {
      const context = createTestUserContext();
      const result = checkToolPermission("code_execution", {}, context);
      expect(result.allowed).toBe(true);
    });

    it("应该对所有配额工具进行校验", () => {
      const context = createTestUserContext({
        quotas: [
          {
            quotaType: "web_search",
            totalValue: 10,
            usedValue: 10,
            remainingValue: 0,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            quotaType: "image_generation",
            totalValue: 10,
            usedValue: 10,
            remainingValue: 0,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            quotaType: "code_execution",
            totalValue: 10,
            usedValue: 10,
            remainingValue: 0,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
      });

      const quotaTools = ["web_search", "image_generation", "code_execution"];

      for (const tool of quotaTools) {
        const result = checkToolPermission(tool, {}, context);
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe("工具名称大小写", () => {
    it("应该忽略工具名称大小写", () => {
      const context = createTestUserContext();

      expect(checkToolPermission("EXEC", { deviceId: "unknown-device" }, context).allowed).toBe(
        false,
      );
      expect(checkToolPermission("Exec", { deviceId: "unknown-device" }, context).allowed).toBe(
        false,
      );
      expect(checkToolPermission("exec", { deviceId: "unknown-device" }, context).allowed).toBe(
        false,
      );
    });
  });
});

describe("createToolGuard", () => {
  it("应该创建一个权限检查函数", () => {
    const context = createTestUserContext();
    const guard = createToolGuard(context);

    const result = guard("exec", { deviceId: "device-1" });
    expect(result.allowed).toBe(true);
  });

  it("应该在无上下文时允许所有操作", () => {
    const guard = createToolGuard(undefined);

    const result = guard("exec", { deviceId: "any-device" });
    expect(result.allowed).toBe(true);
  });
});

describe("checkToolPermissionFromContext", () => {
  it("应该从 AsyncLocalStorage 获取上下文并检查权限", () => {
    const context = createTestUserContext();

    const result = runWithUserContext(context, () => {
      return checkToolPermissionFromContext("exec", { deviceId: "device-1" });
    });

    expect(result.allowed).toBe(true);
  });

  it("应该在无上下文时允许操作", () => {
    const result = checkToolPermissionFromContext("exec", { deviceId: "any-device" });
    expect(result.allowed).toBe(true);
  });

  it("应该正确拒绝无权限的操作", () => {
    const context = createTestUserContext();

    const result = runWithUserContext(context, () => {
      return checkToolPermissionFromContext("exec", { deviceId: "unknown-device" });
    });

    expect(result.allowed).toBe(false);
  });
});

describe("wrapToolWithUserContextGuard", () => {
  /**
   * 创建测试用的模拟工具
   */
  function createMockTool(name: string): AnyAgentTool {
    return {
      name,
      description: `Test tool: ${name}`,
      schema: {},
      execute: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Success" }],
      }),
    } as unknown as AnyAgentTool;
  }

  it("应该在权限允许时调用原始工具", async () => {
    const context = createTestUserContext();
    const mockTool = createMockTool("exec");
    const wrappedTool = wrapToolWithUserContextGuard(mockTool);

    const result = await runWithUserContext(context, async () => {
      return wrappedTool.execute("call-1", { deviceId: "device-1" });
    });

    expect(mockTool.execute).toHaveBeenCalledWith(
      "call-1",
      { deviceId: "device-1" },
      undefined,
      undefined,
    );
    expect(result.content[0].text).toBe("Success");
  });

  it("应该在权限拒绝时返回错误", async () => {
    const context = createTestUserContext();
    const mockTool = createMockTool("exec");
    const wrappedTool = wrapToolWithUserContextGuard(mockTool);

    const result = await runWithUserContext(context, async () => {
      return wrappedTool.execute("call-1", { deviceId: "unknown-device" });
    });

    expect(mockTool.execute).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("Permission denied");
    expect(result.details?.error).toBe(true);
  });

  it("应该在无上下文时允许操作", async () => {
    const mockTool = createMockTool("exec");
    const wrappedTool = wrapToolWithUserContextGuard(mockTool);

    const result = await wrappedTool.execute("call-1", { deviceId: "any-device" });

    expect(mockTool.execute).toHaveBeenCalled();
    expect(result.content[0].text).toBe("Success");
  });

  it("应该保留工具的其他属性", () => {
    const mockTool = createMockTool("exec");
    const wrappedTool = wrapToolWithUserContextGuard(mockTool);

    expect(wrappedTool.name).toBe(mockTool.name);
    expect(wrappedTool.description).toBe(mockTool.description);
    expect(wrappedTool.schema).toBe(mockTool.schema);
  });

  it("应该正确处理非对象参数", async () => {
    const context = createTestUserContext();
    const mockTool = createMockTool("message");
    const wrappedTool = wrapToolWithUserContextGuard(mockTool);

    // 非设备权限工具，应该允许
    const result = await runWithUserContext(context, async () => {
      return wrappedTool.execute("call-1", "string-arg");
    });

    expect(mockTool.execute).toHaveBeenCalled();
    expect(result.content[0].text).toBe("Success");
  });
});
