/**
 * Profile Memory Tool 测试
 *
 * 测试 createProfileMemoryTool 工具的各种操作：
 * - add_fact: 添加用户事实
 * - search_facts: 搜索用户事实
 * - update_fact: 更新用户事实
 * - get_preferences: 获取用户偏好
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
import { getUserFactRepository } from "../../db/repositories/profile-memory.js";
import { runWithUserContext } from "../user-context-store.js";
import type { UserAgentContext } from "../user-context.js";
import { createProfileMemoryTool } from "./profile-memory-tool.js";

describe("createProfileMemoryTool", () => {
  const testUserId = "user-profile-tool-001";

  /** 构造测试用的 UserAgentContext */
  const testContext: UserAgentContext = {
    userId: testUserId,
    isDefaultUser: false,
    devices: [],
    quotas: [],
    loadedAt: new Date(),
  };

  /** 工具实例 */
  const tool = createProfileMemoryTool();

  beforeEach(() => {
    console.log("[TEST] ========== Profile Memory Tool 测试开始 ==========");
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== Profile Memory Tool 测试结束 ==========\n");
    disableMockDatabase();
  });

  it("PMT-001: 工具基本属性正确", () => {
    console.log("[TEST] PMT-001: 验证工具基本属性");

    expect(tool.name).toBe("profile_memory");
    expect(tool.label).toBeTruthy();
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toBeTruthy();

    console.log("[TEST] ✓ 工具名称:", tool.name);
    console.log("[TEST] ✓ 工具标签:", tool.label);
  });

  it("PMT-002: 无用户上下文时返回错误", async () => {
    console.log("[TEST] PMT-002: 无用户上下文时调用 add_fact");

    const result = await tool.execute("test-call-id", {
      action: "add_fact",
      category: "personal",
      key: "name",
      value: "Alice",
    });

    console.log("[TEST] 返回结果:", JSON.stringify(result));

    const text = result.content[0];
    expect(text.type).toBe("text");

    const payload = JSON.parse((text as { type: "text"; text: string }).text);
    expect(payload.error).toBeTruthy();

    console.log("[TEST] ✓ 无上下文时正确返回错误");
  });

  it("PMT-003: add_fact 操作成功添加事实", async () => {
    console.log("[TEST] PMT-003: 添加用户事实");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "add_fact",
        category: "personal",
        key: "favorite_color",
        value: "blue",
        confidence: 0.9,
        source: "explicit",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.factId).toBeTruthy();

    console.log("[TEST] ✓ 事实添加成功, factId:", payload.factId);
  });

  it("PMT-004: add_fact 缺少必填参数返回错误", async () => {
    console.log("[TEST] PMT-004: 添加事实缺少 key 参数");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "add_fact",
        category: "personal",
        // 缺少 key 和 value
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));
    expect(payload.error).toBeTruthy();

    console.log("[TEST] ✓ 缺少参数时正确返回错误");
  });

  it("PMT-005: search_facts 操作搜索已添加的事实", async () => {
    console.log("[TEST] PMT-005: 搜索用户事实");

    // 先添加一些事实
    await runWithUserContext(testContext, async () => {
      const db = getMockDatabase();
      const repo = getUserFactRepository(db, testUserId);
      await repo.create({
        category: "personal",
        key: "favorite_food",
        value: "sushi",
        confidence: 0.8,
        source: "explicit",
      });
      await repo.create({
        category: "work",
        key: "programming_language",
        value: "TypeScript",
        confidence: 0.9,
        source: "explicit",
      });
    });

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "search_facts",
        query: "sushi",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 搜索结果:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.facts).toBeInstanceOf(Array);
    expect(payload.facts.length).toBeGreaterThanOrEqual(1);
    expect(payload.facts[0].value).toBe("sushi");

    console.log("[TEST] ✓ 搜索成功, 找到", payload.facts.length, "条事实");
  });

  it("PMT-006: update_fact 操作更新事实", async () => {
    console.log("[TEST] PMT-006: 更新用户事实");

    // 先创建事实
    let factId: string;
    await runWithUserContext(testContext, async () => {
      const db = getMockDatabase();
      const repo = getUserFactRepository(db, testUserId);
      const fact = await repo.create({
        category: "personal",
        key: "city",
        value: "Beijing",
        confidence: 0.7,
        source: "inferred",
      });
      factId = fact.id;
    });

    // 更新事实
    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update_fact",
        factId: factId!,
        value: "Shanghai",
        confidence: 0.95,
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 更新结果:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);

    console.log("[TEST] ✓ 事实更新成功");
  });

  it("PMT-007: update_fact 不存在的事实返回错误", async () => {
    console.log("[TEST] PMT-007: 更新不存在的事实");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "update_fact",
        factId: "nonexistent-fact-id",
        value: "new value",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));
    expect(payload.error).toBeTruthy();

    console.log("[TEST] ✓ 不存在的事实正确返回错误");
  });

  it("PMT-008: get_preferences 操作无偏好时返回 null", async () => {
    console.log("[TEST] PMT-008: 获取用户偏好（无记录）");

    const result = await runWithUserContext(testContext, () =>
      tool.execute("test-call-id", {
        action: "get_preferences",
      }),
    );

    const text = result.content[0];
    const payload = JSON.parse((text as { type: "text"; text: string }).text);

    console.log("[TEST] 返回:", JSON.stringify(payload));

    expect(payload.ok).toBe(true);
    expect(payload.preferences).toBeNull();

    console.log("[TEST] ✓ 无偏好时正确返回 null");
  });

  it("PMT-009: 未知 action 抛出错误", async () => {
    console.log("[TEST] PMT-009: 调用未知 action");

    await expect(
      runWithUserContext(testContext, () =>
        tool.execute("test-call-id", {
          action: "invalid_action",
        }),
      ),
    ).rejects.toThrow();

    console.log("[TEST] ✓ 未知 action 正确抛出错误");
  });
});
