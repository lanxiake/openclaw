/**
 * 管理员系统监控 RPC 方法处理器
 *
 * 提供系统监控相关的 RPC 方法，使用真实系统数据。
 * 日志查询委托 LogService（使用 system_logs 表），
 * 资源历史从 system_metrics 表查询真实采集数据，
 * 告警管理委托 AlertService（使用 system_alerts 表）。
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  getSystemResources,
  getAllServicesHealth,
  getMonitorStats,
  generateResourceHistory,
  getApiMonitorStats,
  getLogService,
  getAlertService,
} from "../../assistant/monitor/index.js";
import { getSystemMetricsRepository } from "../../db/repositories/system-metrics.js";

// 日志标签
const LOG_TAG = "admin-monitor";

// 延迟初始化的服务实例
let _logService: ReturnType<typeof getLogService> | null = null;
let _alertService: ReturnType<typeof getAlertService> | null = null;

/**
 * 获取 LogService 实例（延迟初始化）
 */
function logService() {
  if (!_logService) {
    _logService = getLogService();
  }
  return _logService;
}

/**
 * 获取 AlertService 实例（延迟初始化）
 */
function alertService() {
  if (!_alertService) {
    _alertService = getAlertService();
  }
  return _alertService;
}

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }

  return value.trim();
}

/**
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  defaultValue?: number,
): number | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }

  return value;
}

/**
 * 管理员系统监控 RPC 方法处理器
 */
export const adminMonitorHandlers: GatewayRequestHandlers = {
  /**
   * 获取监控统计概览（使用真实数据）
   */
  "admin.monitor.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取监控统计`);

      const stats = await getMonitorStats();

      respond(true, { success: true, data: stats }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取监控统计失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取系统健康状态（使用真实数据）
   */
  "admin.monitor.health": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取系统健康状态`);

      const health = await getAllServicesHealth();

      respond(true, { success: true, data: health }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取系统健康状态失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取 API 监控数据（从审计日志聚合真实数据）
   */
  "admin.monitor.api": async ({ params, respond, context }) => {
    try {
      const period = validateStringParam(params, "period") || "day";

      context.logGateway.info(`[${LOG_TAG}] 获取 API 监控数据`, { period });

      const hours = period === "hour" ? 1 : period === "day" ? 24 : 168;

      const data = await getApiMonitorStats(hours);

      respond(true, { success: true, data }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取 API 监控数据失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取资源使用情况（使用真实数据）
   */
  "admin.monitor.resources": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取资源使用情况`);

      const data = await getSystemResources();

      respond(true, { success: true, data }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取资源使用情况失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取资源使用历史（优先使用 system_metrics 真实数据）
   *
   * 从 system_metrics 表查询真实采集的历史数据。
   * 如果表中没有足够数据（刚启动、采集器未运行等），回退到模拟生成。
   */
  "admin.monitor.resources.history": async ({ params, respond, context }) => {
    try {
      const period = (validateStringParam(params, "period") || "hour") as "hour" | "day" | "week";

      context.logGateway.info(`[${LOG_TAG}] 获取资源使用历史`, { period });

      /** 计算时间范围 */
      const now = new Date();
      const startTime = new Date(now);
      if (period === "hour") {
        startTime.setHours(startTime.getHours() - 1);
      } else if (period === "day") {
        startTime.setDate(startTime.getDate() - 1);
      } else {
        startTime.setDate(startTime.getDate() - 7);
      }

      /** 尝试从 system_metrics 获取真实历史数据 */
      type TimelineEntry = { timestamp: string; cpu: number; memory: number; disk: number };
      let timeline: TimelineEntry[];

      try {
        const metricsRepo = getSystemMetricsRepository();
        const metrics = await metricsRepo.getTimeseries({
          startTime,
          endTime: now,
          metricType: "system",
        });

        if (metrics.length >= 3) {
          /** 有足够的真实数据，按时间正序返回 */
          timeline = metrics.reverse().map((m) => ({
            timestamp: m.timestamp.toISOString(),
            cpu: Number(m.cpuUsage ?? 0),
            memory: Number(m.memoryUsage ?? 0),
            disk: Number(m.diskUsage ?? 0),
          }));
        } else {
          /** 数据不足，回退到模拟生成 */
          const currentResources = await getSystemResources();
          timeline = generateResourceHistory(period, currentResources);
        }
      } catch {
        /** 查询失败，回退到模拟生成 */
        const currentResources = await getSystemResources();
        timeline = generateResourceHistory(period, currentResources);
      }

      const data = {
        timeline,
        period,
      };

      respond(true, { success: true, data }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取资源使用历史失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取日志列表（从 system_logs 表查询真实应用日志）
   */
  "admin.monitor.logs": async ({ params, respond, context }) => {
    try {
      const level = validateStringParam(params, "level") as
        | "debug"
        | "info"
        | "warn"
        | "error"
        | "fatal"
        | undefined;
      const source = validateStringParam(params, "source");
      const search = validateStringParam(params, "search");
      const startTime = validateStringParam(params, "startTime");
      const endTime = validateStringParam(params, "endTime");
      const limit = validateNumberParam(params, "limit", 50) || 50;
      const offset = validateNumberParam(params, "offset", 0) || 0;

      context.logGateway.info(`[${LOG_TAG}] 获取日志列表`, {
        level,
        source,
        search,
        limit,
        offset,
      });

      const result = await logService().queryLogs({
        level,
        source,
        search,
        startTime,
        endTime,
        limit,
        offset,
      });

      respond(
        true,
        {
          success: true,
          logs: result.logs,
          total: result.total,
          hasMore: result.hasMore,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取日志列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取日志来源列表（从 system_logs 表查询去重 source）
   */
  "admin.monitor.logs.sources": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取日志来源列表`);

      const sources = await logService().getSources();

      respond(true, { success: true, sources }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取日志统计信息（按级别、来源分组计数）
   */
  "admin.monitor.logs.stats": async ({ params, respond, context }) => {
    try {
      const startTime = validateStringParam(params, "startTime");
      const endTime = validateStringParam(params, "endTime");

      context.logGateway.info(`[${LOG_TAG}] 获取日志统计`);

      const stats = await logService().getStats({
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      });

      respond(true, { success: true, data: stats }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取日志统计失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取告警列表（从 system_alerts 表查询真实数据）
   */
  "admin.monitor.alerts": async ({ params, respond, context }) => {
    try {
      const acknowledged = params.acknowledged as boolean | undefined;
      const resolved = params.resolved as boolean | undefined;

      context.logGateway.info(`[${LOG_TAG}] 获取告警列表`, { acknowledged, resolved });

      const result = await alertService().listAlerts({
        acknowledged,
        resolved,
      });

      respond(
        true,
        {
          success: true,
          alerts: result.alerts,
          total: result.total,
          unacknowledged: result.unacknowledged,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取告警列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 确认告警
   */
  "admin.monitor.alerts.acknowledge": async ({ params, respond, context }) => {
    try {
      const alertId = validateStringParam(params, "alertId", true);

      if (!alertId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing alertId"));
        return;
      }

      // 从 context 获取管理员信息
      const adminName =
        validateStringParam(params, "adminName") ||
        ((context as Record<string, unknown>).adminUsername as string) ||
        "admin";

      context.logGateway.info(`[${LOG_TAG}] 确认告警`, { alertId, adminName });

      await alertService().acknowledgeAlert(alertId, adminName);

      respond(true, { success: true, alertId, message: "告警已确认" }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 确认告警失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 解决告警
   */
  "admin.monitor.alerts.resolve": async ({ params, respond, context }) => {
    try {
      const alertId = validateStringParam(params, "alertId", true);

      if (!alertId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing alertId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 解决告警`, { alertId });

      await alertService().resolveAlert(alertId);

      respond(true, { success: true, alertId, message: "告警已解决" }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 解决告警失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
