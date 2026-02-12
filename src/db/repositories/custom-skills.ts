/**
 * 用户自建技能数据访问层
 *
 * CustomSkillRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  userCustomSkills,
  type UserCustomSkill,
  type NewUserCustomSkill,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== CustomSkillRepository ====================

/**
 * 用户自建技能仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class CustomSkillRepository extends TenantScopedRepository {
  /**
   * 创建技能
   *
   * userId 由基类自动注入，调用方无需传入
   */
  async create(
    data: Omit<NewUserCustomSkill, "id" | "userId" | "createdAt" | "updatedAt">,
  ): Promise<UserCustomSkill> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[CustomSkillRepository] 创建技能, id=${id}, userId=${this.tenantId}, name=${data.name}`,
    );

    const [skill] = await this.db
      .insert(userCustomSkills)
      .values({
        id,
        userId: this.tenantId,
        name: data.name,
        description: data.description,
        version: data.version ?? "1.0.0",
        code: data.code,
        packageFileId: data.packageFileId,
        manifest: data.manifest,
        status: data.status ?? "draft",
        testResults: data.testResults,
        syncedDevices: data.syncedDevices,
        isPublished: data.isPublished ?? false,
        storeItemId: data.storeItemId,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[CustomSkillRepository] 技能创建成功, id=${id}`);
    return skill;
  }

  /**
   * 根据 ID 查找技能（自动过滤 userId）
   */
  async findById(id: string): Promise<UserCustomSkill | null> {
    logger.debug(`[CustomSkillRepository] 查找技能, id=${id}, userId=${this.tenantId}`);

    const [skill] = await this.db
      .select()
      .from(userCustomSkills)
      .where(and(eq(userCustomSkills.id, id), eq(userCustomSkills.userId, this.tenantId)));

    return skill ?? null;
  }

  /**
   * 查询当前用户的技能列表
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: "draft" | "testing" | "ready" | "published" | "disabled";
  }): Promise<{ skills: UserCustomSkill[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[CustomSkillRepository] 查询技能列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(userCustomSkills.userId, this.tenantId)];

    if (options?.status) {
      conditions.push(eq(userCustomSkills.status, options.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userCustomSkills)
      .where(whereClause);

    const result = await this.db
      .select()
      .from(userCustomSkills)
      .where(whereClause)
      .orderBy(desc(userCustomSkills.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      skills: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 更新技能
   */
  async update(
    id: string,
    data: Partial<
      Pick<
        UserCustomSkill,
        | "name"
        | "description"
        | "version"
        | "code"
        | "manifest"
        | "status"
        | "testResults"
        | "syncedDevices"
        | "metadata"
      >
    >,
  ): Promise<UserCustomSkill | null> {
    logger.debug(`[CustomSkillRepository] 更新技能, id=${id}, userId=${this.tenantId}`);

    const [skill] = await this.db
      .update(userCustomSkills)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(userCustomSkills.id, id), eq(userCustomSkills.userId, this.tenantId)))
      .returning();

    return skill ?? null;
  }

  /**
   * 删除技能（硬删除）
   */
  async delete(id: string): Promise<void> {
    logger.debug(`[CustomSkillRepository] 删除技能, id=${id}, userId=${this.tenantId}`);

    await this.db
      .delete(userCustomSkills)
      .where(and(eq(userCustomSkills.id, id), eq(userCustomSkills.userId, this.tenantId)));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 CustomSkillRepository 实例
 */
export function getCustomSkillRepository(db: Database, userId: string): CustomSkillRepository {
  return new CustomSkillRepository(db, userId);
}
