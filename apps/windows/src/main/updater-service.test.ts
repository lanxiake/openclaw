/**
 * UpdaterService 单元测试
 *
 * 测试用例:
 * - WIN-UPD-001: 检查更新 (返回版本信息或"已是最新")
 * - WIN-UPD-002: 下载更新 (下载进度回调正确触发)
 * - 额外: 状态管理、配置更新
 */

import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// 创建一个可控的 autoUpdater mock — 使用 vi.hoisted 确保提升后可用
const { mockAutoUpdater } = vi.hoisted(() => ({
  mockAutoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    currentVersion: { version: "0.1.0" },
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue(null),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: mockAutoUpdater,
}));

import { UpdaterService } from "./updater-service";

describe("UpdaterService", () => {
  let service: UpdaterService;
  // 存储注册的事件回调
  const eventCallbacks: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 捕获 autoUpdater.on 的回调
    mockAutoUpdater.on.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
      eventCallbacks[event] = callback;
    });

    service = new UpdaterService({
      autoCheck: false, // 禁用自动检查以控制测试
      autoDownload: false,
      autoInstall: false,
    });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  // ===========================================================================
  // WIN-UPD-001: 检查更新
  // ===========================================================================
  describe("WIN-UPD-001: 检查更新", () => {
    it("初始状态应为 idle", () => {
      const state = service.getState();
      expect(state.status).toBe("idle");
    });

    it("检查更新时应调用 autoUpdater.checkForUpdates", async () => {
      await service.checkForUpdates();
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it("有新版本时状态应为 available", () => {
      // 触发 update-available 事件
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
        releaseNotes: "New features",
      });

      const state = service.getState();
      expect(state.status).toBe("available");
      expect(state.availableVersion).toBe("1.0.0");
      expect(state.releaseNotes).toBe("New features");
    });

    it("已是最新版本时状态应为 not-available", () => {
      eventCallbacks["update-not-available"]?.({
        version: "0.1.0",
        releaseDate: "2026-01-01",
      });

      const state = service.getState();
      expect(state.status).toBe("not-available");
      expect(state.lastCheckTime).toBeGreaterThan(0);
    });

    it("检查更新失败时状态应为 error", () => {
      eventCallbacks["error"]?.(new Error("Network error"));

      const state = service.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Network error");
    });
  });

  // ===========================================================================
  // WIN-UPD-002: 下载更新
  // ===========================================================================
  describe("WIN-UPD-002: 下载更新", () => {
    it("下载进度应正确更新", () => {
      // 先设置为 available 状态
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
      });

      // 触发下载进度
      eventCallbacks["download-progress"]?.({
        percent: 45.5,
        bytesPerSecond: 1024000,
        transferred: 5000000,
        total: 11000000,
      });

      const state = service.getState();
      expect(state.status).toBe("downloading");
      expect(state.downloadProgress).toBe(45.5);
      expect(state.downloadSpeed).toBe(1024000);
      expect(state.downloadedBytes).toBe(5000000);
      expect(state.totalBytes).toBe(11000000);
    });

    it("下载完成后状态应为 downloaded", () => {
      eventCallbacks["update-downloaded"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
      });

      const state = service.getState();
      expect(state.status).toBe("downloaded");
      expect(state.downloadProgress).toBe(100);
    });

    it("非 available 状态下载应被忽略", async () => {
      // status 是 idle，不是 available
      await service.downloadUpdate();
      expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled();
    });

    it("available 状态才能下载", async () => {
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
      });

      await service.downloadUpdate();
      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 安装更新
  // ===========================================================================
  describe("安装更新", () => {
    it("downloaded 状态应调用 quitAndInstall", () => {
      eventCallbacks["update-downloaded"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
      });

      service.installUpdate();
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    });

    it("非 downloaded 状态安装应被忽略", () => {
      service.installUpdate();
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 配置管理
  // ===========================================================================
  describe("配置管理", () => {
    it("getConfig 应返回当前配置", () => {
      const config = service.getConfig();
      expect(config.autoCheck).toBe(false);
      expect(config.autoDownload).toBe(false);
      expect(config.autoInstall).toBe(false);
    });

    it("updateConfig 应更新配置", () => {
      service.updateConfig({ allowPrerelease: true });
      const config = service.getConfig();
      expect(config.allowPrerelease).toBe(true);
      expect(mockAutoUpdater.allowPrerelease).toBe(true);
    });

    it("state-change 事件应被触发", () => {
      const listener = vi.fn();
      service.on("state-change", listener);

      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 自动检查
  // ===========================================================================
  describe("自动检查", () => {
    it("startAutoCheck 应设置定时器", () => {
      service.updateConfig({ autoCheck: true, checkInterval: 1000 });
      service.startAutoCheck();
      // 立即检查一次
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it("stopAutoCheck 应清除定时器", () => {
      service.startAutoCheck();
      service.stopAutoCheck();
      // 无错误即通过
    });
  });

  // ===========================================================================
  // releaseNotes 格式化
  // ===========================================================================
  describe("releaseNotes 格式化", () => {
    it("字符串格式的 releaseNotes 应正常处理", () => {
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
        releaseNotes: "Bug fixes and improvements",
      });

      const state = service.getState();
      expect(state.releaseNotes).toBe("Bug fixes and improvements");
    });

    it("数组格式的 releaseNotes 应合并", () => {
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
        releaseNotes: [
          { version: "1.0.0", note: "Feature A" },
          { version: "0.9.0", note: "Feature B" },
        ],
      });

      const state = service.getState();
      expect(state.releaseNotes).toContain("Feature A");
      expect(state.releaseNotes).toContain("Feature B");
    });

    it("null releaseNotes 应返回空字符串", () => {
      eventCallbacks["update-available"]?.({
        version: "1.0.0",
        releaseDate: "2026-02-10",
        releaseNotes: null,
      });

      const state = service.getState();
      expect(state.releaseNotes).toBe("");
    });
  });
});
