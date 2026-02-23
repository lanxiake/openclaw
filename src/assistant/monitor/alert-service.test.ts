/**
 * AlertService 测试
 *
 * 测试告警服务的 CRUD、风险集成、资源告警创建
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import { AlertService, getAlertService } from "./alert-service.js";

describe("AlertService", () => {
  let alertService: AlertService;

  beforeEach(() => {
    console.log("[TEST] ========== AlertService测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    alertService = getAlertService(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AlertService测试结束 ==========\n");
    disableMockDatabase();
    vi.restoreAllMocks();
  });

  describe("listAlerts", () => {
    it("ALERT-SVC-001: 应返回空告警列表", async () => {
      console.log("[TEST] ========== ALERT-SVC-001 ==========");

      const result = await alertService.listAlerts({});

      expect(result.alerts).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.unacknowledged).toBe(0);
    });

    it("ALERT-SVC-002: 应创建并列出告警", async () => {
      console.log("[TEST] ========== ALERT-SVC-002 ==========");

      await alertService.createResourceAlert({
        type: "cpu",
        severity: "warning",
        title: "CPU 使用率过高",
        message: "CPU 使用率达到 90%",
        source: "monitor",
        metadata: { usage: 90 },
      });

      const result = await alertService.listAlerts({});

      expect(result.alerts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unacknowledged).toBe(1);

      const alert = result.alerts[0];
      expect(alert.type).toBe("cpu");
      expect(alert.severity).toBe("warning");
      expect(alert.title).toBe("CPU 使用率过高");
      expect(alert.acknowledged).toBe(false);
      expect(alert.resolved).toBe(false);
      // 前端格式：timestamp 为 ISO 字符串
      expect(alert.timestamp).toBeTruthy();
    });

    it("ALERT-SVC-003: 应按 acknowledged 过滤", async () => {
      console.log("[TEST] ========== ALERT-SVC-003 ==========");

      // 创建 2 条告警
      await alertService.createResourceAlert({
        type: "cpu",
        severity: "warning",
        title: "CPU告警",
        message: "高",
        source: "monitor",
      });
      const alert2 = await alertService.createResourceAlert({
        type: "memory",
        severity: "critical",
        title: "内存告警",
        message: "高",
        source: "monitor",
      });

      // 确认第二条
      await alertService.acknowledgeAlert(alert2.id, "admin");

      const unackResult = await alertService.listAlerts({ acknowledged: false });
      const ackResult = await alertService.listAlerts({ acknowledged: true });

      expect(unackResult.total).toBe(1);
      expect(ackResult.total).toBe(1);
    });
  });

  describe("acknowledgeAlert", () => {
    it("ALERT-SVC-004: 应确认告警", async () => {
      console.log("[TEST] ========== ALERT-SVC-004 ==========");

      const created = await alertService.createResourceAlert({
        type: "disk",
        severity: "warning",
        title: "磁盘告警",
        message: "磁盘使用率高",
        source: "monitor",
      });

      await alertService.acknowledgeAlert(created.id, "管理员");

      const result = await alertService.listAlerts({ acknowledged: true });
      expect(result.total).toBe(1);
      expect(result.alerts[0].acknowledged).toBe(true);
      expect(result.alerts[0].acknowledgedBy).toBe("管理员");
      expect(result.alerts[0].acknowledgedAt).toBeTruthy();
    });
  });

  describe("resolveAlert", () => {
    it("ALERT-SVC-005: 应解决告警", async () => {
      console.log("[TEST] ========== ALERT-SVC-005 ==========");

      const created = await alertService.createResourceAlert({
        type: "api_error",
        severity: "critical",
        title: "API 错误",
        message: "错误率升高",
        source: "api-monitor",
      });

      await alertService.resolveAlert(created.id);

      const result = await alertService.listAlerts({ resolved: true });
      expect(result.total).toBe(1);
      expect(result.alerts[0].resolved).toBe(true);
      expect(result.alerts[0].resolvedAt).toBeTruthy();
    });
  });

  describe("handleRiskAlert", () => {
    it("ALERT-SVC-006: 应将 RiskAlert 持久化为 system_alert", async () => {
      console.log("[TEST] ========== ALERT-SVC-006 ==========");

      // 模拟 RiskAlert
      await alertService.handleRiskAlert({
        id: "alert_test_001",
        timestamp: new Date().toISOString(),
        riskLevel: "high",
        score: 85,
        category: "security",
        action: "brute_force_attempt",
        userId: "user-001",
        ipAddress: "10.0.0.1",
        reason: "多次登录失败，疑似暴力破解",
        factors: ["login_failures", "unusual_ip"],
        details: { failureCount: 10 },
      });

      const result = await alertService.listAlerts({});

      expect(result.alerts).toHaveLength(1);

      const alert = result.alerts[0];
      // high → warning severity
      expect(alert.severity).toBe("warning");
      expect(alert.source).toBe("risk-evaluator");
      expect(alert.message).toBe("多次登录失败，疑似暴力破解");
      expect(alert.metadata).toBeDefined();
      expect(alert.metadata?.riskScore).toBe(85);
      expect(alert.metadata?.userId).toBe("user-001");
    });

    it("ALERT-SVC-007: critical RiskAlert → critical severity", async () => {
      console.log("[TEST] ========== ALERT-SVC-007 ==========");

      await alertService.handleRiskAlert({
        id: "alert_test_002",
        timestamp: new Date().toISOString(),
        riskLevel: "critical",
        score: 95,
        category: "auth",
        action: "token_stolen",
        reason: "令牌被盗用",
        factors: ["token_reuse"],
      });

      const result = await alertService.listAlerts({});

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe("critical");
    });
  });

  describe("createResourceAlert", () => {
    it("ALERT-SVC-008: 应创建资源告警并返回前端格式", async () => {
      console.log("[TEST] ========== ALERT-SVC-008 ==========");

      const alert = await alertService.createResourceAlert({
        type: "memory",
        severity: "critical",
        title: "内存使用率严重过高",
        message: "服务器内存使用率已达 95%",
        source: "monitor-service",
        metadata: { usagePercent: 95, totalGB: 16 },
      });

      console.log("[TEST] 创建的告警:", JSON.stringify(alert, null, 2));

      expect(alert.id).toBeTruthy();
      expect(alert.type).toBe("memory");
      expect(alert.severity).toBe("critical");
      expect(alert.timestamp).toBeTruthy();
      expect(alert.acknowledged).toBe(false);
      expect(alert.resolved).toBe(false);
    });
  });
});
