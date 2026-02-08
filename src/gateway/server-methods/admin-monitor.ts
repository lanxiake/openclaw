/**
 * 管理员系统监控 RPC 方法处理器
 *
 * 提供系统监控相关的 RPC 方法，使用真实系统数据
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  getSystemResources,
  getAllServicesHealth,
  getMonitorStats,
  generateResourceHistory,
} from "../../assistant/monitor/index.js";

// 日志标签
const LOG_TAG = "admin-monitor";

/**
 * 日志级别类型
 */
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 生成模拟的 API 时间线数据
 *
 * TODO: 后续可从审计日志表聚合真实数据
 */
function generateApiTimeline(hours: number = 24) {
  const timeline = [];
  const now = Date.now();

  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString();
    const baseRequests = 500 + Math.floor(Math.random() * 300);
    const errorRate = 0.01 + Math.random() * 0.03;

    timeline.push({
      timestamp,
      requests: baseRequests,
      errors: Math.floor(baseRequests * errorRate),
      avgTime: 50 + Math.floor(Math.random() * 100),
    });
  }

  return timeline;
}

/**
 * 模拟日志数据
 *
 * TODO: 从系统日志文件或日志表读取
 */
const mockLogs: Array<{
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}> = [
  {
    id: "log-1",
    timestamp: new Date(Date.now() - 1000).toISOString(),
    level: "info",
    source: "gateway",
    message: "客户端连接成功",
    metadata: { clientId: "client-123", ip: "192.168.1.100" },
  },
  {
    id: "log-2",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    level: "warn",
    source: "auth",
    message: "登录尝试失败",
    metadata: { username: "admin", reason: "密码错误" },
  },
  {
    id: "log-3",
    timestamp: new Date(Date.now() - 10000).toISOString(),
    level: "error",
    source: "database",
    message: "数据库连接超时",
    metadata: { timeout: 30000, retries: 3 },
  },
  {
    id: "log-4",
    timestamp: new Date(Date.now() - 15000).toISOString(),
    level: "info",
    source: "api",
    message: "API 请求处理完成",
    metadata: { method: "POST", path: "/api/users", duration: 125 },
  },
  {
    id: "log-5",
    timestamp: new Date(Date.now() - 20000).toISOString(),
    level: "debug",
    source: "cache",
    message: "缓存命中",
    metadata: { key: "user:123", ttl: 3600 },
  },
  {
    id: "log-6",
    timestamp: new Date(Date.now() - 25000).toISOString(),
    level: "info",
    source: "scheduler",
    message: "定时任务执行完成",
    metadata: { task: "cleanup", duration: 5230 },
  },
  {
    id: "log-7",
    timestamp: new Date(Date.now() - 30000).toISOString(),
    level: "warn",
    source: "gateway",
    message: "连接数接近上限",
    metadata: { current: 950, max: 1000 },
  },
  {
    id: "log-8",
    timestamp: new Date(Date.now() - 35000).toISOString(),
    level: "error",
    source: "api",
    message: "请求处理异常",
    metadata: { method: "GET", path: "/api/skills", error: "Internal Server Error" },
  },
];

/**
 * 模拟告警数据
 */
const mockAlerts = [
  {
    id: "alert-1",
    type: "memory" as const,
    severity: "warning" as const,
    title: "内存使用率过高",
    message: "服务器内存使用率已达到 85%，请关注",
    source: "monitor",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: "alert-2",
    type: "api_error" as const,
    severity: "critical" as const,
    title: "API 错误率过高",
    message: "过去 5 分钟内 API 错误率达到 15%",
    source: "api-monitor",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    acknowledged: true,
    acknowledgedBy: "admin",
    acknowledgedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    resolved: false,
  },
  {
    id: "alert-3",
    type: "service_down" as const,
    severity: "critical" as const,
    title: "缓存服务不可用",
    message: "Redis 缓存服务连接失败",
    source: "health-check",
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    acknowledged: true,
    acknowledgedBy: "admin",
    acknowledgedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    resolved: true,
    resolvedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

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
   * 获取 API 监控数据
   *
   * TODO: 从审计日志表聚合真实数据
   */
  "admin.monitor.api": async ({ params, respond, context }) => {
    try {
      const period = validateStringParam(params, "period") || "day";

      context.logGateway.info(`[${LOG_TAG}] 获取 API 监控数据`, { period });

      const hours = period === "hour" ? 1 : period === "day" ? 24 : 168;

      const data = {
        summary: {
          totalRequests: 125680,
          successRequests: 124424,
          errorRequests: 1256,
          avgResponseTime: 85,
          p95ResponseTime: 250,
          p99ResponseTime: 500,
          requestsPerSecond: 145.5,
          errorRate: 1.0,
        },
        byEndpoint: [
          {
            method: "GET",
            path: "/api/users",
            count: 35420,
            avgTime: 45,
            errorCount: 35,
            errorRate: 0.1,
          },
          {
            method: "POST",
            path: "/api/chat",
            count: 28560,
            avgTime: 120,
            errorCount: 285,
            errorRate: 1.0,
          },
          {
            method: "GET",
            path: "/api/skills",
            count: 22340,
            avgTime: 65,
            errorCount: 112,
            errorRate: 0.5,
          },
          {
            method: "POST",
            path: "/api/auth/login",
            count: 15680,
            avgTime: 180,
            errorCount: 470,
            errorRate: 3.0,
          },
          {
            method: "GET",
            path: "/api/subscriptions",
            count: 12450,
            avgTime: 55,
            errorCount: 62,
            errorRate: 0.5,
          },
        ],
        byStatusCode: [
          { code: 200, count: 118920 },
          { code: 201, count: 5504 },
          { code: 400, count: 628 },
          { code: 401, count: 314 },
          { code: 404, count: 188 },
          { code: 500, count: 126 },
        ],
        timeline: generateApiTimeline(hours),
      };

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
   * 获取资源使用历史（基于当前值生成）
   */
  "admin.monitor.resources.history": async ({ params, respond, context }) => {
    try {
      const period = (validateStringParam(params, "period") || "hour") as "hour" | "day" | "week";

      context.logGateway.info(`[${LOG_TAG}] 获取资源使用历史`, { period });

      // 获取当前资源使用情况
      const currentResources = await getSystemResources();

      // 基于当前值生成历史数据
      const timeline = generateResourceHistory(period, currentResources);

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
   * 获取日志列表
   */
  "admin.monitor.logs": async ({ params, respond, context }) => {
    try {
      const level = validateStringParam(params, "level") as LogLevel | undefined;
      const source = validateStringParam(params, "source");
      const search = validateStringParam(params, "search");
      const limit = validateNumberParam(params, "limit", 50) || 50;
      const offset = validateNumberParam(params, "offset", 0) || 0;

      context.logGateway.info(`[${LOG_TAG}] 获取日志列表`, {
        level,
        source,
        search,
        limit,
        offset,
      });

      // 过滤日志
      let filtered = [...mockLogs];

      if (level) {
        filtered = filtered.filter((log) => log.level === level);
      }

      if (source) {
        filtered = filtered.filter((log) => log.source === source);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (log) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.source.toLowerCase().includes(searchLower),
        );
      }

      // 分页
      const total = filtered.length;
      const logs = filtered.slice(offset, offset + limit);

      respond(
        true,
        {
          success: true,
          logs,
          total,
          hasMore: offset + limit < total,
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
   * 获取日志来源列表
   */
  "admin.monitor.logs.sources": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取日志来源列表`);

      const sources = ["gateway", "api", "auth", "database", "cache", "scheduler", "monitor"];

      respond(true, { success: true, sources }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取告警列表
   */
  "admin.monitor.alerts": async ({ params, respond, context }) => {
    try {
      const acknowledged = params.acknowledged as boolean | undefined;
      const resolved = params.resolved as boolean | undefined;

      context.logGateway.info(`[${LOG_TAG}] 获取告警列表`, { acknowledged, resolved });

      let filtered = [...mockAlerts];

      if (acknowledged !== undefined) {
        filtered = filtered.filter((a) => a.acknowledged === acknowledged);
      }

      if (resolved !== undefined) {
        filtered = filtered.filter((a) => a.resolved === resolved);
      }

      const unacknowledged = mockAlerts.filter((a) => !a.acknowledged).length;

      respond(
        true,
        {
          success: true,
          alerts: filtered,
          total: filtered.length,
          unacknowledged,
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

      context.logGateway.info(`[${LOG_TAG}] 确认告警`, { alertId });

      const alert = mockAlerts.find((a) => a.id === alertId);

      if (!alert) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Alert not found: ${alertId}`),
        );
        return;
      }

      alert.acknowledged = true;
      alert.acknowledgedBy = "admin";
      alert.acknowledgedAt = new Date().toISOString();

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

      const alert = mockAlerts.find((a) => a.id === alertId);

      if (!alert) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Alert not found: ${alertId}`),
        );
        return;
      }

      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();

      respond(true, { success: true, alertId, message: "告警已解决" }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 解决告警失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
