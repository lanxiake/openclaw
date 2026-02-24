/**
 * UserWorkspaceFilesRepository 测试
 *
 * 测试用户 workspace 文件的 CRUD 操作、默认初始化、重置功能、多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  UserWorkspaceFilesRepository,
  getUserWorkspaceFilesRepository,
} from "./user-workspace-files.js";

describe("UserWorkspaceFilesRepository", () => {
  let repo: UserWorkspaceFilesRepository;
  const testUserId = "user-ws-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== UserWorkspaceFilesRepository 测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getUserWorkspaceFilesRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UserWorkspaceFilesRepository 测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("upsert", () => {
    it("WS-UPSERT-001: 应该创建新的 workspace 文件", async () => {
      console.log("[TEST] WS-UPSERT-001: 创建新 workspace 文件");

      const file = await repo.upsert("SOUL.md", "这是灵魂文件内容");

      console.log("[TEST] 文件ID:", file.id);
      console.log("[TEST] 文件名:", file.fileName);

      expect(file.id).toBeTruthy();
      expect(file.userId).toBe(testUserId);
      expect(file.fileName).toBe("SOUL.md");
      expect(file.content).toBe("这是灵魂文件内容");
      expect(file.isCustomized).toBe(true);
      expect(file.createdAt).toBeInstanceOf(Date);

      console.log("[TEST] ✓ workspace 文件创建成功");
    });

    it("WS-UPSERT-002: 应该更新已存在的 workspace 文件", async () => {
      console.log("[TEST] WS-UPSERT-002: 更新已存在的 workspace 文件");

      await repo.upsert("IDENTITY.md", "原始内容");
      const updated = await repo.upsert("IDENTITY.md", "更新后内容");

      console.log("[TEST] 更新后内容:", updated.content);
      console.log("[TEST] 是否自定义:", updated.isCustomized);

      expect(updated.content).toBe("更新后内容");
      expect(updated.isCustomized).toBe(true);

      console.log("[TEST] ✓ workspace 文件更新成功");
    });
  });

  describe("getByFileName", () => {
    it("WS-GET-001: 应该根据文件名获取文件", async () => {
      console.log("[TEST] WS-GET-001: 根据文件名获取文件");

      await repo.upsert("AGENTS.md", "Agent 配置内容");
      const file = await repo.getByFileName("AGENTS.md");

      console.log("[TEST] 找到文件:", file ? "是" : "否");

      expect(file).toBeTruthy();
      expect(file?.fileName).toBe("AGENTS.md");
      expect(file?.content).toBe("Agent 配置内容");

      console.log("[TEST] ✓ 文件按名称获取成功");
    });

    it("WS-GET-002: 不存在的文件应该返回 null", async () => {
      console.log("[TEST] WS-GET-002: 不存在文件返回 null");

      const file = await repo.getByFileName("SOUL.md");

      expect(file).toBeNull();

      console.log("[TEST] ✓ 不存在的文件正确返回 null");
    });
  });

  describe("getAllForUser", () => {
    it("WS-ALL-001: 应该获取用户所有 workspace 文件", async () => {
      console.log("[TEST] WS-ALL-001: 获取所有文件");

      await repo.upsert("SOUL.md", "灵魂");
      await repo.upsert("IDENTITY.md", "身份");
      await repo.upsert("TOOLS.md", "工具");

      const files = await repo.getAllForUser();

      console.log("[TEST] 文件数量:", files.length);

      expect(files.length).toBe(3);

      console.log("[TEST] ✓ 获取所有文件成功");
    });
  });

  describe("initializeForUser", () => {
    it("WS-INIT-001: 应该批量初始化用户的默认文件", async () => {
      console.log("[TEST] WS-INIT-001: 批量初始化默认文件");

      const defaults = new Map<string, string>([
        ["SOUL.md", "默认灵魂"],
        ["IDENTITY.md", "默认身份"],
        ["AGENTS.md", "默认Agent"],
      ]);

      const count = await repo.initializeForUser(defaults);

      console.log("[TEST] 初始化文件数:", count);

      expect(count).toBe(3);

      const files = await repo.getAllForUser();
      expect(files.length).toBe(3);

      console.log("[TEST] ✓ 批量初始化成功");
    });

    it("WS-INIT-002: 不应该覆盖已有文件", async () => {
      console.log("[TEST] WS-INIT-002: 不覆盖已有文件");

      await repo.upsert("SOUL.md", "用户自定义灵魂");

      const defaults = new Map<string, string>([
        ["SOUL.md", "默认灵魂"],
        ["IDENTITY.md", "默认身份"],
      ]);

      const count = await repo.initializeForUser(defaults);

      console.log("[TEST] 新初始化文件数:", count);

      expect(count).toBe(1);

      const soul = await repo.getByFileName("SOUL.md");
      expect(soul?.content).toBe("用户自定义灵魂");

      console.log("[TEST] ✓ 已有文件未被覆盖");
    });
  });

  describe("resetToDefault", () => {
    it("WS-RESET-001: 应该重置文件为默认内容", async () => {
      console.log("[TEST] WS-RESET-001: 重置文件为默认内容");

      await repo.upsert("SOUL.md", "用户自定义内容");
      const reset = await repo.resetToDefault("SOUL.md", "默认灵魂内容");

      console.log("[TEST] 重置后内容:", reset?.content);
      console.log("[TEST] 是否自定义:", reset?.isCustomized);

      expect(reset?.content).toBe("默认灵魂内容");
      expect(reset?.isCustomized).toBe(false);

      console.log("[TEST] ✓ 文件重置成功");
    });

    it("WS-RESET-002: 文件不存在时应该创建默认文件", async () => {
      console.log("[TEST] WS-RESET-002: 不存在时创建默认文件");

      const created = await repo.resetToDefault("HEARTBEAT.md", "默认心跳");

      expect(created?.content).toBe("默认心跳");
      expect(created?.isCustomized).toBe(false);

      console.log("[TEST] ✓ 不存在的文件创建为默认");
    });
  });

  describe("delete", () => {
    it("WS-DELETE-001: 应删除指定文件", async () => {
      console.log("[TEST] WS-DELETE-001: 删除文件");

      await repo.upsert("TOOLS.md", "工具内容");
      await repo.deleteByFileName("TOOLS.md");

      const file = await repo.getByFileName("TOOLS.md");

      expect(file).toBeNull();

      console.log("[TEST] ✓ 文件删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("WS-TENANT-001: 不同用户的 workspace 文件应隔离", async () => {
      console.log("[TEST] WS-TENANT-001: 多租户隔离");

      await repo.upsert("SOUL.md", "用户A的灵魂");

      const db = getMockDatabase();
      const userBRepo = getUserWorkspaceFilesRepository(db, "user-B-different");

      const foundByB = await userBRepo.getByFileName("SOUL.md");
      const userBFiles = await userBRepo.getAllForUser();

      console.log("[TEST] 用户B查找用户A的SOUL.md:", foundByB);
      console.log("[TEST] 用户B的文件数:", userBFiles.length);

      expect(foundByB).toBeNull();
      expect(userBFiles.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
