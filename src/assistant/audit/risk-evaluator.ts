/**
 * 审计日志风险评估器
 *
 * 根据操作类型、上下文和规则自动判定风险级别
 * 支持高风险操作告警
 */

import { getLogger } from "../../shared/logging/logger.js";
import type { AuditCategory, AuditRiskLevel } from "../../db/schema/audit.js";

const logger = getLogger();

/**
 * 风险评估输入参数
 */
export interface RiskEvaluationInput {
  /** 操作类别 */
  category: AuditCategory;
  /** 操作动作 */
  action: string;
  /** 操作结果 */
  result: "success" | "failure" | "partial";
  /** 用户 ID (可选) */
  userId?: string;
  /** IP 地址 (可选) */
  ipAddress?: string;
  /** 操作详情 */
  details?: Record<string, unknown>;
  /** 错误消息 (如有) */
  errorMessage?: string;
}

/**
 * 风险评估结果
 */
export interface RiskEvaluationResult {
  /** 计算得到的风险级别 */
  riskLevel: AuditRiskLevel;
  /** 风险因素列表 */
  factors: string[];
  /** 风险分数 (0-100) */
  score: number;
  /** 是否需要告警 */
  shouldAlert: boolean;
  /** 告警原因 (如需告警) */
  alertReason?: string;
}

/**
 * 操作的基础风险级别映射
 * 根据 category.action 格式定义默认风险级别
 */
const BASE_RISK_LEVELS: Record<string, AuditRiskLevel> = {
  // Auth 认证相关
  "auth.login": "low",
  "auth.logout": "low",
  "auth.login_failed": "medium",
  "auth.password_reset": "medium",
  "auth.password_changed": "high",
  "auth.2fa_enabled": "high",
  "auth.2fa_disabled": "critical",
  "auth.session_revoked": "medium",
  "auth.all_sessions_revoked": "high",

  // User 用户相关
  "user.created": "medium",
  "user.updated": "low",
  "user.deleted": "critical",
  "user.activated": "low",
  "user.deactivated": "high",
  "user.role_changed": "high",
  "user.permissions_changed": "high",

  // Device 设备相关
  "device.linked": "medium",
  "device.unlinked": "medium",
  "device.primary_changed": "low",
  "device.alias_updated": "low",

  // Subscription 订阅相关
  "subscription.created": "medium",
  "subscription.upgraded": "medium",
  "subscription.downgraded": "medium",
  "subscription.canceled": "high",
  "subscription.renewed": "low",

  // Payment 支付相关
  "payment.initiated": "medium",
  "payment.completed": "high",
  "payment.failed": "medium",
  "payment.refunded": "high",
  "payment.disputed": "critical",

  // Skill 技能相关
  "skill.installed": "medium",
  "skill.uninstalled": "medium",
  "skill.enabled": "low",
  "skill.disabled": "low",
  "skill.executed": "low",
  "skill.execute_failed": "medium",

  // System 系统相关
  "system.config_changed": "high",
  "system.backup_created": "medium",
  "system.backup_restored": "critical",
  "system.maintenance_started": "medium",
  "system.maintenance_ended": "low",
  "system.command_executed": "high",
  "system.process_killed": "critical",

  // Security 安全相关
  "security.alert": "high",
  "security.blocked": "high",
  "security.rate_limited": "medium",
  "security.suspicious_activity": "critical",
  "security.data_exported": "high",
  "security.data_import": "medium",
};

/**
 * 高风险IP模式列表
 * 用于识别可疑的访问来源
 */
const SUSPICIOUS_IP_PATTERNS = [
  /^10\./, // 私有网络可疑使用
  /^192\.168\./, // 可疑的内网穿透
  /^127\./, // localhost可疑访问
];

/**
 * 高风险操作阈值
 * 超过此分数需要发送告警
 */
const ALERT_THRESHOLD = 70;

/**
 * 评估操作的风险级别
 *
 * 根据操作类型、上下文和规则自动判定风险级别
 *
 * @param input - 风险评估输入参数
 * @returns 风险评估结果
 */
export function evaluateRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const factors: string[] = [];
  let score = 0;

  // 1. 获取操作的基础风险级别
  const actionKey = `${input.category}.${input.action.split(".").pop()}`;
  const fullActionKey = `${input.category}.${input.action.replace(input.category + ".", "")}`;
  const baseRiskLevel =
    BASE_RISK_LEVELS[fullActionKey] ||
    BASE_RISK_LEVELS[actionKey] ||
    getCategoryDefaultRisk(input.category);

  // 基础分数
  score += getRiskScore(baseRiskLevel);
  factors.push(`基础风险级别: ${baseRiskLevel}`);

  // 2. 评估操作结果
  if (input.result === "failure") {
    score += 15;
    factors.push("操作失败");
  } else if (input.result === "partial") {
    score += 10;
    factors.push("操作部分完成");
  }

  // 3. 评估是否有错误消息
  if (input.errorMessage) {
    score += 5;
    factors.push("包含错误信息");

    // 检查特定的错误模式
    if (
      input.errorMessage.toLowerCase().includes("permission") ||
      input.errorMessage.toLowerCase().includes("unauthorized")
    ) {
      score += 15;
      factors.push("权限相关错误");
    }
    if (
      input.errorMessage.toLowerCase().includes("rate limit") ||
      input.errorMessage.toLowerCase().includes("too many")
    ) {
      score += 10;
      factors.push("频率限制触发");
    }
  }

  // 4. 评估匿名操作 (无用户ID)
  if (!input.userId) {
    if (input.category !== "system") {
      score += 10;
      factors.push("无关联用户ID");
    }
  }

  // 5. 评估可疑IP
  if (input.ipAddress) {
    for (const pattern of SUSPICIOUS_IP_PATTERNS) {
      if (pattern.test(input.ipAddress)) {
        score += 5;
        factors.push("可疑IP来源");
        break;
      }
    }
  }

  // 6. 评估操作详情中的风险因素
  if (input.details) {
    // 批量操作风险更高
    if (typeof input.details.count === "number" && input.details.count > 10) {
      score += 10;
      factors.push(`批量操作 (${input.details.count}项)`);
    }

    // 敏感字段操作
    const sensitiveFields = ["password", "secret", "token", "key", "credential"];
    for (const field of sensitiveFields) {
      if (JSON.stringify(input.details).toLowerCase().includes(field)) {
        score += 15;
        factors.push("涉及敏感数据");
        break;
      }
    }

    // 数据删除操作
    if (input.details.deleted === true || input.details.destroy === true) {
      score += 20;
      factors.push("数据删除操作");
    }

    // 权限提升操作
    if (input.details.roleChange || input.details.permissionChange) {
      score += 15;
      factors.push("权限变更操作");
    }
  }

  // 7. 计算最终风险级别
  const finalRiskLevel = scoreToRiskLevel(score);

  // 8. 判断是否需要告警
  const shouldAlert = score >= ALERT_THRESHOLD;
  const alertReason = shouldAlert
    ? `风险分数 ${score} 超过告警阈值 ${ALERT_THRESHOLD}。风险因素: ${factors.join(", ")}`
    : undefined;

  // 记录高风险评估结果
  if (finalRiskLevel === "high" || finalRiskLevel === "critical") {
    logger.warn("[risk-evaluator] 高风险操作检测", {
      category: input.category,
      action: input.action,
      riskLevel: finalRiskLevel,
      score,
      factors,
    });
  }

  return {
    riskLevel: finalRiskLevel,
    factors,
    score,
    shouldAlert,
    alertReason,
  };
}

/**
 * 获取类别的默认风险级别
 */
function getCategoryDefaultRisk(category: AuditCategory): AuditRiskLevel {
  switch (category) {
    case "security":
      return "high";
    case "payment":
      return "medium";
    case "auth":
      return "medium";
    case "user":
      return "low";
    case "device":
      return "low";
    case "subscription":
      return "low";
    case "skill":
      return "low";
    case "system":
      return "medium";
    default:
      return "low";
  }
}

/**
 * 将风险级别转换为分数
 */
function getRiskScore(riskLevel: AuditRiskLevel): number {
  switch (riskLevel) {
    case "low":
      return 10;
    case "medium":
      return 35;
    case "high":
      return 60;
    case "critical":
      return 85;
    default:
      return 10;
  }
}

/**
 * 将分数转换为风险级别
 */
function scoreToRiskLevel(score: number): AuditRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * 告警处理器类型
 */
export type AlertHandler = (alert: RiskAlert) => Promise<void>;

/**
 * 风险告警信息
 */
export interface RiskAlert {
  /** 告警ID */
  id: string;
  /** 告警时间 */
  timestamp: string;
  /** 风险级别 */
  riskLevel: AuditRiskLevel;
  /** 风险分数 */
  score: number;
  /** 操作类别 */
  category: AuditCategory;
  /** 操作动作 */
  action: string;
  /** 用户ID */
  userId?: string;
  /** IP地址 */
  ipAddress?: string;
  /** 告警原因 */
  reason: string;
  /** 风险因素 */
  factors: string[];
  /** 操作详情 */
  details?: Record<string, unknown>;
}

// 注册的告警处理器列表
const alertHandlers: AlertHandler[] = [];

/**
 * 注册告警处理器
 *
 * @param handler - 告警处理函数
 */
export function registerAlertHandler(handler: AlertHandler): void {
  alertHandlers.push(handler);
  logger.info("[risk-evaluator] 注册告警处理器", {
    handlerCount: alertHandlers.length,
  });
}

/**
 * 移除告警处理器
 *
 * @param handler - 要移除的告警处理函数
 */
export function unregisterAlertHandler(handler: AlertHandler): void {
  const index = alertHandlers.indexOf(handler);
  if (index !== -1) {
    alertHandlers.splice(index, 1);
    logger.info("[risk-evaluator] 移除告警处理器", {
      handlerCount: alertHandlers.length,
    });
  }
}

/**
 * 发送风险告警
 *
 * @param alert - 告警信息
 */
export async function sendRiskAlert(alert: RiskAlert): Promise<void> {
  logger.warn("[risk-evaluator] 发送风险告警", {
    alertId: alert.id,
    riskLevel: alert.riskLevel,
    category: alert.category,
    action: alert.action,
  });

  // 调用所有注册的告警处理器
  const promises = alertHandlers.map(async (handler) => {
    try {
      await handler(alert);
    } catch (error) {
      logger.error("[risk-evaluator] 告警处理器执行失败", {
        alertId: alert.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  await Promise.allSettled(promises);
}

/**
 * 生成告警ID
 */
export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
