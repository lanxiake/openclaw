/**
 * TrayManager 单元测试
 *
 * 测试用例:
 * - WIN-TRAY-001: 托盘菜单 (右键显示菜单项)
 * - WIN-TRAY-002: 连接状态图标 (已连接/未连接图标正确切换)
 * - 额外: 通知显示、销毁
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// 使用 vi.hoisted 确保 mock 变量在 vi.mock 提升后仍可用
const { mockTrayInstance, mockMenuTemplate } = vi.hoisted(() => ({
  mockTrayInstance: {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    displayBalloon: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  },
  mockMenuTemplate: [] as unknown[],
}));

vi.mock("electron", () => ({
  Tray: vi.fn(function () { return mockTrayInstance; }),
  Menu: {
    buildFromTemplate: vi.fn((template: unknown[]) => {
      mockMenuTemplate.length = 0;
      mockMenuTemplate.push(...template);
      return { items: template };
    }),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      resize: vi.fn(() => ({ isIcon: true })),
    })),
  },
}));

// 设置 NODE_ENV=development 使 TrayManager 使用 __dirname 而非 process.resourcesPath
process.env.NODE_ENV = "development";

import { TrayManager } from "./tray-manager";

describe("TrayManager", () => {
  let tray: TrayManager;
  const onShowWindow = vi.fn();
  const onQuit = vi.fn();
  const onToggleConnection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    tray = new TrayManager({
      onShowWindow,
      onQuit,
      onToggleConnection,
    });
  });

  // ===========================================================================
  // WIN-TRAY-001: 托盘菜单
  // ===========================================================================
  describe("WIN-TRAY-001: 托盘菜单", () => {
    it("应创建托盘并设置菜单", () => {
      // Tray 应被创建 — 直接检查 mockTrayInstance 的方法调用
      expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith("OpenClaw Assistant");

      // 应设置右键菜单
      expect(mockTrayInstance.setContextMenu).toHaveBeenCalled();
    });

    it("菜单应包含显示窗口、连接状态、退出等项", () => {
      // 菜单模板应包含关键项
      const labels = mockMenuTemplate
        .filter((item: unknown) => (item as { label?: string }).label)
        .map((item: unknown) => (item as { label: string }).label);

      expect(labels).toContain("显示窗口");
      expect(labels).toContain("退出");
      expect(labels.some((l) => l.includes("连接") || l.includes("Gateway"))).toBe(true);
    });

    it("点击事件应注册", () => {
      expect(mockTrayInstance.on).toHaveBeenCalledWith("click", expect.any(Function));
      expect(mockTrayInstance.on).toHaveBeenCalledWith("double-click", expect.any(Function));
    });
  });

  // ===========================================================================
  // WIN-TRAY-002: 连接状态图标
  // ===========================================================================
  describe("WIN-TRAY-002: 连接状态图标", () => {
    it("更新连接状态为已连接应更新 tooltip", () => {
      tray.updateConnectionStatus(true);
      expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith(
        "OpenClaw Assistant - 已连接",
      );
    });

    it("更新连接状态为未连接应更新 tooltip", () => {
      tray.updateConnectionStatus(false);
      expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith(
        "OpenClaw Assistant - 未连接",
      );
    });

    it("更新连接状态应重新构建菜单", () => {
      const callCountBefore = mockTrayInstance.setContextMenu.mock.calls.length;
      tray.updateConnectionStatus(true);
      expect(mockTrayInstance.setContextMenu.mock.calls.length).toBeGreaterThan(
        callCountBefore,
      );
    });

    it("已连接时菜单应显示断开连接选项", () => {
      tray.updateConnectionStatus(true);
      const labels = mockMenuTemplate
        .filter((item: unknown) => (item as { label?: string }).label)
        .map((item: unknown) => (item as { label: string }).label);
      expect(labels).toContain("断开连接");
      expect(labels.some((l) => l.includes("已连接"))).toBe(true);
    });

    it("未连接时菜单应显示连接 Gateway 选项", () => {
      tray.updateConnectionStatus(false);
      const labels = mockMenuTemplate
        .filter((item: unknown) => (item as { label?: string }).label)
        .map((item: unknown) => (item as { label: string }).label);
      expect(labels).toContain("连接 Gateway");
      expect(labels.some((l) => l.includes("未连接"))).toBe(true);
    });
  });

  // ===========================================================================
  // 通知
  // ===========================================================================
  describe("通知", () => {
    it("showNotification 应调用 displayBalloon", () => {
      tray.showNotification("Test Title", "Test Body");
      expect(mockTrayInstance.displayBalloon).toHaveBeenCalledWith({
        title: "Test Title",
        content: "Test Body",
        iconType: "info",
      });
    });
  });

  // ===========================================================================
  // 销毁
  // ===========================================================================
  describe("销毁", () => {
    it("destroy 应销毁托盘", () => {
      tray.destroy();
      expect(mockTrayInstance.destroy).toHaveBeenCalled();
    });
  });
});
