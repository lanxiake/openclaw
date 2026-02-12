/**
 * 用量配额数据访问层
 *
 * UsageQuotaRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 *
 * incrementUsage 使用 SQL 原子操作确保并发安全。
 */

import { eq, and, sql, lte, gte } from "drizzle-orm";

import { type Database } from "../connection.js";
import { usageQuotas, type UsageQuota, type NewUsageQuota } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== UsageQuotaRepository ====================

/**
 * 用量配额仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class UsageQuotaRepository extends TenantScopedRepository {
  /**
   * 创建配额记录
   *
   * userId 由基类自动注入
   */
  async create(
    data: Omit<NewUsageQuota, "id" | "userId" | "createdAt" | "updatedAt">,
  ): Promise<UsageQuota> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[UsageQuotaRepository] 创建配额, id=${id}, userId=${this.tenantId}, type=${data.quotaType}`,
    );

    const [quota] = await this.db
      .insert(usageQuotas)
      .values({
        id,
        userId: this.tenantId,
        quotaType: data.quotaType,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        limitValue: data.limitValue,
        usedValue: data.usedValue ?? 0,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[UsageQuotaRepository] 配额创建成功, id=${id}`);
    return quota;
  }

  /**
   * 根据 ID 查找配额（自动过滤 userId）
   */
  async findById(id: string): Promise<UsageQuota | null> {
    logger.debug(`[UsageQuotaRepository] 查找配额, id=${id}, userId=${this.tenantId}`);

    const [quota] = await this.db
      .select()
      .from(usageQuotas)
      .where(and(eq(usageQuotas.id, id), eq(usageQuotas.userId, this.tenantId)));

    return quota ?? null;
  }

  /**
   * 查找当前有效期的配额
   *
   * @param quotaType - 配额类型
   */
  async findCurrent(
    quotaType: "tokens" | "storage" | "devices" | "skills" | "api_calls",
  ): Promise<UsageQuota | null> {
    const now = new Date();

    logger.debug(`[UsageQuotaRepository] 查找当前配额, userId=${this.tenantId}, type=${quotaType}`);

    const [quota] = await this.db
      .select()
      .from(usageQuotas)
      .where(
        and(
          eq(usageQuotas.userId, this.tenantId),
          eq(usageQuotas.quotaType, quotaType),
          lte(usageQuotas.periodStart, now),
          gte(usageQuotas.periodEnd, now),
        ),
      );

    return quota ?? null;
  }

  /**
   * 查询当前用户的所有配额
   */
  async findAll(): Promise<UsageQuota[]> {
    logger.debug(`[UsageQuotaRepository] 查询所有配额, userId=${this.tenantId}`);

    return await this.db.select().from(usageQuotas).where(eq(usageQuotas.userId, this.tenantId));
  }

  /**
   * 原子递增使用量
   *
   * 使用 SQL SET usedValue = usedValue + amount 确保并发安全
   */
  async incrementUsage(
    quotaType: "tokens" | "storage" | "devices" | "skills" | "api_calls",
    amount: number,
  ): Promise<UsageQuota | null> {
    const now = new Date();

    logger.debug(
      `[UsageQuotaRepository] 递增使用量, userId=${this.tenantId}, type=${quotaType}, amount=${amount}`,
    );

    const [quota] = await this.db
      .update(usageQuotas)
      .set({
        usedValue: sql`${usageQuotas.usedValue} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usageQuotas.userId, this.tenantId),
          eq(usageQuotas.quotaType, quotaType),
          lte(usageQuotas.periodStart, now),
          gte(usageQuotas.periodEnd, now),
        ),
      )
      .returning();

    return quota ?? null;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 UsageQuotaRepository 实例
 */
export function getUsageQuotaRepository(db: Database, userId: string): UsageQuotaRepository {
  return new UsageQuotaRepository(db, userId);
}
