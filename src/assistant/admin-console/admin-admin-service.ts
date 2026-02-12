/**
 * 管理后台管理员管理服务
 *
 * 提供管理员列表查询、创建、更新、状态管理等功能
 * 仅 super_admin 角色可执行写操作
 */

import { eq, and, or, desc, asc, like, sql, ne } from "drizzle-orm";

import { getDatabase, type Database } from "../../db/connection.js";
import { admins, adminSessions, type Admin, type AdminRole } from "../../db/schema/index.js";
import { getLogger } from "../../logging/logger.js";
import {
  adminAudit,
  getAdminRepository,
  getAdminSessionRepository,
} from "../../db/repositories/admins.js";
import { hashPassword } from "../../db/utils/password.js";

const logger = getLogger();

/**
 * 管理员列表查询参数
 */
export interface AdminListParams {
  /** 搜索关键词 (用户名/显示名称/邮箱) */
  search?: string;
  /** 角色过滤 */
  role?: AdminRole | "all";
  /** 状态过滤 */
  status?: "active" | "suspended" | "locked" | "all";
  /** 分页: 页码 */
  page?: number;
  /** 分页: 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  orderBy?: "createdAt" | "username" | "lastLoginAt";
  /** 排序方向 */
  orderDir?: "asc" | "desc";
}

/**
 * 管理员列表项（脱敏后的安全视图）
 */
export interface AdminListItem {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
}

/**
 * 管理员列表查询结果
 */
export interface AdminListResult {
  admins: AdminListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 创建管理员参数
 */
export interface CreateAdminParams {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: AdminRole;
}

/**
 * 更新管理员参数
 */
export interface UpdateAdminParams {
  displayName?: string;
  email?: string;
  phone?: string;
  role?: AdminRole;
}

/**
 * 将 Admin 实体转换为安全的列表项（隐藏密码等敏感字段）
 */
function toAdminListItem(admin: Admin): AdminListItem {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    email: admin.email,
    phone: admin.phone,
    avatarUrl: admin.avatarUrl,
    role: admin.role,
    status: admin.status,
    mfaEnabled: admin.mfaEnabled,
    lastLoginAt: admin.lastLoginAt,
    lastLoginIp: admin.lastLoginIp,
    createdAt: admin.createdAt,
  };
}

/**
 * 管理后台管理员管理服务类
 */
export class AdminAdminService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 查询管理员列表
   */
  async listAdmins(params: AdminListParams = {}): Promise<AdminListResult> {
    const {
      search,
      role = "all",
      status = "all",
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDir = "desc",
    } = params;

    const repo = getAdminRepository(this.db);
    const result = await repo.findAll({
      search,
      role: role === "all" ? undefined : (role as AdminRole),
      status: status === "all" ? undefined : (status as "active" | "suspended" | "locked"),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: orderBy === "lastLoginAt" ? "createdAt" : orderBy,
      orderDir,
    });

    logger.info("[admin-admin] Listed admins", {
      total: result.total,
      page,
      pageSize,
      search,
      role,
      status,
    });

    return {
      admins: result.admins.map(toAdminListItem),
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    };
  }

  /**
   * 获取管理员详情
   */
  async getAdminDetail(adminId: string): Promise<AdminListItem | null> {
    const repo = getAdminRepository(this.db);
    const admin = await repo.findById(adminId);

    if (!admin) {
      return null;
    }

    return toAdminListItem(admin);
  }

  /**
   * 创建管理员
   */
  async createAdmin(
    params: CreateAdminParams,
    operatorId: string,
    operatorUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; admin?: AdminListItem; error?: string }> {
    try {
      const repo = getAdminRepository(this.db);

      // 检查用户名是否已存在
      const existing = await repo.findByUsername(params.username);
      if (existing) {
        return { success: false, error: "用户名已存在" };
      }

      // 检查邮箱是否已存在
      if (params.email) {
        const existingEmail = await repo.findByEmail(params.email);
        if (existingEmail) {
          return { success: false, error: "邮箱已被使用" };
        }
      }

      // 创建管理员（repo.create 内部会哈希密码）
      const admin = await repo.create({
        username: params.username,
        passwordHash: params.password,
        displayName: params.displayName,
        email: params.email,
        phone: params.phone,
        role: params.role,
        status: "active",
        createdBy: operatorId,
      });

      // 记录审计日志
      await adminAudit({
        adminId: operatorId,
        adminUsername: operatorUsername,
        action: "admin.create",
        targetType: "admin",
        targetId: admin.id,
        targetName: admin.username,
        afterSnapshot: {
          username: admin.username,
          displayName: admin.displayName,
          role: admin.role,
          email: admin.email,
        },
        ipAddress,
        userAgent,
        riskLevel: "high",
      });

      logger.info("[admin-admin] Admin created", {
        newAdminId: admin.id,
        username: params.username,
        role: params.role,
        operatorId,
      });

      return { success: true, admin: toAdminListItem(admin) };
    } catch (error) {
      logger.error("[admin-admin] Failed to create admin", {
        username: params.username,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "创建管理员失败" };
    }
  }

  /**
   * 更新管理员信息
   */
  async updateAdmin(
    targetAdminId: string,
    params: UpdateAdminParams,
    operatorId: string,
    operatorUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; admin?: AdminListItem; error?: string }> {
    try {
      const repo = getAdminRepository(this.db);

      // 获取原始数据用于审计日志
      const before = await repo.findById(targetAdminId);
      if (!before) {
        return { success: false, error: "管理员不存在" };
      }

      // 不允许修改自己的角色
      if (params.role && targetAdminId === operatorId) {
        return { success: false, error: "不能修改自己的角色" };
      }

      // 检查邮箱是否被其他人使用
      if (params.email) {
        const existingEmail = await repo.findByEmail(params.email);
        if (existingEmail && existingEmail.id !== targetAdminId) {
          return { success: false, error: "邮箱已被其他管理员使用" };
        }
      }

      const updateData: Record<string, unknown> = {};
      if (params.displayName !== undefined) updateData.displayName = params.displayName;
      if (params.email !== undefined) updateData.email = params.email;
      if (params.phone !== undefined) updateData.phone = params.phone;
      if (params.role !== undefined) updateData.role = params.role;

      const updated = await repo.update(targetAdminId, updateData);
      if (!updated) {
        return { success: false, error: "更新失败" };
      }

      // 记录审计日志
      await adminAudit({
        adminId: operatorId,
        adminUsername: operatorUsername,
        action: "admin.update",
        targetType: "admin",
        targetId: targetAdminId,
        targetName: before.username,
        beforeSnapshot: {
          displayName: before.displayName,
          email: before.email,
          phone: before.phone,
          role: before.role,
        },
        afterSnapshot: {
          displayName: updated.displayName,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
        },
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-admin] Admin updated", {
        targetAdminId,
        operatorId,
        changes: Object.keys(updateData),
      });

      return { success: true, admin: toAdminListItem(updated) };
    } catch (error) {
      logger.error("[admin-admin] Failed to update admin", {
        targetAdminId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "更新管理员失败" };
    }
  }

  /**
   * 重置管理员密码
   */
  async resetAdminPassword(
    targetAdminId: string,
    newPassword: string,
    operatorId: string,
    operatorUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const repo = getAdminRepository(this.db);
      const sessionRepo = getAdminSessionRepository(this.db);

      const target = await repo.findById(targetAdminId);
      if (!target) {
        return { success: false, error: "管理员不存在" };
      }

      // 更新密码（repo.update 内部会哈希）
      await repo.update(targetAdminId, { passwordHash: newPassword });

      // 撤销所有会话，强制重新登录
      await sessionRepo.revokeAllForAdmin(targetAdminId);

      // 记录审计日志
      await adminAudit({
        adminId: operatorId,
        adminUsername: operatorUsername,
        action: "admin.reset_password",
        targetType: "admin",
        targetId: targetAdminId,
        targetName: target.username,
        ipAddress,
        userAgent,
        riskLevel: "critical",
      });

      logger.info("[admin-admin] Admin password reset", {
        targetAdminId,
        operatorId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-admin] Failed to reset admin password", {
        targetAdminId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "重置密码失败" };
    }
  }

  /**
   * 更新管理员状态（启用/禁用）
   */
  async updateAdminStatus(
    targetAdminId: string,
    newStatus: "active" | "suspended",
    operatorId: string,
    operatorUsername: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const repo = getAdminRepository(this.db);
      const sessionRepo = getAdminSessionRepository(this.db);

      const target = await repo.findById(targetAdminId);
      if (!target) {
        return { success: false, error: "管理员不存在" };
      }

      // 不允许禁用自己
      if (targetAdminId === operatorId) {
        return { success: false, error: "不能修改自己的状态" };
      }

      // 不允许禁用其他 super_admin（除非自己也是 super_admin，但这里已保证操作者是 super_admin）
      if (target.role === "super_admin" && newStatus === "suspended") {
        // 检查是否是最后一个 super_admin
        const { admins: superAdmins } = await repo.findAll({
          role: "super_admin",
          status: "active",
        });
        if (superAdmins.length <= 1) {
          return { success: false, error: "不能禁用最后一个超级管理员" };
        }
      }

      if (newStatus === "suspended") {
        await repo.suspend(targetAdminId);
        // 撤销所有会话
        await sessionRepo.revokeAllForAdmin(targetAdminId);
      } else {
        await repo.activate(targetAdminId);
      }

      const action = newStatus === "suspended" ? "admin.suspend" : "admin.activate";

      // 记录审计日志
      await adminAudit({
        adminId: operatorId,
        adminUsername: operatorUsername,
        action,
        targetType: "admin",
        targetId: targetAdminId,
        targetName: target.username,
        details: { reason, previousStatus: target.status },
        ipAddress,
        userAgent,
        riskLevel: newStatus === "suspended" ? "high" : "medium",
      });

      logger.info("[admin-admin] Admin status updated", {
        targetAdminId,
        newStatus,
        operatorId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-admin] Failed to update admin status", {
        targetAdminId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "更新管理员状态失败" };
    }
  }

  /**
   * 强制管理员登出
   */
  async forceLogoutAdmin(
    targetAdminId: string,
    operatorId: string,
    operatorUsername: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const repo = getAdminRepository(this.db);
      const sessionRepo = getAdminSessionRepository(this.db);

      const target = await repo.findById(targetAdminId);
      if (!target) {
        return { success: false, error: "管理员不存在" };
      }

      // 撤销所有会话
      await sessionRepo.revokeAllForAdmin(targetAdminId);

      // 记录审计日志
      await adminAudit({
        adminId: operatorId,
        adminUsername: operatorUsername,
        action: "admin.force_logout",
        targetType: "admin",
        targetId: targetAdminId,
        targetName: target.username,
        ipAddress,
        userAgent,
        riskLevel: "medium",
      });

      logger.info("[admin-admin] Admin force logout", {
        targetAdminId,
        operatorId,
      });

      return { success: true };
    } catch (error) {
      logger.error("[admin-admin] Failed to force logout admin", {
        targetAdminId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "强制登出失败" };
    }
  }
}

// 单例
let adminAdminServiceInstance: AdminAdminService | null = null;

/**
 * 获取管理员管理服务实例
 */
export function getAdminAdminService(db?: Database): AdminAdminService {
  if (!adminAdminServiceInstance || db) {
    adminAdminServiceInstance = new AdminAdminService(db);
  }
  return adminAdminServiceInstance;
}
