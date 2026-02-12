/**
 * 绠＄悊鍚庡彴鏁版嵁鍒嗘瀽 RPC 鏂规硶
 *
 * 鎻愪緵鏁版嵁鍒嗘瀽鐩稿叧鐨?API锛? * - admin.analytics.overview - 鍒嗘瀽姒傝锛堜娇鐢ㄧ湡瀹炴暟鎹級
 * - admin.analytics.users.growth - 鐢ㄦ埛澧為暱瓒嬪娍
 * - admin.analytics.users.retention - 鐢ㄦ埛鐣欏瓨鍒嗘瀽
 * - admin.analytics.users.demographics - 鐢ㄦ埛鐢诲儚锛堜娇鐢ㄧ湡瀹炴暟鎹級
 * - admin.analytics.revenue.trend - 鏀跺叆瓒嬪娍
 * - admin.analytics.revenue.sources - 鏀跺叆鏉ユ簮鍒嗗竷
 * - admin.analytics.revenue.metrics - ARPU/LTV 鎸囨爣
 * - admin.analytics.skills.usage - 鎶€鑳戒娇鐢ㄥ垎鏋? * - admin.analytics.funnels.* - 婕忔枟鍒嗘瀽
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
 * 鑾峰彇鍒嗘瀽姒傝锛堜娇鐢ㄧ湡瀹炴暟鎹級
 */
const getAnalyticsOverview: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 鑾峰彇鍒嗘瀽姒傝");

  try {
    const data = await getOverviewFromDB();
    respond(true, {
      success: true,
      data,
    });
  } catch (error) {
    console.error("[admin-analytics] 鑾峰彇鍒嗘瀽姒傝澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鍒嗘瀽姒傝澶辫触",
    });
  }
};

/**
 * 鑾峰彇鐢ㄦ埛澧為暱瓒嬪娍锛堜娇鐢ㄧ湡瀹炴暟鎹級
 */
const getUserGrowthTrend: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 鑾峰彇鐢ㄦ埛澧為暱瓒嬪娍, period:", period);

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
    console.error("[admin-analytics] 鑾峰彇鐢ㄦ埛澧為暱瓒嬪娍澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鐢ㄦ埛澧為暱瓒嬪娍澶辫触",
    });
  }
};

/**
 * 鑾峰彇鐢ㄦ埛鐣欏瓨鍒嗘瀽
 */
const getUserRetention: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 鑾峰彇鐢ㄦ埛鐣欏瓨鍒嗘瀽, period:", period);

  // 鐢熸垚闃熷垪鏁版嵁
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

  // 璁＄畻骞冲潎鐣欏瓨鐜?  const avgRetention = {
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
 * 鑾峰彇鐢ㄦ埛鐢诲儚锛堜娇鐢ㄧ湡瀹炴暟鎹級
 */
const getUserDemographics: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 鑾峰彇鐢ㄦ埛鐢诲儚");

  try {
    // 骞惰鑾峰彇璁惧鍒嗗竷鍜岃闃呭垎甯?    const [deviceData, subscriptionData] = await Promise.all([
      getDeviceDistribution(),
      getSubscriptionDistribution(),
    ]);

    // 鍦板尯鍒嗗竷鏆傛椂浣跨敤妯℃嫙鏁版嵁锛堥渶瑕佺敤鎴峰湴鐞嗕綅缃拷韪姛鑳斤級
    const byRegion = [
      { region: "鍗庝笢", count: 5020, percentage: 32.0 },
      { region: "鍗庡寳", count: 3610, percentage: 23.0 },
      { region: "鍗庡崡", count: 2980, percentage: 19.0 },
      { region: "瑗垮崡", count: 1570, percentage: 10.0 },
      { region: "鍗庝腑", count: 1410, percentage: 9.0 },
      { region: "鍏朵粬", count: 1090, percentage: 7.0 },
    ];

    // 娲昏穬鏃舵鏆傛椂浣跨敤妯℃嫙鏁版嵁锛堥渶瑕佺敤鎴蜂細璇濊拷韪姛鑳斤級
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
    console.error("[admin-analytics] 鑾峰彇鐢ㄦ埛鐢诲儚澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鐢ㄦ埛鐢诲儚澶辫触",
    });
  }
};

/**
 * 鑾峰彇鏀跺叆瓒嬪娍锛堜娇鐢ㄧ湡瀹炴暟鎹級
 */
const getRevenueTrend: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 鑾峰彇鏀跺叆瓒嬪娍, period:", period);

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
    console.error("[admin-analytics] 鑾峰彇鏀跺叆瓒嬪娍澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鏀跺叆瓒嬪娍澶辫触",
    });
  }
};

/**
 * 鑾峰彇鏀跺叆鏉ユ簮鍒嗗竷
 */
const getRevenueSources: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 鑾峰彇鏀跺叆鏉ユ簮鍒嗗竷");

  respond(true, {
    success: true,
    data: {
      byPlan: [
        { plan: "涓撲笟鐗?, revenue: 452000, percentage: 36.0, orders: 4520 },
        { plan: "鍥㈤槦鐗?, revenue: 378000, percentage: 30.1, orders: 1890 },
        { plan: "浼佷笟鐗?, revenue: 355000, percentage: 28.2, orders: 710 },
        { plan: "鍏朵粬", revenue: 71800, percentage: 5.7, orders: 359 },
      ],
      byPaymentMethod: [
        { method: "寰俊鏀粯", revenue: 628400, percentage: 50.0, orders: 4120 },
        { method: "鏀粯瀹?, revenue: 502720, percentage: 40.0, orders: 3050 },
        { method: "閾惰鍗?, revenue: 125680, percentage: 10.0, orders: 309 },
      ],
    },
  });
};

/**
 * 鑾峰彇鐢ㄦ埛浠峰€兼寚鏍? */
const getUserValueMetrics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as string) || "month";
  console.log("[admin-analytics] 鑾峰彇鐢ㄦ埛浠峰€兼寚鏍? period:", period);

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
 * 鑾峰彇鎶€鑳戒娇鐢ㄥ垎鏋愶紙浣跨敤鐪熷疄鏁版嵁锛? */
const getSkillUsageAnalytics: GatewayRequestHandler = async ({ params, respond }) => {
  const period = (params.period as "week" | "month" | "quarter") || "month";
  console.log("[admin-analytics] 鑾峰彇鎶€鑳戒娇鐢ㄥ垎鏋? period:", period);

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
          executions: Math.floor(Math.random() * 200) + 100, // TODO: 浠庢墽琛屾棩蹇楄幏鍙?          uniqueUsers: Math.floor(Math.random() * 50) + 30,
        })),
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("[admin-analytics] 鑾峰彇鎶€鑳戒娇鐢ㄥ垎鏋愬け璐?", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鎶€鑳戒娇鐢ㄥ垎鏋愬け璐?,
    });
  }
};

/**
 * 鑾峰彇婕忔枟鍒嗘瀽
 */
const getFunnelAnalysis: GatewayRequestHandler = async ({ params, respond }) => {
  const funnelType = (params.type as string) || "registration";
  console.log("[admin-analytics] 鑾峰彇婕忔枟鍒嗘瀽, type:", funnelType);

  let funnelData;

  if (funnelType === "registration") {
    funnelData = {
      name: "鐢ㄦ埛娉ㄥ唽杞寲",
      steps: [
        { name: "璁块棶娉ㄥ唽椤?, count: 10000, percentage: 100, dropoffRate: 0 },
        { name: "濉啓琛ㄥ崟", count: 6500, percentage: 65, dropoffRate: 35 },
        { name: "楠岃瘉閭", count: 4200, percentage: 42, dropoffRate: 35.4 },
        { name: "瀹屾垚娉ㄥ唽", count: 3800, percentage: 38, dropoffRate: 9.5 },
      ],
      overallConversionRate: 38,
    };
  } else if (funnelType === "subscription") {
    funnelData = {
      name: "璁㈤槄杞寲",
      steps: [
        { name: "鏌ョ湅瀹氫环", count: 5000, percentage: 100, dropoffRate: 0 },
        { name: "閫夋嫨璁″垝", count: 2800, percentage: 56, dropoffRate: 44 },
        { name: "杩涘叆鏀粯", count: 1500, percentage: 30, dropoffRate: 46.4 },
        { name: "瀹屾垚鏀粯", count: 1200, percentage: 24, dropoffRate: 20 },
      ],
      overallConversionRate: 24,
    };
  } else {
    funnelData = {
      name: "鎶€鑳戒娇鐢?,
      steps: [
        { name: "娴忚鎶€鑳?, count: 8000, percentage: 100, dropoffRate: 0 },
        { name: "鏌ョ湅璇︽儏", count: 4500, percentage: 56.3, dropoffRate: 43.7 },
        { name: "瀹夎鎶€鑳?, count: 2800, percentage: 35, dropoffRate: 37.8 },
        { name: "棣栨浣跨敤", count: 2100, percentage: 26.3, dropoffRate: 25 },
        { name: "閲嶅浣跨敤", count: 1500, percentage: 18.8, dropoffRate: 28.6 },
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
 * 鑾峰彇鍙敤婕忔枟鍒楄〃
 */
const listFunnels: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-analytics] 鑾峰彇婕忔枟鍒楄〃");

  respond(true, {
    success: true,
    funnels: [
      { id: "registration", name: "鐢ㄦ埛娉ㄥ唽杞寲", description: "浠庤闂敞鍐岄〉鍒板畬鎴愭敞鍐岀殑杞寲婕忔枟" },
      { id: "subscription", name: "璁㈤槄杞寲", description: "浠庢煡鐪嬪畾浠峰埌瀹屾垚鏀粯鐨勮浆鍖栨紡鏂? },
      { id: "skill_usage", name: "鎶€鑳戒娇鐢?, description: "浠庢祻瑙堟妧鑳藉埌閲嶅浣跨敤鐨勮浆鍖栨紡鏂? },
    ],
  });
};

/**
 * 瀵煎嚭鍒嗘瀽澶勭悊鍣? */
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
