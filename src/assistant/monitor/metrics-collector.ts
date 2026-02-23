/**
 * 系统指标采集器
 *
 * 定期采集系统资源指标（CPU、内存、磁盘等），
 * 写入 system_metrics 表，替代 monitor-service 中模拟的历史数据。
 *
 * 采集间隔: 60 秒
 * 清理策略: 每天清理 30 天前的旧数据
 */

import { getLogger } from "../../logging/logger.js";
import type { SystemMetricsRepository } from "../../db/repositories/system-metrics.js";
import { generateId } from "../../db/utils/id.js";

const logger = getLogger();

/**
 * 系统资源数据提供函数类型
 *
 * 由 monitor-service.getSystemResources() 提供
 */
export interface ResourceDataProvider {
  cpu: { usage: number };
  memory: { usagePercent: number };
  disk: { usagePercent: number };
  process: { memoryUsage: number };
}

/**
 * MetricsCollector 配置
 */
export interface MetricsCollectorOptions {
  /** SystemMetricsRepository 实例 */
  repository: SystemMetricsRepository;
  /** 资源数据获取函数 */
  getResources: () => Promise<ResourceDataProvider>;
  /** 活跃连接数获取函数 */
  getActiveConnections?: () => number;
  /** 采集间隔 (毫秒，默认 60000) */
  intervalMs?: number;
  /** 数据保留天数 (默认 30) */
  retentionDays?: number;
  /** 日志清理保留天数 (默认 7) */
  logRetentionDays?: number;
  /** SystemLogsRepository 实例 (可选，用于日志清理) */
  logsRepository?: { cleanup: (days: number) => Promise<number> };
}

/**
 * 系统指标采集器
 */
export class MetricsCollector {
  private readonly repository: MetricsCollectorOptions["repository"];
  private readonly getResources: MetricsCollectorOptions["getResources"];
  private readonly getActiveConnections: () => number;
  private readonly intervalMs: number;
  private readonly retentionDays: number;
  private readonly logRetentionDays: number;
  private readonly logsRepository?: MetricsCollectorOptions["logsRepository"];

  private collectTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(options: MetricsCollectorOptions) {
    this.repository = options.repository;
    this.getResources = options.getResources;
    this.getActiveConnections = options.getActiveConnections ?? (() => 0);
    this.intervalMs = options.intervalMs ?? 60_000;
    this.retentionDays = options.retentionDays ?? 30;
    this.logRetentionDays = options.logRetentionDays ?? 7;
    this.logsRepository = options.logsRepository;
  }

  /**
   * 启动指标采集
   */
  start(): void {
    if (this.running) {
      logger.debug("[MetricsCollector] 已经在运行中");
      return;
    }

    this.running = true;
    logger.info("[MetricsCollector] 启动指标采集", { intervalMs: this.intervalMs });

    /** 立即采集一次 */
    void this.collectAndStore();

    /** 定时采集 */
    this.collectTimer = setInterval(() => {
      void this.collectAndStore();
    }, this.intervalMs);

    /** 每天凌晨 2 点清理旧数据 (使用 24h 间隔简化) */
    this.cleanupTimer = setInterval(
      () => {
        void this.performCleanup();
      },
      24 * 60 * 60 * 1000,
    );
  }

  /**
   * 停止指标采集
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    logger.info("[MetricsCollector] 指标采集已停止");
  }

  /**
   * 采集并存储一次系统指标
   */
  async collectAndStore(): Promise<void> {
    try {
      const resources = await this.getResources();
      const activeConnections = this.getActiveConnections();

      await this.repository.insert({
        id: generateId(),
        timestamp: new Date(),
        metricType: "system",
        cpuUsage: String(resources.cpu.usage),
        memoryUsage: String(resources.memory.usagePercent),
        diskUsage: String(resources.disk.usagePercent),
        activeConnections,
        heapUsed: resources.process.memoryUsage,
        requestCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
      });

      logger.debug("[MetricsCollector] 指标采集完成", {
        cpu: resources.cpu.usage,
        memory: resources.memory.usagePercent,
      });
    } catch (error) {
      logger.error("[MetricsCollector] 指标采集失败:", error);
    }
  }

  /**
   * 执行数据清理
   */
  async performCleanup(): Promise<void> {
    try {
      /** 清理旧指标 */
      const metricsDeleted = await this.repository.cleanup(this.retentionDays);
      logger.info("[MetricsCollector] 旧指标清理完成", { deleted: metricsDeleted });

      /** 清理旧日志 */
      if (this.logsRepository) {
        const logsDeleted = await this.logsRepository.cleanup(this.logRetentionDays);
        logger.info("[MetricsCollector] 旧日志清理完成", { deleted: logsDeleted });
      }
    } catch (error) {
      logger.error("[MetricsCollector] 数据清理失败:", error);
    }
  }

  /**
   * 是否正在运行
   */
  get isRunning(): boolean {
    return this.running;
  }
}

/**
 * 创建 MetricsCollector 实例
 */
export function createMetricsCollector(options: MetricsCollectorOptions): MetricsCollector {
  return new MetricsCollector(options);
}
