/**
 * 系统提示个性化测试
 *
 * 测试用户助手配置如何影响系统提示的生成
 */

import { describe, expect, it } from "vitest";

import { buildAgentSystemPrompt } from "./system-prompt.js";
import type { UserAssistantConfig } from "./user-context.js";

describe("buildAgentSystemPrompt - 用户个性化", () => {
  const baseParams = {
    workspaceDir: "/test/workspace",
    toolNames: ["read", "write"],
    userTimezone: "Asia/Shanghai",
  };

  it("无用户配置时不添加个性化部分", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: undefined,
    });

    expect(prompt).not.toContain("## User Custom Instructions");
    expect(prompt).not.toContain("## Personality");
    expect(prompt).not.toContain("## User Preferences");
  });

  it("空用户配置时不添加个性化部分", () => {
    const emptyConfig: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: emptyConfig,
    });

    expect(prompt).not.toContain("## User Custom Instructions");
    expect(prompt).not.toContain("## Personality");
    expect(prompt).not.toContain("## User Preferences");
  });

  it("添加用户自定义系统提示", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      systemPrompt: "Always respond in a friendly and helpful manner.",
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).toContain("## User Custom Instructions");
    expect(prompt).toContain("Always respond in a friendly and helpful manner.");
  });

  it("添加性格特征", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      personality: {
        tone: "professional",
        humor: "subtle",
        verbosity: "concise",
      },
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).toContain("## Personality");
    expect(prompt).toContain("- tone: professional");
    expect(prompt).toContain("- humor: subtle");
    expect(prompt).toContain("- verbosity: concise");
  });

  it("添加用户偏好", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      preferences: {
        language: "Chinese",
        codeStyle: "functional",
        responseLength: "detailed",
      },
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).toContain("## User Preferences");
    expect(prompt).toContain("- language: Chinese");
    expect(prompt).toContain("- codeStyle: functional");
    expect(prompt).toContain("- responseLength: detailed");
  });

  it("同时添加所有个性化部分", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      systemPrompt: "Be helpful and concise.",
      personality: {
        tone: "friendly",
        expertise: "software engineering",
      },
      preferences: {
        language: "English",
        timezone: "UTC",
      },
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).toContain("## User Custom Instructions");
    expect(prompt).toContain("Be helpful and concise.");
    expect(prompt).toContain("## Personality");
    expect(prompt).toContain("- tone: friendly");
    expect(prompt).toContain("- expertise: software engineering");
    expect(prompt).toContain("## User Preferences");
    expect(prompt).toContain("- language: English");
    expect(prompt).toContain("- timezone: UTC");
  });

  it("忽略空值和 null 值", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      personality: {
        tone: "friendly",
        empty: "",
        nullValue: null as unknown as string,
        undefinedValue: undefined as unknown as string,
      },
      preferences: {
        language: "Chinese",
        empty: "",
      },
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).toContain("- tone: friendly");
    expect(prompt).toContain("- language: Chinese");
    expect(prompt).not.toContain("- empty:");
    expect(prompt).not.toContain("- nullValue:");
    expect(prompt).not.toContain("- undefinedValue:");
  });

  it("个性化部分在 Runtime 部分之后", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      systemPrompt: "Custom instructions here.",
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    const runtimeIndex = prompt.indexOf("## Runtime");
    const customIndex = prompt.indexOf("## User Custom Instructions");

    expect(runtimeIndex).toBeGreaterThan(-1);
    expect(customIndex).toBeGreaterThan(-1);
    expect(customIndex).toBeGreaterThan(runtimeIndex);
  });

  it("处理空白系统提示", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      systemPrompt: "   ",
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).not.toContain("## User Custom Instructions");
  });

  it("处理空对象的 personality 和 preferences", () => {
    const config: UserAssistantConfig = {
      configId: "test-config",
      name: "Test Config",
      personality: {},
      preferences: {},
    };

    const prompt = buildAgentSystemPrompt({
      ...baseParams,
      userPersonalization: config,
    });

    expect(prompt).not.toContain("## Personality");
    expect(prompt).not.toContain("## User Preferences");
  });
});
