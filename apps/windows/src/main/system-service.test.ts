/**
 * SystemService 单元测试
 *
 * 测试用例:
 * - WIN-SYS-001: 获取系统信息 (返回 CPU/内存/磁盘数据)
 * - WIN-SYS-002: 获取进程列表 (返回进程数组)
 * - WIN-SYS-003: 结束进程 (指定 pid 进程被终止)
 * - 额外: 文件操作安全验证
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    pid: 1234,
    unref: vi.fn(),
  })),
}));

// Mock util.promisify 返回的 execAsync — 使用 vi.hoisted 确保提升后可用
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));
vi.mock("util", () => ({
  promisify: () => mockExecAsync,
}));

import { SystemService } from "./system-service";

describe("SystemService", () => {
  let service: SystemService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SystemService();
  });

  // ===========================================================================
  // WIN-SYS-001: 获取系统信息
  // ===========================================================================
  describe("WIN-SYS-001: 获取系统信息", () => {
    it("应返回系统信息结构", () => {
      const info = service.getSystemInfo();

      expect(info.platform).toBeTruthy();
      expect(info.arch).toBeTruthy();
      expect(info.hostname).toBeTruthy();
      expect(info.cpuModel).toBeTruthy();
      expect(info.cpuCores).toBeGreaterThan(0);
      expect(info.totalMemory).toBeGreaterThan(0);
      expect(info.freeMemory).toBeGreaterThan(0);
      expect(info.usedMemory).toBeGreaterThan(0);
      expect(info.memoryUsagePercent).toBeGreaterThanOrEqual(0);
      expect(info.memoryUsagePercent).toBeLessThanOrEqual(100);
      expect(info.uptime).toBeGreaterThan(0);
    });

    it("连续调用应使用缓存（静态部分一致）", () => {
      const info1 = service.getSystemInfo();
      const info2 = service.getSystemInfo();
      // 静态信息应一致
      expect(info1.cpuModel).toBe(info2.cpuModel);
      expect(info1.cpuCores).toBe(info2.cpuCores);
      expect(info1.totalMemory).toBe(info2.totalMemory);
    });
  });

  // ===========================================================================
  // WIN-SYS-002: 获取进程列表
  // ===========================================================================
  describe("WIN-SYS-002: 获取进程列表", () => {
    it("应返回进程数组", async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { Id: 1234, ProcessName: "node", CPU: 5.5, WorkingSet64: 52428800 },
          { Id: 5678, ProcessName: "chrome", CPU: 2.1, WorkingSet64: 104857600 },
        ]),
      });

      const processes = await service.getProcessList();
      expect(processes.length).toBe(2);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe("node");
      expect(processes[0].cpu).toBe(5.5);
      expect(processes[0].memory).toBe(50); // 52428800 / 1024 / 1024 = 50 MB
      expect(processes[0].memoryBytes).toBe(52428800);
      expect(processes[0].status).toBe("running");
    });

    it("PowerShell 失败时应返回空数组", async () => {
      mockExecAsync.mockRejectedValueOnce(new Error("PowerShell error"));
      const processes = await service.getProcessList();
      expect(processes).toEqual([]);
    });
  });

  // ===========================================================================
  // WIN-SYS-003: 结束进程
  // ===========================================================================
  describe("WIN-SYS-003: 结束进程", () => {
    it("应使用 taskkill 结束指定 PID 进程", async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: "SUCCESS" });

      await expect(service.killProcess(1234)).resolves.toBeUndefined();
      expect(mockExecAsync).toHaveBeenCalledWith("taskkill /PID 1234 /F");
    });

    it("无效 PID 应抛出 SecurityError", async () => {
      await expect(service.killProcess(-1)).rejects.toThrow();
      await expect(service.killProcess(0)).rejects.toThrow();
    });
  });

  // ===========================================================================
  // 磁盘信息
  // ===========================================================================
  describe("磁盘信息", () => {
    it("应返回磁盘数组", async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { DeviceID: "C:", Size: 500000000000, FreeSpace: 200000000000, FileSystem: "NTFS" },
        ]),
      });

      const disks = await service.getDiskInfo();
      expect(disks.length).toBe(1);
      expect(disks[0].name).toBe("C:");
      expect(disks[0].type).toBe("NTFS");
      expect(disks[0].total).toBe(500000000000);
      expect(disks[0].free).toBe(200000000000);
      expect(disks[0].used).toBe(300000000000);
      expect(disks[0].usagePercent).toBe(60);
    });
  });

  // ===========================================================================
  // 命令执行安全
  // ===========================================================================
  describe("命令执行安全", () => {
    it("白名单命令应允许执行", async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: "OK", stderr: "" });
      const result = await service.executeCommand("powershell -Command Get-Date");
      expect(result.stdout).toBe("OK");
    });

    it("非白名单命令应拒绝", async () => {
      await expect(service.executeCommand("curl http://evil.com")).rejects.toThrow();
    });
  });

  // ===========================================================================
  // 用户路径
  // ===========================================================================
  describe("用户路径", () => {
    it("应返回用户目录路径", () => {
      const paths = service.getUserPaths();
      expect(paths.home).toBeTruthy();
      expect(paths.desktop).toContain("Desktop");
      expect(paths.documents).toContain("Documents");
      expect(paths.downloads).toContain("Downloads");
    });
  });

  // ===========================================================================
  // 环境变量
  // ===========================================================================
  describe("环境变量", () => {
    it("应返回存在的环境变量", () => {
      expect(service.getEnvVariable("PATH")).toBeTruthy();
    });

    it("不存在的环境变量应返回 undefined", () => {
      expect(service.getEnvVariable("NONEXISTENT_VAR_12345")).toBeUndefined();
    });
  });
});
