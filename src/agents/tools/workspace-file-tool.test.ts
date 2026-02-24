/**
 * Workspace File Tool 测试
 *
 * 测试 createWorkspaceFileTool 工具的操作：
 * - read: 读取 workspace 文件
 * - update: 更新 workspace 文件
 *
 * 使用 Mock 数据库 + AsyncLocalStorage 模拟用户上下文
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import { getUserWorkspaceFilesRepository } from "../../db/repositories/user-workspace-files.js";
import { runWithUserContext } from "../user-context-store.js";
import type { UserAgentContext } from "../user-context.js";
import { createWorkspaceFileTool } from "./workspace-file-tool.js";

describe("createWorkspaceFileTool", () => {
  const testUserId = "user-wsfile-tool-001";

  /** 构造测试用的 UserAgentContext */
  const testContext: UserAgentContext = {
    userId: testUserId,
    isDefaultUser: false,
    devices: [],
    quotas: [],
    loadedAt: new Date(),
  };

  /** 工具实例 */
  const tool = createWorkspaceFileTool();

  beforeEach(() => {
    console.log("[TEST] ========== Workspace File Tool 测试开始 ==========");
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== Workspace File Tool 测试结束 ==========\n");
    disableMockDatabase();
  });

  it("WFT-001: 工具基本属性正确", () => {
    console.log("[TEST] WFT-001: 验证工具基本属性");

    expect(tool.name).toBe("workspace_file");
    expect(tool.label).toBeTruthy();
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toBeTruthy();

    console.log("[TEST] ✓ 工具名称:", tool.name);
    console.log("[TEST] ✓ 工具标签:", tool.label);
  });

  it("WFT-002: 无用户上下文时返回错误", async () => {
    console.log("[TEST] WFT-002: 无用户上下文时调用 read");

    const result = await tool.execute("test-call-id", {
      action: "read",
      fileName: "SOUL.md",
    });

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));
    expect(payload.error).toBeTruthy();

    console.log("[TEST] ✓ 无上下文时正确返回错误");
  });

  it("WFT-003: read 操作读取不存在的文件返回 null", async () => {
    console.log("[TEST] WFT-003: 读取不存在的文件");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "read",
        fileName: "SOUL.md",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.content).toBeNull();

    console.log("[TEST] ✓ 不存在的文件返回 null");
  });

  it("WFT-004: update 操作创建新文件", async () => {
    console.log("[TEST] WFT-004: 通过 update 创建新文件");

    const testContent = "# SOUL\n\n这是灵魂配置文件";

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update",
        fileName: "SOUL.md",
        content: testContent,
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.fileName).toBe("SOUL.md");
    expect(payload.isCustomized).toBe(true);

    console.log("[TEST] ✓ 文件创建成功");
  });

  it("WFT-005: update 后 read 能读取到内容", async () => {
    console.log("[TEST] WFT-005: update 后再 read");

    const testContent = "# IDENTITY\n\n身份配置内容";

    // 先更新
    await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update",
        fileName: "IDENTITY.md",
        content: testContent,
      }),
    );

    // 再读取
    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "read",
        fileName: "IDENTITY.md",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 读取结果:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.content).toBe(testContent);
    expect(payload.isCustomized).toBe(true);

    console.log("[TEST] ✓ 写入后读取内容一致");
  });

  it("WFT-006: update 操作更新已存在的文件", async () => {
    console.log("[TEST] WFT-006: 更新已存在的文件");

    // 先创建
    await runWithUserContext(testContext, async () => {
      const db = getMockDatabase();
      const repo = getUserWorkspaceFilesRepository(db, testUserId);
      await repo.upsert("AGENTS.md", "原始 AGENTS 内容");
    });

    // 通过工具更新
    const newContent = "# AGENTS\n\n更新后的代理配置";
    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update",
        fileName: "AGENTS.md",
        content: newContent,
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 更新结果:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);

    // 验证内容已更新
    await runWithUserContext(testContext, async () => {
      const db = getMockDatabase();
      const repo = getUserWorkspaceFilesRepository(db, testUserId);
      const file = await repo.getByFileName("AGENTS.md");
      expect(file?.content).toBe(newContent);
    });

    console.log("[TEST] ✓ 文件更新成功");
  });

  it("WFT-007: update 缺少 content 参数返回错误", async () => {
    console.log("[TEST] WFT-007: update 缺少 content 参数");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update",
        fileName: "TOOLS.md",
        // 缺少 content
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));
    expect(payload.error).toBeTruthy();

    console.log("[TEST] ✓ 缺少 content 时正确返回错误");
  });

  it("WFT-008: 不同用户的文件数据隔离", async () => {
    console.log("[TEST] WFT-008: 多租户数据隔离");

    const otherUserContext: UserAgentContext = {
      userId: "other-user-002",
      isDefaultUser: false,
      devices: [],
      quotas: [],
      loadedAt: new Date(),
    };

    // 用户 A 写入文件
    await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update",
        fileName: "SOUL.md",
        content: "用户 A 的灵魂",
      }),
    );

    // 用户 B 读取文件（应该为空）
    const result = await runWithUserContext(otherUserContext, () =>
      tool.execute("test-call-id", {
        action: "read",
        fileName: "SOUL.md",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 用户 B 读取结果:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.content).toBeNull();

    console.log("[TEST] ✓ 不同用户数据隔离正确");
  });

  it("WFT-009: 未知 action 抛出错误", async () => {
    console.log("[TEST] WFT-009: 调用未知 action");

    await expect(
      runWithUserContext(testContext, () =>
        tool.execute("test-call-id", {
          action: "delete",
          fileName: "SOUL.md",
        }),
      ),
    ).rejects.toThrow();

    console.log("[TEST] ✓ 未知 action 正确抛出错误");
  });
});
