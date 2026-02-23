/**
 * MetricsCollector 单元测试
 *
 * 测试指标采集、定时调度、数据清理和错误处理
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricsCollector, createMetricsCollector } from "./metrics-collector.js";
import type { ResourceDataProvider } from "./metrics-collector.js";

/**
 * 创建模拟的资源数据
 */
function createMockResources(overrides?: Partial<ResourceDataProvider>): ResourceDataProvider {
  return {
    cpu: { usage: overrides?.cpu?.usage ?? 45.2 },
    memory: { usagePercent: overrides?.memory?.usagePercent ?? 62.8 },
    disk: { usagePercent: overrides?.disk?.usagePercent ?? 71.5 },
    process: { memoryUsage: overrides?.process?.memoryUsage ?? 150_000_000 },
  };
}

/**
 * 创建 Mock Repository
 */
function createMockRepository() {
  const insertedMetrics: unknown[] = [];

  return {
    insert: vi.fn(async (metric: unknown) => {
      insertedMetrics.push(metric);
    }),
    cleanup: vi.fn(async (_days: number) => 5),
    getTimeseries: vi.fn(async () => []),
    getLatest: vi.fn(async () => null),
    insertedMetrics,
  };
}

/**
 * 创建 Mock LogsRepository
 */
function createMockLogsRepository() {
  return {
    cleanup: vi.fn(async (_days: number) => 3),
  };
}

describe("MetricsCollector", () => {
  let collector: MetricsCollector;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockGetResources: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRepo = createMockRepository();
    mockGetResources = vi.fn(async () => createMockResources());
  });

  afterEach(() => {
    collector?.stop();
    vi.useRealTimers();
  });

  describe("基本功能", () => {
    it("MC-001: start 应该立即采集一次指标", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 60_000,
      });

      collector.start();

      /** 等待异步 collectAndStore 完成 */
      await vi.advanceTimersByTimeAsync(100);

      expect(mockGetResources).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });

    it("MC-002: start 后 isRunning 应该返回 true", () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      expect(collector.isRunning).toBe(false);
      collector.start();
      expect(collector.isRunning).toBe(true);
    });

    it("MC-003: stop 后 isRunning 应该返回 false", () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      collector.start();
      expect(collector.isRunning).toBe(true);

      collector.stop();
      expect(collector.isRunning).toBe(false);
    });

    it("MC-004: 重复调用 start 不应重复启动", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 60_000,
      });

      collector.start();
      collector.start();

      await vi.advanceTimersByTimeAsync(100);

      /** 只应采集一次 (第一次 start 的立即采集) */
      expect(mockGetResources).toHaveBeenCalledTimes(1);
    });

    it("MC-005: 未启动时调用 stop 不应报错", () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      expect(() => collector.stop()).not.toThrow();
    });
  });

  describe("定时采集", () => {
    it("MC-006: 应该按配置的间隔定时采集", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 5_000,
      });

      collector.start();

      /** 初始采集 */
      await vi.advanceTimersByTimeAsync(100);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);

      /** 第一个间隔 */
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockRepo.insert).toHaveBeenCalledTimes(2);

      /** 第二个间隔 */
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockRepo.insert).toHaveBeenCalledTimes(3);
    });

    it("MC-007: stop 后应该停止定时采集", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 5_000,
      });

      collector.start();
      await vi.advanceTimersByTimeAsync(100);

      collector.stop();

      /** 推进时间后不应有新的采集 */
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("数据采集格式", () => {
    it("MC-008: 应该正确转换资源数据格式", async () => {
      const resources = createMockResources({
        cpu: { usage: 85.3 },
        memory: { usagePercent: 72.1 },
        disk: { usagePercent: 55.0 },
        process: { memoryUsage: 200_000_000 },
      });

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: vi.fn(async () => resources),
        getActiveConnections: () => 42,
        intervalMs: 60_000,
      });

      collector.start();
      await vi.advanceTimersByTimeAsync(100);

      const inserted = mockRepo.insertedMetrics[0] as Record<string, unknown>;
      expect(inserted.metricType).toBe("system");
      expect(inserted.cpuUsage).toBe("85.3");
      expect(inserted.memoryUsage).toBe("72.1");
      expect(inserted.diskUsage).toBe("55");
      expect(inserted.activeConnections).toBe(42);
      expect(inserted.heapUsed).toBe(200_000_000);
      expect(inserted.requestCount).toBe(0);
      expect(inserted.errorCount).toBe(0);
      expect(inserted.avgResponseTime).toBe(0);
    });

    it("MC-009: 未提供 getActiveConnections 时默认为 0", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      collector.start();
      await vi.advanceTimersByTimeAsync(100);

      const inserted = mockRepo.insertedMetrics[0] as Record<string, unknown>;
      expect(inserted.activeConnections).toBe(0);
    });

    it("MC-010: 每次采集应该生成唯一 ID 和时间戳", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 1_000,
      });

      collector.start();
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(mockRepo.insertedMetrics.length).toBe(2);

      const first = mockRepo.insertedMetrics[0] as Record<string, unknown>;
      const second = mockRepo.insertedMetrics[1] as Record<string, unknown>;

      expect(first.id).toBeDefined();
      expect(second.id).toBeDefined();
      expect(first.id).not.toBe(second.id);
      expect(first.timestamp).toBeInstanceOf(Date);
      expect(second.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("数据清理", () => {
    it("MC-011: performCleanup 应该清理旧指标数据", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        retentionDays: 15,
      });

      await collector.performCleanup();

      expect(mockRepo.cleanup).toHaveBeenCalledWith(15);
    });

    it("MC-012: performCleanup 应该同时清理旧日志", async () => {
      const mockLogsRepo = createMockLogsRepository();

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        retentionDays: 30,
        logRetentionDays: 7,
        logsRepository: mockLogsRepo,
      });

      await collector.performCleanup();

      expect(mockRepo.cleanup).toHaveBeenCalledWith(30);
      expect(mockLogsRepo.cleanup).toHaveBeenCalledWith(7);
    });

    it("MC-013: 未提供 logsRepository 时不应清理日志", async () => {
      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      /** 不应抛错 */
      await expect(collector.performCleanup()).resolves.toBeUndefined();
      expect(mockRepo.cleanup).toHaveBeenCalledTimes(1);
    });

    it("MC-014: 使用默认保留天数 (指标30天, 日志7天)", async () => {
      const mockLogsRepo = createMockLogsRepository();

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        logsRepository: mockLogsRepo,
      });

      await collector.performCleanup();

      expect(mockRepo.cleanup).toHaveBeenCalledWith(30);
      expect(mockLogsRepo.cleanup).toHaveBeenCalledWith(7);
    });
  });

  describe("错误处理", () => {
    it("MC-015: 资源获取失败不应阻塞后续采集", async () => {
      const failingGetResources = vi
        .fn()
        .mockRejectedValueOnce(new Error("获取 CPU 信息失败"))
        .mockResolvedValueOnce(createMockResources());

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: failingGetResources,
        intervalMs: 1_000,
      });

      collector.start();

      /** 第一次采集失败 */
      await vi.advanceTimersByTimeAsync(100);
      expect(failingGetResources).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).not.toHaveBeenCalled();

      /** 第二次采集应该成功 */
      await vi.advanceTimersByTimeAsync(1_000);
      expect(failingGetResources).toHaveBeenCalledTimes(2);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });

    it("MC-016: 数据库写入失败不应阻塞后续采集", async () => {
      mockRepo.insert
        .mockRejectedValueOnce(new Error("DB 连接断开"))
        .mockResolvedValueOnce(undefined);

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
        intervalMs: 1_000,
      });

      collector.start();

      /** 第一次写入失败 */
      await vi.advanceTimersByTimeAsync(100);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);

      /** 第二次写入应该成功 */
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockRepo.insert).toHaveBeenCalledTimes(2);
    });

    it("MC-017: 清理失败不应影响下次清理", async () => {
      mockRepo.cleanup.mockRejectedValueOnce(new Error("清理超时")).mockResolvedValueOnce(10);

      collector = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      /** 第一次清理失败 */
      await expect(collector.performCleanup()).resolves.toBeUndefined();

      /** 第二次清理应该成功 */
      await expect(collector.performCleanup()).resolves.toBeUndefined();
      expect(mockRepo.cleanup).toHaveBeenCalledTimes(2);
    });
  });

  describe("工厂函数", () => {
    it("MC-018: createMetricsCollector 应该返回有效实例", () => {
      const instance = createMetricsCollector({
        repository: mockRepo as never,
        getResources: mockGetResources,
      });

      expect(instance).toBeInstanceOf(MetricsCollector);
      expect(instance.isRunning).toBe(false);
    });
  });
});
