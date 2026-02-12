/**
 * 用户助手配置数据访问层
 *
 * AssistantConfigRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  userAssistantConfigs,
  type UserAssistantConfig,
  type NewUserAssistantConfig,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== AssistantConfigRepository ====================

/**
 * 用户助手配置仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class AssistantConfigRepository extends TenantScopedRepository {
  /**
   * 创建助手配置
   *
   * userId 由基类自动注入
   */
  async create(
    data: Omit<NewUserAssistantConfig, "id" | "userId" | "createdAt" | "updatedAt">,
  ): Promise<UserAssistantConfig> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[AssistantConfigRepository] 创建配置, id=${id}, userId=${this.tenantId}, name=${data.name}`,
    );

    const [config] = await this.db
      .insert(userAssistantConfigs)
      .values({
        id,
        userId: this.tenantId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        personality: data.personality,
        preferences: data.preferences,
        modelConfig: data.modelConfig,
        devicePermissions: data.devicePermissions,
        systemPrompt: data.systemPrompt,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[AssistantConfigRepository] 配置创建成功, id=${id}`);
    return config;
  }

  /**
   * 根据 ID 查找配置（自动过滤 userId）
   */
  async findById(id: string): Promise<UserAssistantConfig | null> {
    logger.debug(`[AssistantConfigRepository] 查找配置, id=${id}, userId=${this.tenantId}`);

    const [config] = await this.db
      .select()
      .from(userAssistantConfigs)
      .where(and(eq(userAssistantConfigs.id, id), eq(userAssistantConfigs.userId, this.tenantId)));

    return config ?? null;
  }

  /**
   * 查找默认配置
   */
  async findDefault(): Promise<UserAssistantConfig | null> {
    logger.debug(`[AssistantConfigRepository] 查找默认配置, userId=${this.tenantId}`);

    const [config] = await this.db
      .select()
      .from(userAssistantConfigs)
      .where(
        and(
          eq(userAssistantConfigs.userId, this.tenantId),
          eq(userAssistantConfigs.isDefault, true),
        ),
      );

    return config ?? null;
  }

  /**
   * 查询当前用户的配置列表
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ configs: UserAssistantConfig[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    logger.debug(`[AssistantConfigRepository] 查询配置列表, userId=${this.tenantId}`);

    const whereClause = eq(userAssistantConfigs.userId, this.tenantId);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAssistantConfigs)
      .where(whereClause);

    const result = await this.db
      .select()
      .from(userAssistantConfigs)
      .where(whereClause)
      .orderBy(desc(userAssistantConfigs.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      configs: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 更新配置
   */
  async update(
    id: string,
    data: Partial<
      Pick<
        UserAssistantConfig,
        | "name"
        | "isDefault"
        | "personality"
        | "preferences"
        | "modelConfig"
        | "devicePermissions"
        | "systemPrompt"
        | "metadata"
      >
    >,
  ): Promise<UserAssistantConfig | null> {
    logger.debug(`[AssistantConfigRepository] 更新配置, id=${id}, userId=${this.tenantId}`);

    const [config] = await this.db
      .update(userAssistantConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(userAssistantConfigs.id, id), eq(userAssistantConfigs.userId, this.tenantId)))
      .returning();

    return config ?? null;
  }

  /**
   * 删除配置
   */
  async delete(id: string): Promise<void> {
    logger.debug(`[AssistantConfigRepository] 删除配置, id=${id}, userId=${this.tenantId}`);

    await this.db
      .delete(userAssistantConfigs)
      .where(and(eq(userAssistantConfigs.id, id), eq(userAssistantConfigs.userId, this.tenantId)));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 AssistantConfigRepository 实例
 */
export function getAssistantConfigRepository(
  db: Database,
  userId: string,
): AssistantConfigRepository {
  return new AssistantConfigRepository(db, userId);
}
