/**
 * 系统日志数据访问层
 *
 * 提供结构化日志的批量写入、查询、统计和清理功能。
 * 支持按级别、来源、时间范围和关键词过滤。
 */

import { eq, and, gte, lte, lt, desc, sql, or, ilike } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  systemLogs,
  type SystemLog,
  type NewSystemLog,
  type LogLevelEnum,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 日志级别权重 (用于 >= 过滤)
 */
const LOG_LEVEL_WEIGHT: Record<LogLevelEnum, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * 获取指定级别及以上的所有级别
 */
function getLevelsAtOrAbove(minLevel: LogLevelEnum): LogLevelEnum[] {
  const minWeight = LOG_LEVEL_WEIGHT[minLevel];
  return (Object.entries(LOG_LEVEL_WEIGHT) as [LogLevelEnum, number][])
    .filter(([, weight]) => weight >= minWeight)
    .map(([level]) => level);
}

/**
 * 日志查询参数
 */
export interface SystemLogQueryParams {
  /** 最低日志级别 (包含该级别及以上) */
  level?: LogLevelEnum;
  /** 日志来源模块 */
  source?: string;
  /** 消息关键词搜索 (模糊匹配) */
  search?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 分页大小 (默认 50) */
  limit?: number;
  /** 分页偏移 */
  offset?: number;
}

/**
 * 日志统计结果
 */
export interface SystemLogStats {
  /** 日志总数 */
  total: number;
  /** 按级别分组计数 */
  byLevel: Record<string, number>;
  /** 按来源分组计数 */
  bySource: Record<string, number>;
}

/**
 * 系统日志仓库类
 */
export class SystemLogsRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 批量插入日志记录
   *
   * DB Transport 使用此方法批量写入缓冲的日志
   */
  async batchInsert(logs: NewSystemLog[]): Promise<void> {
    if (logs.length === 0) {
      return;
    }

    logger.debug(`[SystemLogsRepository] 批量插入日志: ${logs.length} 条`);

    await this.db.insert(systemLogs).values(logs);
  }

  /**
   * 查询日志列表
   *
   * 支持按级别、来源、关键词和时间范围过滤
   */
  async query(params: SystemLogQueryParams): Promise<{ logs: SystemLog[]; total: number }> {
    const conditions = [];

    /** 级别过滤: 使用 or 条件匹配指定级别及以上 */
    if (params.level) {
      const levels = getLevelsAtOrAbove(params.level);
      const levelConditions = levels.map((l) => eq(systemLogs.level, l));
      if (levelConditions.length === 1) {
        conditions.push(levelConditions[0]);
      } else {
        conditions.push(or(...levelConditions));
      }
    }

    /** 来源过滤 */
    if (params.source) {
      conditions.push(eq(systemLogs.source, params.source));
    }

    /** 关键词搜索 (消息模糊匹配) */
    if (params.search) {
      conditions.push(ilike(systemLogs.message, `%${params.search}%`));
    }

    /** 时间范围 */
    if (params.startTime) {
      conditions.push(gte(systemLogs.timestamp, params.startTime));
    }
    if (params.endTime) {
      conditions.push(lte(systemLogs.timestamp, params.endTime));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    /** 并行获取日志数据和总数 */
    const [logs, [countResult]] = await Promise.all([
      this.db
        .select()
        .from(systemLogs)
        .where(whereClause)
        .orderBy(desc(systemLogs.timestamp))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemLogs)
        .where(whereClause),
    ]);

    return {
      logs,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 获取所有活跃的日志来源
   *
   * 用于前端过滤下拉菜单
   */
  async getSources(): Promise<string[]> {
    /** 查询所有记录，在内存中提取来源并去重排序 */
    const results = await this.db.select().from(systemLogs);

    const unique = [...new Set(results.map((r) => r.source))];
    return unique.sort();
  }

  /**
   * 获取日志统计信息
   *
   * 查询所有匹配记录，在内存中按级别和来源分组计数。
   * 数据量可控（7天保留期），内存聚合性能足够。
   */
  async getStats(params?: { startTime?: Date; endTime?: Date }): Promise<SystemLogStats> {
    const conditions = [];
    if (params?.startTime) {
      conditions.push(gte(systemLogs.timestamp, params.startTime));
    }
    if (params?.endTime) {
      conditions.push(lte(systemLogs.timestamp, params.endTime));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    /** 查询所有匹配的日志 */
    const rows = await this.db.select().from(systemLogs).where(whereClause);

    /** 在内存中聚合 */
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const row of rows) {
      byLevel[row.level] = (byLevel[row.level] ?? 0) + 1;
      bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    }

    return {
      total: rows.length,
      byLevel,
      bySource,
    };
  }

  /**
   * 获取最近 N 条日志
   *
   * 用于实时日志流的初始化加载
   */
  async getTail(count: number): Promise<SystemLog[]> {
    return this.db.select().from(systemLogs).orderBy(desc(systemLogs.timestamp)).limit(count);
  }

  /**
   * 清理旧日志
   *
   * 删除超过保留天数的日志记录，使用 returning 获取删除数
   *
   * @returns 删除的记录数
   */
  async cleanup(retentionDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    logger.debug(`[SystemLogsRepository] 清理旧日志`, {
      retentionDays,
      cutoff: cutoff.toISOString(),
    });

    const deleted = await this.db
      .delete(systemLogs)
      .where(lt(systemLogs.timestamp, cutoff))
      .returning();

    logger.debug(`[SystemLogsRepository] 旧日志清理完成`, { deleted: deleted.length });

    return deleted.length;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 SystemLogsRepository 实例
 */
export function getSystemLogsRepository(db?: Database): SystemLogsRepository {
  return new SystemLogsRepository(db ?? getDatabase());
}

/**
 * 生成日志记录 ID
 *
 * 供 DB Transport 使用
 */
export function generateLogId(): string {
  return generateId();
}
