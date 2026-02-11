/**
 * Electron mock for unit tests
 *
 * 提供 Electron API 的 mock 实现，用于单元测试
 */

import { vi } from "vitest";

// Mock app
export const app = {
  getPath: vi.fn((name: string) => {
    const paths: Record<string, string> = {
      userData: "/mock/userData",
      home: "/mock/home",
      desktop: "/mock/desktop",
      documents: "/mock/documents",
      downloads: "/mock/downloads",
      temp: "/mock/temp",
    };
    return paths[name] || `/mock/${name}`;
  }),
  getName: vi.fn(() => "OpenClaw Assistant"),
  getVersion: vi.fn(() => "0.1.0"),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
};

// Mock BrowserWindow
export const BrowserWindow = vi.fn().mockImplementation(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
    on: vi.fn(),
  },
  on: vi.fn(),
  once: vi.fn(),
}));

// Mock dialog
export const dialog = {
  showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: "" }),
  showErrorBox: vi.fn(),
};

// Mock Tray
export const Tray = vi.fn().mockImplementation(() => ({
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  displayBalloon: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
}));

// Mock Menu
export const Menu = {
  buildFromTemplate: vi.fn(() => ({})),
  setApplicationMenu: vi.fn(),
};

// Mock nativeImage
export const nativeImage = {
  createFromPath: vi.fn(() => ({
    resize: vi.fn(() => ({})),
    isEmpty: vi.fn(() => false),
  })),
  createEmpty: vi.fn(() => ({
    resize: vi.fn(() => ({})),
    isEmpty: vi.fn(() => true),
  })),
};

// Mock ipcMain
export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn(),
};

// Mock shell
export const shell = {
  openExternal: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(""),
};

// Mock clipboard
export const clipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => ""),
};
