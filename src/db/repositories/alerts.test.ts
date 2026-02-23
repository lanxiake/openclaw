/**
 * AlertRepository 测试
 *
 * 测试系统告警的 CRUD 操作、过滤查询、确认/解决功能
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { AlertRepository, getAlertRepository } from "./alerts.js";

// ==================== AlertRepository 测试 ====================

describe("AlertRepository", () => {
  let alertRepo: AlertRepository;

  beforeEach(() => {
    console.log("[TEST] ========== AlertRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    alertRepo = getAlertRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AlertRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("ALERT-CREATE-001: 应该创建告警记录", async () => {
      console.log("[TEST] ========== ALERT-CREATE-001 ==========");

      const alert = await alertRepo.create({
        type: "memory",
        severity: "warning",
        title: "内存使用率过高",
        message: "服务器内存使用率已达到 85%",
        source: "monitor",
      });

      console.log("[TEST] 告警ID:", alert.id);
      console.log("[TEST] 告警类型:", alert.type);

      expect(alert.id).toBeTruthy();
      expect(alert.type).toBe("memory");
      expect(alert.severity).toBe("warning");
      expect(alert.title).toBe("内存使用率过高");
      expect(alert.message).toBe("服务器内存使用率已达到 85%");
      expect(alert.source).toBe("monitor");
      expect(alert.acknowledged).toBe(false);
      expect(alert.resolved).toBe(false);
      expect(alert.createdAt).toBeInstanceOf(Date);
    });

    it("ALERT-CREATE-002: 应该支持 metadata 和 auditLogId", async () => {
      console.log("[TEST] ========== ALERT-CREATE-002 ==========");

      const alert = await alertRepo.create({
        type: "api_error",
        severity: "critical",
        title: "API 错误率过高",
        message: "过去 5 分钟内 API 错误率达到 15%",
        source: "api-monitor",
        auditLogId: "audit-log-001",
        metadata: { errorRate: 0.15, threshold: 0.05 },
      });

      expect(alert.auditLogId).toBe("audit-log-001");
      expect(alert.metadata).toEqual({ errorRate: 0.15, threshold: 0.05 });
    });
  });

  describe("query", () => {
    it("ALERT-QUERY-001: 应该返回所有告警（分页）", async () => {
      console.log("[TEST] ========== ALERT-QUERY-001 ==========");

      // 创建 3 条告警
      await alertRepo.create({
        type: "memory",
        severity: "warning",
        title: "告警1",
        message: "消息1",
        source: "monitor",
      });
      await alertRepo.create({
        type: "cpu",
        severity: "critical",
        title: "告警2",
        message: "消息2",
        source: "monitor",
      });
      await alertRepo.create({
        type: "disk",
        severity: "info",
        title: "告警3",
        message: "消息3",
        source: "monitor",
      });

      const result = await alertRepo.query({ limit: 10 });

      console.log("[TEST] 告警总数:", result.total);
      console.log("[TEST] 未确认数:", result.unacknowledged);

      expect(result.total).toBe(3);
      expect(result.alerts).toHaveLength(3);
      expect(result.unacknowledged).toBe(3);
    });

    it("ALERT-QUERY-002: 应该按 severity 过滤", async () => {
      console.log("[TEST] ========== ALERT-QUERY-002 ==========");

      await alertRepo.create({
        type: "memory",
        severity: "warning",
        title: "警告",
        message: "警告消息",
        source: "monitor",
      });
      await alertRepo.create({
        type: "cpu",
        severity: "critical",
        title: "严重",
        message: "严重消息",
        source: "monitor",
      });

      const result = await alertRepo.query({ severity: "critical" });

      expect(result.total).toBe(1);
      expect(result.alerts[0].severity).toBe("critical");
    });

    it("ALERT-QUERY-003: 应该按 acknowledged 过滤", async () => {
      console.log("[TEST] ========== ALERT-QUERY-003 ==========");

      const alert1 = await alertRepo.create({
        type: "memory",
        severity: "warning",
        title: "告警1",
        message: "消息",
        source: "monitor",
      });
      await alertRepo.create({
        type: "cpu",
        severity: "critical",
        title: "告警2",
        message: "消息",
        source: "monitor",
      });

      // 确认第一条
      await alertRepo.acknowledge(alert1.id, "admin");

      const unackResult = await alertRepo.query({ acknowledged: false });
      const ackResult = await alertRepo.query({ acknowledged: true });

      expect(unackResult.total).toBe(1);
      expect(ackResult.total).toBe(1);
      expect(ackResult.alerts[0].acknowledgedBy).toBe("admin");
    });
  });

  describe("findById", () => {
    it("ALERT-FIND-001: 应该按 ID 查找告警", async () => {
      console.log("[TEST] ========== ALERT-FIND-001 ==========");

      const created = await alertRepo.create({
        type: "service_down",
        severity: "critical",
        title: "服务不可用",
        message: "Redis 缓存连接失败",
        source: "health-check",
      });

      const found = await alertRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe("服务不可用");
    });

    it("ALERT-FIND-002: 不存在的 ID 应返回 null", async () => {
      console.log("[TEST] ========== ALERT-FIND-002 ==========");

      const found = await alertRepo.findById("nonexistent-id");

      expect(found).toBeNull();
    });
  });

  describe("acknowledge", () => {
    it("ALERT-ACK-001: 应该确认告警", async () => {
      console.log("[TEST] ========== ALERT-ACK-001 ==========");

      const created = await alertRepo.create({
        type: "api_error",
        severity: "warning",
        title: "API 错误",
        message: "错误率升高",
        source: "api-monitor",
      });

      const acked = await alertRepo.acknowledge(created.id, "管理员张三");

      expect(acked).not.toBeNull();
      expect(acked!.acknowledged).toBe(true);
      expect(acked!.acknowledgedBy).toBe("管理员张三");
      expect(acked!.acknowledgedAt).toBeInstanceOf(Date);
    });
  });

  describe("resolve", () => {
    it("ALERT-RESOLVE-001: 应该解决告警", async () => {
      console.log("[TEST] ========== ALERT-RESOLVE-001 ==========");

      const created = await alertRepo.create({
        type: "memory",
        severity: "critical",
        title: "内存告警",
        message: "内存过高",
        source: "monitor",
      });

      const resolved = await alertRepo.resolve(created.id);

      expect(resolved).not.toBeNull();
      expect(resolved!.resolved).toBe(true);
      expect(resolved!.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe("countUnacknowledged", () => {
    it("ALERT-COUNT-001: 应该统计未确认告警数量", async () => {
      console.log("[TEST] ========== ALERT-COUNT-001 ==========");

      await alertRepo.create({
        type: "memory",
        severity: "warning",
        title: "告警1",
        message: "消息",
        source: "monitor",
      });
      const alert2 = await alertRepo.create({
        type: "cpu",
        severity: "critical",
        title: "告警2",
        message: "消息",
        source: "monitor",
      });

      // 确认第二条
      await alertRepo.acknowledge(alert2.id, "admin");

      const count = await alertRepo.countUnacknowledged();

      expect(count).toBe(1);
    });
  });
});
