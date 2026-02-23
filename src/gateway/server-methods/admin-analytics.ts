/**
 * 管理后台数据分析 RPC 方法
 *
 * 提供数据分析相关的 API（全部使用真实数据库数据）：
 * - admin.analytics.overview - 分析概览
 * - admin.analytics.users.growth - 用户增长趋势
 * - admin.analytics.users.retention - 用户留存分析
 * - admin.analytics.users.demographics - 用户画像
 * - admin.analytics.revenue.trend - 收入趋势
 * - admin.analytics.revenue.sources - 收入来源分布
 * - admin.analytics.revenue.metrics - ARPU/LTV 指标
 * - admin.analytics.skills.usage - 技能使用分析
 * - admin.analytics.funnels.* - 漏斗分析
 */

import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";
import {
  getAnalyticsOverview as getOverviewFromDB,
  getDeviceDistribution,
  getSubscriptionDistribution,
  getUserGrowthTrend as getUserGrowthTrendFromDB,
  getRevenueTrend as getRevenueTrendFromDB,
  getSkillUsageAnalytics as getSkillUsageAnalyticsFromDB,
  getUserRetention as getUserRetentionFromDB,
  getActiveHourDistribution,
  getRevenueSources as getRevenueSourcesFromDB,
  getUserValueMetrics as getUserValueMetricsFromDB,
  getFunnelAnalysis as getFunnelAnalysisFromDB,
  listFunnelTypes,
  getSkillUsageTrend,
} from "../../assistant/analytics/index.js";

/**
 * 获取分析概览（使用真实数据）
 */
const getAnalyticsOverview: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取分析概览");

  try {
    const data = await getOverviewFromDB();
    respond(true, {
      success: true,
      data,
    });
  } catch (error) {
    console.error("[admin-analytics] 获取分析概览失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取分析概览失败",
    });
  }
};

/**
 * 获取用户增长趋势（使用真实数据）
 */
const getUserGrowthTrend: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 获取用户增长趋势, period:", period);

  try {
    const result = await getUserGrowthTrendFromDB(period);

    respond(true, {
      success: true,
      data: {
        period,
        data: result.data,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取用户增长趋势失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取用户增长趋势失败",
    });
  }
};

/**
 * 获取用户留存分析（使用真实数据）
 */
const getUserRetention: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 获取用户留存分析, period:", period);

  try {
    const result = await getUserRetentionFromDB(period);

    respond(true, {
      success: true,
      data: {
        period,
        cohorts: result.cohorts,
        averageRetention: result.averageRetention,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取用户留存分析失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取用户留存分析失败",
    });
  }
};

/**
 * 获取用户画像（使用真实数据）
 *
 * 设备分布、订阅分布从 DB 获取；
 * 活跃时段从 audit_logs 聚合；
 * 地区分布暂不实现（缺少 IP 地理解析模块）。
 */
const getUserDemographics: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取用户画像");

  try {
    const [deviceData, subscriptionData, activeHours] = await Promise.all([
      getDeviceDistribution(),
      getSubscriptionDistribution(),
      getActiveHourDistribution(),
    ]);

    respond(true, {
      success: true,
      data: {
        byPlan: subscriptionData,
        byDevice: deviceData,
        byRegion: [], // 地区分布暂不实现，需 IP 地理解析模块
        byActiveHour: activeHours,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取用户画像失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取用户画像失败",
    });
  }
};

/**
 * 获取收入趋势（使用真实数据）
 */
const getRevenueTrend: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 获取收入趋势, period:", period);

  try {
    const result = await getRevenueTrendFromDB(period);

    respond(true, {
      success: true,
      data: {
        period,
        data: result.data,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取收入趋势失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取收入趋势失败",
    });
  }
};

/**
 * 获取收入来源分布（使用真实数据）
 */
const getRevenueSources: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取收入来源分布");

  try {
    const data = await getRevenueSourcesFromDB();

    respond(true, {
      success: true,
      data,
    });
  } catch (error) {
    console.error("[admin-analytics] 获取收入来源分布失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取收入来源分布失败",
    });
  }
};

/**
 * 获取用户价值指标（使用真实数据）
 */
const getUserValueMetrics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 获取用户价值指标, period:", period);

  try {
    const metrics = await getUserValueMetricsFromDB(period);

    respond(true, {
      success: true,
      data: {
        arpu: metrics.arpu,
        arppu: metrics.arppu,
        ltv: metrics.ltv,
        payingUserRate: metrics.payingUserRate,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取用户价值指标失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取用户价值指标失败",
    });
  }
};

/**
 * 获取技能使用分析（使用真实数据）
 */
const getSkillUsageAnalytics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 获取技能使用分析, period:", period);

  try {
    const [result, usageTrend] = await Promise.all([
      getSkillUsageAnalyticsFromDB(period),
      getSkillUsageTrend(period),
    ]);

    respond(true, {
      success: true,
      data: {
        period,
        topSkills: result.topSkills,
        categoryDistribution: result.categoryDistribution,
        usageTrend,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取技能使用分析失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取技能使用分析失败",
    });
  }
};

/**
 * 获取漏斗分析（使用真实数据）
 */
const getFunnelAnalysis: GatewayRequestHandler = async ({ params, respond }) => {
  const funnelType = (params.type as string) || "registration";
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 获取漏斗分析, type:", funnelType, "period:", period);

  try {
    const data = await getFunnelAnalysisFromDB(funnelType, period);

    respond(true, {
      success: true,
      data: {
        ...data,
        period,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 获取漏斗分析失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取漏斗分析失败",
    });
  }
};

/**
 * 获取可用漏斗列表（使用真实数据）
 */
const listFunnels: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取漏斗列表");

  const funnels = listFunnelTypes();

  respond(true, {
    success: true,
    funnels,
  });
};

/**
 * 导出分析处理器
 */
export const adminAnalyticsHandlers: GatewayRequestHandlers = {
  "admin.analytics.overview": getAnalyticsOverview,
  "admin.analytics.users.growth": getUserGrowthTrend,
  "admin.analytics.users.retention": getUserRetention,
  "admin.analytics.users.demographics": getUserDemographics,
  "admin.analytics.revenue.trend": getRevenueTrend,
  "admin.analytics.revenue.sources": getRevenueSources,
  "admin.analytics.revenue.metrics": getUserValueMetrics,
  "admin.analytics.skills.usage": getSkillUsageAnalytics,
  "admin.analytics.funnels.list": listFunnels,
  "admin.analytics.funnels.get": getFunnelAnalysis,
};
