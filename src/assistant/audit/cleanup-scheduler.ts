/**
 * 审计日志清理定时任务
 *
 * 提供定时清理过期审计日志和导出文件的功能
 * 支持:
 * - 可配置的保留期限
 * - 自动启动/停止
 * - 清理统计报告
 */

import { getLogger } from "../../shared/logging/logger.js";
import { getEnhancedAuditService } from "./enhanced-service.js";

const logger = getLogger();

/**
 * 清理任务配置
 */
export interface CleanupTaskConfig {
  /** 是否启用自动清理 */
  enabled: boolean;
  /** 审计日志保留天数 (默认365天) */
  auditLogRetentionDays: number;
  /** 清理间隔 (毫秒, 默认24小时) */
  intervalMs: number;
  /** 执行时间 (小时, 0-23, 默认凌晨3点) */
  executeAtHour: number;
}

/**
 * 清理任务结果
 */
export interface CleanupResult {
  /** 执行时间 */
  executedAt: string;
  /** 是否成功 */
  success: boolean;
  /** 删除的审计日志数量 */
  deletedAuditLogs: number;
  /** 删除的导出记录数量 */
  deletedExports: number;
  /** 错误信息 (如有) */
  error?: string;
  /** 执行耗时 (毫秒) */
  durationMs: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CleanupTaskConfig = {
  enabled: true,
  auditLogRetentionDays: 365,
  intervalMs: 24 * 60 * 60 * 1000, // 24小时
  executeAtHour: 3, // 凌晨3点
};

/**
 * 审计日志清理调度器
 */
export class AuditCleanupScheduler {
  private config: CleanupTaskConfig;
  private timer: NodeJS.Timeout | null = null;
  private lastResult: CleanupResult | null = null;
  private isRunning = false;

  constructor(config?: Partial<CleanupTaskConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info("[audit-cleanup] 创建清理调度器", {
      enabled: this.config.enabled,
      retentionDays: this.config.auditLogRetentionDays,
      executeAtHour: this.config.executeAtHour,
    });
  }

  /**
   * 启动定时清理任务
   */
  start(): void {
    if (this.timer) {
      logger.warn("[audit-cleanup] 清理调度器已在运行");
      return;
    }

    if (!this.config.enabled) {
      logger.info("[audit-cleanup] 清理调度器已禁用，不启动");
      return;
    }

    logger.info("[audit-cleanup] 启动清理调度器");

    // 计算到下一个执行时间的延迟
    const now = new Date();
    const nextRun = this.calculateNextRunTime(now);
    const initialDelay = nextRun.getTime() - now.getTime();

    logger.info("[audit-cleanup] 下次执行时间", {
      nextRun: nextRun.toISOString(),
      initialDelayMs: initialDelay,
    });

    // 首次执行
    setTimeout(() => {
      this.execute().catch((error) => {
        logger.error("[audit-cleanup] 首次执行失败", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });

      // 设置周期性执行
      this.timer = setInterval(() => {
        this.execute().catch((error) => {
          logger.error("[audit-cleanup] 周期执行失败", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
      }, this.config.intervalMs);
    }, initialDelay);

    logger.info("[audit-cleanup] 清理调度器已启动");
  }

  /**
   * 停止定时清理任务
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("[audit-cleanup] 清理调度器已停止");
    }
  }

  /**
   * 手动执行清理任务
   */
  async execute(): Promise<CleanupResult> {
    if (this.isRunning) {
      logger.warn("[audit-cleanup] 清理任务正在执行中，跳过");
      return {
        executedAt: new Date().toISOString(),
        success: false,
        deletedAuditLogs: 0,
        deletedExports: 0,
        error: "清理任务正在执行中",
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const executedAt = new Date().toISOString();

    logger.info("[audit-cleanup] 开始执行清理任务");

    try {
      const service = getEnhancedAuditService();

      // 清理过期审计日志
      const deletedAuditLogs = await service.cleanupOldLogs(this.config.auditLogRetentionDays);

      // 清理过期导出
      const deletedExports = await service.cleanupExpiredExports();

      const durationMs = Date.now() - startTime;

      const result: CleanupResult = {
        executedAt,
        success: true,
        deletedAuditLogs,
        deletedExports,
        durationMs,
      };

      this.lastResult = result;

      logger.info("[audit-cleanup] 清理任务完成", {
        deletedAuditLogs,
        deletedExports,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const result: CleanupResult = {
        executedAt,
        success: false,
        deletedAuditLogs: 0,
        deletedExports: 0,
        error: errorMessage,
        durationMs,
      };

      this.lastResult = result;

      logger.error("[audit-cleanup] 清理任务失败", {
        error: errorMessage,
        durationMs,
      });

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 计算下一次执行时间
   */
  private calculateNextRunTime(from: Date): Date {
    const next = new Date(from);
    next.setHours(this.config.executeAtHour, 0, 0, 0);

    // 如果今天的执行时间已过，则设为明天
    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    lastResult: CleanupResult | null;
    config: CleanupTaskConfig;
  } {
    return {
      enabled: this.timer !== null,
      isRunning: this.isRunning,
      lastResult: this.lastResult,
      config: { ...this.config },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CleanupTaskConfig>): void {
    const wasRunning = this.timer !== null;

    // 如果正在运行，先停止
    if (wasRunning) {
      this.stop();
    }

    // 更新配置
    this.config = { ...this.config, ...config };

    logger.info("[audit-cleanup] 更新配置", { config: this.config });

    // 如果之前在运行且仍然启用，重新启动
    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }
}

// 单例实例
let cleanupScheduler: AuditCleanupScheduler | null = null;

/**
 * 获取清理调度器实例
 */
export function getCleanupScheduler(): AuditCleanupScheduler {
  if (!cleanupScheduler) {
    cleanupScheduler = new AuditCleanupScheduler();
  }
  return cleanupScheduler;
}

/**
 * 启动清理调度器
 */
export function startCleanupScheduler(config?: Partial<CleanupTaskConfig>): void {
  if (cleanupScheduler) {
    if (config) {
      cleanupScheduler.updateConfig(config);
    }
    cleanupScheduler.start();
  } else {
    cleanupScheduler = new AuditCleanupScheduler(config);
    cleanupScheduler.start();
  }
}

/**
 * 停止清理调度器
 */
export function stopCleanupScheduler(): void {
  if (cleanupScheduler) {
    cleanupScheduler.stop();
  }
}

/**
 * 手动执行清理任务
 */
export async function executeCleanup(): Promise<CleanupResult> {
  const scheduler = getCleanupScheduler();
  return scheduler.execute();
}
