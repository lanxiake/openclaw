/**
 * 管理员数据访问层
 *
 * 提供管理员 CRUD 操作
 */

import { eq, and, or, gt, sql, desc, asc, like } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  admins,
  adminSessions,
  adminAuditLogs,
  adminLoginAttempts,
  type Admin,
  type NewAdmin,
  type AdminSession,
  type NewAdminSession,
  type AdminAuditLog,
  type NewAdminAuditLog,
  type AdminLoginAttempt,
  type NewAdminLoginAttempt,
  type AdminRole,
  type AdminStatus,
  type AdminPermissions,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { hashPassword, hashRefreshToken, generateRefreshToken } from "../utils/password.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 管理员仓库类
 */
export class AdminRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建管理员
   */
  async create(data: Omit<NewAdmin, "id" | "createdAt" | "updatedAt">): Promise<Admin> {
    const id = generateId();
    const now = new Date();

    // 密码哈希处理
    let passwordHash = data.passwordHash;
    if (passwordHash && !passwordHash.startsWith("$scrypt$")) {
      passwordHash = await hashPassword(passwordHash);
    }

    const [admin] = await this.db
      .insert(admins)
      .values({
        ...data,
        id,
        passwordHash: passwordHash || "",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[admin-repo] Admin created", {
      adminId: id,
      username: data.username,
    });
    return admin;
  }

  /**
   * 根据 ID 查找管理员
   */
  async findById(id: string): Promise<Admin | null> {
    const [admin] = await this.db.select().from(admins).where(eq(admins.id, id));
    return admin ?? null;
  }

  /**
   * 根据用户名查找管理员
   */
  async findByUsername(username: string): Promise<Admin | null> {
    const [admin] = await this.db.select().from(admins).where(eq(admins.username, username));
    return admin ?? null;
  }

  /**
   * 根据邮箱查找管理员
   */
  async findByEmail(email: string): Promise<Admin | null> {
    const [admin] = await this.db
      .select()
      .from(admins)
      .where(eq(admins.email, email.toLowerCase()));
    return admin ?? null;
  }

  /**
   * 获取管理员列表
   */
  async findAll(options?: {
    role?: AdminRole;
    status?: AdminStatus;
    search?: string;
    limit?: number;
    offset?: number;
    orderBy?: "createdAt" | "username";
    orderDir?: "asc" | "desc";
  }): Promise<{ admins: Admin[]; total: number }> {
    const conditions = [];

    if (options?.role) {
      conditions.push(eq(admins.role, options.role));
    }
    if (options?.status) {
      conditions.push(eq(admins.status, options.status));
    }
    if (options?.search) {
      conditions.push(
        or(
          like(admins.username, `%${options.search}%`),
          like(admins.displayName, `%${options.search}%`),
          like(admins.email, `%${options.search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(admins)
      .where(whereClause);

    // 获取列表
    const orderColumn = options?.orderBy === "username" ? admins.username : admins.createdAt;
    const orderFn = options?.orderDir === "asc" ? asc : desc;

    let query = this.db.select().from(admins).where(whereClause).orderBy(orderFn(orderColumn));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const result = await query;

    return { admins: result, total: count };
  }

  /**
   * 更新管理员
   */
  async update(
    id: string,
    data: Partial<Omit<NewAdmin, "id" | "createdAt">>,
  ): Promise<Admin | null> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    // 如果更新密码，先哈希
    if (updateData.passwordHash && !updateData.passwordHash.startsWith("$scrypt$")) {
      updateData.passwordHash = await hashPassword(updateData.passwordHash);
      updateData.passwordChangedAt = new Date();
    }

    const [admin] = await this.db
      .update(admins)
      .set(updateData)
      .where(eq(admins.id, id))
      .returning();

    if (admin) {
      logger.info("[admin-repo] Admin updated", { adminId: id });
    }
    return admin ?? null;
  }

  /**
   * 更新最后登录信息
   */
  async updateLastLogin(id: string, ipAddress?: string): Promise<void> {
    await this.db
      .update(admins)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedLoginAttempts: "0",
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
  }

  /**
   * 增加失败登录次数
   */
  async incrementFailedAttempts(id: string): Promise<number> {
    const [result] = await this.db
      .update(admins)
      .set({
        failedLoginAttempts: sql`${admins.failedLoginAttempts} + 1`,
        lastFailedLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id))
      .returning({ failedLoginAttempts: admins.failedLoginAttempts });

    return Number(result?.failedLoginAttempts) || 0;
  }

  /**
   * 重置失败登录次数
   */
  async resetFailedAttempts(id: string): Promise<void> {
    await this.db
      .update(admins)
      .set({
        failedLoginAttempts: "0",
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
  }

  /**
   * 锁定账户
   */
  async lockAccount(id: string, lockDurationMs: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockDurationMs);
    await this.db
      .update(admins)
      .set({
        status: "locked",
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
    logger.warn("[admin-repo] Admin account locked", {
      adminId: id,
      lockedUntil: lockedUntil.toISOString(),
    });
  }

  /**
   * 解锁账户
   */
  async unlockAccount(id: string): Promise<void> {
    await this.db
      .update(admins)
      .set({
        status: "active",
        lockedUntil: null,
        failedLoginAttempts: "0",
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
    logger.info("[admin-repo] Admin account unlocked", { adminId: id });
  }

  /**
   * 停用管理员
   */
  async suspend(id: string): Promise<void> {
    await this.db
      .update(admins)
      .set({
        status: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
    logger.info("[admin-repo] Admin suspended", { adminId: id });
  }

  /**
   * 激活管理员
   */
  async activate(id: string): Promise<void> {
    await this.db
      .update(admins)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(admins.id, id));
    logger.info("[admin-repo] Admin activated", { adminId: id });
  }

  /**
   * 删除管理员
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(admins).where(eq(admins.id, id));
    logger.warn("[admin-repo] Admin deleted", { adminId: id });
  }
}

/**
 * 管理员会话仓库类
 */
export class AdminSessionRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建会话
   */
  async create(
    adminId: string,
    options: { userAgent?: string; ipAddress?: string; expiresInMs?: number },
  ): Promise<{ session: AdminSession; refreshToken: string }> {
    const id = generateId();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + (options.expiresInMs ?? 24 * 60 * 60 * 1000), // 默认 24 小时
    );

    const [session] = await this.db
      .insert(adminSessions)
      .values({
        id,
        adminId,
        refreshTokenHash,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        expiresAt,
        createdAt: new Date(),
      })
      .returning();

    logger.debug("[admin-session-repo] Session created", {
      sessionId: id,
      adminId,
    });
    return { session, refreshToken };
  }

  /**
   * 根据 Refresh Token 查找会话
   */
  async findByRefreshToken(refreshToken: string): Promise<AdminSession | null> {
    const hash = hashRefreshToken(refreshToken);
    const [session] = await this.db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.refreshTokenHash, hash),
          eq(adminSessions.revoked, false),
          gt(adminSessions.expiresAt, new Date()),
        ),
      );
    return session ?? null;
  }

  /**
   * 获取管理员的所有会话
   */
  async findByAdminId(adminId: string): Promise<AdminSession[]> {
    return this.db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.adminId, adminId),
          eq(adminSessions.revoked, false),
          gt(adminSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(adminSessions.createdAt));
  }

  /**
   * 刷新会话
   */
  async refresh(
    sessionId: string,
    newExpiresInMs?: number,
  ): Promise<{ session: AdminSession; refreshToken: string } | null> {
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + (newExpiresInMs ?? 24 * 60 * 60 * 1000));

    const [session] = await this.db
      .update(adminSessions)
      .set({
        refreshTokenHash: newHash,
        expiresAt: newExpiresAt,
        lastActiveAt: new Date(),
      })
      .where(eq(adminSessions.id, sessionId))
      .returning();

    if (!session) return null;
    return { session, refreshToken: newRefreshToken };
  }

  /**
   * 更新最后活跃时间
   */
  async updateLastActive(sessionId: string): Promise<void> {
    await this.db
      .update(adminSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(adminSessions.id, sessionId));
  }

  /**
   * 撤销会话
   */
  async revoke(sessionId: string): Promise<void> {
    await this.db
      .update(adminSessions)
      .set({ revoked: true })
      .where(eq(adminSessions.id, sessionId));
    logger.debug("[admin-session-repo] Session revoked", { sessionId });
  }

  /**
   * 撤销管理员所有会话
   */
  async revokeAllForAdmin(adminId: string): Promise<void> {
    await this.db
      .update(adminSessions)
      .set({ revoked: true })
      .where(eq(adminSessions.adminId, adminId));
    logger.info("[admin-session-repo] All sessions revoked for admin", { adminId });
  }

  /**
   * 清理过期会话
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .delete(adminSessions)
      .where(or(sql`${adminSessions.expiresAt} < NOW()`, eq(adminSessions.revoked, true)));
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info("[admin-session-repo] Cleaned up expired sessions", { count });
    }
    return count;
  }
}

/**
 * 管理员审计日志仓库类
 */
export class AdminAuditLogRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 记录审计日志
   */
  async create(data: Omit<NewAdminAuditLog, "id" | "createdAt">): Promise<AdminAuditLog> {
    const id = generateId();

    const [log] = await this.db
      .insert(adminAuditLogs)
      .values({
        ...data,
        id,
        createdAt: new Date(),
      })
      .returning();

    logger.debug("[admin-audit-repo] Audit log created", {
      logId: id,
      action: data.action,
      adminId: data.adminId,
    });
    return log;
  }

  /**
   * 查询审计日志
   */
  async findAll(options?: {
    adminId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    riskLevel?: "low" | "medium" | "high" | "critical";
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number }> {
    const conditions = [];

    if (options?.adminId) {
      conditions.push(eq(adminAuditLogs.adminId, options.adminId));
    }
    if (options?.action) {
      conditions.push(eq(adminAuditLogs.action, options.action));
    }
    if (options?.targetType) {
      conditions.push(eq(adminAuditLogs.targetType, options.targetType));
    }
    if (options?.targetId) {
      conditions.push(eq(adminAuditLogs.targetId, options.targetId));
    }
    if (options?.riskLevel) {
      conditions.push(eq(adminAuditLogs.riskLevel, options.riskLevel));
    }
    if (options?.startDate) {
      conditions.push(gt(adminAuditLogs.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(sql`${adminAuditLogs.createdAt} < ${options.endDate}`);
    }
    if (options?.search) {
      conditions.push(
        or(
          like(adminAuditLogs.adminUsername, `%${options.search}%`),
          like(adminAuditLogs.action, `%${options.search}%`),
          like(adminAuditLogs.targetName, `%${options.search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(whereClause);

    // 获取列表
    let query = this.db
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const logs = await query;

    return { logs, total: count };
  }

  /**
   * 根据 ID 获取审计日志详情
   */
  async findById(id: string): Promise<AdminAuditLog | null> {
    const [log] = await this.db.select().from(adminAuditLogs).where(eq(adminAuditLogs.id, id));
    return log ?? null;
  }
}

/**
 * 管理员登录尝试仓库类
 */
export class AdminLoginAttemptRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 记录登录尝试
   */
  async record(data: Omit<NewAdminLoginAttempt, "id" | "attemptedAt">): Promise<void> {
    const id = generateId();
    await this.db.insert(adminLoginAttempts).values({
      ...data,
      id,
      attemptedAt: new Date(),
    });
  }

  /**
   * 获取最近失败次数 (根据用户名)
   */
  async getRecentFailureCount(
    username: string,
    windowMs: number = 15 * 60 * 1000, // 15 分钟
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminLoginAttempts)
      .where(
        and(
          eq(adminLoginAttempts.username, username),
          eq(adminLoginAttempts.success, false),
          gt(adminLoginAttempts.attemptedAt, since),
        ),
      );
    return result[0]?.count ?? 0;
  }

  /**
   * 获取 IP 级别的失败次数
   */
  async getRecentFailureCountByIp(
    ipAddress: string,
    windowMs: number = 60 * 60 * 1000, // 1 小时
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminLoginAttempts)
      .where(
        and(
          eq(adminLoginAttempts.ipAddress, ipAddress),
          eq(adminLoginAttempts.success, false),
          gt(adminLoginAttempts.attemptedAt, since),
        ),
      );
    return result[0]?.count ?? 0;
  }

  /**
   * 清理过期记录
   */
  async cleanupOld(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(adminLoginAttempts)
      .where(sql`${adminLoginAttempts.attemptedAt} < ${cutoff}`);
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}

// 单例工厂函数
let adminRepoInstance: AdminRepository | null = null;
let adminSessionRepoInstance: AdminSessionRepository | null = null;
let adminAuditLogRepoInstance: AdminAuditLogRepository | null = null;
let adminLoginAttemptRepoInstance: AdminLoginAttemptRepository | null = null;

export function getAdminRepository(db?: Database): AdminRepository {
  if (!adminRepoInstance || db) {
    adminRepoInstance = new AdminRepository(db);
  }
  return adminRepoInstance;
}

export function getAdminSessionRepository(db?: Database): AdminSessionRepository {
  if (!adminSessionRepoInstance || db) {
    adminSessionRepoInstance = new AdminSessionRepository(db);
  }
  return adminSessionRepoInstance;
}

export function getAdminAuditLogRepository(db?: Database): AdminAuditLogRepository {
  if (!adminAuditLogRepoInstance || db) {
    adminAuditLogRepoInstance = new AdminAuditLogRepository(db);
  }
  return adminAuditLogRepoInstance;
}

export function getAdminLoginAttemptRepository(db?: Database): AdminLoginAttemptRepository {
  if (!adminLoginAttemptRepoInstance || db) {
    adminLoginAttemptRepoInstance = new AdminLoginAttemptRepository(db);
  }
  return adminLoginAttemptRepoInstance;
}

/**
 * 记录管理员审计日志的便捷函数
 */
export async function adminAudit(data: {
  adminId?: string | null;
  adminUsername: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
}): Promise<void> {
  const repo = getAdminAuditLogRepository();
  await repo.create({
    adminId: data.adminId,
    adminUsername: data.adminUsername,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    targetName: data.targetName,
    details: data.details,
    beforeSnapshot: data.beforeSnapshot,
    afterSnapshot: data.afterSnapshot,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    riskLevel: data.riskLevel || "low",
  });
}
