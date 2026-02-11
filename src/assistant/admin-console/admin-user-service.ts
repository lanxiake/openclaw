/**
 * 管理后台用户管理服务
 *
 * 提供用户列表查询、用户详情、用户状态管理等功能
 */

import { eq, and, or, gt, lt, desc, asc, like, sql, count } from "drizzle-orm";

import { getDatabase, type Database } from "../../db/connection.js";
import {
  users,
  userDevices,
  userSessions,
  subscriptions,
  type User,
} from "../../db/schema/index.js";
import { getLogger } from "../../shared/logging/logger.js";
import { adminAudit } from "../../db/repositories/admins.js";
import {
  getSubscriptionRepository,
  getUserDeviceRepository,
  getUserSessionRepository,
} from "../../db/repositories/index.js";

const logger = getLogger();

/**
 * 用户列表查询参数
 */
export interface UserListParams {
  /** 搜索关键词 (手机号/邮箱/显示名称) */
  search?: string;
  /** 用户状态过滤 */
  status?: "active" | "inactive" | "all";
  /** 订阅状态过滤 */
  subscriptionStatus?: "active" | "trial" | "expired" | "canceled" | "all";
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
  /** 分页: 页码 */
  page?: number;
  /** 分页: 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  orderBy?: "createdAt" | "lastLoginAt" | "displayName";
  /** 排序方向 */
  orderDir?: "asc" | "desc";
}

/**
 * 用户列表项 (简化信息)
 */
export interface UserListItem {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** 设备数量 */
  deviceCount: number;
  /** 订阅信息 */
  subscription: {
    planName: string | null;
    status: string | null;
    endDate: Date | null;
  } | null;
}

/**
 * 用户详情
 */
export interface UserDetail extends UserListItem {
  /** 绑定的设备列表 */
  devices: Array<{
    id: string;
    deviceId: string;
    alias: string | null;
    isPrimary: boolean;
    linkedAt: Date;
    lastActiveAt: Date | null;
  }>;
  /** 订阅详情 */
  subscriptionDetail: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenew: boolean;
  } | null;
  /** 使用统计 */
  usageStats: {
    totalMessages: number;
    totalTokens: number;
    monthlyMessages: number;
    monthlyTokens: number;
  };
  /** 偏好设置 */
  preferences: Record<string, unknown> | null;
  /** 元数据 */
  metadata: Record<string, unknown> | null;
}

/**
 * 用户列表查询结果
 */
export interface UserListResult {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 管理后台用户管理服务类
 */
export class AdminUserService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 查询用户列表
   */
  async listUsers(params: UserListParams = {}): Promise<UserListResult> {
    const {
      search,
      status = "all",
      subscriptionStatus = "all",
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDir = "desc",
    } = params;

    const conditions = [];

    // 搜索条件
    if (search) {
      conditions.push(
        or(
          like(users.phone, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.displayName, `%${search}%`),
        ),
      );
    }

    // 状态过滤
    if (status === "active") {
      conditions.push(eq(users.isActive, true));
    } else if (status === "inactive") {
      conditions.push(eq(users.isActive, false));
    }

    // 日期范围
    if (startDate) {
      conditions.push(gt(users.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lt(users.createdAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    // 排序
    const orderColumn =
      orderBy === "lastLoginAt"
        ? users.lastLoginAt
        : orderBy === "displayName"
          ? users.displayName
          : users.createdAt;
    const orderFn = orderDir === "asc" ? asc : desc;

    // 分页查询
    const offset = (page - 1) * pageSize;
    const userList = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset(offset);

    // 获取每个用户的设备数量和订阅信息
    const usersWithDetails = await Promise.all(
      userList.map(async (user) => {
        // 获取设备数量
        const [{ count: deviceCount }] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(userDevices)
          .where(eq(userDevices.userId, user.id));

        // 获取订阅信息
        const [subscription] = await this.db
          .select({
            planId: subscriptions.planId,
            status: subscriptions.status,
            endDate: subscriptions.currentPeriodEnd,
          })
          .from(subscriptions)
          .where(eq(subscriptions.userId, user.id))
          .limit(1);

        return {
          id: user.id,
          phone: user.phone,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          deviceCount,
          subscription: subscription
            ? {
                planName: subscription.planId, // TODO: 获取实际计划名称
                status: subscription.status,
                endDate: subscription.endDate,
              }
            : null,
        };
      }),
    );

    return {
      users: usersWithDetails,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string): Promise<UserDetail | null> {
    // 获取用户基本信息
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return null;
    }

    // 获取设备列表
    const devices = await this.db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.linkedAt));

    // 获取订阅信息
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    // TODO: 获取使用统计 (需要从消息表统计)
    const usageStats = {
      totalMessages: 0,
      totalTokens: 0,
      monthlyMessages: 0,
      monthlyTokens: 0,
    };

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      deviceCount: devices.length,
      subscription: subscription
        ? {
            planName: subscription.planId,
            status: subscription.status,
            endDate: subscription.currentPeriodEnd,
          }
        : null,
      devices: devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        alias: d.alias,
        isPrimary: d.isPrimary,
        linkedAt: d.linkedAt,
        lastActiveAt: d.lastActiveAt,
      })),
      subscriptionDetail: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            planName: subscription.planId, // TODO: 获取实际计划名称
            status: subscription.status,
            startDate: subscription.currentPeriodStart,
            endDate: subscription.currentPeriodEnd,
            autoRenew: !subscription.canceledAt, // 如果没有取消则视为自动续费
          }
        : null,
      usageStats,
      preferences: user.preferences as Record<string, unknown> | null,
      metadata: user.metadata,
    };
  }

  /**
   * 停用用户
   */
  async suspendUser(
    userId: string,
    adminId: string,
    adminUsername: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取用户信息
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: "用户不存在" };
      }

      if (!user.isActive) {
        return { success: false, error: "用户已处于停用状态" };
      }

      // 更新用户状态
      await this.db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 撤销所有会话
      await this.db
        .update(userSessions)
        .set({ revoked: true })
        .where(eq(userSessions.userId, userId));

      // 记录审计日志
      await adminAudit({
        adminId,
        adminUsername,
        action: "user.suspend",
        targetType: "user",
        targetId: userId,
        targetName: user.displayName || user.phone || user.email || userId,
        details: { reason },
        ipAddress,
        userAgent,
        riskLevel: "high",
      });

      logger.info("[admin-user] User suspended", {
        userId,
        adminId,
        reason,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-user] Failed to suspend user", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "停用用户失败" };
    }
  }

  /**
   * 激活用户
   */
  async activateUser(
    userId: string,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取用户信息
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: "用户不存在" };
      }

      if (user.isActive) {
        return { success: false, error: "用户已处于激活状态" };
      }

      // 更新用户状态
      await this.db
        .update(users)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 记录审计日志
      await adminAudit({
        adminId,
        adminUsername,
        action: "user.activate",
        targetType: "user",
        targetId: userId,
        targetName: user.displayName || user.phone || user.email || userId,
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-user] User activated", {
        userId,
        adminId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-user] Failed to activate user", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "激活用户失败" };
    }
  }

  /**
   * 重置用户密码
   */
  async resetUserPassword(
    userId: string,
    newPassword: string,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { hashPassword } = await import("../../db/utils/password.js");

      // 获取用户信息
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: "用户不存在" };
      }

      // 哈希新密码
      const passwordHash = await hashPassword(newPassword);

      // 更新密码
      await this.db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 撤销所有会话，强制重新登录
      await this.db
        .update(userSessions)
        .set({ revoked: true })
        .where(eq(userSessions.userId, userId));

      // 记录审计日志
      await adminAudit({
        adminId,
        adminUsername,
        action: "user.reset_password",
        targetType: "user",
        targetId: userId,
        targetName: user.displayName || user.phone || user.email || userId,
        ipAddress,
        userAgent,
        riskLevel: "high",
      });

      logger.info("[admin-user] User password reset", {
        userId,
        adminId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-user] Failed to reset user password", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "重置密码失败" };
    }
  }

  /**
   * 解绑用户设备
   */
  async unlinkUserDevice(
    userId: string,
    deviceId: string,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取设备信息
      const [device] = await this.db
        .select()
        .from(userDevices)
        .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)));

      if (!device) {
        return { success: false, error: "设备不存在" };
      }

      // 删除设备关联
      await this.db
        .delete(userDevices)
        .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)));

      // 记录审计日志
      await adminAudit({
        adminId,
        adminUsername,
        action: "user.unlink_device",
        targetType: "user",
        targetId: userId,
        details: { deviceId, deviceAlias: device.alias },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-user] User device unlinked", {
        userId,
        deviceId,
        adminId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-user] Failed to unlink user device", {
        userId,
        deviceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "解绑设备失败" };
    }
  }

  /**
   * 强制登出用户所有会话
   */
  async forceLogoutUser(
    userId: string,
    adminId: string,
    adminUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取用户信息
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: "用户不存在" };
      }

      // 撤销所有会话
      const result = await this.db
        .update(userSessions)
        .set({ revoked: true })
        .where(eq(userSessions.userId, userId));

      // 记录审计日志
      await adminAudit({
        adminId,
        adminUsername,
        action: "user.force_logout",
        targetType: "user",
        targetId: userId,
        targetName: user.displayName || user.phone || user.email || userId,
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-user] User sessions revoked", {
        userId,
        adminId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-user] Failed to force logout user", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "强制登出失败" };
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisMonth: number;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(users);

    const [{ active }] = await this.db
      .select({ active: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isActive, true));

    const [{ today }] = await this.db
      .select({ today: sql<number>`count(*)::int` })
      .from(users)
      .where(gt(users.createdAt, startOfDay));

    const [{ thisMonth }] = await this.db
      .select({ thisMonth: sql<number>`count(*)::int` })
      .from(users)
      .where(gt(users.createdAt, startOfMonth));

    return {
      totalUsers: total,
      activeUsers: active,
      newUsersToday: today,
      newUsersThisMonth: thisMonth,
    };
  }
}

// 单例
let adminUserServiceInstance: AdminUserService | null = null;

export function getAdminUserService(db?: Database): AdminUserService {
  if (!adminUserServiceInstance || db) {
    adminUserServiceInstance = new AdminUserService(db);
  }
  return adminUserServiceInstance;
}
