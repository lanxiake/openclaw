/**
 * 数据库日志传输层
 *
 * 通过 tslog 的 transport 机制拦截所有日志，批量写入 system_logs 表。
 * 使用内存队列 + 定时刷新避免逐条写库的性能开销。
 *
 * 设计要点：
 * - transport() 立即返回，不阻塞应用日志输出
 * - 队列达 50 条或 3 秒后自动刷新
 * - 队列超 500 条时丢弃最旧 25% 防止内存溢出
 * - shutdown() 确保最后的日志持久化
 */

import { hostname } from "node:os";

import type { LogTransportRecord } from "./logger.js";
import type { SystemLogsRepository } from "../db/repositories/system-logs.js";
import type { NewSystemLog } from "../db/schema/system-logs.js";
import type { LogLevelEnum } from "../db/schema/system-logs.js";
import { generateId } from "../db/utils/id.js";

/**
 * tslog 级别 ID 到级别名称的映射
 *
 * tslog 内部: 0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal
 */
const TSLOG_LEVEL_MAP: Record<number, LogLevelEnum> = {
  1: "trace",
  2: "debug",
  3: "info",
  4: "warn",
  5: "error",
  6: "fatal",
};

/**
 * DB Transport 配置
 */
export interface DbTransportOptions {
  /** SystemLogsRepository 实例 */
  repository: SystemLogsRepository;
  /** 缓冲阈值 (达到此数量触发 flush，默认 50) */
  batchSize?: number;
  /** 刷新间隔 (毫秒，默认 3000) */
  flushIntervalMs?: number;
  /** 最大队列容量 (超出时丢弃旧日志，默认 500) */
  maxQueueSize?: number;
  /** 最低持久化级别 (低于此级别的不写库，默认 debug) */
  minLevel?: LogLevelEnum;
}

/**
 * 日志级别权重 (用于过滤)
 */
const LEVEL_WEIGHT: Record<LogLevelEnum, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * 数据库日志传输类
 */
export class DatabaseLogTransport {
  private readonly repository: SystemLogsRepository;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly minLevelWeight: number;
  private readonly cachedHostname: string;

  private queue: NewSystemLog[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private shuttingDown = false;

  constructor(options: DbTransportOptions) {
    this.repository = options.repository;
    this.batchSize = options.batchSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 3000;
    this.maxQueueSize = options.maxQueueSize ?? 500;
    this.minLevelWeight = LEVEL_WEIGHT[options.minLevel ?? "debug"];
    this.cachedHostname = hostname();
  }

  /**
   * Transport 函数 - 注册到 tslog
   *
   * 将 LogObj 转换为 system_logs 记录并添加到队列
   */
  transport = (logObj: LogTransportRecord): void => {
    if (this.shuttingDown) {
      return;
    }

    try {
      const record = this.convertToLogRecord(logObj);
      if (!record) {
        return;
      }

      /** 级别过滤: 低于最低级别的不入库 */
      const levelWeight = LEVEL_WEIGHT[record.level as LogLevelEnum] ?? 0;
      if (levelWeight < this.minLevelWeight) {
        return;
      }

      this.queue.push(record);

      /** 队列溢出保护: 丢弃最旧的 25% */
      if (this.queue.length > this.maxQueueSize) {
        const dropCount = Math.floor(this.queue.length * 0.25);
        this.queue = this.queue.slice(dropCount);
      }

      /** 达到批量阈值立即刷新 */
      if (this.queue.length >= this.batchSize) {
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch {
      // transport 绝不能阻塞应用日志
    }
  };

  /**
   * 将 tslog LogObj 转换为 system_logs 记录
   */
  private convertToLogRecord(logObj: LogTransportRecord): NewSystemLog | null {
    const meta = logObj._meta as
      | { logLevelId?: number; logLevelName?: string; name?: string; date?: Date }
      | undefined;

    /** 提取日志级别 */
    const level = this.extractLevel(meta);
    if (!level) {
      return null;
    }

    /** 提取来源模块名 */
    const source = this.extractSource(meta);

    /** 提取消息内容 */
    const message = this.extractMessage(logObj);

    /** 提取错误信息 */
    const errorName = this.extractErrorName(logObj);

    /** 构建元数据 */
    const metadata = this.extractMetadata(logObj);

    return {
      id: generateId(),
      timestamp: meta?.date ?? new Date(),
      level,
      source,
      message,
      errorName,
      metadata,
    };
  }

  /**
   * 从 tslog _meta 中提取日志级别
   */
  private extractLevel(
    meta: { logLevelId?: number; logLevelName?: string } | undefined,
  ): LogLevelEnum | null {
    if (meta?.logLevelId !== undefined) {
      return TSLOG_LEVEL_MAP[meta.logLevelId] ?? null;
    }
    if (meta?.logLevelName) {
      const name = meta.logLevelName.toLowerCase();
      if (name in LEVEL_WEIGHT) {
        return name as LogLevelEnum;
      }
    }
    return "info";
  }

  /**
   * 从 tslog _meta.name 中提取来源模块
   */
  private extractSource(meta: { name?: string } | undefined): string {
    if (!meta?.name) {
      return "app";
    }
    /** tslog 的 name 可能是 JSON 字符串 (getChildLogger 的 bindings) */
    try {
      const parsed = JSON.parse(meta.name);
      if (typeof parsed === "object" && parsed !== null) {
        return ((parsed as Record<string, unknown>).module as string) ?? "app";
      }
      return String(parsed);
    } catch {
      return meta.name;
    }
  }

  /**
   * 从 LogObj 中提取消息文本
   */
  private extractMessage(logObj: LogTransportRecord): string {
    /** tslog 的参数在 0, 1, 2... 数字索引上 */
    const parts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const val = logObj[String(i)];
      if (val === undefined) break;
      if (typeof val === "string") {
        parts.push(val);
      } else {
        try {
          parts.push(JSON.stringify(val));
        } catch {
          parts.push(String(val));
        }
      }
    }

    if (parts.length > 0) {
      return parts.join(" ");
    }

    /** 回退: 尝试其他常见字段 */
    if (typeof logObj.message === "string") {
      return logObj.message;
    }
    if (typeof logObj.msg === "string") {
      return logObj.msg;
    }

    return JSON.stringify(logObj);
  }

  /**
   * 提取错误名称 (仅 error/fatal 级别)
   */
  private extractErrorName(logObj: LogTransportRecord): string | undefined {
    for (let i = 0; i < 10; i++) {
      const val = logObj[String(i)];
      if (val === undefined) break;
      if (val instanceof Error) {
        return val.name;
      }
      if (typeof val === "object" && val !== null && "name" in val && "stack" in val) {
        return (val as { name: string }).name;
      }
    }
    return undefined;
  }

  /**
   * 从 LogObj 中提取结构化元数据
   */
  private extractMetadata(logObj: LogTransportRecord): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      pid: process.pid,
      hostname: this.cachedHostname,
    };

    /** 提取非系统字段作为元数据 */
    for (const [key, value] of Object.entries(logObj)) {
      if (key === "_meta" || key === "date" || /^\d+$/.test(key)) {
        continue;
      }
      metadata[key] = value;
    }

    /** 提取错误堆栈 */
    for (let i = 0; i < 10; i++) {
      const val = logObj[String(i)];
      if (val === undefined) break;
      if (val instanceof Error) {
        metadata.errorStack = val.stack;
        break;
      }
      if (typeof val === "object" && val !== null && "stack" in val) {
        metadata.errorStack = (val as { stack: string }).stack;
        break;
      }
    }

    return metadata;
  }

  /**
   * 调度延迟刷新
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * 将队列中的日志批量写入数据库
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.repository.batchInsert(batch);
    } catch {
      // 数据库写入失败不影响应用运行
      // 日志丢失比应用崩溃更可接受
    } finally {
      this.flushing = false;
    }

    /** 如果队列中还有数据，继续刷新 */
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * 优雅关闭: 刷完剩余队列
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    /** 刷完所有剩余日志 */
    while (this.queue.length > 0) {
      await this.flush();
    }
  }

  /**
   * 获取当前队列长度 (用于监控和测试)
   */
  get queueLength(): number {
    return this.queue.length;
  }
}

/**
 * 创建数据库日志传输实例
 */
export function createDatabaseLogTransport(options: DbTransportOptions): DatabaseLogTransport {
  return new DatabaseLogTransport(options);
}
