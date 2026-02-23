/**
 * 分析模块导出
 */

export {
  getUserStats,
  getRevenueStats,
  getSkillStats,
  getDeviceDistribution,
  getSubscriptionDistribution,
  getAnalyticsOverview,
  generateTimeSeriesData,
  getUserGrowthTrend,
  getRevenueTrend,
  getSkillUsageAnalytics,
  type AnalyticsOverview,
  type UserStats,
  type RevenueStats,
} from "./analytics-service.js";

export {
  getUserRetention,
  getActiveHourDistribution,
  getRevenueSources,
  getUserValueMetrics,
  getFunnelAnalysis,
  listFunnelTypes,
  getSkillUsageTrend,
  type RetentionResult,
  type RevenueSourcesResult,
  type UserValueResult,
  type FunnelResult,
} from "./analytics-extended.js";
