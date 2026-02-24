/**
 * MemoryAuditRepository 测试
 *
 * 测试记忆审计日志的写入、查询、按用户/会话过滤
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { MemoryAuditRepository, getMemoryAuditRepository } from "./memory-audit.js";

describe("MemoryAuditRepository", () => {
  let repo: MemoryAuditRepository;
  const testUserId = "user-audit-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== MemoryAuditRepository 测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getMemoryAuditRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== MemoryAuditRepository 测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("log", () => {
    it("AUDIT-LOG-001: 应成功写入审计日志", async () => {
      console.log("[TEST] AUDIT-LOG-001: 写入审计日志");

      const log = await repo.log({
        userId: testUserId,
        action: "add_fact",
        source: "agent",
        targetId: "fact-001",
        sessionId: "session-001",
        agentId: "agent-001",
        details: {
          category: "personal",
          after: "birthday: 1990-05-01",
        },
      });

      console.log("[TEST] 日志 ID:", log.id);
      console.log("[TEST] 操作:", log.action);
      console.log("[TEST] 来源:", log.source);

      expect(log.id).toBeTruthy();
      expect(log.userId).toBe(testUserId);
      expect(log.action).toBe("add_fact");
      expect(log.source).toBe("agent");
      expect(log.targetId).toBe("fact-001");
      expect(log.sessionId).toBe("session-001");
      expect(log.createdAt).toBeInstanceOf(Date);

      console.log("[TEST] ✓ 审计日志写入成功");
    });

    it("AUDIT-LOG-002: 应写入最小字段的日志", async () => {
      console.log("[TEST] AUDIT-LOG-002: 最小字段日志");

      const log = await repo.log({
        userId: testUserId,
        action: "system_load",
        source: "system",
      });

      expect(log.id).toBeTruthy();
      expect(log.userId).toBe(testUserId);
      expect(log.action).toBe("system_load");
      expect(log.source).toBe("system");
      expect(log.targetId).toBeUndefined();
      expect(log.sessionId).toBeUndefined();

      console.log("[TEST] ✓ 最小字段日志写入成功");
    });

    it("AUDIT-LOG-003: 应写入管理员操作日志", async () => {
      console.log("[TEST] AUDIT-LOG-003: 管理员操作日志");

      const log = await repo.log({
        userId: testUserId,
        action: "update_fact",
        source: "admin",
        targetId: "fact-002",
        adminId: "admin-001",
        details: {
          before: "value: old",
          after: "value: new",
        },
      });

      expect(log.source).toBe("admin");
      expect(log.adminId).toBe("admin-001");
      expect(log.details?.before).toBe("value: old");
      expect(log.details?.after).toBe("value: new");

      console.log("[TEST] ✓ 管理员操作日志写入成功");
    });
  });

  describe("findByUser", () => {
    it("AUDIT-FIND-001: 应按用户 ID 查询日志", async () => {
      console.log("[TEST] AUDIT-FIND-001: 按用户查询");

      await repo.log({ userId: testUserId, action: "add_fact", source: "agent" });
      await repo.log({ userId: testUserId, action: "read_profile", source: "system" });
      await repo.log({ userId: "other-user", action: "add_fact", source: "agent" });

      const result = await repo.findByUser(testUserId);

      console.log("[TEST] 日志数量:", result.logs.length);

      expect(result.logs.length).toBe(2);
      expect(result.logs.every((l) => l.userId === testUserId)).toBe(true);

      console.log("[TEST] ✓ 按用户查询正常");
    });

    it("AUDIT-FIND-002: 应支持按操作类型过滤", async () => {
      console.log("[TEST] AUDIT-FIND-002: 按操作类型过滤");

      await repo.log({ userId: testUserId, action: "add_fact", source: "agent" });
      await repo.log({ userId: testUserId, action: "read_profile", source: "system" });
      await repo.log({ userId: testUserId, action: "add_fact", source: "agent" });

      const result = await repo.findByUser(testUserId, { action: "add_fact" });

      console.log("[TEST] add_fact 日志数:", result.logs.length);

      expect(result.logs.length).toBe(2);
      expect(result.logs.every((l) => l.action === "add_fact")).toBe(true);

      console.log("[TEST] ✓ 按操作类型过滤正常");
    });

    it("AUDIT-FIND-003: 应支持分页", async () => {
      console.log("[TEST] AUDIT-FIND-003: 分页测试");

      for (let i = 0; i < 5; i++) {
        await repo.log({ userId: testUserId, action: "add_fact", source: "agent" });
      }

      const page1 = await repo.findByUser(testUserId, { limit: 2, offset: 0 });
      const page2 = await repo.findByUser(testUserId, { limit: 2, offset: 2 });

      console.log("[TEST] 第一页:", page1.logs.length);
      console.log("[TEST] 第二页:", page2.logs.length);
      console.log("[TEST] 总数:", page1.total);

      expect(page1.logs.length).toBe(2);
      expect(page2.logs.length).toBe(2);
      expect(page1.total).toBe(5);

      console.log("[TEST] ✓ 分页正常");
    });
  });

  describe("findBySession", () => {
    it("AUDIT-SESSION-001: 应按会话 ID 查询日志", async () => {
      console.log("[TEST] AUDIT-SESSION-001: 按会话查询");

      await repo.log({
        userId: testUserId,
        action: "add_fact",
        source: "agent",
        sessionId: "session-A",
      });
      await repo.log({
        userId: testUserId,
        action: "read_facts",
        source: "agent",
        sessionId: "session-A",
      });
      await repo.log({
        userId: testUserId,
        action: "add_fact",
        source: "agent",
        sessionId: "session-B",
      });

      const result = await repo.findBySession("session-A");

      console.log("[TEST] session-A 日志数:", result.length);

      expect(result.length).toBe(2);
      expect(result.every((l) => l.sessionId === "session-A")).toBe(true);

      console.log("[TEST] ✓ 按会话查询正常");
    });
  });
});
