/**
 * 绠＄悊鍛樼郴缁熺洃鎺?RPC 鏂规硶澶勭悊鍣? *
 * 鎻愪緵绯荤粺鐩戞帶鐩稿叧鐨?RPC 鏂规硶锛屼娇鐢ㄧ湡瀹炵郴缁熸暟鎹? */

import { ErrorCodes, errorShape } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  getSystemResources,
  getAllServicesHealth,
  getMonitorStats,
  generateResourceHistory,
} from "../../assistant/monitor/index.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-monitor";

/**
 * 鏃ュ織绾у埆绫诲瀷
 */
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 鐢熸垚妯℃嫙鐨?API 鏃堕棿绾挎暟鎹? *
 * TODO: 鍚庣画鍙粠瀹¤鏃ュ織琛ㄨ仛鍚堢湡瀹炴暟鎹? */
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
 * 妯℃嫙鏃ュ織鏁版嵁
 *
 * TODO: 浠庣郴缁熸棩蹇楁枃浠舵垨鏃ュ織琛ㄨ鍙? */
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
    message: "瀹㈡埛绔繛鎺ユ垚鍔?,
    metadata: { clientId: "client-123", ip: "192.168.1.100" },
  },
  {
    id: "log-2",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    level: "warn",
    source: "auth",
    message: "鐧诲綍灏濊瘯澶辫触",
    metadata: { username: "admin", reason: "瀵嗙爜閿欒" },
  },
  {
    id: "log-3",
    timestamp: new Date(Date.now() - 10000).toISOString(),
    level: "error",
    source: "database",
    message: "鏁版嵁搴撹繛鎺ヨ秴鏃?,
    metadata: { timeout: 30000, retries: 3 },
  },
  {
    id: "log-4",
    timestamp: new Date(Date.now() - 15000).toISOString(),
    level: "info",
    source: "api",
    message: "API 璇锋眰澶勭悊瀹屾垚",
    metadata: { method: "POST", path: "/api/users", duration: 125 },
  },
  {
    id: "log-5",
    timestamp: new Date(Date.now() - 20000).toISOString(),
    level: "debug",
    source: "cache",
    message: "缂撳瓨鍛戒腑",
    metadata: { key: "user:123", ttl: 3600 },
  },
  {
    id: "log-6",
    timestamp: new Date(Date.now() - 25000).toISOString(),
    level: "info",
    source: "scheduler",
    message: "瀹氭椂浠诲姟鎵ц瀹屾垚",
    metadata: { task: "cleanup", duration: 5230 },
  },
  {
    id: "log-7",
    timestamp: new Date(Date.now() - 30000).toISOString(),
    level: "warn",
    source: "gateway",
    message: "杩炴帴鏁版帴杩戜笂闄?,
    metadata: { current: 950, max: 1000 },
  },
  {
    id: "log-8",
    timestamp: new Date(Date.now() - 35000).toISOString(),
    level: "error",
    source: "api",
    message: "璇锋眰澶勭悊寮傚父",
    metadata: { method: "GET", path: "/api/skills", error: "Internal Server Error" },
  },
];

/**
 * 妯℃嫙鍛婅鏁版嵁
 */
const mockAlerts = [
  {
    id: "alert-1",
    type: "memory" as const,
    severity: "warning" as const,
    title: "鍐呭瓨浣跨敤鐜囪繃楂?,
    message: "鏈嶅姟鍣ㄥ唴瀛樹娇鐢ㄧ巼宸茶揪鍒?85%锛岃鍏虫敞",
    source: "monitor",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: "alert-2",
    type: "api_error" as const,
    severity: "critical" as const,
    title: "API 閿欒鐜囪繃楂?,
    message: "杩囧幓 5 鍒嗛挓鍐?API 閿欒鐜囪揪鍒?15%",
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
    title: "缂撳瓨鏈嶅姟涓嶅彲鐢?,
    message: "Redis 缂撳瓨鏈嶅姟杩炴帴澶辫触",
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
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * 楠岃瘉鏁板瓧鍙傛暟
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
 * 绠＄悊鍛樼郴缁熺洃鎺?RPC 鏂规硶澶勭悊鍣? */
export const adminMonitorHandlers: GatewayRequestHandlers = {
  /**
   * 鑾峰彇鐩戞帶缁熻姒傝锛堜娇鐢ㄧ湡瀹炴暟鎹級
   */
  "admin.monitor.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鐩戞帶缁熻`);

      const stats = await getMonitorStats();

      respond(true, { success: true, data: stats }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鐩戞帶缁熻澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇绯荤粺鍋ュ悍鐘舵€侊紙浣跨敤鐪熷疄鏁版嵁锛?   */
  "admin.monitor.health": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇绯荤粺鍋ュ悍鐘舵€乣);

      const health = await getAllServicesHealth();

      respond(true, { success: true, data: health }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇绯荤粺鍋ュ悍鐘舵€佸け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇 API 鐩戞帶鏁版嵁
   *
   * TODO: 浠庡璁℃棩蹇楄〃鑱氬悎鐪熷疄鏁版嵁
   */
  "admin.monitor.api": async ({ params, respond, context }) => {
    try {
      const period = validateStringParam(params, "period") || "day";

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇 API 鐩戞帶鏁版嵁`, { period });

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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇 API 鐩戞帶鏁版嵁澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇璧勬簮浣跨敤鎯呭喌锛堜娇鐢ㄧ湡瀹炴暟鎹級
   */
  "admin.monitor.resources": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇璧勬簮浣跨敤鎯呭喌`);

      const data = await getSystemResources();

      respond(true, { success: true, data }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇璧勬簮浣跨敤鎯呭喌澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇璧勬簮浣跨敤鍘嗗彶锛堝熀浜庡綋鍓嶅€肩敓鎴愶級
   */
  "admin.monitor.resources.history": async ({ params, respond, context }) => {
    try {
      const period = (validateStringParam(params, "period") || "hour") as "hour" | "day" | "week";

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇璧勬簮浣跨敤鍘嗗彶`, { period });

      // 鑾峰彇褰撳墠璧勬簮浣跨敤鎯呭喌
      const currentResources = await getSystemResources();

      // 鍩轰簬褰撳墠鍊肩敓鎴愬巻鍙叉暟鎹?      const timeline = generateResourceHistory(period, currentResources);

      const data = {
        timeline,
        period,
      };

      respond(true, { success: true, data }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇璧勬簮浣跨敤鍘嗗彶澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鏃ュ織鍒楄〃
   */
  "admin.monitor.logs": async ({ params, respond, context }) => {
    try {
      const level = validateStringParam(params, "level") as LogLevel | undefined;
      const source = validateStringParam(params, "source");
      const search = validateStringParam(params, "search");
      const limit = validateNumberParam(params, "limit", 50) || 50;
      const offset = validateNumberParam(params, "offset", 0) || 0;

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鏃ュ織鍒楄〃`, {
        level,
        source,
        search,
        limit,
        offset,
      });

      // 杩囨护鏃ュ織
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

      // 鍒嗛〉
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鏃ュ織鍒楄〃澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鏃ュ織鏉ユ簮鍒楄〃
   */
  "admin.monitor.logs.sources": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鏃ュ織鏉ユ簮鍒楄〃`);

      const sources = ["gateway", "api", "auth", "database", "cache", "scheduler", "monitor"];

      respond(true, { success: true, sources }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鍛婅鍒楄〃
   */
  "admin.monitor.alerts": async ({ params, respond, context }) => {
    try {
      const acknowledged = params.acknowledged as boolean | undefined;
      const resolved = params.resolved as boolean | undefined;

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鍛婅鍒楄〃`, { acknowledged, resolved });

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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鍛婅鍒楄〃澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 纭鍛婅
   */
  "admin.monitor.alerts.acknowledge": async ({ params, respond, context }) => {
    try {
      const alertId = validateStringParam(params, "alertId", true);

      if (!alertId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing alertId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 纭鍛婅`, { alertId });

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

      respond(true, { success: true, alertId, message: "鍛婅宸茬‘璁? }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 纭鍛婅澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 瑙ｅ喅鍛婅
   */
  "admin.monitor.alerts.resolve": async ({ params, respond, context }) => {
    try {
      const alertId = validateStringParam(params, "alertId", true);

      if (!alertId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing alertId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 瑙ｅ喅鍛婅`, { alertId });

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

      respond(true, { success: true, alertId, message: "鍛婅宸茶В鍐? }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 瑙ｅ喅鍛婅澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
