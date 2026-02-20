/**
 * 用户级审计日志 API 路由
 *
 * 提供当前用户的审计日志查询、统计、导出、配置管理功能
 * 基于 JSON Lines 本地审计日志系统（assistant.audit.*）
 *
 * GET    /api/audit/logs           - 查询审计日志
 * GET    /api/audit/logs/recent    - 获取最近日志
 * GET    /api/audit/logs/stats     - 获取统计信息
 * GET    /api/audit/logs/export    - 导出日志
 * DELETE /api/audit/logs           - 清除日志
 * GET    /api/audit/config         - 获取审计配置
 * PUT    /api/audit/config         - 更新审计配置
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  getAuditConfig,
  updateAuditConfig,
  getRecentAuditLogs,
  type AuditLogFilters,
  type AuditExportOptions,
  type AuditLogConfig,
} from "../../../../../src/assistant/audit/index.js";

/**
 * 注册用户级审计日志路由
 */
export function registerAuditRoutes(server: FastifyInstance): void {
  /**
   * GET /api/audit/logs - 查询审计日志
   */
  server.get(
    "/api/audit/logs",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as {
        startTime?: string;
        endTime?: string;
        eventTypes?: string;
        severities?: string;
        results?: string;
        sourceTypes?: string;
        search?: string;
        sessionId?: string;
        offset?: string;
        limit?: string;
        sortOrder?: string;
      };

      request.log.info("[audit] 查询审计日志");

      const filters: AuditLogFilters = {
        startTime: query.startTime,
        endTime: query.endTime,
        eventTypes: query.eventTypes
          ? (query.eventTypes.split(",") as AuditLogFilters["eventTypes"])
          : undefined,
        severities: query.severities
          ? (query.severities.split(",") as AuditLogFilters["severities"])
          : undefined,
        results: query.results
          ? (query.results.split(",") as AuditLogFilters["results"])
          : undefined,
        sourceTypes: query.sourceTypes
          ? (query.sourceTypes.split(",") as AuditLogFilters["sourceTypes"])
          : undefined,
        search: query.search,
        sessionId: query.sessionId,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        sortOrder: query.sortOrder as AuditLogFilters["sortOrder"],
      };

      const result = await queryAuditLogs(filters);

      return {
        success: true,
        data: result,
      };
    },
  );

  /**
   * GET /api/audit/logs/recent - 获取最近的审计日志
   */
  server.get(
    "/api/audit/logs/recent",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { limit?: string };

      request.log.info("[audit] 获取最近审计日志");

      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const entries = await getRecentAuditLogs(limit);

      return {
        success: true,
        data: {
          entries,
          total: entries.length,
        },
      };
    },
  );

  /**
   * GET /api/audit/logs/stats - 获取审计日志统计
   */
  server.get(
    "/api/audit/logs/stats",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.info("[audit] 获取审计日志统计");

      const stats = await getAuditStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/audit/logs/export - 导出审计日志
   */
  server.get(
    "/api/audit/logs/export",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        format?: string;
        startTime?: string;
        endTime?: string;
        search?: string;
        eventTypes?: string;
        severities?: string;
      };

      const format = (query.format || "json") as "json" | "csv";
      if (!["json", "csv"].includes(format)) {
        return reply.code(400).send({
          success: false,
          error: "Format must be 'json' or 'csv'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info({ format }, "[audit] 导出审计日志");

      const options: AuditExportOptions = {
        format,
        filters: {
          startTime: query.startTime,
          endTime: query.endTime,
          search: query.search,
          eventTypes: query.eventTypes
            ? (query.eventTypes.split(",") as AuditLogFilters["eventTypes"])
            : undefined,
          severities: query.severities
            ? (query.severities.split(",") as AuditLogFilters["severities"])
            : undefined,
        },
      };

      const content = await exportAuditLogs(options);

      return {
        success: true,
        data: {
          content,
          format,
        },
      };
    },
  );

  /**
   * DELETE /api/audit/logs - 清除审计日志
   */
  server.delete(
    "/api/audit/logs",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { beforeDate?: string };

      request.log.info({ beforeDate: query.beforeDate }, "[audit] 清除审计日志");

      const result = await clearAuditLogs({ beforeDate: query.beforeDate });

      return { success: true, data: result };
    },
  );

  /**
   * GET /api/audit/config - 获取审计配置
   */
  server.get(
    "/api/audit/config",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.info("[audit] 获取审计配置");

      const config = getAuditConfig();

      return { success: true, data: { config } };
    },
  );

  /**
   * PUT /api/audit/config - 更新审计配置
   */
  server.put(
    "/api/audit/config",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = request.body as Partial<AuditLogConfig>;

      request.log.info("[audit] 更新审计配置");

      const config: Partial<AuditLogConfig> = {};

      if (typeof body.enabled === "boolean") {
        config.enabled = body.enabled;
      }
      if (typeof body.retentionDays === "number") {
        config.retentionDays = body.retentionDays;
      }
      if (typeof body.maxEntries === "number") {
        config.maxEntries = body.maxEntries;
      }
      if (typeof body.logChatContent === "boolean") {
        config.logChatContent = body.logChatContent;
      }
      if (typeof body.logFilePaths === "boolean") {
        config.logFilePaths = body.logFilePaths;
      }
      if (Array.isArray(body.eventTypes)) {
        config.eventTypes = body.eventTypes as AuditLogConfig["eventTypes"];
      }
      if (
        typeof body.minSeverity === "string" &&
        ["info", "warn", "critical"].includes(body.minSeverity)
      ) {
        config.minSeverity = body.minSeverity as AuditLogConfig["minSeverity"];
      }

      const updatedConfig = await updateAuditConfig(config);

      return { success: true, data: { config: updatedConfig } };
    },
  );
}
