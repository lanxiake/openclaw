/**
 * Prompt 构建函数测试
 *
 * @module memory/pluggable/llm/prompts.test
 */

import { describe, it, expect } from "vitest";

import {
  buildSummarizationSystemPrompt,
  buildSummarizationUserMessage,
  buildProfileExtractionSystemPrompt,
  buildProfileExtractionUserMessage,
} from "./prompts.js";
import type { Message } from "../interfaces/types.js";
import type { UserFact } from "../interfaces/profile-memory.js";

// ==================== 测试工具 ====================

/** 创建测试消息 */
function makeMessage(role: "user" | "assistant", content: string): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date(),
  };
}

/** 创建测试事实 */
function makeFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: "fact-1",
    category: "personal",
    key: "name",
    value: "张三",
    confidence: 0.9,
    source: "explicit",
    sensitive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== 对话摘要 Prompt ====================

describe("buildSummarizationSystemPrompt", () => {
  it("应包含 JSON 格式要求", () => {
    const prompt = buildSummarizationSystemPrompt();

    expect(prompt).toContain("summary");
    expect(prompt).toContain("keyTopics");
    expect(prompt).toContain("decisions");
    expect(prompt).toContain("JSON");
  });

  it("应包含输出要求", () => {
    const prompt = buildSummarizationSystemPrompt();

    expect(prompt).toContain("摘要");
    expect(prompt).toContain("关键话题");
  });
});

describe("buildSummarizationUserMessage", () => {
  it("应格式化消息列表", () => {
    const messages: Message[] = [
      makeMessage("user", "你好"),
      makeMessage("assistant", "你好！有什么可以帮助你的？"),
    ];

    const result = buildSummarizationUserMessage(messages);

    expect(result).toContain("[user]: 你好");
    expect(result).toContain("[assistant]: 你好！有什么可以帮助你的？");
  });

  it("应截断超长消息", () => {
    const longContent = "a".repeat(600);
    const messages: Message[] = [makeMessage("user", longContent)];

    const result = buildSummarizationUserMessage(messages);

    expect(result).toContain("...");
    expect(result.length).toBeLessThan(longContent.length + 100);
  });

  it("应限制最大消息数", () => {
    const messages: Message[] = Array.from({ length: 50 }, (_, i) =>
      makeMessage("user", `消息 ${i}`),
    );

    const result = buildSummarizationUserMessage(messages);

    // 只保留最后 30 条
    expect(result).toContain("消息 49");
    expect(result).toContain("消息 20");
    expect(result).not.toContain("消息 19");
  });

  it("应处理空消息列表", () => {
    const result = buildSummarizationUserMessage([]);

    expect(result).toContain("请分析以下对话");
  });
});

// ==================== 画像提取 Prompt ====================

describe("buildProfileExtractionSystemPrompt", () => {
  it("应包含 JSON 格式要求", () => {
    const prompt = buildProfileExtractionSystemPrompt([]);

    expect(prompt).toContain("newFacts");
    expect(prompt).toContain("updatedFacts");
    expect(prompt).toContain("newPatterns");
    expect(prompt).toContain("JSON");
  });

  it("无已有事实时不包含事实部分", () => {
    const prompt = buildProfileExtractionSystemPrompt([]);

    expect(prompt).not.toContain("用户已有的事实");
  });

  it("有已有事实时包含事实列表", () => {
    const facts: UserFact[] = [
      makeFact({ category: "personal", key: "name", value: "张三" }),
      makeFact({ id: "fact-2", category: "work", key: "company", value: "OpenClaw" }),
    ];

    const prompt = buildProfileExtractionSystemPrompt(facts);

    expect(prompt).toContain("用户已有的事实");
    expect(prompt).toContain("[personal] name: 张三");
    expect(prompt).toContain("[work] company: OpenClaw");
  });

  it("应包含置信度说明", () => {
    const prompt = buildProfileExtractionSystemPrompt([]);

    expect(prompt).toContain("confidence");
    expect(prompt).toContain("0.9");
  });
});

describe("buildProfileExtractionUserMessage", () => {
  it("应只提取用户消息", () => {
    const messages: Message[] = [
      makeMessage("user", "我叫张三"),
      makeMessage("assistant", "你好张三"),
      makeMessage("user", "我在OpenClaw工作"),
    ];

    const result = buildProfileExtractionUserMessage(messages);

    expect(result).toContain("我叫张三");
    expect(result).toContain("我在OpenClaw工作");
    expect(result).not.toContain("你好张三");
  });

  it("应用分隔符连接消息", () => {
    const messages: Message[] = [makeMessage("user", "消息1"), makeMessage("user", "消息2")];

    const result = buildProfileExtractionUserMessage(messages);

    expect(result).toContain("---");
  });

  it("应处理无用户消息的情况", () => {
    const messages: Message[] = [makeMessage("assistant", "你好")];

    const result = buildProfileExtractionUserMessage(messages);

    expect(result).toContain("请从以下用户消息中提取画像信息");
  });
});
