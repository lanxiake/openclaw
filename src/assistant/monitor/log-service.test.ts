/**
 * LogService 测试
 *
 * 测试 system_logs 查询、level 过滤、来源过滤、搜索、分页和统计功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import { getSystemLogsRepository } from "../../db/repositories/system-logs.js";
import { LogService, getLogService } from "./log-service.js";

describe("LogService", () => {
  let logService: LogService;

  beforeEach(() => {
    enableMockDatabase();
    const db = getMockDatabase();
    logService = getLogService(db);
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
    vi.restoreAllMocks();
  });

  /**
   * 向 system_logs 表插入测试数据
   */
  async function insertTestLog(overrides: {
    level?: string;
    source?: string;
    message?: string;
    errorName?: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = getMockDatabase();
    const repo = getSystemLogsRepository(db);
    const { generateId } = await import("../../db/utils/id.js");

    await repo.batchInsert([
      {
        id: generateId(),
        timestamp: new Date(),
        level: overrides.level ?? "info",
        source: overrides.source ?? "app",
        message: overrides.message ?? "test message",
        errorName: overrides.errorName,
        metadata: overrides.metadata ?? {},
      },
    ]);
  }

  describe("基本查询", () => {
    it("LOG-QUERY-001: 应返回日志列表", async () => {
      await insertTestLog({ level: "info", source: "gateway", message: "Gateway started" });
      await insertTestLog({ level: "error", source: "agent", message: "Agent failed" });

      const result = await logService.queryLogs({});

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("LOG-QUERY-002: 返回的 LogEntry 格式正确", async () => {
      await insertTestLog({
        level: "warn",
        source: "gateway",
        message: "High memory usage",
        errorName: "MemoryWarning",
        metadata: { pid: 1234 },
      });

      const result = await logService.queryLogs({});
      const log = result.logs[0];

      expect(log.id).toBeTruthy();
      expect(log.timestamp).toBeTruthy();
      expect(log.level).toBe("warn");
      expect(log.source).toBe("gateway");
      expect(log.message).toBe("High memory usage");
      expect(log.metadata).toBeDefined();
      expect(log.metadata?.errorName).toBe("MemoryWarning");
    });
  });

  describe("level 过滤", () => {
    it("LOG-FILTER-001: 应按 level 过滤日志 (>= 指定级别)", async () => {
      await insertTestLog({ level: "info", source: "app", message: "info msg" });
      await insertTestLog({ level: "warn", source: "app", message: "warn msg" });
      await insertTestLog({ level: "error", source: "app", message: "error msg" });

      /** error 级别过滤: 应返回 error (不含 info/warn) */
      const errorResult = await logService.queryLogs({ level: "error" });
      expect(errorResult.logs.every((l) => l.level === "error" || l.level === "fatal")).toBe(true);
      expect(errorResult.total).toBe(1);

      /** warn 级别过滤: 应返回 warn + error */
      const warnResult = await logService.queryLogs({ level: "warn" });
      expect(warnResult.total).toBe(2);

      /** info 级别过滤: 应返回全部 */
      const infoResult = await logService.queryLogs({ level: "info" });
      expect(infoResult.total).toBe(3);
    });
  });

  describe("source 过滤", () => {
    it("LOG-SOURCE-001: 应按 source 过滤日志", async () => {
      await insertTestLog({ level: "info", source: "gateway", message: "gateway msg" });
      await insertTestLog({ level: "info", source: "agent", message: "agent msg" });

      const result = await logService.queryLogs({ source: "gateway" });

      expect(result.logs.every((l) => l.source === "gateway")).toBe(true);
    });
  });

  describe("分页", () => {
    it("LOG-PAGE-001: 应支持分页和 hasMore", async () => {
      /** 创建 5 条日志 */
      for (let i = 0; i < 5; i++) {
        await insertTestLog({ level: "info", source: "app", message: `msg-${i}` });
      }

      /** 第一页: limit=2 */
      const page1 = await logService.queryLogs({ limit: 2, offset: 0 });
      expect(page1.logs).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      /** 最后一页: offset=4 */
      const lastPage = await logService.queryLogs({ limit: 2, offset: 4 });
      expect(lastPage.logs).toHaveLength(1);
      expect(lastPage.hasMore).toBe(false);
    });
  });

  describe("getSources", () => {
    it("LOG-SOURCES-001: 应返回去重后的来源列表", async () => {
      await insertTestLog({ level: "info", source: "gateway", message: "msg1" });
      await insertTestLog({ level: "error", source: "agent", message: "msg2" });
      await insertTestLog({ level: "info", source: "gateway", message: "msg3" });

      const sources = await logService.getSources();

      expect(sources).toContain("gateway");
      expect(sources).toContain("agent");
      expect(sources.length).toBe(2);
    });
  });

  describe("getStats", () => {
    it("LOG-STATS-001: 应返回按级别和来源的统计", async () => {
      await insertTestLog({ level: "info", source: "gateway", message: "msg1" });
      await insertTestLog({ level: "info", source: "gateway", message: "msg2" });
      await insertTestLog({ level: "error", source: "agent", message: "msg3" });

      const stats = await logService.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.bySource.gateway).toBe(2);
      expect(stats.bySource.agent).toBe(1);
    });
  });

  describe("getTail", () => {
    it("LOG-TAIL-001: 应返回最近的日志条目", async () => {
      for (let i = 0; i < 5; i++) {
        await insertTestLog({ level: "info", source: "app", message: `msg-${i}` });
      }

      const logs = await logService.getTail(3);

      expect(logs.length).toBeLessThanOrEqual(3);
      expect(logs[0].level).toBe("info");
      expect(logs[0].source).toBe("app");
    });
  });

  describe("工厂函数", () => {
    it("LOG-FACTORY-001: getLogService 应返回有效实例", () => {
      const service = getLogService();

      expect(service).toBeInstanceOf(LogService);
    });
  });
});
