/**
 * 日志查询服务
 *
 * 从 system_logs 表查询结构化应用日志，
 * 提供统一的日志查询、来源列表和统计接口。
 *
 * 数据来源: DB Transport 通过 tslog 拦截的应用日志
 */

import {
  getSystemLogsRepository,
  type SystemLogsRepository,
  type SystemLogQueryParams,
  type SystemLogStats,
} from "../../db/repositories/system-logs.js";
import type { LogLevelEnum } from "../../db/schema/system-logs.js";
import type { Database } from "../../db/connection.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 日志级别（匹配前端 LogLevel 定义）
 */
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志条目（匹配前端 LogEntry 定义）
 */
interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * 日志查询参数（匹配前端 LogQuery 定义）
 */
interface LogQuery {
  level?: LogLevel;
  source?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

/**
 * 日志查询响应（匹配前端 LogQueryResponse 定义）
 */
interface LogQueryResponse {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * 日志查询服务
 *
 * 从 system_logs 表查询结构化应用日志，
 * 提供统一的日志查询和来源列表接口。
 */
export class LogService {
  private logsRepo: SystemLogsRepository;

  constructor(db?: Database) {
    this.logsRepo = getSystemLogsRepository(db);
  }

  /**
   * 查询日志列表
   *
   * 将前端 LogQuery 参数转换为 SystemLogsRepository.query() 参数，
   * 执行查询后将结果映射为 LogEntry 格式。
   *
   * @param query - 前端日志查询参数
   * @returns 日志列表 + 总数 + 是否还有更多
   */
  async queryLogs(query: LogQuery): Promise<LogQueryResponse> {
    logger.debug("[LogService] 查询日志", { query });

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    /** 构建 SystemLogsRepository 查询参数 */
    const repoParams: SystemLogQueryParams = {
      limit,
      offset,
    };

    /** 级别过滤 (system_logs 原生支持 >= 级别过滤) */
    if (query.level) {
      repoParams.level = query.level as LogLevelEnum;
    }

    /** 来源模块过滤 */
    if (query.source) {
      repoParams.source = query.source;
    }

    /** 关键词搜索 */
    if (query.search) {
      repoParams.search = query.search;
    }

    /** 时间范围 */
    if (query.startTime) {
      repoParams.startTime = new Date(query.startTime);
    }
    if (query.endTime) {
      repoParams.endTime = new Date(query.endTime);
    }

    /** 执行查询 */
    const result = await this.logsRepo.query(repoParams);

    /** 映射为 LogEntry 格式 */
    const logs: LogEntry[] = result.logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      level: log.level as LogLevel,
      source: log.source,
      message: log.message,
      metadata: {
        ...((log.metadata as Record<string, unknown>) ?? {}),
        ...(log.errorName ? { errorName: log.errorName } : {}),
      },
    }));

    const hasMore = offset + logs.length < result.total;

    logger.debug("[LogService] 查询日志完成", {
      total: result.total,
      returned: logs.length,
      hasMore,
    });

    return {
      logs,
      total: result.total,
      hasMore,
    };
  }

  /**
   * 获取日志来源列表
   *
   * 查询 system_logs 表中所有不重复的 source 值。
   *
   * @returns 去重排序后的来源列表
   */
  async getSources(): Promise<string[]> {
    logger.debug("[LogService] 获取日志来源列表");

    const sources = await this.logsRepo.getSources();

    logger.debug("[LogService] 日志来源列表", { sources });

    return sources;
  }

  /**
   * 获取日志统计信息
   *
   * 按级别和来源分组统计日志数量。
   *
   * @param params - 可选的时间范围过滤
   * @returns 日志统计数据
   */
  async getStats(params?: { startTime?: Date; endTime?: Date }): Promise<SystemLogStats> {
    logger.debug("[LogService] 获取日志统计");

    const stats = await this.logsRepo.getStats(params);

    logger.debug("[LogService] 日志统计完成", { total: stats.total });

    return stats;
  }

  /**
   * 获取最近 N 条日志
   *
   * 用于实时日志流的初始化加载。
   *
   * @param count - 获取条数 (默认 20)
   * @returns 最近的日志条目列表
   */
  async getTail(count: number = 20): Promise<LogEntry[]> {
    logger.debug("[LogService] 获取最近日志", { count });

    const logs = await this.logsRepo.getTail(count);

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      level: log.level as LogLevel,
      source: log.source,
      message: log.message,
      metadata: {
        ...((log.metadata as Record<string, unknown>) ?? {}),
        ...(log.errorName ? { errorName: log.errorName } : {}),
      },
    }));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 LogService 实例
 */
export function getLogService(db?: Database): LogService {
  return new LogService(db);
}
