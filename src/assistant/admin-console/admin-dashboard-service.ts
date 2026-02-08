/**
 * 管理后台仪表盘服务
 *
 * 提供仪表盘统计数据、趋势数据、实时动态等功能
 */

import { getDatabase } from "../../db/connection.js";
import { users, subscriptions, paymentOrders } from "../../db/schema/index.js";
import { plans } from "../../db/schema/subscriptions.js";
import { sql, eq, gte, lte, and, count, sum, desc } from "drizzle-orm";
import { getLogger } from "../../logging/logger.js";

// 日志标签
const LOG_TAG = "admin-dashboard-service";
const logger = getLogger();

/**
 * 仪表盘统计概览数据
 */
export interface DashboardStats {
  /** 总用户数 */
  totalUsers: number;
  /** 今日新增用户 */
  newUsersToday: number;
  /** 活跃用户数 (7天内有登录) */
  activeUsers7d: number;
  /** 付费用户数 (有有效订阅) */
  paidUsers: number;
  /** 本月收入 (分) */
  revenueThisMonth: number;
  /** 在线设备数 */
  onlineDevices: number;
  /** 今日 API 调用次数 */
  apiCallsToday: number;
  /** 较上周变化百分比 */
  changes: {
    users: number;
    revenue: number;
    subscriptions: number;
  };
}

/**
 * 趋势数据
 */
export interface TrendData {
  /** 日期标签 */
  labels: string[];
  /** 数据值 */
  values: number[];
}

/**
 * 订阅分布数据
 */
export interface SubscriptionDistribution {
  /** 计划名称 */
  name: string;
  /** 计划代码 */
  code: string;
  /** 订阅数量 */
  count: number;
  /** 百分比 */
  percentage: number;
}

/**
 * 活动类型
 */
export type ActivityType =
  | "user_register"
  | "subscription_created"
  | "subscription_canceled"
  | "payment_success"
  | "payment_refund";

/**
 * 实时活动
 */
export interface Activity {
  /** 活动类型 */
  type: ActivityType;
  /** 用户 ID */
  userId?: string;
  /** 用户名/手机号 (脱敏) */
  userName?: string;
  /** 相关金额 (分) */
  amount?: number;
  /** 计划名称 */
  planName?: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 获取今日开始时间
 */
function getTodayStart(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * 获取本月开始时间
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * 获取上周开始时间
 */
function getLastWeekStart(): Date {
  const now = new Date();
  now.setDate(now.getDate() - 7);
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * 获取两周前开始时间
 */
function getTwoWeeksAgoStart(): Date {
  const now = new Date();
  now.setDate(now.getDate() - 14);
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * 脱敏手机号
 */
function maskPhone(phone: string | null): string {
  if (!phone) return "未知用户";
  if (phone.length >= 7) {
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }
  return phone.slice(0, 2) + "****";
}

/**
 * 管理后台仪表盘服务类
 */
class AdminDashboardService {
  /**
   * 获取仪表盘统计概览
   */
  async getStats(): Promise<DashboardStats> {
    logger.info(`[${LOG_TAG}] Getting dashboard stats`);

    const db = getDatabase();
    const todayStart = getTodayStart();
    const lastWeekStart = getLastWeekStart();
    const twoWeeksAgoStart = getTwoWeeksAgoStart();
    const monthStart = getMonthStart();

    try {
      // 查询总用户数
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult[0]?.count ?? 0;

      // 查询今日新增用户
      const newUsersTodayResult = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, todayStart));
      const newUsersToday = newUsersTodayResult[0]?.count ?? 0;

      // 查询活跃用户 (7天内有登录)
      const activeUsers7dResult = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.lastLoginAt, lastWeekStart));
      const activeUsers7d = activeUsers7dResult[0]?.count ?? 0;

      // 查询付费用户 (有有效订阅)
      const paidUsersResult = await db
        .select({ count: sql<number>`count(distinct ${subscriptions.userId})` })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));
      const paidUsers = Number(paidUsersResult[0]?.count ?? 0);

      // 查询本月收入
      const revenueResult = await db
        .select({ total: sum(paymentOrders.paidAmount) })
        .from(paymentOrders)
        .where(and(eq(paymentOrders.paymentStatus, "paid"), gte(paymentOrders.paidAt, monthStart)));
      const revenueThisMonth = Number(revenueResult[0]?.total ?? 0);

      // 计算周对比变化
      // 本周新增用户
      const thisWeekUsersResult = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, lastWeekStart));
      const thisWeekUsers = thisWeekUsersResult[0]?.count ?? 0;

      // 上周新增用户
      const lastWeekUsersResult = await db
        .select({ count: count() })
        .from(users)
        .where(and(gte(users.createdAt, twoWeeksAgoStart), lte(users.createdAt, lastWeekStart)));
      const lastWeekUsers = lastWeekUsersResult[0]?.count ?? 0;

      // 用户增长百分比
      const usersChange =
        lastWeekUsers > 0
          ? ((thisWeekUsers - lastWeekUsers) / lastWeekUsers) * 100
          : thisWeekUsers > 0
            ? 100
            : 0;

      // 在线设备数 (暂时返回模拟数据，实际需要从设备心跳表获取)
      const onlineDevices = 0;

      // 今日 API 调用次数 (暂时返回0，实际需要从日志表获取)
      const apiCallsToday = 0;

      return {
        totalUsers,
        newUsersToday,
        activeUsers7d,
        paidUsers,
        revenueThisMonth,
        onlineDevices,
        apiCallsToday,
        changes: {
          users: Math.round(usersChange * 10) / 10,
          revenue: 0, // 需要实际计算
          subscriptions: 0, // 需要实际计算
        },
      };
    } catch (error) {
      logger.error(`[${LOG_TAG}] Failed to get dashboard stats`, { error });
      throw error;
    }
  }

  /**
   * 获取趋势数据
   *
   * @param type - 趋势类型 (users | revenue | subscriptions)
   * @param period - 时间周期 (7d | 30d | 90d)
   */
  async getTrends(
    type: "users" | "revenue" | "subscriptions",
    period: "7d" | "30d" | "90d" = "30d",
  ): Promise<TrendData> {
    logger.info(`[${LOG_TAG}] Getting trends`, { type, period });

    const db = getDatabase();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const labels: string[] = [];
    const values: number[] = [];

    try {
      // 生成日期标签
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        labels.push(date.toISOString().split("T")[0]);
      }

      if (type === "users") {
        // 查询每日新增用户数
        const result = await db
          .select({
            date: sql<string>`DATE(${users.createdAt})`.as("date"),
            count: count(),
          })
          .from(users)
          .where(gte(users.createdAt, startDate))
          .groupBy(sql`DATE(${users.createdAt})`)
          .orderBy(sql`DATE(${users.createdAt})`);

        // 填充数据
        const dataMap = new Map<string, number>();
        for (const r of result) {
          dataMap.set(r.date, r.count);
        }
        for (const label of labels) {
          values.push(dataMap.get(label) ?? 0);
        }
      } else if (type === "revenue") {
        // 查询每日收入
        const result = await db
          .select({
            date: sql<string>`DATE(${paymentOrders.paidAt})`.as("date"),
            total: sum(paymentOrders.paidAmount),
          })
          .from(paymentOrders)
          .where(and(eq(paymentOrders.paymentStatus, "paid"), gte(paymentOrders.paidAt, startDate)))
          .groupBy(sql`DATE(${paymentOrders.paidAt})`)
          .orderBy(sql`DATE(${paymentOrders.paidAt})`);

        // 填充数据
        const dataMap = new Map<string, number>();
        for (const r of result) {
          dataMap.set(r.date, Number(r.total ?? 0));
        }
        for (const label of labels) {
          values.push(dataMap.get(label) ?? 0);
        }
      } else if (type === "subscriptions") {
        // 查询每日新增订阅数
        const result = await db
          .select({
            date: sql<string>`DATE(${subscriptions.createdAt})`.as("date"),
            count: count(),
          })
          .from(subscriptions)
          .where(gte(subscriptions.createdAt, startDate))
          .groupBy(sql`DATE(${subscriptions.createdAt})`)
          .orderBy(sql`DATE(${subscriptions.createdAt})`);

        // 填充数据
        const dataMap = new Map<string, number>();
        for (const r of result) {
          dataMap.set(r.date, r.count);
        }
        for (const label of labels) {
          values.push(dataMap.get(label) ?? 0);
        }
      }

      return { labels, values };
    } catch (error) {
      logger.error(`[${LOG_TAG}] Failed to get trends`, { error, type, period });
      throw error;
    }
  }

  /**
   * 获取订阅分布
   */
  async getSubscriptionDistribution(): Promise<SubscriptionDistribution[]> {
    logger.info(`[${LOG_TAG}] Getting subscription distribution`);

    const db = getDatabase();

    try {
      // 查询各计划的订阅数量
      const result = await db
        .select({
          planId: subscriptions.planId,
          count: count(),
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
        .groupBy(subscriptions.planId);

      // 获取计划信息
      const plansList = await db.select().from(plans);
      const plansMap = new Map<string, (typeof plansList)[0]>();
      for (const p of plansList) {
        plansMap.set(p.id, p);
      }

      // 计算总数
      let total = 0;
      for (const r of result) {
        total += r.count;
      }

      // 组装结果
      const distribution: SubscriptionDistribution[] = [];
      for (const r of result) {
        const plan = plansMap.get(r.planId);
        distribution.push({
          name: plan?.name ?? "未知计划",
          code: plan?.code ?? "unknown",
          count: r.count,
          percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
        });
      }

      // 按数量降序排序
      distribution.sort((a, b) => b.count - a.count);

      return distribution;
    } catch (error) {
      logger.error(`[${LOG_TAG}] Failed to get subscription distribution`, { error });
      throw error;
    }
  }

  /**
   * 获取最近活动
   *
   * @param limit - 返回数量限制
   */
  async getActivities(limit = 10): Promise<Activity[]> {
    logger.info(`[${LOG_TAG}] Getting recent activities`, { limit });

    const db = getDatabase();
    const activities: Activity[] = [];

    try {
      // 查询最近注册用户
      const recentUsers = await db
        .select({
          id: users.id,
          phone: users.phone,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit);

      for (const user of recentUsers) {
        activities.push({
          type: "user_register",
          userId: user.id,
          userName: maskPhone(user.phone),
          timestamp: user.createdAt?.toISOString() ?? new Date().toISOString(),
        });
      }

      // 查询最近订阅 - 简化版本，避免复杂的关联查询
      const recentSubs = await db
        .select({
          userId: subscriptions.userId,
          planId: subscriptions.planId,
          status: subscriptions.status,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .orderBy(desc(subscriptions.createdAt))
        .limit(limit);

      // 获取计划信息
      const plansList = await db.select().from(plans);
      const plansMap = new Map<string, (typeof plansList)[0]>();
      for (const p of plansList) {
        plansMap.set(p.id, p);
      }

      for (const sub of recentSubs) {
        const plan = plansMap.get(sub.planId);

        activities.push({
          type: sub.status === "canceled" ? "subscription_canceled" : "subscription_created",
          userId: sub.userId,
          userName: "用户",
          planName: plan?.name ?? "未知计划",
          timestamp: sub.createdAt?.toISOString() ?? new Date().toISOString(),
        });
      }

      // 查询最近支付
      const recentPayments = await db
        .select({
          userId: paymentOrders.userId,
          paidAmount: paymentOrders.paidAmount,
          paymentStatus: paymentOrders.paymentStatus,
          paidAt: paymentOrders.paidAt,
        })
        .from(paymentOrders)
        .where(eq(paymentOrders.paymentStatus, "paid"))
        .orderBy(desc(paymentOrders.paidAt))
        .limit(limit);

      for (const payment of recentPayments) {
        activities.push({
          type: "payment_success",
          userId: payment.userId ?? undefined,
          userName: "用户",
          amount: payment.paidAmount ?? 0,
          timestamp: payment.paidAt?.toISOString() ?? new Date().toISOString(),
        });
      }

      // 按时间排序并限制数量
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, limit);
    } catch (error) {
      logger.error(`[${LOG_TAG}] Failed to get activities`, { error });
      throw error;
    }
  }
}

// 单例实例
let dashboardService: AdminDashboardService | null = null;

/**
 * 获取管理后台仪表盘服务实例
 */
export function getAdminDashboardService(): AdminDashboardService {
  if (!dashboardService) {
    dashboardService = new AdminDashboardService();
  }
  return dashboardService;
}
