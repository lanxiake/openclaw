/**
 * 用户画像记忆数据访问层 (Phase 1: L3 Archival Memory)
 *
 * 提供 4 个 Repository 类：
 * - UserProfileRepository: 用户画像核心数据
 * - UserFactRepository: 用户事实管理
 * - UserPreferencesV2Repository: 用户偏好设置
 * - BehaviorPatternRepository: 行为模式管理
 *
 * 所有 Repository 继承 TenantScopedRepository，自动实现多租户数据隔离。
 */

import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  userProfiles,
  userFacts,
  userPreferencesV2,
  behaviorPatterns,
  type UserProfile,
  type NewUserProfile,
  type UserFactRecord,
  type NewUserFactRecord,
  type UserPreferencesV2Record,
  type NewUserPreferencesV2Record,
  type BehaviorPatternRecord,
  type NewBehaviorPatternRecord,
  type FactCategoryEnum,
  type BehaviorPatternTypeEnum,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== UserProfileRepository ====================

/**
 * 用户画像核心数据仓库
 *
 * 管理用户的核心身份信息，每个用户只有一条记录
 */
export class UserProfileRepository extends TenantScopedRepository {
  /**
   * 获取用户画像（不存在则返回 null）
   */
  async get(): Promise<UserProfile | null> {
    logger.debug(`[UserProfileRepository] 获取画像, userId=${this.tenantId}`);

    const [profile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, this.tenantId));

    return profile ?? null;
  }

  /**
   * 获取或创建用户画像
   */
  async getOrCreate(): Promise<UserProfile> {
    const existing = await this.get();
    if (existing) {
      return existing;
    }

    logger.debug(`[UserProfileRepository] 创建画像, userId=${this.tenantId}`);

    const id = generateId();
    const now = new Date();

    const [profile] = await this.db
      .insert(userProfiles)
      .values({
        id,
        userId: this.tenantId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return profile;
  }

  /**
   * 更新用户画像
   */
  async update(
    data: Partial<
      Pick<
        UserProfile,
        | "displayName"
        | "nickname"
        | "avatarUrl"
        | "bio"
        | "language"
        | "timezone"
        | "workRole"
        | "metadata"
      >
    >,
  ): Promise<UserProfile | null> {
    logger.debug(`[UserProfileRepository] 更新画像, userId=${this.tenantId}`);

    const [profile] = await this.db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, this.tenantId))
      .returning();

    return profile ?? null;
  }

  /**
   * 删除用户画像
   */
  async delete(): Promise<void> {
    logger.debug(`[UserProfileRepository] 删除画像, userId=${this.tenantId}`);

    await this.db.delete(userProfiles).where(eq(userProfiles.userId, this.tenantId));
  }
}

// ==================== UserFactRepository ====================

/**
 * 用户事实仓库
 *
 * 管理用户的分类知识，支持置信度和敏感度标记
 */
export class UserFactRepository extends TenantScopedRepository {
  /**
   * 创建事实
   */
  async create(
    data: Omit<NewUserFactRecord, "id" | "userId" | "createdAt" | "updatedAt" | "isActive">,
  ): Promise<UserFactRecord> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[UserFactRepository] 创建事实, id=${id}, userId=${this.tenantId}, category=${data.category}`,
    );

    const [fact] = await this.db
      .insert(userFacts)
      .values({
        id,
        userId: this.tenantId,
        ...data,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return fact;
  }

  /**
   * 根据 ID 查找事实
   */
  async findById(id: string): Promise<UserFactRecord | null> {
    logger.debug(`[UserFactRepository] 查找事实, id=${id}, userId=${this.tenantId}`);

    const [fact] = await this.db
      .select()
      .from(userFacts)
      .where(and(eq(userFacts.id, id), eq(userFacts.userId, this.tenantId)));

    return fact ?? null;
  }

  /**
   * 查询事实列表
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    category?: FactCategoryEnum;
    activeOnly?: boolean;
  }): Promise<{ facts: UserFactRecord[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[UserFactRepository] 查询事实列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(userFacts.userId, this.tenantId)];

    if (options?.category) {
      conditions.push(eq(userFacts.category, options.category));
    }

    if (options?.activeOnly !== false) {
      conditions.push(eq(userFacts.isActive, true));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFacts)
      .where(whereClause);

    const facts = await this.db
      .select()
      .from(userFacts)
      .where(whereClause)
      .orderBy(desc(userFacts.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      facts,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 搜索事实（按 key 或 value 模糊匹配）
   */
  async search(query: string): Promise<UserFactRecord[]> {
    logger.debug(`[UserFactRepository] 搜索事实, query="${query}", userId=${this.tenantId}`);

    const searchPattern = `%${query}%`;

    const facts = await this.db
      .select()
      .from(userFacts)
      .where(
        and(
          eq(userFacts.userId, this.tenantId),
          eq(userFacts.isActive, true),
          or(ilike(userFacts.key, searchPattern), ilike(userFacts.value, searchPattern)),
        ),
      )
      .orderBy(desc(userFacts.confidence))
      .limit(20);

    return facts;
  }

  /**
   * 更新事实
   */
  async update(
    id: string,
    data: Partial<
      Pick<UserFactRecord, "value" | "confidence" | "sensitive" | "validUntil" | "metadata">
    >,
  ): Promise<UserFactRecord | null> {
    logger.debug(`[UserFactRepository] 更新事实, id=${id}, userId=${this.tenantId}`);

    const [fact] = await this.db
      .update(userFacts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(userFacts.id, id), eq(userFacts.userId, this.tenantId)))
      .returning();

    return fact ?? null;
  }

  /**
   * 停用事实（软删除）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug(`[UserFactRepository] 停用事实, id=${id}, userId=${this.tenantId}`);

    await this.db
      .update(userFacts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(userFacts.id, id), eq(userFacts.userId, this.tenantId)));
  }

  /**
   * 硬删除事实
   */
  async delete(id: string): Promise<void> {
    logger.debug(`[UserFactRepository] 删除事实, id=${id}, userId=${this.tenantId}`);

    await this.db
      .delete(userFacts)
      .where(and(eq(userFacts.id, id), eq(userFacts.userId, this.tenantId)));
  }
}

// ==================== UserPreferencesV2Repository ====================

/**
 * 用户偏好设置仓库 (v2)
 *
 * 管理用户的交互偏好，每个用户只有一条记录
 */
export class UserPreferencesV2Repository extends TenantScopedRepository {
  /**
   * 获取用户偏好（不存在则返回 null）
   */
  async get(): Promise<UserPreferencesV2Record | null> {
    logger.debug(`[UserPreferencesV2Repository] 获取偏好, userId=${this.tenantId}`);

    const [prefs] = await this.db
      .select()
      .from(userPreferencesV2)
      .where(eq(userPreferencesV2.userId, this.tenantId));

    return prefs ?? null;
  }

  /**
   * 获取或创建用户偏好
   */
  async getOrCreate(): Promise<UserPreferencesV2Record> {
    const existing = await this.get();
    if (existing) {
      return existing;
    }

    logger.debug(`[UserPreferencesV2Repository] 创建偏好, userId=${this.tenantId}`);

    const id = generateId();
    const now = new Date();

    const [prefs] = await this.db
      .insert(userPreferencesV2)
      .values({
        id,
        userId: this.tenantId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return prefs;
  }

  /**
   * 更新用户偏好
   */
  async update(
    data: Partial<
      Pick<
        UserPreferencesV2Record,
        | "language"
        | "timezone"
        | "responseStyle"
        | "confirmLevel"
        | "favoriteSkills"
        | "disabledSkills"
        | "thinkingLevel"
        | "verboseLevel"
        | "notifications"
        | "metadata"
      >
    >,
  ): Promise<UserPreferencesV2Record | null> {
    logger.debug(`[UserPreferencesV2Repository] 更新偏好, userId=${this.tenantId}`);

    const [prefs] = await this.db
      .update(userPreferencesV2)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userPreferencesV2.userId, this.tenantId))
      .returning();

    return prefs ?? null;
  }

  /**
   * 添加喜欢的技能
   */
  async addFavoriteSkill(skillId: string): Promise<UserPreferencesV2Record | null> {
    logger.debug(
      `[UserPreferencesV2Repository] 添加喜欢技能, skillId=${skillId}, userId=${this.tenantId}`,
    );

    const prefs = await this.getOrCreate();
    const currentFavorites = prefs.favoriteSkills ?? [];

    if (currentFavorites.includes(skillId)) {
      return prefs;
    }

    return this.update({
      favoriteSkills: [...currentFavorites, skillId],
    });
  }

  /**
   * 移除喜欢的技能
   */
  async removeFavoriteSkill(skillId: string): Promise<UserPreferencesV2Record | null> {
    logger.debug(
      `[UserPreferencesV2Repository] 移除喜欢技能, skillId=${skillId}, userId=${this.tenantId}`,
    );

    const prefs = await this.get();
    if (!prefs) {
      return null;
    }

    const currentFavorites = prefs.favoriteSkills ?? [];
    return this.update({
      favoriteSkills: currentFavorites.filter((id) => id !== skillId),
    });
  }

  /**
   * 禁用技能
   */
  async disableSkill(skillId: string): Promise<UserPreferencesV2Record | null> {
    logger.debug(
      `[UserPreferencesV2Repository] 禁用技能, skillId=${skillId}, userId=${this.tenantId}`,
    );

    const prefs = await this.getOrCreate();
    const currentDisabled = prefs.disabledSkills ?? [];

    if (currentDisabled.includes(skillId)) {
      return prefs;
    }

    return this.update({
      disabledSkills: [...currentDisabled, skillId],
    });
  }

  /**
   * 启用技能
   */
  async enableSkill(skillId: string): Promise<UserPreferencesV2Record | null> {
    logger.debug(
      `[UserPreferencesV2Repository] 启用技能, skillId=${skillId}, userId=${this.tenantId}`,
    );

    const prefs = await this.get();
    if (!prefs) {
      return null;
    }

    const currentDisabled = prefs.disabledSkills ?? [];
    return this.update({
      disabledSkills: currentDisabled.filter((id) => id !== skillId),
    });
  }

  /**
   * 删除用户偏好
   */
  async delete(): Promise<void> {
    logger.debug(`[UserPreferencesV2Repository] 删除偏好, userId=${this.tenantId}`);

    await this.db.delete(userPreferencesV2).where(eq(userPreferencesV2.userId, this.tenantId));
  }
}

// ==================== BehaviorPatternRepository ====================

/**
 * 行为模式仓库
 *
 * 管理从用户行为中学习到的模式
 */
export class BehaviorPatternRepository extends TenantScopedRepository {
  /**
   * 创建行为模式
   */
  async create(
    data: Omit<NewBehaviorPatternRecord, "id" | "userId" | "createdAt" | "updatedAt" | "isActive">,
  ): Promise<BehaviorPatternRecord> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[BehaviorPatternRepository] 创建模式, id=${id}, userId=${this.tenantId}, type=${data.type}`,
    );

    const [pattern] = await this.db
      .insert(behaviorPatterns)
      .values({
        id,
        userId: this.tenantId,
        ...data,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return pattern;
  }

  /**
   * 根据 ID 查找行为模式
   */
  async findById(id: string): Promise<BehaviorPatternRecord | null> {
    logger.debug(`[BehaviorPatternRepository] 查找模式, id=${id}, userId=${this.tenantId}`);

    const [pattern] = await this.db
      .select()
      .from(behaviorPatterns)
      .where(and(eq(behaviorPatterns.id, id), eq(behaviorPatterns.userId, this.tenantId)));

    return pattern ?? null;
  }

  /**
   * 查询行为模式列表
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    type?: BehaviorPatternTypeEnum;
    activeOnly?: boolean;
    confirmedOnly?: boolean;
  }): Promise<{ patterns: BehaviorPatternRecord[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[BehaviorPatternRepository] 查询模式列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(behaviorPatterns.userId, this.tenantId)];

    if (options?.type) {
      conditions.push(eq(behaviorPatterns.type, options.type));
    }

    if (options?.activeOnly !== false) {
      conditions.push(eq(behaviorPatterns.isActive, true));
    }

    if (options?.confirmedOnly) {
      conditions.push(eq(behaviorPatterns.confirmed, true));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(behaviorPatterns)
      .where(whereClause);

    const patterns = await this.db
      .select()
      .from(behaviorPatterns)
      .where(whereClause)
      .orderBy(desc(behaviorPatterns.confidence))
      .limit(limit)
      .offset(offset);

    return {
      patterns,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 按类型查找高置信度模式
   */
  async findHighConfidenceByType(
    type: BehaviorPatternTypeEnum,
    minConfidence: number = 0.7,
  ): Promise<BehaviorPatternRecord[]> {
    logger.debug(
      `[BehaviorPatternRepository] 查找高置信度模式, type=${type}, minConfidence=${minConfidence}, userId=${this.tenantId}`,
    );

    const patterns = await this.db
      .select()
      .from(behaviorPatterns)
      .where(
        and(
          eq(behaviorPatterns.userId, this.tenantId),
          eq(behaviorPatterns.type, type),
          eq(behaviorPatterns.isActive, true),
          sql`${behaviorPatterns.confidence} >= ${minConfidence}`,
        ),
      )
      .orderBy(desc(behaviorPatterns.confidence))
      .limit(10);

    return patterns;
  }

  /**
   * 更新行为模式
   */
  async update(
    id: string,
    data: Partial<
      Pick<BehaviorPatternRecord, "pattern" | "evidence" | "confidence" | "confirmed" | "metadata">
    >,
  ): Promise<BehaviorPatternRecord | null> {
    logger.debug(`[BehaviorPatternRepository] 更新模式, id=${id}, userId=${this.tenantId}`);

    const [pattern] = await this.db
      .update(behaviorPatterns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(behaviorPatterns.id, id), eq(behaviorPatterns.userId, this.tenantId)))
      .returning();

    return pattern ?? null;
  }

  /**
   * 增加证据并更新置信度
   */
  async addEvidence(id: string, newEvidence: string): Promise<BehaviorPatternRecord | null> {
    logger.debug(`[BehaviorPatternRepository] 添加证据, id=${id}, userId=${this.tenantId}`);

    const pattern = await this.findById(id);
    if (!pattern) {
      return null;
    }

    const currentEvidence = pattern.evidence ?? [];
    const updatedEvidence = [...currentEvidence, newEvidence];

    // 置信度随证据增加而提升，最高 0.95
    const newConfidence = Math.min(0.95, pattern.confidence + 0.05);

    return this.update(id, {
      evidence: updatedEvidence,
      confidence: newConfidence,
    });
  }

  /**
   * 用户确认模式
   */
  async confirm(id: string, confirmed: boolean): Promise<BehaviorPatternRecord | null> {
    logger.debug(
      `[BehaviorPatternRepository] 确认模式, id=${id}, confirmed=${confirmed}, userId=${this.tenantId}`,
    );

    const confidenceAdjustment = confirmed ? 0.2 : -0.3;
    const pattern = await this.findById(id);

    if (!pattern) {
      return null;
    }

    const newConfidence = Math.max(0, Math.min(1, pattern.confidence + confidenceAdjustment));

    return this.update(id, {
      confirmed,
      confidence: newConfidence,
    });
  }

  /**
   * 停用行为模式（软删除）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug(`[BehaviorPatternRepository] 停用模式, id=${id}, userId=${this.tenantId}`);

    await this.db
      .update(behaviorPatterns)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(behaviorPatterns.id, id), eq(behaviorPatterns.userId, this.tenantId)));
  }

  /**
   * 硬删除行为模式
   */
  async delete(id: string): Promise<void> {
    logger.debug(`[BehaviorPatternRepository] 删除模式, id=${id}, userId=${this.tenantId}`);

    await this.db
      .delete(behaviorPatterns)
      .where(and(eq(behaviorPatterns.id, id), eq(behaviorPatterns.userId, this.tenantId)));
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 UserProfileRepository 实例
 */
export function getUserProfileRepository(db: Database, userId: string): UserProfileRepository {
  logger.debug(`[getUserProfileRepository] 创建实例, userId=${userId}`);
  return new UserProfileRepository(db, userId);
}

/**
 * 创建 UserFactRepository 实例
 */
export function getUserFactRepository(db: Database, userId: string): UserFactRepository {
  logger.debug(`[getUserFactRepository] 创建实例, userId=${userId}`);
  return new UserFactRepository(db, userId);
}

/**
 * 创建 UserPreferencesV2Repository 实例
 */
export function getUserPreferencesV2Repository(
  db: Database,
  userId: string,
): UserPreferencesV2Repository {
  logger.debug(`[getUserPreferencesV2Repository] 创建实例, userId=${userId}`);
  return new UserPreferencesV2Repository(db, userId);
}

/**
 * 创建 BehaviorPatternRepository 实例
 */
export function getBehaviorPatternRepository(
  db: Database,
  userId: string,
): BehaviorPatternRepository {
  logger.debug(`[getBehaviorPatternRepository] 创建实例, userId=${userId}`);
  return new BehaviorPatternRepository(db, userId);
}
