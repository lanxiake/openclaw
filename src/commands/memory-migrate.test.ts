/**
 * 记忆迁移命令单元测试
 *
 * 测试 runMemoryMigrate 的各种场景：
 * - 正常迁移文件到数据库
 * - dry-run 模式仅预览
 * - 跳过已存在的文件
 * - 文件不存在时标记 not_found
 * - 空文件被跳过
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { runMemoryMigrate, type MigrateOptions } from "./memory-migrate.js";

// Mock 数据库和仓库
const mockGetByFileName = vi.fn();
const mockUpsert = vi.fn();
const mockAuditLog = vi.fn();

vi.mock("../db/connection.js", () => ({
  getDatabase: () => ({}),
}));

vi.mock("../db/repositories/user-workspace-files.js", () => ({
  getUserWorkspaceFilesRepository: () => ({
    getByFileName: mockGetByFileName,
    upsert: mockUpsert,
  }),
}));

vi.mock("../db/repositories/memory-audit.js", () => ({
  getMemoryAuditRepository: () => ({
    log: mockAuditLog,
  }),
}));

vi.mock("../agents/workspace.js", () => ({
  resolveDefaultAgentWorkspaceDir: () => "/tmp/test-workspace",
  DEFAULT_SOUL_FILENAME: "SOUL.md",
  DEFAULT_IDENTITY_FILENAME: "IDENTITY.md",
  DEFAULT_AGENTS_FILENAME: "AGENTS.md",
  DEFAULT_TOOLS_FILENAME: "TOOLS.md",
  DEFAULT_HEARTBEAT_FILENAME: "HEARTBEAT.md",
}));

vi.mock("../runtime.js", () => ({
  defaultRuntime: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fs
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
}));

describe("memory-migrate", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = "/tmp/test-workspace";
    mockAuditLog.mockResolvedValue({});
    mockUpsert.mockImplementation((_fileName: string, content: string) =>
      Promise.resolve({
        id: "generated-id",
        fileName: _fileName,
        content,
        isCustomized: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("MM-001: dry-run 模式不写入数据库", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("SOUL.md")) return Promise.resolve("# Soul content");
      if (p.endsWith("IDENTITY.md")) return Promise.resolve("# Identity content");
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    const result = await runMemoryMigrate({
      dryRun: true,
      workspaceDir: tempDir,
      userId: "test-user",
    });

    expect(result.dryRun).toBe(true);
    expect(result.totalMigrated).toBe(2);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("MM-002: 正常迁移文件到数据库", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("SOUL.md")) return Promise.resolve("# Soul");
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    mockGetByFileName.mockResolvedValue(null);

    const result = await runMemoryMigrate({
      workspaceDir: tempDir,
      userId: "user-1",
    });

    expect(result.totalMigrated).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith("SOUL.md", "# Soul");
  });

  it("MM-003: 跳过数据库中已存在的文件", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("SOUL.md")) return Promise.resolve("# Soul new");
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    mockGetByFileName.mockResolvedValue({
      id: "existing-id",
      fileName: "SOUL.md",
      content: "# Soul old",
      isCustomized: false,
    });

    const result = await runMemoryMigrate({
      workspaceDir: tempDir,
      userId: "user-1",
    });

    expect(result.totalSkipped).toBe(1);
    expect(result.totalMigrated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("MM-004: 文件不存在标记为 not_found", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    const result = await runMemoryMigrate({
      workspaceDir: tempDir,
      userId: "user-1",
    });

    expect(result.totalNotFound).toBe(5);
    expect(result.totalMigrated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("MM-005: 空文件被跳过", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("SOUL.md")) return Promise.resolve("   \n  ");
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    const result = await runMemoryMigrate({
      workspaceDir: tempDir,
      userId: "user-1",
    });

    expect(result.totalSkipped).toBe(1);
    expect(result.totalMigrated).toBe(0);
  });

  it("MM-006: 默认使用 'default' 用户 ID", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    const result = await runMemoryMigrate({
      workspaceDir: tempDir,
    });

    expect(result.userId).toBe("default");
  });

  it("MM-007: 迁移记录审计日志", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("SOUL.md")) return Promise.resolve("# Soul");
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      return Promise.reject(err);
    });

    mockGetByFileName.mockResolvedValue(null);

    await runMemoryMigrate({
      workspaceDir: tempDir,
      userId: "user-audit",
    });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-audit",
        action: "update_workspace_file",
        source: "system",
      }),
    );
  });
});
