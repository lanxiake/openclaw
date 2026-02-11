/**
 * ClientSkillRuntime 单元测试
 *
 * 测试用例:
 * - WIN-SKILL-001: 加载并执行技能 (技能代码正确执行，返回结果)
 * - 额外: 内置技能注册、确认对话框、取消执行
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  BrowserWindow: vi.fn(),
}));

import { ClientSkillRuntime } from "./skill-runtime";
import type { SystemService } from "./system-service";

/**
 * 创建 mock SystemService
 */
function createMockSystemService(): SystemService {
  return {
    listDirectory: vi.fn().mockResolvedValue([
      { name: "file1.txt", path: "/mock/file1.txt", isDirectory: false, size: 100, createdAt: new Date(), modifiedAt: new Date(), extension: ".txt" },
    ]),
    readFile: vi.fn().mockResolvedValue("file content"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    getSystemInfo: vi.fn().mockReturnValue({
      platform: "win32",
      arch: "x64",
      hostname: "test-host",
      release: "10.0",
      cpuModel: "Test CPU",
      cpuCores: 4,
      totalMemory: 8_000_000_000,
      freeMemory: 4_000_000_000,
      usedMemory: 4_000_000_000,
      memoryUsagePercent: 50,
      uptime: 3600,
    }),
    executeCommand: vi.fn().mockResolvedValue({ stdout: "OK", stderr: "" }),
    getUserPaths: vi.fn().mockReturnValue({
      home: "/mock/home",
      desktop: "/mock/desktop",
      documents: "/mock/documents",
      downloads: "/mock/downloads",
    }),
  } as unknown as SystemService;
}

describe("ClientSkillRuntime", () => {
  let runtime: ClientSkillRuntime;
  let mockSystemService: SystemService;

  beforeEach(() => {
    mockSystemService = createMockSystemService();
    runtime = new ClientSkillRuntime(mockSystemService);
  });

  // ===========================================================================
  // WIN-SKILL-001: 加载并执行技能
  // ===========================================================================
  describe("WIN-SKILL-001: 加载并执行技能", () => {
    it("应成功执行内置系统信息技能", async () => {
      const result = await runtime.executeSkill({
        requestId: "req-001",
        skillId: "builtin:system-info",
        params: {},
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.requestId).toBe("req-001");
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect((result.result as { platform: string }).platform).toBe("win32");
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("应成功执行内置文件列表技能", async () => {
      const result = await runtime.executeSkill({
        requestId: "req-002",
        skillId: "builtin:file-list",
        params: { path: "/mock/dir" },
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(true);
      expect((result.result as { count: number }).count).toBe(1);
    });

    it("应成功执行内置读取文件技能", async () => {
      const result = await runtime.executeSkill({
        requestId: "req-003",
        skillId: "builtin:file-read",
        params: { path: "/mock/file.txt" },
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(true);
      expect((result.result as { content: string }).content).toBe("file content");
    });

    it("技能不存在时应返回 SKILL_NOT_FOUND", async () => {
      const result = await runtime.executeSkill({
        requestId: "req-004",
        skillId: "nonexistent:skill",
        params: {},
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SKILL_NOT_FOUND");
    });

    it("SystemService 未设置时应返回 INTERNAL_ERROR", async () => {
      const runtimeNoService = new ClientSkillRuntime();
      const result = await runtimeNoService.executeSkill({
        requestId: "req-005",
        skillId: "builtin:system-info",
        params: {},
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INTERNAL_ERROR");
    });
  });

  // ===========================================================================
  // 技能注册和管理
  // ===========================================================================
  describe("技能注册和管理", () => {
    it("应列出所有已启用的内置技能", () => {
      const skills = runtime.listSkills();
      expect(skills.length).toBe(4);
      expect(skills.map((s) => s.id)).toContain("builtin:system-info");
      expect(skills.map((s) => s.id)).toContain("builtin:file-list");
      expect(skills.map((s) => s.id)).toContain("builtin:file-read");
      expect(skills.map((s) => s.id)).toContain("builtin:execute-command");
    });

    it("registerSkill 应注册新技能", () => {
      runtime.registerSkill({
        id: "custom:test",
        name: "Test Skill",
        version: "1.0.0",
        runMode: "local",
        enabled: true,
        execute: async () => "test result",
      });

      const skill = runtime.getSkill("custom:test");
      expect(skill).toBeDefined();
      expect(skill?.name).toBe("Test Skill");
    });

    it("unregisterSkill 应注销技能", () => {
      runtime.registerSkill({
        id: "custom:temp",
        name: "Temp",
        version: "1.0.0",
        runMode: "local",
        enabled: true,
        execute: async () => null,
      });

      expect(runtime.unregisterSkill("custom:temp")).toBe(true);
      expect(runtime.getSkill("custom:temp")).toBeUndefined();
    });

    it("disabled 技能应返回 SKILL_DISABLED", async () => {
      runtime.registerSkill({
        id: "custom:disabled",
        name: "Disabled",
        version: "1.0.0",
        runMode: "local",
        enabled: false,
        execute: async () => null,
      });

      const result = await runtime.executeSkill({
        requestId: "req-006",
        skillId: "custom:disabled",
        params: {},
        requireConfirm: false,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SKILL_DISABLED");
    });
  });

  // ===========================================================================
  // 确认对话框
  // ===========================================================================
  describe("确认对话框", () => {
    it("requireConfirm 时应调用确认处理器", async () => {
      const confirmHandler = vi.fn().mockResolvedValue(true);
      runtime.setConfirmHandler(confirmHandler);

      await runtime.executeSkill({
        requestId: "req-007",
        skillId: "builtin:system-info",
        params: {},
        requireConfirm: true,
        confirmMessage: "确认执行?",
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(confirmHandler).toHaveBeenCalled();
    });

    it("用户取消时应返回 USER_CANCELLED", async () => {
      const confirmHandler = vi.fn().mockResolvedValue(false);
      runtime.setConfirmHandler(confirmHandler);

      const result = await runtime.executeSkill({
        requestId: "req-008",
        skillId: "builtin:system-info",
        params: {},
        requireConfirm: true,
        timeoutMs: 5000,
        runMode: "local",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("USER_CANCELLED");
    });
  });

  // ===========================================================================
  // 取消执行
  // ===========================================================================
  describe("取消执行", () => {
    it("cancelExecution 应取消正在执行的技能", async () => {
      runtime.registerSkill({
        id: "custom:slow",
        name: "Slow Skill",
        version: "1.0.0",
        runMode: "local",
        enabled: true,
        execute: async (_params, context) => {
          await new Promise<void>((resolve) => {
            const check = () => {
              if (context.abortSignal?.aborted) return resolve();
              setTimeout(check, 10);
            };
            check();
          });
          throw new Error("aborted");
        },
      });

      // 开始执行，不 await
      const execPromise = runtime.executeSkill({
        requestId: "req-cancel",
        skillId: "custom:slow",
        params: {},
        requireConfirm: false,
        timeoutMs: 10000,
        runMode: "local",
      });

      // 等待一下让执行开始
      await new Promise((r) => setTimeout(r, 50));

      // 取消
      const cancelled = runtime.cancelExecution("req-cancel");
      expect(cancelled).toBe(true);

      const result = await execPromise;
      expect(result.success).toBe(false);
    });

    it("cancelExecution 对不存在的请求返回 false", () => {
      expect(runtime.cancelExecution("nonexistent")).toBe(false);
    });
  });

  // ===========================================================================
  // 沙箱管理
  // ===========================================================================
  describe("沙箱管理", () => {
    it("默认沙箱状态应为 null", () => {
      expect(runtime.getSandboxStatus()).toBeNull();
    });

    it("setSandboxEnabled 应启用沙箱", async () => {
      await runtime.setSandboxEnabled(true);
      const status = runtime.getSandboxStatus();
      expect(status?.enabled).toBe(true);
    });
  });
});
