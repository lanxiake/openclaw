/**
 * 审计日志 API 路由
 *
 * GET    /api/admin/audit-logs         - 获取审计日志列表
 * GET    /api/admin/audit-logs/stats   - 获取审计日志统计
 * GET    /api/admin/audit-logs/actions - 获取操作类型列表
 * GET    /api/admin/audit-logs/admins  - 获取管理员列表
 * GET    /api/admin/audit-logs/:id     - 获取审计日志详情
 * GET    /api/admin/audit-logs/export  - 导出审计日志
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getAdminAuditService } from "../../../../../src/assistant/admin-console/admin-audit-service.js";
import { getRequestAdmin } from "../../plugins/admin-auth.js";

/**
 * 注册审计日志路由
 */
export function registerAdminAuditRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/audit-logs - 获取审计日志列表
   */
  server.get(
    "/api/admin/audit-logs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        adminId?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(query.pageSize || "20", 10)),
      );

      request.log.info(
        { adminId: admin.adminId, page, pageSize },
        "[admin-audit] 查询审计日志列表",
      );

      const auditService = getAdminAuditService();
      const result = await auditService.listAuditLogs({
        page,
        pageSize,
        search: query.search,
        adminId: query.adminId,
        action: query.action,
        startDate: query.startDate,
        endDate: query.endDate,
        sortBy: query.sortBy as "createdAt" | undefined,
        sortOrder: query.sortOrder as "asc" | "desc" | undefined,
      });

      return {
        success: true,
        data: result.logs,
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      };
    },
  );

  /**
   * GET /api/admin/audit-logs/stats - 获取审计日志统计
   */
  server.get(
    "/api/admin/audit-logs/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-audit] 查询审计日志统计",
      );

      const auditService = getAdminAuditService();
      const stats = await auditService.getAuditLogStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/audit-logs/actions - 获取操作类型列表
   */
  server.get(
    "/api/admin/audit-logs/actions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-audit] 查询操作类型列表",
      );

      const auditService = getAdminAuditService();
      const actions = await auditService.getActionTypes();

      return { success: true, data: actions };
    },
  );

  /**
   * GET /api/admin/audit-logs/admins - 获取管理员列表
   */
  server.get(
    "/api/admin/audit-logs/admins",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-audit] 查询管理员列表",
      );

      const auditService = getAdminAuditService();
      const admins = await auditService.getAdminList();

      return { success: true, data: admins };
    },
  );

  /**
   * GET /api/admin/audit-logs/export - 导出审计日志
   */
  server.get(
    "/api/admin/audit-logs/export",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        format?: string;
        adminId?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
      };

      const format = (query.format || "json") as "json" | "csv";
      if (!["json", "csv"].includes(format)) {
        return reply.code(400).send({
          success: false,
          error: "Format must be 'json' or 'csv'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, format },
        "[admin-audit] 导出审计日志",
      );

      const auditService = getAdminAuditService();
      const result = await auditService.exportAuditLogs(
        {
          adminId: query.adminId,
          action: query.action,
          startDate: query.startDate,
          endDate: query.endDate,
        },
        format,
      );

      // 设置下载响应头
      reply.header("Content-Type", format === "json" ? "application/json" : "text/csv");
      reply.header("Content-Disposition", `attachment; filename="${result.filename}"`);

      return result.data;
    },
  );

  /**
   * GET /api/admin/audit-logs/:id - 获取审计日志详情
   */
  server.get(
    "/api/admin/audit-logs/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, logId: id },
        "[admin-audit] 查询审计日志详情",
      );

      const auditService = getAdminAuditService();
      const log = await auditService.getAuditLogDetail(id);
      if (!log) {
        return reply.code(404).send({
          success: false,
          error: "Audit log not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: log };
    },
  );
}
