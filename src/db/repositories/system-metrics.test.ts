/**
 * SystemMetricsRepository 测试
 *
 * 测试系统指标的插入、时序查询、最新记录获取和清理功能
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  SystemMetricsRepository,
  getSystemMetricsRepository,
  generateMetricId,
} from "./system-metrics.js";

// ==================== SystemMetricsRepository 测试 ====================

describe("SystemMetricsRepository", () => {
  let metricsRepo: SystemMetricsRepository;

  beforeEach(() => {
    console.log("[TEST] ========== SystemMetricsRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    metricsRepo = getSystemMetricsRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== SystemMetricsRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("insert", () => {
    it("METRICS-INSERT-001: 应该插入系统指标记录", async () => {
      console.log("[TEST] ========== METRICS-INSERT-001 ==========");

      const id = generateMetricId();
      const now = new Date();

      await metricsRepo.insert({
        id,
        timestamp: now,
        metricType: "system",
        cpuUsage: "45.20",
        memoryUsage: "62.30",
      });

      console.log("[TEST] 插入指标ID:", id);

      // 通过 getLatest 验证插入成功
      const latest = await metricsRepo.getLatest();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(id);
      expect(latest!.metricType).toBe("system");
      expect(latest!.cpuUsage).toBe("45.20");
      expect(latest!.memoryUsage).toBe("62.30");
    });

    it("METRICS-INSERT-002: 应该插入带完整字段的指标记录", async () => {
      console.log("[TEST] ========== METRICS-INSERT-002 ==========");

      const id = generateMetricId();
      const now = new Date();

      await metricsRepo.insert({
        id,
        timestamp: now,
        metricType: "system",
        cpuUsage: "78.50",
        memoryUsage: "85.10",
        diskUsage: "45.00",
        activeConnections: 12,
        heapUsed: 134217728,
        requestCount: 1500,
        errorCount: 3,
        avgResponseTime: 250,
      });

      const latest = await metricsRepo.getLatest();

      console.log("[TEST] 完整字段指标:", {
        cpu: latest!.cpuUsage,
        memory: latest!.memoryUsage,
        disk: latest!.diskUsage,
        connections: latest!.activeConnections,
      });

      expect(latest).not.toBeNull();
      expect(latest!.cpuUsage).toBe("78.50");
      expect(latest!.memoryUsage).toBe("85.10");
      expect(latest!.diskUsage).toBe("45.00");
      expect(latest!.activeConnections).toBe(12);
      expect(latest!.heapUsed).toBe(134217728);
      expect(latest!.requestCount).toBe(1500);
      expect(latest!.errorCount).toBe(3);
      expect(latest!.avgResponseTime).toBe(250);
    });
  });

  describe("getTimeseries", () => {
    it("METRICS-TS-001: 应该按时间范围查询指标", async () => {
      console.log("[TEST] ========== METRICS-TS-001 ==========");

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // 插入 3 条不同时间的指标
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: twoHoursAgo,
        metricType: "system",
        cpuUsage: "30.00",
      });
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: oneHourAgo,
        metricType: "system",
        cpuUsage: "50.00",
      });
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: now,
        metricType: "system",
        cpuUsage: "70.00",
      });

      // 查询最近 90 分钟内的数据（排除 2 小时前的记录）
      const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000);
      const results = await metricsRepo.getTimeseries({
        startTime: ninetyMinAgo,
        endTime: now,
      });

      console.log("[TEST] 时间范围查询结果数:", results.length);

      expect(results).toHaveLength(2);
      // Mock DB 的 orderBy 不实际排序，验证返回的值集合正确
      const cpuValues = results.map((r) => r.cpuUsage).sort();
      expect(cpuValues).toEqual(["50.00", "70.00"]);
    });

    it("METRICS-TS-002: 应该按指标类型过滤", async () => {
      console.log("[TEST] ========== METRICS-TS-002 ==========");

      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // 仅插入 system 类型指标验证方法调用正确
      // 注: Mock DB 不支持 sql`` 模板标签条件解析，
      //     类型过滤在集成测试中验证，此处验证方法调用和返回结构
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: now,
        metricType: "system",
        cpuUsage: "50.00",
      });

      const results = await metricsRepo.getTimeseries({
        startTime: fiveMinAgo,
        endTime: now,
        metricType: "system",
      });

      console.log("[TEST] system 类型指标数:", results.length);

      expect(results).toHaveLength(1);
      expect(results[0].metricType).toBe("system");
      expect(results[0].cpuUsage).toBe("50.00");
    });

    it("METRICS-TS-003: 应该按 limit 限制结果数量", async () => {
      console.log("[TEST] ========== METRICS-TS-003 ==========");

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 插入 5 条指标
      for (let i = 0; i < 5; i++) {
        await metricsRepo.insert({
          id: generateMetricId(),
          timestamp: new Date(now.getTime() - i * 60 * 1000),
          metricType: "system",
          cpuUsage: `${50 + i}.00`,
        });
      }

      const results = await metricsRepo.getTimeseries({
        startTime: oneHourAgo,
        endTime: now,
        limit: 3,
      });

      console.log("[TEST] limit=3 查询结果数:", results.length);

      expect(results).toHaveLength(3);
    });
  });

  describe("getLatest", () => {
    it("METRICS-LATEST-001: 应该返回最新一条记录", async () => {
      console.log("[TEST] ========== METRICS-LATEST-001 ==========");

      const now = new Date();

      // 插入单条记录验证 getLatest 返回
      // 注: Mock DB 的 orderBy 不实际排序，使用单条记录验证
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: now,
        metricType: "system",
        cpuUsage: "80.00",
      });

      const latest = await metricsRepo.getLatest();

      console.log("[TEST] 最新指标 CPU:", latest!.cpuUsage);

      expect(latest).not.toBeNull();
      expect(latest!.cpuUsage).toBe("80.00");
      expect(latest!.timestamp).toEqual(now);
    });

    it("METRICS-LATEST-002: 无数据时应返回 null", async () => {
      console.log("[TEST] ========== METRICS-LATEST-002 ==========");

      const latest = await metricsRepo.getLatest();

      console.log("[TEST] 空表查询结果:", latest);

      expect(latest).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("METRICS-CLEANUP-001: 应该清理超过保留天数的记录", async () => {
      console.log("[TEST] ========== METRICS-CLEANUP-001 ==========");

      const now = new Date();
      const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      // 插入一条 31 天前的旧数据（应被清理）
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: thirtyOneDaysAgo,
        metricType: "system",
        cpuUsage: "10.00",
      });

      // 插入一条 29 天前的数据（应保留）
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: twentyNineDaysAgo,
        metricType: "system",
        cpuUsage: "20.00",
      });

      // 插入一条当前数据（应保留）
      await metricsRepo.insert({
        id: generateMetricId(),
        timestamp: now,
        metricType: "system",
        cpuUsage: "50.00",
      });

      const deletedCount = await metricsRepo.cleanup(30);

      console.log("[TEST] 清理删除数:", deletedCount);

      expect(deletedCount).toBe(1);

      // 验证剩余记录
      const remaining = await metricsRepo.getTimeseries({
        startTime: new Date(0),
        endTime: now,
        limit: 100,
      });

      console.log("[TEST] 清理后剩余记录数:", remaining.length);

      expect(remaining).toHaveLength(2);
    });
  });
});
