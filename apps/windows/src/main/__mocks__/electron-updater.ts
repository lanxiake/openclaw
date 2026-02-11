/**
 * electron-updater mock for unit tests
 */

import { vi } from "vitest";

export const autoUpdater = {
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
};

export type UpdateInfo = {
  version: string;
  releaseDate: string;
  releaseNotes?: string | null;
};

export type ProgressInfo = {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
};
