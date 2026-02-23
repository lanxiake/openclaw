/**
 * DatabaseLogTransport 测试
 *
 * 测试日志批处理、缓冲刷新、队列溢出保护和优雅关闭
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseLogTransport, createDatabaseLogTransport } from "./db-transport.js";

/**
 * 创建 Mock Repository
 */
function createMockRepository() {
  const insertedLogs: unknown[][] = [];

  return {
    batchInsert: vi.fn(async (logs: unknown[]) => {
      insertedLogs.push(logs);
    }),
    insertedLogs,
    /** 获取所有已插入的日志（平铺） */
    getAllLogs: () => insertedLogs.flat(),
  };
}

/**
 * 创建模拟的 tslog LogObj
 */
function createLogObj(
  level: number,
  levelName: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return {
    _meta: {
      logLevelId: level,
      logLevelName: levelName,
      name: "test-module",
      date: new Date(),
    },
    0: message,
    ...extra,
  };
}

describe("DatabaseLogTransport", () => {
  let transport: DatabaseLogTransport;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRepo = createMockRepository();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("基本功能", () => {
    it("DB-TRANSPORT-001: 应该缓冲日志直到达到批量阈值", () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 3,
        flushIntervalMs: 5000,
      });

      /** 添加 2 条日志 (未达到阈值 3) */
      transport.transport(createLogObj(3, "info", "日志1"));
      transport.transport(createLogObj(3, "info", "日志2"));

      expect(transport.queueLength).toBe(2);
      expect(mockRepo.batchInsert).not.toHaveBeenCalled();
    });

    it("DB-TRANSPORT-002: 达到批量阈值时应该自动刷新", async () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 2,
        flushIntervalMs: 5000,
      });

      transport.transport(createLogObj(3, "info", "日志1"));
      transport.transport(createLogObj(3, "info", "日志2"));

      /** 等待异步 flush 完成 */
      await vi.advanceTimersByTimeAsync(100);

      expect(mockRepo.batchInsert).toHaveBeenCalledTimes(1);
      expect(mockRepo.getAllLogs()).toHaveLength(2);
    });

    it("DB-TRANSPORT-003: 定时器到期应该触发刷新", async () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 100,
        flushIntervalMs: 3000,
      });

      transport.transport(createLogObj(3, "info", "日志1"));

      expect(mockRepo.batchInsert).not.toHaveBeenCalled();

      /** 推进时间 3 秒 */
      await vi.advanceTimersByTimeAsync(3100);

      expect(mockRepo.batchInsert).toHaveBeenCalledTimes(1);
      expect(mockRepo.getAllLogs()).toHaveLength(1);
    });
  });

  describe("日志格式转换", () => {
    beforeEach(() => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 1,
        flushIntervalMs: 5000,
      });
    });

    it("DB-TRANSPORT-004: 应该正确提取日志级别", async () => {
      transport.transport(createLogObj(4, "warn", "警告消息"));
      await vi.advanceTimersByTimeAsync(100);

      const logs = mockRepo.getAllLogs() as Array<{ level: string }>;
      expect(logs[0].level).toBe("warn");
    });

    it("DB-TRANSPORT-005: 应该正确提取消息文本", async () => {
      transport.transport(createLogObj(3, "info", "Hello World"));
      await vi.advanceTimersByTimeAsync(100);

      const logs = mockRepo.getAllLogs() as Array<{ message: string }>;
      expect(logs[0].message).toContain("Hello World");
    });

    it("DB-TRANSPORT-006: 应该提取来源模块名", async () => {
      transport.transport(createLogObj(3, "info", "测试消息"));
      await vi.advanceTimersByTimeAsync(100);

      const logs = mockRepo.getAllLogs() as Array<{ source: string }>;
      expect(logs[0].source).toBe("test-module");
    });

    it("DB-TRANSPORT-007: 应该提取错误名称", async () => {
      const error = new Error("测试错误");
      error.name = "TestError";
      transport.transport({
        _meta: { logLevelId: 5, logLevelName: "error", name: "test", date: new Date() },
        0: error,
      });
      await vi.advanceTimersByTimeAsync(100);

      const logs = mockRepo.getAllLogs() as Array<{ errorName?: string }>;
      expect(logs[0].errorName).toBe("TestError");
    });
  });

  describe("级别过滤", () => {
    it("DB-TRANSPORT-008: 应该过滤低于最低级别的日志", async () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 1,
        flushIntervalMs: 5000,
        minLevel: "warn",
      });

      /** trace, debug, info 应该被过滤 */
      transport.transport(createLogObj(1, "trace", "trace消息"));
      transport.transport(createLogObj(2, "debug", "debug消息"));
      transport.transport(createLogObj(3, "info", "info消息"));

      /** warn 及以上应该保留 */
      transport.transport(createLogObj(4, "warn", "warn消息"));
      await vi.advanceTimersByTimeAsync(100);

      expect(mockRepo.getAllLogs()).toHaveLength(1);
      const logs = mockRepo.getAllLogs() as Array<{ level: string }>;
      expect(logs[0].level).toBe("warn");
    });
  });

  describe("队列溢出保护", () => {
    it("DB-TRANSPORT-009: 队列超限时应该丢弃最旧日志", () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 1000,
        flushIntervalMs: 60000,
        maxQueueSize: 10,
      });

      /** 添加 15 条日志（超过 maxQueueSize=10） */
      for (let i = 0; i < 15; i++) {
        transport.transport(createLogObj(3, "info", `日志${i}`));
      }

      /** 队列应该被裁剪到 <= maxQueueSize */
      expect(transport.queueLength).toBeLessThanOrEqual(15);
      expect(transport.queueLength).toBeGreaterThan(0);
    });
  });

  describe("优雅关闭", () => {
    it("DB-TRANSPORT-010: shutdown 应该刷完剩余队列", async () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 100,
        flushIntervalMs: 60000,
      });

      transport.transport(createLogObj(3, "info", "日志1"));
      transport.transport(createLogObj(4, "warn", "日志2"));
      transport.transport(createLogObj(5, "error", "日志3"));

      expect(transport.queueLength).toBe(3);

      await transport.shutdown();

      expect(transport.queueLength).toBe(0);
      expect(mockRepo.batchInsert).toHaveBeenCalled();
      expect(mockRepo.getAllLogs()).toHaveLength(3);
    });

    it("DB-TRANSPORT-011: shutdown 后不再接受新日志", async () => {
      transport = createDatabaseLogTransport({
        repository: mockRepo as never,
        batchSize: 1,
        flushIntervalMs: 5000,
      });

      await transport.shutdown();

      transport.transport(createLogObj(3, "info", "不应写入的日志"));

      expect(transport.queueLength).toBe(0);
    });
  });

  describe("错误处理", () => {
    it("DB-TRANSPORT-012: 数据库写入失败不应阻塞后续日志", async () => {
      const failRepo = {
        batchInsert: vi
          .fn()
          .mockRejectedValueOnce(new Error("DB连接断开"))
          .mockResolvedValueOnce(undefined),
      };

      transport = createDatabaseLogTransport({
        repository: failRepo as never,
        batchSize: 1,
        flushIntervalMs: 5000,
      });

      /** 第一条会触发写入失败 */
      transport.transport(createLogObj(3, "info", "日志1"));
      await vi.advanceTimersByTimeAsync(100);

      /** 第二条应该正常写入 */
      transport.transport(createLogObj(3, "info", "日志2"));
      await vi.advanceTimersByTimeAsync(100);

      expect(failRepo.batchInsert).toHaveBeenCalledTimes(2);
    });
  });
});
