/**
 * 监控 API 路由
 *
 * GET    /api/admin/monitor/stats          - 获取监控统计概览
 * GET    /api/admin/monitor/resources      - 获取系统资源信息
 * GET    /api/admin/monitor/health         - 获取服务健康状态
 * GET    /api/admin/monitor/api            - 获取 API 监控数据
 * GET    /api/admin/monitor/resources/history - 获取资源使用历史
 * GET    /api/admin/monitor/logs           - 获取日志列表
 * GET    /api/admin/monitor/logs/sources   - 获取日志来源列表
 * GET    /api/admin/monitor/logs/stats     - 获取日志统计
 * GET    /api/admin/monitor/alerts         - 获取告警列表
 * POST   /api/admin/monitor/alerts/:id/acknowledge - 确认告警
 * POST   /api/admin/monitor/alerts/:id/resolve     - 解决告警
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getMonitorStats,
  getSystemResources,
  getAllServicesHealth,
  getApiMonitorStats,
  getLogService,
  getAlertService,
  generateResourceHistory,
} from "../../../../../src/assistant/monitor/index.js";
import { getSystemMetricsRepository } from "../../../../../src/db/repositories/system-metrics.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";

/**
 * 注册监控路由
 */
export function registerAdminMonitorRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/monitor/stats - 获取监控统计概览
   */
  server.get(
    "/api/admin/monitor/stats",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-monitor] 查询监控统计概览",
      );

      const stats = await getMonitorStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/monitor/resources - 获取系统资源信息
   */
  server.get(
    "/api/admin/monitor/resources",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-monitor] 查询系统资源信息",
      );

      const resources = await getSystemResources();

      return { success: true, data: resources };
    },
  );

  /**
   * GET /api/admin/monitor/health - 获取服务健康状态
   */
  server.get(
    "/api/admin/monitor/health",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-monitor] 查询服务健康状态",
      );

      const health = await getAllServicesHealth();

      return { success: true, data: health };
    },
  );

  /**
   * GET /api/admin/monitor/api - 获取 API 监控数据
   */
  server.get(
    "/api/admin/monitor/api",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as { hours?: string };
      const hours = Math.min(168, Math.max(1, parseInt(query.hours || "24", 10)));

      request.log.info(
        { adminId: admin.adminId, hours },
        "[admin-monitor] 查询 API 监控数据",
      );

      const apiStats = await getApiMonitorStats(hours);

      return { success: true, data: apiStats };
    },
  );

  /**
   * GET /api/admin/monitor/resources/history - 获取资源使用历史
   *
   * 从 system_metrics 表查询真实历史数据，数据不足时回退到模拟生成。
   * 查询参数 period: 'hour' | 'day' | 'week'（默认 'hour'）
   */
  server.get(
    "/api/admin/monitor/resources/history",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as { period?: string };
      const period = (query.period === "day" || query.period === "week") ? query.period : "hour";

      /** 根据时间周期计算查询起点 */
      const periodHours = { hour: 1, day: 24, week: 168 };
      const now = new Date();
      const startTime = new Date(now.getTime() - periodHours[period] * 60 * 60 * 1000);

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-monitor] 查询资源使用历史",
      );

      /** 尝试从 system_metrics 表查询真实数据 */
      const metricsRepo = getSystemMetricsRepository();
      const metrics = await metricsRepo.getTimeseries({
        startTime,
        endTime: now,
        metricType: "system",
      });

      let timeline: Array<{ timestamp: string; cpu: number; memory: number; disk: number }>;

      if (metrics.length >= 3) {
        /** 有足够的真实数据，使用真实历史 */
        timeline = [...metrics].reverse().map((m) => ({
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
          cpu: parseFloat(String(m.cpuUsage)) || 0,
          memory: parseFloat(String(m.memoryUsage)) || 0,
          disk: parseFloat(String(m.diskUsage)) || 0,
        }));
      } else {
        /** 数据不足，回退到模拟生成 */
        const currentResources = await getSystemResources();
        timeline = generateResourceHistory(period, currentResources);
      }

      /** 转换为前端 ResourceHistory 格式 */
      const data = {
        labels: timeline.map((t) => t.timestamp),
        cpu: timeline.map((t) => t.cpu),
        memory: timeline.map((t) => t.memory),
        disk: timeline.map((t) => t.disk),
      };

      return { success: true, data };
    },
  );

  /**
   * GET /api/admin/monitor/logs - 获取日志列表
   */
  server.get(
    "/api/admin/monitor/logs",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        level?: string;
        source?: string;
        search?: string;
        startTime?: string;
        endTime?: string;
        limit?: string;
        offset?: string;
      };

      request.log.info(
        { adminId: admin.adminId, level: query.level, source: query.source },
        "[admin-monitor] 查询日志列表",
      );

      const logSvc = getLogService();
      const result = await logSvc.queryLogs({
        level: query.level as "debug" | "info" | "warn" | "error" | "fatal" | undefined,
        source: query.source,
        search: query.search,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return {
        success: true,
        data: {
          logs: result.logs,
          total: result.total,
          hasMore: result.hasMore,
        },
      };
    },
  );

  /**
   * GET /api/admin/monitor/logs/sources - 获取日志来源列表
   */
  server.get(
    "/api/admin/monitor/logs/sources",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-monitor] 查询日志来源列表",
      );

      const logSvc = getLogService();
      const sources = await logSvc.getSources();

      return { success: true, data: sources };
    },
  );

  /**
   * GET /api/admin/monitor/logs/stats - 获取日志统计
   */
  server.get(
    "/api/admin/monitor/logs/stats",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        startTime?: string;
        endTime?: string;
      };

      request.log.info(
        { adminId: admin.adminId },
        "[admin-monitor] 查询日志统计",
      );

      const logSvc = getLogService();
      const stats = await logSvc.getStats({
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      });

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/monitor/alerts - 获取告警列表
   */
  server.get(
    "/api/admin/monitor/alerts",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      const query = request.query as {
        acknowledged?: string;
        resolved?: string;
        severity?: string;
        limit?: string;
        offset?: string;
      };

      request.log.info(
        { adminId: admin.adminId, acknowledged: query.acknowledged },
        "[admin-monitor] 查询告警列表",
      );

      const alertSvc = getAlertService();
      const result = await alertSvc.listAlerts({
        acknowledged: query.acknowledged !== undefined ? query.acknowledged === "true" : undefined,
        resolved: query.resolved !== undefined ? query.resolved === "true" : undefined,
        severity: query.severity as "info" | "warning" | "critical" | undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return {
        success: true,
        data: {
          alerts: result.alerts,
          total: result.total,
          unacknowledged: result.unacknowledged,
        },
      };
    },
  );

  /**
   * POST /api/admin/monitor/alerts/:id/acknowledge - 确认告警
   */
  server.post(
    "/api/admin/monitor/alerts/:id/acknowledge",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, alertId: id },
        "[admin-monitor] 确认告警",
      );

      const alertSvc = getAlertService();
      await alertSvc.acknowledgeAlert(id, admin.adminId);

      return { success: true, message: "告警已确认" };
    },
  );

  /**
   * POST /api/admin/monitor/alerts/:id/resolve - 解决告警
   */
  server.post(
    "/api/admin/monitor/alerts/:id/resolve",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, alertId: id },
        "[admin-monitor] 解决告警",
      );

      const alertSvc = getAlertService();
      await alertSvc.resolveAlert(id);

      return { success: true, message: "告警已解决" };
    },
  );
}
