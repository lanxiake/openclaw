/**
 * 响应解析器测试
 *
 * @module memory/pluggable/llm/response-parsers.test
 */

import { describe, it, expect } from "vitest";

import {
  extractJSON,
  parseSummarizationResponse,
  parseProfileExtractionResponse,
} from "./response-parsers.js";

// ==================== extractJSON ====================

describe("extractJSON", () => {
  it("应返回纯 JSON 字符串", () => {
    const input = '{"key": "value"}';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it("应剥离 ```json 代码围栏", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it("应剥离无语言标记的代码围栏", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it("应处理带空格和换行的代码围栏", () => {
    const input = '```json \n  {"key": "value"}  \n ```';
    expect(JSON.parse(extractJSON(input))).toEqual({ key: "value" });
  });

  it("应 trim 首尾空白", () => {
    const input = '  \n {"key": "value"} \n  ';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });
});

// ==================== parseSummarizationResponse ====================

describe("parseSummarizationResponse", () => {
  it("应解析有效的 JSON 响应", () => {
    const input = JSON.stringify({
      summary: "讨论了项目架构设计",
      keyTopics: ["架构", "数据库", "API"],
      decisions: ["使用 PostgreSQL"],
    });

    const result = parseSummarizationResponse(input);

    expect(result.summary).toBe("讨论了项目架构设计");
    expect(result.keyTopics).toEqual(["架构", "数据库", "API"]);
    expect(result.decisions).toEqual(["使用 PostgreSQL"]);
  });

  it("应解析带代码围栏的 JSON", () => {
    const input = `\`\`\`json
{
  "summary": "测试摘要",
  "keyTopics": ["测试"],
  "decisions": []
}
\`\`\``;

    const result = parseSummarizationResponse(input);

    expect(result.summary).toBe("测试摘要");
    expect(result.keyTopics).toEqual(["测试"]);
    expect(result.decisions).toEqual([]);
  });

  it("应对畸形 JSON 返回空默认值", () => {
    const result = parseSummarizationResponse("this is not json");

    expect(result.summary).toBe("");
    expect(result.keyTopics).toEqual([]);
    expect(result.decisions).toEqual([]);
  });

  it("应对空字符串返回空默认值", () => {
    const result = parseSummarizationResponse("");

    expect(result.summary).toBe("");
    expect(result.keyTopics).toEqual([]);
    expect(result.decisions).toEqual([]);
  });

  it("应对部分有效数据进行部分提取", () => {
    const input = JSON.stringify({
      summary: "有效摘要",
      keyTopics: ["话题1", 123, "话题2"], // 包含非字符串
      decisions: "不是数组", // 类型错误
    });

    const result = parseSummarizationResponse(input);

    expect(result.summary).toBe("有效摘要");
    expect(result.keyTopics).toEqual(["话题1", "话题2"]);
    expect(result.decisions).toEqual([]);
  });

  it("应对缺失字段返回默认值", () => {
    const input = JSON.stringify({
      summary: "只有摘要",
    });

    const result = parseSummarizationResponse(input);

    expect(result.summary).toBe("只有摘要");
    expect(result.keyTopics).toEqual([]);
    expect(result.decisions).toEqual([]);
  });
});

// ==================== parseProfileExtractionResponse ====================

describe("parseProfileExtractionResponse", () => {
  it("应解析有效的完整响应", () => {
    const input = JSON.stringify({
      newFacts: [
        {
          content: "用户名叫张三",
          category: "personal",
          key: "name",
          confidence: 0.9,
        },
      ],
      updatedFacts: [
        {
          id: "fact-1",
          content: "更新后的内容",
          previousValue: "旧值",
        },
      ],
      newPatterns: [
        {
          type: "communication",
          pattern: "喜欢简洁的回复",
          confidence: 0.7,
        },
      ],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toHaveLength(1);
    expect(result.newFacts[0].content).toBe("用户名叫张三");
    expect(result.newFacts[0].category).toBe("personal");

    expect(result.updatedFacts).toHaveLength(1);
    expect(result.updatedFacts[0].id).toBe("fact-1");

    expect(result.newPatterns).toHaveLength(1);
    expect(result.newPatterns[0].type).toBe("communication");
  });

  it("应解析带代码围栏的响应", () => {
    const input = `\`\`\`json
{
  "newFacts": [],
  "updatedFacts": [],
  "newPatterns": []
}
\`\`\``;

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toEqual([]);
    expect(result.updatedFacts).toEqual([]);
    expect(result.newPatterns).toEqual([]);
  });

  it("应对畸形 JSON 返回空默认值", () => {
    const result = parseProfileExtractionResponse("not json at all");

    expect(result.newFacts).toEqual([]);
    expect(result.updatedFacts).toEqual([]);
    expect(result.newPatterns).toEqual([]);
  });

  it("应过滤掉无效的 category", () => {
    const input = JSON.stringify({
      newFacts: [
        { content: "有效", category: "personal", key: "name", confidence: 0.9 },
        { content: "无效", category: "invalid_category", key: "x", confidence: 0.5 },
      ],
      updatedFacts: [],
      newPatterns: [],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toHaveLength(1);
    expect(result.newFacts[0].category).toBe("personal");
  });

  it("应过滤掉无效的 pattern type", () => {
    const input = JSON.stringify({
      newFacts: [],
      updatedFacts: [],
      newPatterns: [
        { type: "communication", pattern: "有效模式", confidence: 0.7 },
        { type: "invalid_type", pattern: "无效模式", confidence: 0.5 },
      ],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newPatterns).toHaveLength(1);
    expect(result.newPatterns[0].type).toBe("communication");
  });

  it("应将 confidence 限制在 0-1 范围", () => {
    const input = JSON.stringify({
      newFacts: [
        { content: "超限", category: "personal", key: "test", confidence: 1.5 },
        { content: "负数", category: "work", key: "test2", confidence: -0.3 },
      ],
      updatedFacts: [],
      newPatterns: [],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toHaveLength(2);
    expect(result.newFacts[0].confidence).toBe(1);
    expect(result.newFacts[1].confidence).toBe(0);
  });

  it("应处理缺少必要字段的事实", () => {
    const input = JSON.stringify({
      newFacts: [
        { content: "缺少 key", category: "personal", confidence: 0.9 }, // 缺少 key
        { category: "work", key: "test", confidence: 0.5 }, // 缺少 content
        { content: "完整", category: "hobby", key: "music", confidence: 0.8 },
      ],
      updatedFacts: [],
      newPatterns: [],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toHaveLength(1);
    expect(result.newFacts[0].content).toBe("完整");
  });

  it("应处理空数组的各项", () => {
    const input = JSON.stringify({
      newFacts: [],
      updatedFacts: [],
      newPatterns: [],
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toEqual([]);
    expect(result.updatedFacts).toEqual([]);
    expect(result.newPatterns).toEqual([]);
  });

  it("应处理 newFacts 非数组的情况", () => {
    const input = JSON.stringify({
      newFacts: "not an array",
      updatedFacts: null,
      newPatterns: 123,
    });

    const result = parseProfileExtractionResponse(input);

    expect(result.newFacts).toEqual([]);
    expect(result.updatedFacts).toEqual([]);
    expect(result.newPatterns).toEqual([]);
  });
});
