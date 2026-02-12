/**
 * 多租户数据隔离基类
 *
 * TenantScopedRepository 是所有需要租户隔离的 Repository 的基类。
 * 它强制要求在构造时传入 userId，作为数据隔离的租户标识。
 * 子类继承此基类后，在所有查询中应使用 tenantId 进行数据过滤。
 */

import { type Database } from "../connection.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 多租户 Repository 基类
 *
 * 提供 tenantId（即 userId）作为数据隔离标识，
 * 确保所有数据操作都限定在当前用户范围内。
 */
export class TenantScopedRepository {
  /**
   * 构造 TenantScopedRepository
   *
   * @param db - Drizzle ORM 数据库实例
   * @param userId - 当前用户 ID，作为租户隔离标识
   * @throws 当 userId 为空、undefined 或 null 时抛出异常
   */
  constructor(
    protected readonly db: Database,
    protected readonly userId: string,
  ) {
    if (!userId) {
      logger.error("[TenantScopedRepository] 构造失败: userId 为空");
      throw new Error("[TenantScopedRepository] userId is required");
    }

    logger.debug(`[TenantScopedRepository] 构造成功, tenantId=${userId}`);
  }

  /**
   * 获取当前租户标识（即 userId）
   *
   * @returns 当前用户的 ID
   */
  get tenantId(): string {
    return this.userId;
  }
}

/**
 * 创建 TenantScopedRepository 实例的工厂函数
 *
 * @param db - Drizzle ORM 数据库实例
 * @param userId - 当前用户 ID
 * @returns TenantScopedRepository 实例
 */
export function getTenantScopedRepository(db: Database, userId: string): TenantScopedRepository {
  logger.debug(`[getTenantScopedRepository] 创建实例, userId=${userId}`);
  return new TenantScopedRepository(db, userId);
}
