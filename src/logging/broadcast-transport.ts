/**
 * WebSocket 广播日志传输层
 *
 * 通过 Gateway 的广播机制将日志实时推送到 admin 客户端。
 * 仅推送 info 及以上级别，避免 trace/debug 淹没网络。
 */

import { generateId } from "../db/utils/id.js";
import type { LogTransportRecord } from "./logger.js";
import type { LogLevelEnum } from "../db/schema/system-logs.js";

/**
 * 广播函数类型 (来自 Gateway)
 */
export type BroadcastFn = (event: string, payload: unknown) => void;

/**
 * 推送到客户端的日志条目格式
 */
export interface BroadcastLogEntry {
  id: string;
  timestamp: string;
  level: LogLevelEnum;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * tslog 级别 ID 到级别名称的映射
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
 * 级别权重
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
 * Broadcast Transport 配置
 */
export interface BroadcastTransportOptions {
  /** Gateway 广播函数 */
  broadcaster: BroadcastFn;
  /** 最低广播级别 (默认 info，避免 trace/debug 淹没) */
  minLevel?: LogLevelEnum;
  /** 广播事件名称 (默认 "admin.logs.entry") */
  eventName?: string;
}

/**
 * WebSocket 广播日志传输类
 */
export class BroadcastLogTransport {
  private readonly broadcaster: BroadcastFn;
  private readonly minLevelWeight: number;
  private readonly eventName: string;

  constructor(options: BroadcastTransportOptions) {
    this.broadcaster = options.broadcaster;
    this.minLevelWeight = LEVEL_WEIGHT[options.minLevel ?? "info"];
    this.eventName = options.eventName ?? "admin.logs.entry";
  }

  /**
   * Transport 函数 - 注册到 tslog
   */
  transport = (logObj: LogTransportRecord): void => {
    try {
      const entry = this.convertToLogEntry(logObj);
      if (!entry) {
        return;
      }

      /** 级别过滤 */
      const levelWeight = LEVEL_WEIGHT[entry.level] ?? 0;
      if (levelWeight < this.minLevelWeight) {
        return;
      }

      /** 通过 Gateway 广播推送 */
      this.broadcaster(this.eventName, entry);
    } catch {
      // 广播失败不影响应用
    }
  };

  /**
   * 将 tslog LogObj 转换为广播日志条目
   */
  private convertToLogEntry(logObj: LogTransportRecord): BroadcastLogEntry | null {
    const meta = logObj._meta as
      | { logLevelId?: number; logLevelName?: string; name?: string; date?: Date }
      | undefined;

    /** 提取级别 */
    let level: LogLevelEnum = "info";
    if (meta?.logLevelId !== undefined) {
      level = TSLOG_LEVEL_MAP[meta.logLevelId] ?? "info";
    }

    /** 提取来源 */
    let source = "app";
    if (meta?.name) {
      try {
        const parsed = JSON.parse(meta.name);
        source =
          typeof parsed === "object" && parsed !== null
            ? (((parsed as Record<string, unknown>).module as string) ?? "app")
            : String(parsed);
      } catch {
        source = meta.name;
      }
    }

    /** 提取消息 */
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
    const message = parts.length > 0 ? parts.join(" ") : String(logObj.message ?? "");

    if (!message) {
      return null;
    }

    const timestamp = (meta?.date ?? new Date()).toISOString();

    return {
      id: generateId(),
      timestamp,
      level,
      source,
      message,
    };
  }
}

/**
 * 创建广播日志传输实例
 */
export function createBroadcastLogTransport(
  options: BroadcastTransportOptions,
): BroadcastLogTransport {
  return new BroadcastLogTransport(options);
}
