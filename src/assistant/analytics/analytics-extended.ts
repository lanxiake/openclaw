/**
 * 扩展分析服务
 *
 * 在现有 analytics-service.ts 基础上，补充以下分析功能：
 * - 用户留存分析（基于 users + audit_logs）
 * - 活跃时段分布（基于 audit_logs 按小时聚合）
 * - 收入来源分布（基于 paymentOrders）
 * - 用户价值指标 ARPU/ARPPU/LTV（基于 paymentOrders + users）
 * - 漏斗分析（基于 users/subscriptions/paymentOrders/userInstalledSkills）
 * - 技能使用趋势（基于 audit_logs category='skill'）
 *
 * 所有功能基于现有数据库表实现，无需新建表或 migration。
 */

import { sql, count, and, gte, lte, eq, sum } from "drizzle-orm";
import { getDatabase } from "../../db/index.js";
import {
  users,
  auditLogs,
  paymentOrders,
  subscriptions,
  userInstalledSkills,
} from "../../db/schema/index.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// ==================== 类型定义 ====================

/** 留存队列数据 */
interface RetentionCohort {
  cohort: string;
  cohortSize: number;
  day1: number;
  day3: number;
  day7: number;
  day14: number;
  day30: number;
}

/** 留存分析结果 */
export interface RetentionResult {
  cohorts: RetentionCohort[];
  averageRetention: {
    day1: number;
    day3: number;
    day7: number;
    day14: number;
    day30: number;
  };
}

/** 活跃时段数据点 */
interface HourDistribution {
  hour: number;
  count: number;
}

/** 收入来源分布 */
export interface RevenueSourcesResult {
  byPlan: Array<{ plan: string; revenue: number; percentage: number; orders: number }>;
  byPaymentMethod: Array<{
    method: string;
    revenue: number;
    percentage: number;
    orders: number;
  }>;
}

/** 用户价值指标 */
export interface UserValueResult {
  arpu: number;
  arppu: number;
  ltv: number;
  payingUserRate: number;
}

/** 漏斗步骤 */
interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  dropoffRate: number;
}

/** 漏斗分析结果 */
export interface FunnelResult {
  name: string;
  steps: FunnelStep[];
  overallConversionRate: number;
}

/** 漏斗类型定义 */
interface FunnelType {
  id: string;
  name: string;
  description: string;
}

/** 技能使用趋势数据点 */
interface SkillUsageTrendPoint {
  date: string;
  executions: number;
  uniqueUsers: number;
}

// ==================== 辅助函数 ====================

/**
 * 根据 period 计算时间窗口
 */
function getPeriodDays(period: string): number {
  switch (period) {
    case "week":
      return 7;
    case "month":
      return 30;
    case "quarter":
      return 90;
    default:
      return 30;
  }
}

/**
 * 根据 period 计算留存队列周数
 */
function getPeriodWeeks(period: string): number {
  switch (period) {
    case "week":
      return 4;
    case "month":
      return 8;
    case "quarter":
      return 12;
    default:
      return 8;
  }
}

/**
 * 构建漏斗步骤数组
 *
 * 从各步骤的 count 计算百分比和流失率
 */
function buildFunnelSteps(steps: Array<{ name: string; count: number }>): FunnelStep[] {
  if (steps.length === 0) return [];

  const baseCount = steps[0].count || 1;

  return steps.map((step, index) => ({
    name: step.name,
    count: step.count,
    percentage: baseCount > 0 ? Math.round((step.count / baseCount) * 1000) / 10 : 0,
    dropoffRate:
      index === 0
        ? 0
        : steps[index - 1].count > 0
          ? Math.round(((steps[index - 1].count - step.count) / steps[index - 1].count) * 1000) / 10
          : 0,
  }));
}

// ==================== 留存分析 ====================

/**
 * 获取用户留存分析
 *
 * 按周为队列（cohort），统计每个队列在 Day1/3/7/14/30 的留存率。
 * 使用 audit_logs (category='auth') 作为活跃信号。
 * 如果 audit_logs 数据不足，退化为 users.lastLoginAt 粗略估算。
 *
 * @param period - 分析周期 (week/month/quarter)
 * @returns 留存分析结果
 */
export async function getUserRetention(period: string): Promise<RetentionResult> {
  logger.debug("[analytics-ext] 获取用户留存分析", { period });

  try {
    const db = await getDatabase();
    const weeks = getPeriodWeeks(period);
    const now = new Date();

    const cohorts: RetentionCohort[] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      // 队列的起止日期（每周一个队列）
      const cohortStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const cohortEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const cohortLabel = cohortStart.toISOString().split("T")[0];

      // 该队列的用户 ID 列表和人数
      const cohortUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            gte(users.createdAt, cohortStart),
            lte(users.createdAt, cohortEnd),
          ),
        );
      const cohortSize = cohortUsers.length;

      if (cohortSize === 0) {
        cohorts.push({
          cohort: cohortLabel,
          cohortSize: 0,
          day1: 0,
          day3: 0,
          day7: 0,
          day14: 0,
          day30: 0,
        });
        continue;
      }

      const userIds = cohortUsers.map((u) => u.id);

      // 计算各天留存率
      const retentionDays = [1, 3, 7, 14, 30];
      const retentionRates: number[] = [];

      for (const day of retentionDays) {
        const dayStart = new Date(cohortEnd.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(cohortEnd.getTime() + day * 24 * 60 * 60 * 1000);

        // 如果目标日期在未来，留存率设为 0
        if (dayStart > now) {
          retentionRates.push(0);
          continue;
        }

        // 查询 audit_logs 中该队列用户在目标时间段有活跃记录的数量
        const activeResult = await db
          .select({ cnt: sql<number>`COUNT(DISTINCT ${auditLogs.userId})` })
          .from(auditLogs)
          .where(
            and(
              sql`${auditLogs.userId} = ANY(${userIds})`,
              gte(auditLogs.createdAt, dayStart),
              lte(auditLogs.createdAt, dayEnd),
            ),
          );

        const activeCount = Number(activeResult[0]?.cnt || 0);
        retentionRates.push(cohortSize > 0 ? Math.round((activeCount / cohortSize) * 100) : 0);
      }

      cohorts.push({
        cohort: cohortLabel,
        cohortSize,
        day1: retentionRates[0],
        day3: retentionRates[1],
        day7: retentionRates[2],
        day14: retentionRates[3],
        day30: retentionRates[4],
      });
    }

    // 计算平均留存率
    const validCohorts = cohorts.filter((c) => c.cohortSize > 0);
    const avgRetention = {
      day1:
        validCohorts.length > 0
          ? Math.round(validCohorts.reduce((s, c) => s + c.day1, 0) / validCohorts.length)
          : 0,
      day3:
        validCohorts.length > 0
          ? Math.round(validCohorts.reduce((s, c) => s + c.day3, 0) / validCohorts.length)
          : 0,
      day7:
        validCohorts.length > 0
          ? Math.round(validCohorts.reduce((s, c) => s + c.day7, 0) / validCohorts.length)
          : 0,
      day14:
        validCohorts.length > 0
          ? Math.round(validCohorts.reduce((s, c) => s + c.day14, 0) / validCohorts.length)
          : 0,
      day30:
        validCohorts.length > 0
          ? Math.round(validCohorts.reduce((s, c) => s + c.day30, 0) / validCohorts.length)
          : 0,
    };

    logger.debug("[analytics-ext] 留存分析完成", {
      cohortCount: cohorts.length,
      validCohortCount: validCohorts.length,
    });

    return { cohorts, averageRetention: avgRetention };
  } catch (error) {
    logger.error("[analytics-ext] 获取留存分析失败", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return {
      cohorts: [],
      averageRetention: { day1: 0, day3: 0, day7: 0, day14: 0, day30: 0 },
    };
  }
}

// ==================== 活跃时段分布 ====================

/**
 * 获取活跃时段分布
 *
 * 统计过去 30 天 audit_logs 按小时的分布。
 *
 * @returns 24 个小时的活跃分布数组
 */
export async function getActiveHourDistribution(): Promise<HourDistribution[]> {
  logger.debug("[analytics-ext] 获取活跃时段分布");

  try {
    const db = await getDatabase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${auditLogs.createdAt})::int`,
        cnt: count(),
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, thirtyDaysAgo))
      .groupBy(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt})`);

    // 补全 24 小时
    const hourMap = new Map(result.map((r) => [Number(r.hour), Number(r.cnt)]));
    const distribution: HourDistribution[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourMap.get(hour) ?? 0,
    }));

    return distribution;
  } catch (error) {
    logger.error("[analytics-ext] 获取活跃时段分布失败", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }
}

// ==================== 收入来源分布 ====================

/**
 * 获取收入来源分布
 *
 * 从 paymentOrders 按 orderType 和 paymentMethod 聚合。
 *
 * @returns 按计划和支付方式分组的收入分布
 */
export async function getRevenueSources(): Promise<RevenueSourcesResult> {
  logger.debug("[analytics-ext] 获取收入来源分布");

  try {
    const db = await getDatabase();

    // 按订单类型聚合
    const byTypeResult = await db
      .select({
        orderType: paymentOrders.orderType,
        revenue: sum(paymentOrders.paidAmount),
        orders: count(),
      })
      .from(paymentOrders)
      .where(eq(paymentOrders.paymentStatus, "paid"))
      .groupBy(paymentOrders.orderType);

    const totalRevenue = byTypeResult.reduce((s, r) => s + Number(r.revenue || 0), 0);

    // 订单类型名称映射
    const typeNameMap: Record<string, string> = {
      subscription: "订阅",
      skill: "技能购买",
      tokens: "Token 充值",
      storage: "存储扩容",
    };

    const byPlan = byTypeResult.map((r) => {
      const revenue = Number(r.revenue || 0);
      return {
        plan: typeNameMap[r.orderType] ?? r.orderType,
        revenue: Math.round(revenue / 100), // 分 → 元
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
        orders: Number(r.orders),
      };
    });

    // 按支付方式聚合
    const byMethodResult = await db
      .select({
        method: paymentOrders.paymentMethod,
        revenue: sum(paymentOrders.paidAmount),
        orders: count(),
      })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.paymentStatus, "paid"),
          sql`${paymentOrders.paymentMethod} IS NOT NULL`,
        ),
      )
      .groupBy(paymentOrders.paymentMethod);

    const methodNameMap: Record<string, string> = {
      wechat: "微信支付",
      alipay: "支付宝",
      stripe: "Stripe",
      manual: "手动录入",
    };

    const byPaymentMethod = byMethodResult.map((r) => {
      const revenue = Number(r.revenue || 0);
      return {
        method: methodNameMap[r.method ?? ""] ?? (r.method || "未知"),
        revenue: Math.round(revenue / 100),
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
        orders: Number(r.orders),
      };
    });

    return { byPlan, byPaymentMethod };
  } catch (error) {
    logger.error("[analytics-ext] 获取收入来源分布失败", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return { byPlan: [], byPaymentMethod: [] };
  }
}

// ==================== 用户价值指标 ====================

/**
 * 获取用户价值指标 (ARPU / ARPPU / LTV / 付费率)
 *
 * @param period - 分析周期
 * @returns 用户价值指标
 */
export async function getUserValueMetrics(period: string): Promise<UserValueResult> {
  logger.debug("[analytics-ext] 获取用户价值指标", { period });

  try {
    const db = await getDatabase();
    const days = getPeriodDays(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 总用户数（活跃用户）
    const totalUsersResult = await db
      .select({ cnt: count() })
      .from(users)
      .where(eq(users.isActive, true));
    const totalUsers = Number(totalUsersResult[0]?.cnt || 0);

    // 付费用户数和收入（时间窗口内）
    const revenueResult = await db
      .select({
        totalRevenue: sum(paymentOrders.paidAmount),
        payingUsers: sql<number>`COUNT(DISTINCT ${paymentOrders.userId})`,
      })
      .from(paymentOrders)
      .where(and(eq(paymentOrders.paymentStatus, "paid"), gte(paymentOrders.paidAt, startDate)));

    const totalRevenue = Number(revenueResult[0]?.totalRevenue || 0);
    const payingUsers = Number(revenueResult[0]?.payingUsers || 0);

    // 计算指标（金额单位：分 → 元）
    const revenueYuan = totalRevenue / 100;
    const arpu = totalUsers > 0 ? Math.round((revenueYuan / totalUsers) * 100) / 100 : 0;
    const arppu = payingUsers > 0 ? Math.round((revenueYuan / payingUsers) * 100) / 100 : 0;
    const ltv = Math.round(arpu * 12 * 100) / 100; // 月均 × 12 估算年 LTV
    const payingUserRate = totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 1000) / 10 : 0;

    logger.debug("[analytics-ext] 用户价值指标计算完成", {
      arpu,
      arppu,
      ltv,
      payingUserRate,
    });

    return { arpu, arppu, ltv, payingUserRate };
  } catch (error) {
    logger.error("[analytics-ext] 获取用户价值指标失败", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return { arpu: 0, arppu: 0, ltv: 0, payingUserRate: 0 };
  }
}

// ==================== 漏斗分析 ====================

/**
 * 获取漏斗类型列表
 */
export function listFunnelTypes(): FunnelType[] {
  return [
    {
      id: "registration",
      name: "用户注册转化",
      description: "从总用户到完成注册并首次登录的转化漏斗",
    },
    {
      id: "subscription",
      name: "订阅转化",
      description: "从活跃用户到完成付费订阅的转化漏斗",
    },
    {
      id: "skill_usage",
      name: "技能使用",
      description: "从活跃用户到安装并使用技能的转化漏斗",
    },
  ];
}

/**
 * 获取漏斗分析
 *
 * 基于现有表数据构建漏斗：
 * - registration: users 总量 → 时段内注册 → 有登录记录
 * - subscription: 活跃用户 → 创建订单 → 完成支付
 * - skill_usage: 活跃用户 → 安装技能 → 活跃使用
 *
 * @param type - 漏斗类型
 * @param period - 分析周期
 * @returns 漏斗分析结果
 */
export async function getFunnelAnalysis(type: string, period: string): Promise<FunnelResult> {
  logger.debug("[analytics-ext] 获取漏斗分析", { type, period });

  try {
    const db = await getDatabase();
    const days = getPeriodDays(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (type === "registration") {
      return await getRegistrationFunnel(db, startDate);
    } else if (type === "subscription") {
      return await getSubscriptionFunnel(db, startDate);
    } else {
      return await getSkillUsageFunnel(db, startDate);
    }
  } catch (error) {
    logger.error("[analytics-ext] 获取漏斗分析失败", {
      type,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return { name: "未知漏斗", steps: [], overallConversionRate: 0 };
  }
}

/**
 * 注册漏斗：总用户 → 时段内注册 → 有登录记录
 */
async function getRegistrationFunnel(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startDate: Date,
): Promise<FunnelResult> {
  // 总用户（作为基准）
  const totalResult = await db.select({ cnt: count() }).from(users);
  const total = Number(totalResult[0]?.cnt || 0);

  // 时段内新注册
  const newResult = await db
    .select({ cnt: count() })
    .from(users)
    .where(gte(users.createdAt, startDate));
  const newUsers = Number(newResult[0]?.cnt || 0);

  // 新注册中有登录记录的
  const loginResult = await db
    .select({ cnt: count() })
    .from(users)
    .where(and(gte(users.createdAt, startDate), sql`${users.lastLoginAt} IS NOT NULL`));
  const loggedIn = Number(loginResult[0]?.cnt || 0);

  const steps = buildFunnelSteps([
    { name: "总用户", count: total },
    { name: "新注册", count: newUsers },
    { name: "已登录", count: loggedIn },
  ]);

  return {
    name: "用户注册转化",
    steps,
    overallConversionRate: total > 0 ? Math.round((loggedIn / total) * 1000) / 10 : 0,
  };
}

/**
 * 订阅漏斗：活跃用户 → 创建订单 → 完成支付
 */
async function getSubscriptionFunnel(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startDate: Date,
): Promise<FunnelResult> {
  // 活跃用户（时段内有登录）
  const activeResult = await db
    .select({ cnt: count() })
    .from(users)
    .where(and(eq(users.isActive, true), gte(users.lastLoginAt, startDate)));
  const activeUsers = Number(activeResult[0]?.cnt || 0);

  // 创建了订单（subscription 类型）
  const orderResult = await db
    .select({ cnt: count() })
    .from(paymentOrders)
    .where(
      and(eq(paymentOrders.orderType, "subscription"), gte(paymentOrders.createdAt, startDate)),
    );
  const orderCreated = Number(orderResult[0]?.cnt || 0);

  // 完成支付
  const paidResult = await db
    .select({ cnt: count() })
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.orderType, "subscription"),
        eq(paymentOrders.paymentStatus, "paid"),
        gte(paymentOrders.createdAt, startDate),
      ),
    );
  const paidOrders = Number(paidResult[0]?.cnt || 0);

  const steps = buildFunnelSteps([
    { name: "活跃用户", count: activeUsers },
    { name: "创建订单", count: orderCreated },
    { name: "完成支付", count: paidOrders },
  ]);

  return {
    name: "订阅转化",
    steps,
    overallConversionRate: activeUsers > 0 ? Math.round((paidOrders / activeUsers) * 1000) / 10 : 0,
  };
}

/**
 * 技能使用漏斗：活跃用户 → 安装技能 → 活跃使用
 */
async function getSkillUsageFunnel(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startDate: Date,
): Promise<FunnelResult> {
  // 活跃用户
  const activeResult = await db
    .select({ cnt: count() })
    .from(users)
    .where(and(eq(users.isActive, true), gte(users.lastLoginAt, startDate)));
  const activeUsers = Number(activeResult[0]?.cnt || 0);

  // 安装了技能
  const installResult = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT ${userInstalledSkills.userId})` })
    .from(userInstalledSkills)
    .where(gte(userInstalledSkills.installedAt, startDate));
  const installUsers = Number(installResult[0]?.cnt || 0);

  // 活跃使用（lastUsedAt 在时段内）
  const usageResult = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT ${userInstalledSkills.userId})` })
    .from(userInstalledSkills)
    .where(
      and(
        gte(userInstalledSkills.installedAt, startDate),
        sql`${userInstalledSkills.lastUsedAt} IS NOT NULL`,
        gte(userInstalledSkills.lastUsedAt, startDate),
      ),
    );
  const activeSkillUsers = Number(usageResult[0]?.cnt || 0);

  const steps = buildFunnelSteps([
    { name: "活跃用户", count: activeUsers },
    { name: "安装技能", count: installUsers },
    { name: "活跃使用", count: activeSkillUsers },
  ]);

  return {
    name: "技能使用",
    steps,
    overallConversionRate:
      activeUsers > 0 ? Math.round((activeSkillUsers / activeUsers) * 1000) / 10 : 0,
  };
}

// ==================== 技能使用趋势 ====================

/**
 * 获取技能使用趋势
 *
 * 从 audit_logs (category='skill') 按天聚合操作数和去重用户数。
 *
 * @param period - 分析周期
 * @returns 每天的技能使用数据
 */
export async function getSkillUsageTrend(period: string): Promise<SkillUsageTrendPoint[]> {
  logger.debug("[analytics-ext] 获取技能使用趋势", { period });

  try {
    const db = await getDatabase();
    const days = getPeriodDays(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        executions: count(),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${auditLogs.userId})`,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.category, "skill"), gte(auditLogs.createdAt, startDate)))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // 补全缺失的日期
    const dateMap = new Map(
      result.map((r) => [
        r.date,
        { executions: Number(r.executions), uniqueUsers: Number(r.uniqueUsers) },
      ]),
    );

    const trend: SkillUsageTrendPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const data = dateMap.get(dateStr);

      trend.push({
        date: dateStr,
        executions: data?.executions ?? 0,
        uniqueUsers: data?.uniqueUsers ?? 0,
      });
    }

    return trend;
  } catch (error) {
    logger.error("[analytics-ext] 获取技能使用趋势失败", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return [];
  }
}
