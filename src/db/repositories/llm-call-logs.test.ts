/**
 * LlmCallLogRepository 测试
 *
 * 测试 LLM 调用日志的写入、查询、聚合统计和清理功能。
 * 使用 mock database 进行单元测试。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { LlmCallLogRepository, getLlmCallLogRepository } from "./llm-call-logs.js";

describe("LlmCallLogRepository", () => {
  let repo: LlmCallLogRepository;

  beforeEach(() => {
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getLlmCallLogRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  // ==================== insert 测试 ====================

  describe("insert", () => {
    it("LLM-INSERT-001: 应该成功插入一条 LLM 调用日志", async () => {
      await repo.insert({
        userId: "user-001",
        sessionId: "session-001",
        runId: "run-001",
        channel: "telegram",
        provider: "anthropic",
        model: "claude-3-opus",
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheWriteTokens: 100,
        totalTokens: 1800,
        durationMs: 3500,
        status: "success",
        errorMessage: null,
        metadata: { authProfileId: "profile-1", contextTokens: 200000 },
        calledAt: new Date(),
      });

      const result = await repo.query({ limit: 10 });

      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.provider).toBe("anthropic");
      expect(result.logs[0]!.model).toBe("claude-3-opus");
      expect(result.logs[0]!.status).toBe("success");
    });

    it("LLM-INSERT-002: 应该支持无 userId 的系统调用", async () => {
      await repo.insert({
        userId: null,
        sessionId: "session-sys",
        runId: "run-sys",
        channel: null,
        provider: "openai",
        model: "gpt-4o",
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
        durationMs: 1200,
        status: "success",
        calledAt: new Date(),
      });

      const result = await repo.query({ limit: 10 });

      expect(result.total).toBe(1);
      expect(result.logs[0]!.userId).toBeNull();
    });

    it("LLM-INSERT-003: 应该记录错误状态的调用", async () => {
      await repo.insert({
        userId: "user-001",
        sessionId: "session-err",
        runId: "run-err",
        provider: "anthropic",
        model: "claude-3-opus",
        durationMs: 500,
        status: "rate_limited",
        errorMessage: "Rate limit exceeded",
        metadata: { failoverReason: "rate_limited" },
        calledAt: new Date(),
      });

      const result = await repo.query({ limit: 10 });

      expect(result.logs[0]!.status).toBe("rate_limited");
      expect(result.logs[0]!.errorMessage).toBe("Rate limit exceeded");
    });
  });

  // ==================== insertBatch 测试 ====================

  describe("insertBatch", () => {
    it("LLM-BATCH-001: 应该批量插入多条日志", async () => {
      const now = new Date();
      await repo.insertBatch([
        {
          userId: "user-001",
          provider: "anthropic",
          model: "claude-3-opus",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          durationMs: 3000,
          status: "success" as const,
          calledAt: now,
        },
        {
          userId: "user-002",
          provider: "openai",
          model: "gpt-4o",
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          durationMs: 2000,
          status: "success" as const,
          calledAt: now,
        },
      ]);

      const result = await repo.query({ limit: 10 });

      expect(result.total).toBe(2);
    });

    it("LLM-BATCH-002: 空数组应该安全跳过", async () => {
      await repo.insertBatch([]);

      const result = await repo.query({ limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  // ==================== query 测试 ====================

  describe("query", () => {
    beforeEach(async () => {
      const now = new Date();
      await repo.insertBatch([
        {
          userId: "user-001",
          sessionId: "sess-1",
          channel: "telegram",
          provider: "anthropic",
          model: "claude-3-opus",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          durationMs: 3000,
          status: "success" as const,
          calledAt: new Date(now.getTime() - 4000),
        },
        {
          userId: "user-001",
          sessionId: "sess-1",
          channel: "telegram",
          provider: "anthropic",
          model: "claude-3-sonnet",
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          durationMs: 1500,
          status: "success" as const,
          calledAt: new Date(now.getTime() - 3000),
        },
        {
          userId: "user-002",
          sessionId: "sess-2",
          channel: "discord",
          provider: "openai",
          model: "gpt-4o",
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          durationMs: 2000,
          status: "error" as const,
          errorMessage: "Internal server error",
          calledAt: new Date(now.getTime() - 2000),
        },
        {
          userId: "user-003",
          channel: "web",
          provider: "anthropic",
          model: "claude-3-opus",
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          durationMs: 5000,
          status: "timeout" as const,
          errorMessage: "Request timed out",
          calledAt: new Date(now.getTime() - 1000),
        },
      ]);
    });

    it("LLM-QUERY-001: 应该返回所有日志（分页）", async () => {
      const result = await repo.query({ limit: 10 });

      expect(result.total).toBe(4);
      expect(result.logs).toHaveLength(4);
    });

    it("LLM-QUERY-002: 应该按 userId 过滤", async () => {
      const result = await repo.query({ userId: "user-001" });

      expect(result.total).toBe(2);
      expect(result.logs.every((l) => l.userId === "user-001")).toBe(true);
    });

    it("LLM-QUERY-003: 应该按 provider 过滤", async () => {
      const result = await repo.query({ provider: "anthropic" });

      expect(result.total).toBe(3);
      expect(result.logs.every((l) => l.provider === "anthropic")).toBe(true);
    });

    it("LLM-QUERY-004: 应该按 model 过滤", async () => {
      const result = await repo.query({ model: "claude-3-opus" });

      expect(result.total).toBe(2);
      expect(result.logs.every((l) => l.model === "claude-3-opus")).toBe(true);
    });

    it("LLM-QUERY-005: 应该按 status 过滤", async () => {
      const result = await repo.query({ status: "error" });

      expect(result.total).toBe(1);
      expect(result.logs[0]!.status).toBe("error");
    });

    it("LLM-QUERY-006: 应该按 channel 过滤", async () => {
      const result = await repo.query({ channel: "telegram" });

      expect(result.total).toBe(2);
      expect(result.logs.every((l) => l.channel === "telegram")).toBe(true);
    });

    it("LLM-QUERY-007: 应该支持分页", async () => {
      const page1 = await repo.query({ limit: 2, offset: 0 });
      const page2 = await repo.query({ limit: 2, offset: 2 });

      expect(page1.logs).toHaveLength(2);
      expect(page2.logs).toHaveLength(2);
      expect(page1.total).toBe(4);
      /** 两页的 ID 不应重叠 */
      const page1Ids = page1.logs.map((l) => l.id);
      const page2Ids = page2.logs.map((l) => l.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });

    it("LLM-QUERY-008: hasMore 在有更多数据时应为 true", async () => {
      const result = await repo.query({ limit: 2 });

      expect(result.hasMore).toBe(true);
    });

    it("LLM-QUERY-009: hasMore 在无更多数据时应为 false", async () => {
      const result = await repo.query({ limit: 10 });

      expect(result.hasMore).toBe(false);
    });
  });

  // ==================== getStats 测试 ====================

  describe("getStats", () => {
    beforeEach(async () => {
      const now = new Date();
      await repo.insertBatch([
        {
          userId: "user-001",
          provider: "anthropic",
          model: "claude-3-opus",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          durationMs: 3000,
          status: "success" as const,
          calledAt: now,
        },
        {
          userId: "user-001",
          provider: "anthropic",
          model: "claude-3-sonnet",
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          durationMs: 1500,
          status: "success" as const,
          calledAt: now,
        },
        {
          userId: "user-002",
          provider: "openai",
          model: "gpt-4o",
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          durationMs: 2000,
          status: "error" as const,
          calledAt: now,
        },
      ]);
    });

    it("LLM-STATS-001: 应该返回正确的聚合统计", async () => {
      const stats = await repo.getStats();

      expect(stats.totalCalls).toBe(3);
      expect(stats.successCalls).toBe(2);
      expect(stats.errorCalls).toBe(1);
      expect(stats.totalInputTokens).toBe(2300);
      expect(stats.totalOutputTokens).toBe(1100);
    });

    it("LLM-STATS-002: 应该按 provider 分组统计", async () => {
      const stats = await repo.getStats();

      expect(stats.byProvider.anthropic).toBe(2);
      expect(stats.byProvider.openai).toBe(1);
    });

    it("LLM-STATS-003: 应该按 model 分组统计", async () => {
      const stats = await repo.getStats();

      expect(stats.byModel["claude-3-opus"]).toBe(1);
      expect(stats.byModel["claude-3-sonnet"]).toBe(1);
      expect(stats.byModel["gpt-4o"]).toBe(1);
    });

    it("LLM-STATS-004: 空数据应返回零值", async () => {
      clearMockDatabase();

      const stats = await repo.getStats();

      expect(stats.totalCalls).toBe(0);
      expect(stats.successCalls).toBe(0);
      expect(stats.errorCalls).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
    });
  });

  // ==================== cleanup 测试 ====================

  describe("cleanup", () => {
    it("LLM-CLEANUP-001: 应该清理指定时间之前的日志", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40天前
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1天前

      await repo.insertBatch([
        {
          provider: "anthropic",
          model: "claude-3-opus",
          status: "success" as const,
          calledAt: oldDate,
          durationMs: 1000,
        },
        {
          provider: "anthropic",
          model: "claude-3-opus",
          status: "success" as const,
          calledAt: oldDate,
          durationMs: 1000,
        },
        {
          provider: "anthropic",
          model: "claude-3-opus",
          status: "success" as const,
          calledAt: recentDate,
          durationMs: 1000,
        },
        {
          provider: "anthropic",
          model: "claude-3-opus",
          status: "success" as const,
          calledAt: now,
          durationMs: 1000,
        },
      ]);

      /** 清理 30 天前的日志 */
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await repo.cleanup(cutoff);

      expect(deleted).toBe(2);

      const remaining = await repo.query({ limit: 10 });
      expect(remaining.total).toBe(2);
    });

    it("LLM-CLEANUP-002: 无过期日志时应返回 0", async () => {
      const now = new Date();
      await repo.insert({
        provider: "anthropic",
        model: "claude-3-opus",
        status: "success",
        calledAt: now,
        durationMs: 1000,
      });

      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await repo.cleanup(cutoff);

      expect(deleted).toBe(0);
    });
  });
});
