/**
 * 数据分析 API 路由
 *
 * GET    /api/admin/analytics/overview            - 分析概览
 * GET    /api/admin/analytics/users/growth        - 用户增长趋势
 * GET    /api/admin/analytics/users/retention     - 用户留存分析
 * GET    /api/admin/analytics/users/demographics  - 用户画像
 * GET    /api/admin/analytics/revenue/trend       - 收入趋势
 * GET    /api/admin/analytics/revenue/sources     - 收入来源分布
 * GET    /api/admin/analytics/revenue/metrics     - 用户价值指标
 * GET    /api/admin/analytics/skills/usage        - 技能使用分析
 * GET    /api/admin/analytics/funnels             - 漏斗类型列表
 * GET    /api/admin/analytics/funnels/:type       - 漏斗分析
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getAnalyticsOverview,
  getUserGrowthTrend,
  getRevenueTrend,
  getSkillUsageAnalytics,
  getDeviceDistribution,
  getSubscriptionDistribution,
  getUserRetention,
  getActiveHourDistribution,
  getRevenueSources,
  getUserValueMetrics,
  getFunnelAnalysis,
  listFunnelTypes,
  getSkillUsageTrend,
} from "../../../../../src/assistant/analytics/index.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";

/**
 * 注册数据分析路由
 */
export function registerAdminAnalyticsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/analytics/overview - 分析概览
   */
  server.get(
    "/api/admin/analytics/overview",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-analytics] 查询分析概览",
      );

      const data = await getAnalyticsOverview();

      return { success: true, data };
    },
  );

  /**
   * GET /api/admin/analytics/users/growth - 用户增长趋势
   */
  server.get(
    "/api/admin/analytics/users/growth",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { period?: string };
      const period = (query.period as "week" | "month" | "quarter") || "month";

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-analytics] 查询用户增长趋势",
      );

      const result = await getUserGrowthTrend(period);

      return {
        success: true,
        data: { period, data: result.data, summary: result.summary },
      };
    },
  );

  /**
   * GET /api/admin/analytics/users/retention - 用户留存分析
   */
  server.get(
    "/api/admin/analytics/users/retention",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { period?: string };
      const period = query.period || "month";

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-analytics] 查询用户留存分析",
      );

      const result = await getUserRetention(period);

      return {
        success: true,
        data: { period, cohorts: result.cohorts, averageRetention: result.averageRetention },
      };
    },
  );

  /**
   * GET /api/admin/analytics/users/demographics - 用户画像
   */
  server.get(
    "/api/admin/analytics/users/demographics",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-analytics] 查询用户画像",
      );

      const [deviceData, subscriptionData, activeHours] = await Promise.all([
        getDeviceDistribution(),
        getSubscriptionDistribution(),
        getActiveHourDistribution(),
      ]);

      return {
        success: true,
        data: {
          byPlan: subscriptionData,
          byDevice: deviceData,
          byRegion: [],
          byActiveHour: activeHours,
        },
      };
    },
  );

  /**
   * GET /api/admin/analytics/revenue/trend - 收入趋势
   */
  server.get(
    "/api/admin/analytics/revenue/trend",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { period?: string };
      const period = (query.period as "week" | "month" | "quarter") || "month";

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-analytics] 查询收入趋势",
      );

      const result = await getRevenueTrend(period);

      return {
        success: true,
        data: { period, data: result.data, summary: result.summary },
      };
    },
  );

  /**
   * GET /api/admin/analytics/revenue/sources - 收入来源分布
   */
  server.get(
    "/api/admin/analytics/revenue/sources",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-analytics] 查询收入来源分布",
      );

      const data = await getRevenueSources();

      return { success: true, data };
    },
  );

  /**
   * GET /api/admin/analytics/revenue/metrics - 用户价值指标
   */
  server.get(
    "/api/admin/analytics/revenue/metrics",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { period?: string };
      const period = query.period || "month";

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-analytics] 查询用户价值指标",
      );

      const metrics = await getUserValueMetrics(period);

      return { success: true, data: metrics };
    },
  );

  /**
   * GET /api/admin/analytics/skills/usage - 技能使用分析
   */
  server.get(
    "/api/admin/analytics/skills/usage",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const query = request.query as { period?: string };
      const period = (query.period as "week" | "month" | "quarter") || "month";

      request.log.info(
        { adminId: admin.adminId, period },
        "[admin-analytics] 查询技能使用分析",
      );

      const [result, usageTrend] = await Promise.all([
        getSkillUsageAnalytics(period),
        getSkillUsageTrend(period),
      ]);

      return {
        success: true,
        data: {
          period,
          topSkills: result.topSkills,
          categoryDistribution: result.categoryDistribution,
          usageTrend,
          summary: result.summary,
        },
      };
    },
  );

  /**
   * GET /api/admin/analytics/funnels - 漏斗类型列表
   */
  server.get(
    "/api/admin/analytics/funnels",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);

      request.log.info(
        { adminId: admin.adminId },
        "[admin-analytics] 查询漏斗类型列表",
      );

      const funnels = listFunnelTypes();

      return { success: true, data: funnels };
    },
  );

  /**
   * GET /api/admin/analytics/funnels/:type - 漏斗分析
   */
  server.get(
    "/api/admin/analytics/funnels/:type",
    { preHandler: requirePermission("system", "viewLogs") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { type } = request.params as { type: string };
      const query = request.query as { period?: string };
      const period = query.period || "month";

      request.log.info(
        { adminId: admin.adminId, funnelType: type, period },
        "[admin-analytics] 查询漏斗分析",
      );

      const data = await getFunnelAnalysis(type, period);

      return { success: true, data: { ...data, period } };
    },
  );
}
