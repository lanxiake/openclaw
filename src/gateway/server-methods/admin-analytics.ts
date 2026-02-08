/**
 * 管理后台数据分析 RPC 方法
 *
 * 提供数据分析相关的 API：
 * - admin.analytics.overview - 分析概览（使用真实数据）
 * - admin.analytics.users.growth - 用户增长趋势
 * - admin.analytics.users.retention - 用户留存分析
 * - admin.analytics.users.demographics - 用户画像（使用真实数据）
 * - admin.analytics.revenue.trend - 收入趋势
 * - admin.analytics.revenue.sources - 收入来源分布
 * - admin.analytics.revenue.metrics - ARPU/LTV 指标
 * - admin.analytics.skills.usage - 技能使用分析
 * - admin.analytics.funnels.* - 漏斗分析
 */

import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";
import {
  getAnalyticsOverview as getOverviewFromDB,
  getUserStats,
  getRevenueStats,
  getDeviceDistribution,
  getSubscriptionDistribution,
  generateTimeSeriesData,
  getUserGrowthTrend as getUserGrowthTrendFromDB,
  getRevenueTrend as getRevenueTrendFromDB,
  getSkillUsageAnalytics as getSkillUsageAnalyticsFromDB,
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
 * 获取用户留存分析
 */
const getUserRetention: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 获取用户留存分析, period:", period);

  // 生成队列数据
  const cohorts = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    cohorts.push({
      cohort: date.toISOString().split("T")[0],
      day1: Math.floor(Math.random() * 20) + 60,
      day3: Math.floor(Math.random() * 15) + 45,
      day7: Math.floor(Math.random() * 15) + 35,
      day14: Math.floor(Math.random() * 10) + 25,
      day30: Math.floor(Math.random() * 10) + 15,
    });
  }

  // 计算平均留存率
  const avgRetention = {
    day1: Math.floor(cohorts.reduce((s, c) => s + c.day1, 0) / cohorts.length),
    day3: Math.floor(cohorts.reduce((s, c) => s + c.day3, 0) / cohorts.length),
    day7: Math.floor(cohorts.reduce((s, c) => s + c.day7, 0) / cohorts.length),
    day14: Math.floor(cohorts.reduce((s, c) => s + c.day14, 0) / cohorts.length),
    day30: Math.floor(cohorts.reduce((s, c) => s + c.day30, 0) / cohorts.length),
  };

  respond(true, {
    success: true,
    data: {
      period,
      cohorts,
      averageRetention: avgRetention,
    },
  });
};

/**
 * 获取用户画像（使用真实数据）
 */
const getUserDemographics: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取用户画像");

  try {
    // 并行获取设备分布和订阅分布
    const [deviceData, subscriptionData] = await Promise.all([
      getDeviceDistribution(),
      getSubscriptionDistribution(),
    ]);

    // 地区分布暂时使用模拟数据（需要用户地理位置追踪功能）
    const byRegion = [
      { region: "华东", count: 5020, percentage: 32.0 },
      { region: "华北", count: 3610, percentage: 23.0 },
      { region: "华南", count: 2980, percentage: 19.0 },
      { region: "西南", count: 1570, percentage: 10.0 },
      { region: "华中", count: 1410, percentage: 9.0 },
      { region: "其他", count: 1090, percentage: 7.0 },
    ];

    // 活跃时段暂时使用模拟数据（需要用户会话追踪功能）
    const byActiveHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: Math.floor(
        1000 * (hour >= 9 && hour <= 22 ? 1 + Math.sin(((hour - 9) * Math.PI) / 13) : 0.3),
      ),
    }));

    respond(true, {
      success: true,
      data: {
        byPlan: subscriptionData,
        byDevice: deviceData,
        byRegion,
        byActiveHour,
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
 * 获取收入来源分布
 */
const getRevenueSources: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取收入来源分布");

  respond(true, {
    success: true,
    data: {
      byPlan: [
        { plan: "专业版", revenue: 452000, percentage: 36.0, orders: 4520 },
        { plan: "团队版", revenue: 378000, percentage: 30.1, orders: 1890 },
        { plan: "企业版", revenue: 355000, percentage: 28.2, orders: 710 },
        { plan: "其他", revenue: 71800, percentage: 5.7, orders: 359 },
      ],
      byPaymentMethod: [
        { method: "微信支付", revenue: 628400, percentage: 50.0, orders: 4120 },
        { method: "支付宝", revenue: 502720, percentage: 40.0, orders: 3050 },
        { method: "银行卡", revenue: 125680, percentage: 10.0, orders: 309 },
      ],
    },
  });
};

/**
 * 获取用户价值指标
 */
const getUserValueMetrics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 获取用户价值指标, period:", period);

  const days = period === "week" ? 7 : period === "month" ? 30 : 90;

  respond(true, {
    success: true,
    data: {
      arpu: 80.2,
      ltv: 960,
      payingUserRate: 45.4,
      payingArpu: 176.8,
      trend: generateTimeSeriesData(days, () => ({
        arpu: 75 + Math.random() * 15,
        ltv: 900 + Math.random() * 150,
      })),
    },
  });
};

/**
 * 获取技能使用分析（使用真实数据）
 */
const getSkillUsageAnalytics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 获取技能使用分析, period:", period);

  try {
    const result = await getSkillUsageAnalyticsFromDB(period);
    const days = period === "week" ? 7 : period === "month" ? 30 : 90;

    respond(true, {
      success: true,
      data: {
        period,
        topSkills: result.topSkills,
        categoryDistribution: result.categoryDistribution,
        usageTrend: generateTimeSeriesData(days, () => ({
          executions: Math.floor(Math.random() * 200) + 100, // TODO: 从执行日志获取
          uniqueUsers: Math.floor(Math.random() * 50) + 30,
        })),
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
 * 获取漏斗分析
 */
const getFunnelAnalysis: GatewayRequestHandler = async ({ params, respond }) => {
  const funnelType = (params.type as string) || "registration";
  console.log("[admin-analytics] 获取漏斗分析, type:", funnelType);

  let funnelData;

  if (funnelType === "registration") {
    funnelData = {
      name: "用户注册转化",
      steps: [
        { name: "访问注册页", count: 10000, percentage: 100, dropoffRate: 0 },
        { name: "填写表单", count: 6500, percentage: 65, dropoffRate: 35 },
        { name: "验证邮箱", count: 4200, percentage: 42, dropoffRate: 35.4 },
        { name: "完成注册", count: 3800, percentage: 38, dropoffRate: 9.5 },
      ],
      overallConversionRate: 38,
    };
  } else if (funnelType === "subscription") {
    funnelData = {
      name: "订阅转化",
      steps: [
        { name: "查看定价", count: 5000, percentage: 100, dropoffRate: 0 },
        { name: "选择计划", count: 2800, percentage: 56, dropoffRate: 44 },
        { name: "进入支付", count: 1500, percentage: 30, dropoffRate: 46.4 },
        { name: "完成支付", count: 1200, percentage: 24, dropoffRate: 20 },
      ],
      overallConversionRate: 24,
    };
  } else {
    funnelData = {
      name: "技能使用",
      steps: [
        { name: "浏览技能", count: 8000, percentage: 100, dropoffRate: 0 },
        { name: "查看详情", count: 4500, percentage: 56.3, dropoffRate: 43.7 },
        { name: "安装技能", count: 2800, percentage: 35, dropoffRate: 37.8 },
        { name: "首次使用", count: 2100, percentage: 26.3, dropoffRate: 25 },
        { name: "重复使用", count: 1500, percentage: 18.8, dropoffRate: 28.6 },
      ],
      overallConversionRate: 18.8,
    };
  }

  respond(true, {
    success: true,
    data: {
      ...funnelData,
      period: (params.period as string) || "month",
    },
  });
};

/**
 * 获取可用漏斗列表
 */
const listFunnels: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 获取漏斗列表");

  respond(true, {
    success: true,
    funnels: [
      { id: "registration", name: "用户注册转化", description: "从访问注册页到完成注册的转化漏斗" },
      { id: "subscription", name: "订阅转化", description: "从查看定价到完成支付的转化漏斗" },
      { id: "skill_usage", name: "技能使用", description: "从浏览技能到重复使用的转化漏斗" },
    ],
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
