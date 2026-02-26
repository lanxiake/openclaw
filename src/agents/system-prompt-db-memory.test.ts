/**
 * Phase 4 数据库优先加载单元测试
 *
 * 测试 buildProfileMemorySection (通过 buildAgentSystemPrompt 间接测试)
 * 和 bootstrap-files 的数据库优先加载逻辑。
 */

import fs from "node:fs/promises";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { buildAgentSystemPrompt } from "./system-prompt.js";
import { resolveBootstrapFilesForRun } from "./bootstrap-files.js";
import { clearInternalHooks } from "../hooks/internal-hooks.js";
import { makeTempWorkspace } from "../test-helpers/workspace.js";
import type { UserProfileMemory } from "./user-context.js";

describe("buildAgentSystemPrompt — profileMemory 注入", () => {
  it("PM-001: profileMemory 为 undefined 时不注入任何记忆段", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/mtbot",
    });

    expect(prompt).not.toContain("## User Profile");
    expect(prompt).not.toContain("## Known Facts About User");
    expect(prompt).not.toContain("## User Interaction Preferences");
  });

  it("PM-002: 注入用户 Profile 信息", () => {
    const profileMemory: UserProfileMemory = {
      profile: {
        id: "p1",
        userId: "u1",
        displayName: "张三",
        nickname: "三哥",
        bio: "软件工程师",
        language: "zh-CN",
        timezone: "Asia/Shanghai",
        workRole: "开发者",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      facts: [],
      preferences: null,
    };

    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/mtbot",
      profileMemory,
    });

    expect(prompt).toContain("## User Profile");
    expect(prompt).toContain("- Name: 张三");
    expect(prompt).toContain("- Nickname: 三哥");
    expect(prompt).toContain("- Language: zh-CN");
    expect(prompt).toContain("- Timezone: Asia/Shanghai");
    expect(prompt).toContain("- Work Role: 开发者");
  });

  it("PM-003: 注入用户事实并按 category 分组", () => {
    const profileMemory: UserProfileMemory = {
      profile: null,
      facts: [
        {
          id: "f1",
          userId: "u1",
          category: "personal",
          key: "name",
          value: "张三",
          confidence: 0.95,
          source: "explicit",
          sensitivity: "normal",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f2",
          userId: "u1",
          category: "personal",
          key: "age",
          value: "30",
          confidence: 0.5,
          source: "inferred",
          sensitivity: "normal",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f3",
          userId: "u1",
          category: "work",
          key: "role",
          value: "engineer",
          confidence: 0.9,
          source: "explicit",
          sensitivity: "normal",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      preferences: null,
    };

    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/mtbot",
      profileMemory,
    });

    expect(prompt).toContain("## Known Facts About User");
    expect(prompt).toContain("### personal");
    expect(prompt).toContain("- name: 张三");
    expect(prompt).toContain("- age: 30 (low confidence)");
    expect(prompt).toContain("### work");
    expect(prompt).toContain("- role: engineer");
  });

  it("PM-004: 注入用户偏好设置", () => {
    const profileMemory: UserProfileMemory = {
      profile: null,
      facts: [],
      preferences: {
        id: "pref1",
        userId: "u1",
        language: "zh-CN",
        timezone: "Asia/Shanghai",
        responseStyle: "concise",
        confirmLevel: "always",
        thinkingLevel: "detailed",
        verboseLevel: "normal",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/mtbot",
      profileMemory,
    });

    expect(prompt).toContain("## User Interaction Preferences");
    expect(prompt).toContain("- Response Style: concise");
    expect(prompt).toContain("- Confirm Level: always");
    expect(prompt).toContain("- Thinking Level: detailed");
    expect(prompt).toContain("- Verbose Level: normal");
  });

  it("PM-005: Profile 存在但字段全空时显示 No profile details", () => {
    const profileMemory: UserProfileMemory = {
      profile: {
        id: "p1",
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      facts: [],
      preferences: null,
    };

    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/mtbot",
      profileMemory,
    });

    expect(prompt).toContain("## User Profile");
    expect(prompt).toContain("(No profile details available)");
  });
});

describe("resolveBootstrapFilesForRun — 数据库优先加载", () => {
  let tempDir: string;

  beforeEach(async () => {
    clearInternalHooks();
    tempDir = await makeTempWorkspace();
  });

  afterEach(async () => {
    clearInternalHooks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("DB-001: 有 workspaceFiles 时使用数据库数据", async () => {
    const workspaceFiles = new Map<string, string>();
    workspaceFiles.set("SOUL.md", "# DB Soul Content");
    workspaceFiles.set("IDENTITY.md", "# DB Identity Content");

    const files = await resolveBootstrapFilesForRun({
      workspaceDir: tempDir,
      userContext: {
        userId: "test-user",
        isDefaultUser: false,
        devices: [],
        quotas: [],
        workspaceFiles,
        loadedAt: new Date(),
      },
    });

    const soulFile = files.find((f) => f.name === "SOUL.md");
    const identityFile = files.find((f) => f.name === "IDENTITY.md");

    expect(soulFile).toBeDefined();
    expect(soulFile?.content).toBe("# DB Soul Content");
    expect(soulFile?.missing).toBe(false);

    expect(identityFile).toBeDefined();
    expect(identityFile?.content).toBe("# DB Identity Content");
  });

  it("DB-002: workspaceFiles 为空 Map 时 fallback 到文件系统", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir: tempDir,
      userContext: {
        userId: "test-user",
        isDefaultUser: false,
        devices: [],
        quotas: [],
        workspaceFiles: new Map(),
        loadedAt: new Date(),
      },
    });

    // fallback 到文件系统，临时目录没有这些文件
    expect(Array.isArray(files)).toBe(true);
  });

  it("DB-003: userContext 为 undefined 时 fallback 到文件系统", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir: tempDir,
    });

    // 不应抛出异常
    expect(Array.isArray(files)).toBe(true);
  });

  it("DB-004: workspaceFiles 为 undefined 时 fallback 到文件系统", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir: tempDir,
      userContext: {
        userId: "test-user",
        isDefaultUser: false,
        devices: [],
        quotas: [],
        loadedAt: new Date(),
      },
    });

    expect(Array.isArray(files)).toBe(true);
  });
});
