/**
 * 系统指标数据访问层
 *
 * 提供系统资源监控指标的写入、时序查询和清理功能。
 * MetricsCollector 每 60 秒调用 insert 写入采样数据。
 */

import { and, gte, lte, lt, desc, sql } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import { systemMetrics, type SystemMetric, type NewSystemMetric } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 系统指标仓库类
 */
export class SystemMetricsRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 插入单条指标记录
   *
   * MetricsCollector 每 60 秒调用一次
   */
  async insert(metric: NewSystemMetric): Promise<void> {
    logger.debug(`[SystemMetricsRepository] 插入指标记录`, { type: metric.metricType });

    await this.db.insert(systemMetrics).values(metric);
  }

  /**
   * 查询时序指标数据
   *
   * 按时间范围查询，可选按指标类型过滤
   */
  async getTimeseries(params: {
    startTime: Date;
    endTime: Date;
    metricType?: string;
    limit?: number;
  }): Promise<SystemMetric[]> {
    const conditions = [
      gte(systemMetrics.timestamp, params.startTime),
      lte(systemMetrics.timestamp, params.endTime),
    ];

    if (params.metricType) {
      conditions.push(sql`${systemMetrics.metricType} = ${params.metricType}`);
    }

    const limit = params.limit ?? 1440; // 默认最多 24h * 60 = 1440 条

    return this.db
      .select()
      .from(systemMetrics)
      .where(and(...conditions))
      .orderBy(desc(systemMetrics.timestamp))
      .limit(limit);
  }

  /**
   * 获取最新一条指标记录
   *
   * 用于仪表盘显示当前状态
   */
  async getLatest(): Promise<SystemMetric | null> {
    const results = await this.db
      .select()
      .from(systemMetrics)
      .orderBy(desc(systemMetrics.timestamp))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * 清理旧指标数据
   *
   * 删除超过保留天数的记录
   *
   * @returns 删除的记录数
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    logger.debug(`[SystemMetricsRepository] 清理旧指标`, {
      retentionDays,
      cutoff: cutoff.toISOString(),
    });

    const deleted = await this.db
      .delete(systemMetrics)
      .where(lt(systemMetrics.timestamp, cutoff))
      .returning();

    logger.debug(`[SystemMetricsRepository] 旧指标清理完成`, { deleted: deleted.length });

    return deleted.length;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 SystemMetricsRepository 实例
 */
export function getSystemMetricsRepository(db?: Database): SystemMetricsRepository {
  return new SystemMetricsRepository(db ?? getDatabase());
}

/**
 * 生成指标记录 ID
 */
export function generateMetricId(): string {
  return generateId();
}
