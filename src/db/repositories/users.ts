/**
 * 用户数据访问层
 *
 * 提供用户 CRUD 操作
 */

import { eq, and, or, gt, sql } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  users,
  userDevices,
  userSessions,
  loginAttempts,
  verificationCodes,
  type User,
  type NewUser,
  type UserDevice,
  type NewUserDevice,
  type UserSession,
  type NewUserSession,
  type LoginAttempt,
  type NewLoginAttempt,
  type VerificationCode,
  type NewVerificationCode,
} from "../schema/index.js";
import { generateId, generateVerificationCode } from "../utils/id.js";
import { hashPassword, hashRefreshToken, generateRefreshToken } from "../utils/password.js";
import { getLogger } from "../../shared/logging/logger.js";

const logger = getLogger();

/**
 * 用户仓库类
 */
export class UserRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建用户
   */
  async create(data: Omit<NewUser, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const id = generateId();
    const now = new Date();

    // 如果有密码，先哈希
    let passwordHash = data.passwordHash;
    if (passwordHash && !passwordHash.startsWith("$scrypt$")) {
      passwordHash = await hashPassword(passwordHash);
    }

    const [user] = await this.db
      .insert(users)
      .values({
        ...data,
        id,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[user-repo] User created", { userId: id });
    return user;
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  /**
   * 根据手机号查找用户
   */
  async findByPhone(phone: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.phone, phone));
    return user ?? null;
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user ?? null;
  }

  /**
   * 根据微信 OpenID 查找用户
   */
  async findByWechatOpenId(openId: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.wechatOpenId, openId));
    return user ?? null;
  }

  /**
   * 根据登录标识查找用户 (手机/邮箱)
   */
  async findByIdentifier(identifier: string): Promise<User | null> {
    // 判断是邮箱还是手机号
    const isEmail = identifier.includes("@");
    if (isEmail) {
      return this.findByEmail(identifier);
    }
    return this.findByPhone(identifier);
  }

  /**
   * 更新用户
   */
  async update(id: string, data: Partial<Omit<NewUser, "id" | "createdAt">>): Promise<User | null> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    // 如果更新密码，先哈希
    if (updateData.passwordHash && !updateData.passwordHash.startsWith("$scrypt$")) {
      updateData.passwordHash = await hashPassword(updateData.passwordHash);
    }

    const [user] = await this.db.update(users).set(updateData).where(eq(users.id, id)).returning();

    if (user) {
      logger.info("[user-repo] User updated", { userId: id });
    }
    return user ?? null;
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * 停用用户
   */
  async deactivate(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    logger.info("[user-repo] User deactivated", { userId: id });
  }

  /**
   * 激活用户
   */
  async activate(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    logger.info("[user-repo] User activated", { userId: id });
  }

  /**
   * 删除用户 (软删除：停用)
   */
  async softDelete(id: string): Promise<void> {
    await this.deactivate(id);
  }

  /**
   * 硬删除用户
   */
  async hardDelete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
    logger.warn("[user-repo] User hard deleted", { userId: id });
  }

  /**
   * 删除所有用户 (仅用于测试)
   */
  async deleteAll(): Promise<void> {
    await this.db.delete(users);
    logger.warn("[user-repo] All users deleted");
  }
}

/**
 * 用户设备仓库类
 */
export class UserDeviceRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 关联设备到用户
   */
  async linkDevice(
    userId: string,
    deviceId: string,
    options?: { alias?: string; isPrimary?: boolean },
  ): Promise<UserDevice> {
    const id = generateId();

    const [device] = await this.db
      .insert(userDevices)
      .values({
        id,
        userId,
        deviceId,
        alias: options?.alias,
        isPrimary: options?.isPrimary ?? false,
        linkedAt: new Date(),
      })
      .returning();

    logger.info("[user-device-repo] Device linked", { userId, deviceId });
    return device;
  }

  /**
   * 解除设备关联
   */
  async unlinkDevice(userId: string, deviceId: string): Promise<void> {
    await this.db
      .delete(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)));
    logger.info("[user-device-repo] Device unlinked", { userId, deviceId });
  }

  /**
   * 获取用户的所有设备
   */
  async findByUserId(userId: string): Promise<UserDevice[]> {
    return this.db.select().from(userDevices).where(eq(userDevices.userId, userId));
  }

  /**
   * 根据设备 ID 查找关联
   */
  async findByDeviceId(deviceId: string): Promise<UserDevice | null> {
    const [device] = await this.db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceId, deviceId));
    return device ?? null;
  }

  /**
   * 更新设备最后活跃时间
   */
  async updateLastActive(userId: string, deviceId: string): Promise<void> {
    await this.db
      .update(userDevices)
      .set({ lastActiveAt: new Date() })
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)));
  }

  /**
   * 设置主设备
   */
  async setPrimaryDevice(userId: string, deviceId: string): Promise<void> {
    // 先将所有设备设为非主设备
    await this.db
      .update(userDevices)
      .set({ isPrimary: false })
      .where(eq(userDevices.userId, userId));

    // 设置指定设备为主设备
    await this.db
      .update(userDevices)
      .set({ isPrimary: true })
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)));

    logger.info("[user-device-repo] Primary device set", { userId, deviceId });
  }
}

/**
 * 用户会话仓库类
 */
export class UserSessionRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建会话
   */
  async create(
    userId: string,
    options: { userAgent?: string; ipAddress?: string; expiresInMs?: number },
  ): Promise<{ session: UserSession; refreshToken: string }> {
    const id = generateId();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + (options.expiresInMs ?? 7 * 24 * 60 * 60 * 1000), // 默认 7 天
    );

    const [session] = await this.db
      .insert(userSessions)
      .values({
        id,
        userId,
        refreshTokenHash,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        expiresAt,
        createdAt: new Date(),
      })
      .returning();

    logger.debug("[user-session-repo] Session created", {
      sessionId: id,
      userId,
    });
    return { session, refreshToken };
  }

  /**
   * 根据 Refresh Token 查找会话
   */
  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const hash = hashRefreshToken(refreshToken);
    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.refreshTokenHash, hash),
          eq(userSessions.revoked, false),
          gt(userSessions.expiresAt, new Date()),
        ),
      );
    return session ?? null;
  }

  /**
   * 刷新会话
   */
  async refresh(
    sessionId: string,
    newExpiresInMs?: number,
  ): Promise<{ session: UserSession; refreshToken: string } | null> {
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + (newExpiresInMs ?? 7 * 24 * 60 * 60 * 1000));

    const [session] = await this.db
      .update(userSessions)
      .set({
        refreshTokenHash: newHash,
        expiresAt: newExpiresAt,
        lastRefreshedAt: new Date(),
      })
      .where(eq(userSessions.id, sessionId))
      .returning();

    if (!session) return null;
    return { session, refreshToken: newRefreshToken };
  }

  /**
   * 根据 ID 查找会话
   */
  async findById(sessionId: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.id, sessionId));
    return session ?? null;
  }

  /**
   * 获取用户的所有有效会话
   */
  async findByUserId(userId: string): Promise<UserSession[]> {
    return this.db.select().from(userSessions).where(eq(userSessions.userId, userId));
  }

  /**
   * 撤销会话
   */
  async revoke(sessionId: string): Promise<void> {
    await this.db.update(userSessions).set({ revoked: true }).where(eq(userSessions.id, sessionId));
    logger.debug("[user-session-repo] Session revoked", { sessionId });
  }

  /**
   * 撤销用户所有会话
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(userSessions)
      .set({ revoked: true })
      .where(eq(userSessions.userId, userId));
    logger.info("[user-session-repo] All sessions revoked for user", { userId });
  }

  /**
   * 清理过期会话
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .delete(userSessions)
      .where(or(sql`${userSessions.expiresAt} < NOW()`, eq(userSessions.revoked, true)));
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info("[user-session-repo] Cleaned up expired sessions", { count });
    }
    return count;
  }

  /**
   * 删除所有会话 (仅用于测试)
   */
  async deleteAll(): Promise<void> {
    await this.db.delete(userSessions);
    logger.warn("[user-session-repo] All sessions deleted");
  }
}

/**
 * 登录尝试仓库类
 */
export class LoginAttemptRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 记录登录尝试
   */
  async record(data: Omit<NewLoginAttempt, "id" | "attemptedAt">): Promise<void> {
    const id = generateId();
    await this.db.insert(loginAttempts).values({
      ...data,
      id,
      attemptedAt: new Date(),
    });
  }

  /**
   * 获取最近失败次数 (用于限流)
   */
  async getRecentFailureCount(
    identifier: string,
    ipAddress: string,
    windowMs: number = 15 * 60 * 1000, // 15 分钟
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.success, false),
          gt(loginAttempts.attemptedAt, since),
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
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.success, false),
          gt(loginAttempts.attemptedAt, since),
        ),
      );
    return result[0]?.count ?? 0;
  }

  /**
   * 清理过期记录
   */
  async cleanupOld(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(loginAttempts)
      .where(sql`${loginAttempts.attemptedAt} < ${cutoff}`);
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }

  /**
   * 删除所有登录尝试记录 (仅用于测试)
   */
  async deleteAll(): Promise<void> {
    await this.db.delete(loginAttempts);
    logger.warn("[login-attempt-repo] All login attempts deleted");
  }
}

/**
 * 验证码仓库类
 */
export class VerificationCodeRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建验证码
   */
  async create(
    target: string,
    targetType: "phone" | "email",
    purpose: "register" | "login" | "reset_password" | "bind" | "verify",
    expiresInMs: number = 5 * 60 * 1000, // 5 分钟
  ): Promise<{ code: string; expiresAt: Date }> {
    const id = generateId();
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + expiresInMs);

    await this.db.insert(verificationCodes).values({
      id,
      target,
      targetType,
      code,
      purpose,
      expiresAt,
      createdAt: new Date(),
    });

    logger.debug("[verification-code-repo] Code created", {
      target,
      purpose,
    });
    return { code, expiresAt };
  }

  /**
   * 验证并使用验证码
   */
  async verify(
    target: string,
    code: string,
    purpose: "register" | "login" | "reset_password" | "bind" | "verify",
  ): Promise<boolean> {
    // 查找有效验证码
    const [record] = await this.db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.target, target),
          eq(verificationCodes.code, code),
          eq(verificationCodes.purpose, purpose),
          eq(verificationCodes.used, false),
          gt(verificationCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!record) {
      // 增加尝试次数
      await this.db
        .update(verificationCodes)
        .set({
          attempts: sql`${verificationCodes.attempts}::int + 1`,
        })
        .where(
          and(
            eq(verificationCodes.target, target),
            eq(verificationCodes.purpose, purpose),
            eq(verificationCodes.used, false),
          ),
        );
      return false;
    }

    // 标记为已使用
    await this.db
      .update(verificationCodes)
      .set({ used: true })
      .where(eq(verificationCodes.id, record.id));

    logger.debug("[verification-code-repo] Code verified", {
      target,
      purpose,
    });
    return true;
  }

  /**
   * 获取最近发送次数 (用于限流)
   */
  async getRecentSendCount(
    target: string,
    windowMs: number = 60 * 60 * 1000, // 1 小时
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.target, target), gt(verificationCodes.createdAt, since)));
    return result[0]?.count ?? 0;
  }

  /**
   * 清理过期验证码
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .delete(verificationCodes)
      .where(or(sql`${verificationCodes.expiresAt} < NOW()`, eq(verificationCodes.used, true)));
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }

  /**
   * 删除所有验证码 (仅用于测试)
   */
  async deleteAll(): Promise<void> {
    await this.db.delete(verificationCodes);
    logger.warn("[verification-code-repo] All verification codes deleted");
  }
}

// 导出单例工厂函数
export function getUserRepository(db?: Database): UserRepository {
  return new UserRepository(db);
}

export function getUserDeviceRepository(db?: Database): UserDeviceRepository {
  return new UserDeviceRepository(db);
}

export function getUserSessionRepository(db?: Database): UserSessionRepository {
  return new UserSessionRepository(db);
}

export function getLoginAttemptRepository(db?: Database): LoginAttemptRepository {
  return new LoginAttemptRepository(db);
}

export function getVerificationCodeRepository(db?: Database): VerificationCodeRepository {
  return new VerificationCodeRepository(db);
}
