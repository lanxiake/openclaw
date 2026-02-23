/**
 * 告警服务
 *
 * 管理系统告警的创建、查询、确认和解决。
 * 集成 risk-evaluator 的 registerAlertHandler() 将 RiskAlert 持久化为 system_alert。
 * 供 monitor-service 和 admin-monitor RPC 处理器调用。
 *
 * RiskAlert → system_alerts 映射:
 * - riskLevel: high   → severity: warning
 * - riskLevel: critical → severity: critical
 * - category → 映射到 type (security → custom, system → service_down, auth → custom)
 * - reason → message
 * - score/factors/userId/ipAddress → metadata
 */

import type { Database } from "../../db/connection.js";
import type { AlertType, AlertSeverity, SystemAlert } from "../../db/schema/index.js";
import { getAlertRepository, type AlertRepository } from "../../db/repositories/alerts.js";
import type { RiskAlert } from "../audit/risk-evaluator.js";
import type { AuditRiskLevel } from "../../db/schema/audit.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 前端 Alert 格式（匹配 admin-console/types/monitor.ts:178-192）
 */
interface FrontendAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 前端告警列表响应格式
 */
interface AlertListResponse {
  alerts: FrontendAlert[];
  total: number;
  unacknowledged: number;
}

/**
 * riskLevel → severity 映射表
 *
 * high → warning（需要关注但非紧急）
 * critical → critical（紧急需立即处理）
 */
const RISK_TO_SEVERITY: Record<AuditRiskLevel, AlertSeverity> = {
  low: "info",
  medium: "info",
  high: "warning",
  critical: "critical",
};

/**
 * AuditCategory → AlertType 映射表
 */
const CATEGORY_TO_TYPE: Record<string, AlertType> = {
  auth: "custom",
  security: "custom",
  system: "service_down",
  user: "custom",
  device: "custom",
  subscription: "custom",
  payment: "custom",
  skill: "custom",
};

/**
 * 将 SystemAlert 数据库记录转换为前端 Alert 格式
 */
function toFrontendAlert(alert: SystemAlert): FrontendAlert {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    source: alert.source,
    timestamp: alert.createdAt.toISOString(),
    acknowledged: alert.acknowledged,
    acknowledgedBy: alert.acknowledgedBy ?? undefined,
    acknowledgedAt: alert.acknowledgedAt?.toISOString(),
    resolved: alert.resolved,
    resolvedAt: alert.resolvedAt?.toISOString(),
    metadata: (alert.metadata as Record<string, unknown>) ?? undefined,
  };
}

/**
 * 告警服务
 *
 * 提供告警的完整生命周期管理：创建、查询、确认、解决。
 * 可通过 handleRiskAlert() 接收 risk-evaluator 的自动告警。
 */
export class AlertService {
  private alertRepo: AlertRepository;

  constructor(db?: Database) {
    this.alertRepo = getAlertRepository(db);
    logger.debug("[AlertService] 初始化完成");
  }

  /**
   * 处理来自 risk-evaluator 的 RiskAlert
   *
   * 将风险告警持久化到 system_alerts 表，
   * 映射 riskLevel/category 到 severity/type。
   *
   * @param riskAlert - risk-evaluator 发送的告警
   */
  async handleRiskAlert(riskAlert: RiskAlert): Promise<void> {
    logger.info("[AlertService] 接收风险告警", {
      alertId: riskAlert.id,
      riskLevel: riskAlert.riskLevel,
      category: riskAlert.category,
      action: riskAlert.action,
    });

    const severity = RISK_TO_SEVERITY[riskAlert.riskLevel] ?? "info";
    const type: AlertType = CATEGORY_TO_TYPE[riskAlert.category] ?? "custom";

    await this.alertRepo.create({
      type,
      severity,
      title: `[${riskAlert.category}] ${riskAlert.action}`,
      message: riskAlert.reason,
      source: "risk-evaluator",
      metadata: {
        riskAlertId: riskAlert.id,
        riskScore: riskAlert.score,
        riskLevel: riskAlert.riskLevel,
        factors: riskAlert.factors,
        userId: riskAlert.userId,
        ipAddress: riskAlert.ipAddress,
        ...(riskAlert.details ?? {}),
      },
    });

    logger.info("[AlertService] 风险告警已持久化", {
      alertId: riskAlert.id,
      severity,
      type,
    });
  }

  /**
   * 查询告警列表（返回前端格式）
   *
   * @param filters - 过滤参数
   * @returns 告警列表 + 总数 + 未确认数
   */
  async listAlerts(filters: {
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AlertListResponse> {
    logger.debug("[AlertService] 查询告警列表", { filters });

    const result = await this.alertRepo.query({
      severity: filters.severity,
      acknowledged: filters.acknowledged,
      resolved: filters.resolved,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });

    return {
      alerts: result.alerts.map(toFrontendAlert),
      total: result.total,
      unacknowledged: result.unacknowledged,
    };
  }

  /**
   * 确认告警
   *
   * @param alertId - 告警 ID
   * @param adminName - 确认人名称
   */
  async acknowledgeAlert(alertId: string, adminName: string): Promise<void> {
    logger.info("[AlertService] 确认告警", { alertId, adminName });

    const result = await this.alertRepo.acknowledge(alertId, adminName);
    if (!result) {
      logger.warn("[AlertService] 告警不存在", { alertId });
      throw new Error(`告警 ${alertId} 不存在`);
    }
  }

  /**
   * 解决告警
   *
   * @param alertId - 告警 ID
   */
  async resolveAlert(alertId: string): Promise<void> {
    logger.info("[AlertService] 解决告警", { alertId });

    const result = await this.alertRepo.resolve(alertId);
    if (!result) {
      logger.warn("[AlertService] 告警不存在", { alertId });
      throw new Error(`告警 ${alertId} 不存在`);
    }
  }

  /**
   * 创建资源告警
   *
   * 供 monitor-service 在检测到资源阈值超标时调用。
   * 返回前端格式的告警对象。
   *
   * @param params - 告警参数
   * @returns 前端格式的告警对象
   */
  async createResourceAlert(params: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): Promise<FrontendAlert> {
    logger.info("[AlertService] 创建资源告警", {
      type: params.type,
      severity: params.severity,
      title: params.title,
    });

    const alert = await this.alertRepo.create({
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      source: params.source,
      metadata: params.metadata,
    });

    return toFrontendAlert(alert);
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 AlertService 实例
 */
export function getAlertService(db?: Database): AlertService {
  return new AlertService(db);
}
