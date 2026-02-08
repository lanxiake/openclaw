/**
 * 增强版审计日志服务
 *
 * 整合数据库存储、风险自动评估、导出频率限制
 * 提供完整的审计日志管理功能
 */

import { getLogger } from "../../logging/logger.js";
import {
  getAuditLogRepository,
  getExportLogRepository,
  type AuditLogRepository,
  type ExportLogRepository,
} from "../../db/repositories/audit.js";
import type {
  AuditLog,
  AuditCategory,
  AuditRiskLevel,
  AuditLogDetails,
} from "../../db/schema/audit.js";
import {
  evaluateRisk,
  sendRiskAlert,
  generateAlertId,
  type RiskEvaluationInput,
  type RiskAlert,
} from "./risk-evaluator.js";

const logger = getLogger();

/**
 * 审计日志写入请求
 */
export interface AuditLogRequest {
  /** 用户 ID (可选，系统操作可为空) */
  userId?: string;
  /** 设备 ID (可选) */
  deviceId?: string;
  /** 操作类别 */
  category: AuditCategory;
  /** 操作动作 */
  action: string;
  /** 资源类型 (可选) */
  resourceType?: string;
  /** 资源 ID (可选) */
  resourceId?: string;
  /** 风险级别 (可选，不提供则自动评估) */
  riskLevel?: AuditRiskLevel;
  /** IP 地址 (可选) */
  ipAddress?: string;
  /** User Agent (可选) */
  userAgent?: string;
  /** 操作详情 (可选) */
  details?: AuditLogDetails;
  /** 操作前状态 (可选) */
  beforeState?: Record<string, unknown>;
  /** 操作后状态 (可选) */
  afterState?: Record<string, unknown>;
  /** 操作结果 */
  result: "success" | "failure" | "partial";
  /** 错误消息 (可选) */
  errorMessage?: string;
  /** 是否跳过风险评估 (默认false) */
  skipRiskEvaluation?: boolean;
}

/**
 * 审计日志查询参数
 */
export interface AuditLogQueryParams {
  /** 用户 ID */
  userId?: string;
  /** 设备 ID */
  deviceId?: string;
  /** 操作类别 */
  category?: AuditCategory;
  /** 操作动作 */
  action?: string;
  /** 风险级别 */
  riskLevel?: AuditRiskLevel;
  /** 开始时间 */
  startDate?: Date;
  /** 结束时间 */
  endDate?: Date;
  /** 页码 (从1开始) */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 导出请求参数
 */
export interface ExportRequest {
  /** 用户 ID */
  userId: string;
  /** 导出类型 */
  exportType: "user_data" | "audit_logs" | "chat_history" | "files";
  /** 导出格式 */
  format: "json" | "csv" | "zip";
  /** 开始时间 (可选) */
  startDate?: string;
  /** 结束时间 (可选) */
  endDate?: string;
  /** 过滤条件 (可选) */
  filters?: Record<string, unknown>;
  /** IP 地址 */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 导出结果
 */
export interface ExportResult {
  /** 是否成功 */
  success: boolean;
  /** 导出 ID */
  exportId?: string;
  /** 错误信息 */
  error?: string;
  /** 错误码 */
  errorCode?: string;
  /** 下次可导出时间 (限流时返回) */
  retryAfter?: string;
}

/**
 * 导出频率限制配置
 */
interface ExportRateLimitConfig {
  /** 时间窗口 (毫秒) */
  windowMs: number;
  /** 时间窗口内最大导出次数 */
  maxExports: number;
}

/**
 * 默认导出频率限制: 每小时最多3次
 */
const DEFAULT_EXPORT_RATE_LIMIT: ExportRateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1小时
  maxExports: 3,
};

/**
 * 增强版审计日志服务
 */
export class EnhancedAuditService {
  private auditRepo: AuditLogRepository;
  private exportRepo: ExportLogRepository;
  private exportRateLimit: ExportRateLimitConfig;

  constructor(config?: { exportRateLimit?: Partial<ExportRateLimitConfig> }) {
    this.auditRepo = getAuditLogRepository();
    this.exportRepo = getExportLogRepository();
    this.exportRateLimit = {
      ...DEFAULT_EXPORT_RATE_LIMIT,
      ...config?.exportRateLimit,
    };

    logger.info("[enhanced-audit] 增强版审计服务初始化", {
      exportRateLimit: this.exportRateLimit,
    });
  }

  /**
   * 写入审计日志
   *
   * 自动评估风险级别，高风险操作触发告警
   *
   * @param request - 审计日志请求
   * @returns 写入的审计日志记录
   */
  async log(request: AuditLogRequest): Promise<AuditLog> {
    // 1. 风险评估 (如果未提供风险级别且未跳过评估)
    let finalRiskLevel = request.riskLevel;
    let shouldAlert = false;
    let alertReason: string | undefined;
    let riskFactors: string[] = [];

    if (!finalRiskLevel && !request.skipRiskEvaluation) {
      const evaluationInput: RiskEvaluationInput = {
        category: request.category,
        action: request.action,
        result: request.result,
        userId: request.userId,
        ipAddress: request.ipAddress,
        details: request.details as Record<string, unknown> | undefined,
        errorMessage: request.errorMessage,
      };

      const evaluation = evaluateRisk(evaluationInput);
      finalRiskLevel = evaluation.riskLevel;
      shouldAlert = evaluation.shouldAlert;
      alertReason = evaluation.alertReason;
      riskFactors = evaluation.factors;

      logger.debug("[enhanced-audit] 风险评估完成", {
        action: request.action,
        riskLevel: finalRiskLevel,
        score: evaluation.score,
        factors: riskFactors,
      });
    }

    // 2. 写入审计日志
    const auditLog = await this.auditRepo.log({
      userId: request.userId,
      deviceId: request.deviceId,
      category: request.category,
      action: request.action,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      riskLevel: finalRiskLevel ?? "low",
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      details: request.details,
      beforeState: request.beforeState,
      afterState: request.afterState,
      result: request.result,
      errorMessage: request.errorMessage,
    });

    logger.debug("[enhanced-audit] 审计日志已写入", {
      id: auditLog.id,
      category: request.category,
      action: request.action,
      riskLevel: finalRiskLevel,
    });

    // 3. 高风险操作告警
    if (shouldAlert && alertReason) {
      const alert: RiskAlert = {
        id: generateAlertId(),
        timestamp: new Date().toISOString(),
        riskLevel: finalRiskLevel ?? "high",
        score: 0, // 将在风险评估中计算
        category: request.category,
        action: request.action,
        userId: request.userId,
        ipAddress: request.ipAddress,
        reason: alertReason,
        factors: riskFactors,
        details: request.details as Record<string, unknown> | undefined,
      };

      // 异步发送告警，不阻塞主流程
      sendRiskAlert(alert).catch((error) => {
        logger.error("[enhanced-audit] 发送风险告警失败", {
          alertId: alert.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }

    return auditLog;
  }

  /**
   * 查询审计日志 (分页)
   *
   * @param params - 查询参数
   * @returns 分页结果
   */
  async query(params: AuditLogQueryParams): Promise<PaginatedResult<AuditLog>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const { logs, total } = await this.auditRepo.query({
      userId: params.userId,
      category: params.category,
      riskLevel: params.riskLevel,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);

    logger.debug("[enhanced-audit] 查询审计日志", {
      params,
      total,
      page,
      pageSize,
    });

    return {
      items: logs,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取用户最近的审计日志
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量 (默认20)
   * @returns 审计日志列表
   */
  async getRecentByUser(userId: string, limit: number = 20): Promise<AuditLog[]> {
    const logs = await this.auditRepo.getRecentByUser(userId, limit);

    logger.debug("[enhanced-audit] 获取用户最近审计日志", {
      userId,
      limit,
      count: logs.length,
    });

    return logs;
  }

  /**
   * 获取高风险操作日志
   *
   * @param since - 开始时间
   * @param limit - 返回数量 (默认100)
   * @returns 高风险审计日志列表
   */
  async getHighRiskLogs(since: Date, limit: number = 100): Promise<AuditLog[]> {
    const logs = await this.auditRepo.getHighRiskLogs(since, limit);

    logger.debug("[enhanced-audit] 获取高风险操作日志", {
      since: since.toISOString(),
      limit,
      count: logs.length,
    });

    return logs;
  }

  /**
   * 根据 ID 获取审计日志
   *
   * @param id - 审计日志 ID
   * @returns 审计日志或 null
   */
  async getById(id: string): Promise<AuditLog | null> {
    return this.auditRepo.findById(id);
  }

  /**
   * 请求数据导出 (带频率限制)
   *
   * @param request - 导出请求
   * @returns 导出结果
   */
  async requestExport(request: ExportRequest): Promise<ExportResult> {
    const { userId, exportType, format, startDate, endDate, filters, ipAddress, userAgent } =
      request;

    // 1. 检查导出频率限制
    const recentExports = await this.getRecentExportCount(userId);
    if (recentExports >= this.exportRateLimit.maxExports) {
      const retryAfter = new Date(Date.now() + this.exportRateLimit.windowMs);

      logger.warn("[enhanced-audit] 导出请求被限流", {
        userId,
        recentExports,
        maxExports: this.exportRateLimit.maxExports,
      });

      // 记录审计日志
      await this.log({
        userId,
        category: "security",
        action: "security.rate_limited",
        result: "failure",
        ipAddress,
        userAgent,
        details: {
          reason: "导出频率超限",
          exportType,
          recentExports,
          maxExports: this.exportRateLimit.maxExports,
        },
      });

      return {
        success: false,
        error: `导出请求过于频繁，请在 ${retryAfter.toISOString()} 后重试`,
        errorCode: "RATE_LIMITED",
        retryAfter: retryAfter.toISOString(),
      };
    }

    // 2. 创建导出记录
    try {
      const exportLog = await this.exportRepo.create({
        userId,
        exportType,
        format,
        params: {
          startDate,
          endDate,
          filters,
        },
      });

      logger.info("[enhanced-audit] 创建导出请求", {
        exportId: exportLog.id,
        userId,
        exportType,
        format,
      });

      // 3. 记录审计日志
      await this.log({
        userId,
        category: "security",
        action: "security.data_exported",
        resourceType: "export",
        resourceId: exportLog.id,
        result: "success",
        ipAddress,
        userAgent,
        details: {
          exportType,
          format,
          startDate,
          endDate,
        },
      });

      return {
        success: true,
        exportId: exportLog.id,
      };
    } catch (error) {
      logger.error("[enhanced-audit] 创建导出请求失败", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: "创建导出请求失败",
        errorCode: "EXPORT_ERROR",
      };
    }
  }

  /**
   * 获取用户近期导出次数
   *
   * @param userId - 用户 ID
   * @returns 近期导出次数
   */
  private async getRecentExportCount(userId: string): Promise<number> {
    const exports = await this.exportRepo.findByUserId(userId, 10);
    const windowStart = Date.now() - this.exportRateLimit.windowMs;

    return exports.filter((e) => new Date(e.requestedAt).getTime() > windowStart).length;
  }

  /**
   * 获取用户的导出历史
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量
   * @returns 导出记录列表
   */
  async getExportHistory(userId: string, limit: number = 20) {
    const exports = await this.exportRepo.findByUserId(userId, limit);

    logger.debug("[enhanced-audit] 获取导出历史", {
      userId,
      limit,
      count: exports.length,
    });

    return exports;
  }

  /**
   * 标记导出完成
   *
   * @param exportId - 导出 ID
   * @param filePath - 文件路径
   * @param fileSize - 文件大小
   */
  async markExportCompleted(
    exportId: string,
    filePath: string,
    fileSize: number
  ): Promise<void> {
    await this.exportRepo.markCompleted(exportId, filePath, fileSize);

    logger.info("[enhanced-audit] 标记导出完成", {
      exportId,
      filePath,
      fileSize,
    });
  }

  /**
   * 标记导出失败
   *
   * @param exportId - 导出 ID
   * @param errorMessage - 错误信息
   */
  async markExportFailed(exportId: string, errorMessage: string): Promise<void> {
    await this.exportRepo.markFailed(exportId, errorMessage);

    logger.warn("[enhanced-audit] 标记导出失败", {
      exportId,
      errorMessage,
    });
  }

  /**
   * 记录导出下载
   *
   * @param exportId - 导出 ID
   */
  async recordExportDownload(exportId: string): Promise<void> {
    await this.exportRepo.recordDownload(exportId);

    logger.debug("[enhanced-audit] 记录导出下载", { exportId });
  }

  /**
   * 清理过期日志
   *
   * @param retentionDays - 保留天数 (默认365天)
   * @returns 清理的日志数量
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const count = await this.auditRepo.cleanupOld(retentionDays);

    logger.info("[enhanced-audit] 清理过期审计日志", {
      retentionDays,
      deletedCount: count,
    });

    return count;
  }

  /**
   * 清理过期导出
   *
   * @returns 清理的导出数量
   */
  async cleanupExpiredExports(): Promise<number> {
    const count = await this.exportRepo.cleanupExpired();

    logger.info("[enhanced-audit] 清理过期导出", {
      deletedCount: count,
    });

    return count;
  }
}

// 单例实例
let enhancedAuditService: EnhancedAuditService | null = null;

/**
 * 获取增强版审计服务实例
 */
export function getEnhancedAuditService(): EnhancedAuditService {
  if (!enhancedAuditService) {
    enhancedAuditService = new EnhancedAuditService();
  }
  return enhancedAuditService;
}

/**
 * 便捷的审计日志写入函数
 *
 * 使用增强版审计服务记录日志，自动评估风险级别
 */
export async function auditEnhanced(request: AuditLogRequest): Promise<void> {
  try {
    const service = getEnhancedAuditService();
    await service.log(request);
  } catch (error) {
    // 审计日志失败不应影响主业务流程
    logger.error("[enhanced-audit] 写入审计日志失败", {
      error: error instanceof Error ? error.message : "Unknown error",
      request: {
        category: request.category,
        action: request.action,
      },
    });
  }
}
