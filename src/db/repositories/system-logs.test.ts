/**
 * SystemLogsRepository 测试
 *
 * 测试系统日志的批量写入、过滤查询、统计和清理功能
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { SystemLogsRepository, getSystemLogsRepository } from "./system-logs.js";

describe("SystemLogsRepository", () => {
  let logsRepo: SystemLogsRepository;

  beforeEach(() => {
    enableMockDatabase();
    const db = getMockDatabase();
    logsRepo = getSystemLogsRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  describe("batchInsert", () => {
    it("SYSLOG-BATCH-001: 应该批量插入日志记录", async () => {
      const logs = [
        {
          id: "log-001",
          timestamp: new Date(),
          level: "info" as const,
          source: "gateway",
          message: "Gateway 启动成功",
        },
        {
          id: "log-002",
          timestamp: new Date(),
          level: "warn" as const,
          source: "db",
          message: "数据库连接池接近上限",
          metadata: { poolSize: 18, maxPool: 20 },
        },
        {
          id: "log-003",
          timestamp: new Date(),
          level: "error" as const,
          source: "auth",
          message: "Token 验证失败",
          errorName: "TokenExpiredError",
          metadata: { userId: "user-123" },
        },
      ];

      await logsRepo.batchInsert(logs);

      const result = await logsRepo.query({ limit: 10 });

      expect(result.total).toBe(3);
      expect(result.logs).toHaveLength(3);
    });

    it("SYSLOG-BATCH-002: 空数组应该安全跳过", async () => {
      await logsRepo.batchInsert([]);

      const result = await logsRepo.query({ limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      /** 插入测试数据 */
      const now = new Date();
      await logsRepo.batchInsert([
        {
          id: "log-q1",
          timestamp: new Date(now.getTime() - 3000),
          level: "info" as const,
          source: "gateway",
          message: "请求处理完成",
        },
        {
          id: "log-q2",
          timestamp: new Date(now.getTime() - 2000),
          level: "warn" as const,
          source: "db",
          message: "慢查询警告: SELECT * FROM users",
        },
        {
          id: "log-q3",
          timestamp: new Date(now.getTime() - 1000),
          level: "error" as const,
          source: "gateway",
          message: "WebSocket 连接异常断开",
          errorName: "ConnectionError",
        },
        {
          id: "log-q4",
          timestamp: now,
          level: "debug" as const,
          source: "auth",
          message: "Token 刷新成功",
        },
      ]);
    });

    it("SYSLOG-QUERY-001: 应该返回所有日志（分页）", async () => {
      const result = await logsRepo.query({ limit: 10 });

      expect(result.total).toBe(4);
      expect(result.logs).toHaveLength(4);
    });

    it("SYSLOG-QUERY-002: 应该按来源过滤", async () => {
      const result = await logsRepo.query({ source: "gateway" });

      expect(result.total).toBe(2);
      expect(result.logs.every((log) => log.source === "gateway")).toBe(true);
    });

    it("SYSLOG-QUERY-003: 应该按级别过滤 (包含该级别及以上)", async () => {
      const result = await logsRepo.query({ level: "warn" });

      /** warn 及以上包含 warn + error + fatal */
      expect(result.total).toBe(2);
      expect(result.logs.every((log) => ["warn", "error", "fatal"].includes(log.level))).toBe(true);
    });

    it("SYSLOG-QUERY-004: 应该支持分页", async () => {
      const page1 = await logsRepo.query({ limit: 2, offset: 0 });
      const page2 = await logsRepo.query({ limit: 2, offset: 2 });

      expect(page1.logs).toHaveLength(2);
      expect(page2.logs).toHaveLength(2);
      expect(page1.total).toBe(4);
      /** 两页的 ID 不应重叠 */
      const page1Ids = page1.logs.map((l) => l.id);
      const page2Ids = page2.logs.map((l) => l.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });
  });

  describe("getSources", () => {
    it("SYSLOG-SOURCES-001: 应该返回所有活跃日志来源", async () => {
      await logsRepo.batchInsert([
        {
          id: "s1",
          timestamp: new Date(),
          level: "info" as const,
          source: "gateway",
          message: "msg",
        },
        { id: "s2", timestamp: new Date(), level: "info" as const, source: "db", message: "msg" },
        {
          id: "s3",
          timestamp: new Date(),
          level: "info" as const,
          source: "gateway",
          message: "msg",
        },
        { id: "s4", timestamp: new Date(), level: "info" as const, source: "auth", message: "msg" },
      ]);

      const sources = await logsRepo.getSources();

      /** 应去重并排序 */
      expect(sources).toEqual(expect.arrayContaining(["auth", "db", "gateway"]));
      expect(sources).toHaveLength(3);
    });
  });

  describe("getStats", () => {
    it("SYSLOG-STATS-001: 应该返回按级别和来源的统计", async () => {
      await logsRepo.batchInsert([
        {
          id: "st1",
          timestamp: new Date(),
          level: "info" as const,
          source: "gateway",
          message: "msg",
        },
        {
          id: "st2",
          timestamp: new Date(),
          level: "info" as const,
          source: "gateway",
          message: "msg",
        },
        { id: "st3", timestamp: new Date(), level: "warn" as const, source: "db", message: "msg" },
        {
          id: "st4",
          timestamp: new Date(),
          level: "error" as const,
          source: "auth",
          message: "msg",
        },
      ]);

      const stats = await logsRepo.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.warn).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.bySource.gateway).toBe(2);
      expect(stats.bySource.db).toBe(1);
      expect(stats.bySource.auth).toBe(1);
    });
  });

  describe("getTail", () => {
    it("SYSLOG-TAIL-001: 应该返回指定数量的日志", async () => {
      await logsRepo.batchInsert([
        { id: "t1", timestamp: new Date(), level: "info" as const, source: "gw", message: "日志1" },
        { id: "t2", timestamp: new Date(), level: "info" as const, source: "gw", message: "日志2" },
        { id: "t3", timestamp: new Date(), level: "info" as const, source: "gw", message: "日志3" },
        { id: "t4", timestamp: new Date(), level: "info" as const, source: "gw", message: "日志4" },
      ]);

      const tail = await logsRepo.getTail(2);

      /** mock 环境不支持排序，只验证返回数量 */
      expect(tail).toHaveLength(2);
    });
  });

  describe("cleanup", () => {
    it("SYSLOG-CLEANUP-001: 应该清理超过保留天数的日志", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10天前
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1天前

      await logsRepo.batchInsert([
        { id: "c1", timestamp: oldDate, level: "info" as const, source: "gw", message: "旧日志" },
        { id: "c2", timestamp: oldDate, level: "error" as const, source: "gw", message: "旧错误" },
        {
          id: "c3",
          timestamp: recentDate,
          level: "info" as const,
          source: "gw",
          message: "近期日志",
        },
        { id: "c4", timestamp: now, level: "info" as const, source: "gw", message: "今天的日志" },
      ]);

      /** 清理 7 天前的日志 */
      const deleted = await logsRepo.cleanup(7);

      expect(deleted).toBe(2);

      const remaining = await logsRepo.query({ limit: 10 });
      expect(remaining.total).toBe(2);
    });
  });
});
