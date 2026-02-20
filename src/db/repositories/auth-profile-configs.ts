/**
 * Auth Profile 配置 Repository
 *
 * 提供 auth_profiles 和 auth_profile_order 表的数据访问方法。
 * 支持系统级/租户级的 CRUD 操作及合并查询。
 */

import { eq, and } from "drizzle-orm";

import { getLogger } from "../../logging/logger.js";
import type { Database } from "../connection.js";
import {
  authProfiles,
  authProfileOrder,
  type AuthProfile,
  type NewAuthProfile,
  type AuthProfileOrderRecord,
  type AuthProfileUsageStats,
} from "../schema/auth-profiles.js";
import { generateId } from "../utils/id.js";

const logger = getLogger();

// ---------------------------------------------------------------------------
// AuthProfileRepository
// ---------------------------------------------------------------------------

/**
 * Auth Profile 数据访问层
 *
 * 管理 auth_profiles 表的 CRUD，支持系统/租户配置的合并查询。
 */
export class AuthProfileRepository {
  constructor(private readonly db: Database) {}

  /**
   * 创建新的 auth profile
   */
  async create(data: NewAuthProfile): Promise<AuthProfile> {
    logger.debug("[AuthProfileRepo] 创建 auth profile", {
      id: data.id,
      profileId: data.profileId,
      configType: data.configType,
    });

    const [created] = await this.db.insert(authProfiles).values(data).returning();
    return created!;
  }

  /**
   * 获取系统级启用的 profiles（按 priority 排序）
   */
  async listSystemProfiles(): Promise<AuthProfile[]> {
    logger.debug("[AuthProfileRepo] 查询系统级 profiles");

    return this.db
      .select()
      .from(authProfiles)
      .where(and(eq(authProfiles.configType, "system"), eq(authProfiles.enabled, true)))
      .orderBy(authProfiles.priority);
  }

  /**
   * 获取租户级启用的 profiles（按 priority 排序）
   */
  async listTenantProfiles(userId: string): Promise<AuthProfile[]> {
    logger.debug("[AuthProfileRepo] 查询租户级 profiles", { userId });

    return this.db
      .select()
      .from(authProfiles)
      .where(
        and(
          eq(authProfiles.configType, "tenant"),
          eq(authProfiles.userId, userId),
          eq(authProfiles.enabled, true),
        ),
      )
      .orderBy(authProfiles.priority);
  }

  /**
   * 获取有效的 profiles 列表（租户覆盖系统配置）
   *
   * 策略：相同 profileId 下，租户配置优先于系统配置。
   * 按 priority 排序。
   */
  async listEffectiveProfiles(userId?: string): Promise<AuthProfile[]> {
    logger.debug("[AuthProfileRepo] 查询有效 profiles", { userId });

    const profiles: AuthProfile[] = [];

    // 1. 获取租户配置
    if (userId) {
      const tenantProfiles = await this.listTenantProfiles(userId);
      profiles.push(...tenantProfiles);
    }

    // 2. 获取系统配置
    const systemProfiles = await this.listSystemProfiles();
    profiles.push(...systemProfiles);

    // 3. 按 profileId 去重（租户优先，因为租户先加入列表）
    const uniqueProfiles = new Map<string, AuthProfile>();
    for (const profile of profiles) {
      if (!uniqueProfiles.has(profile.profileId)) {
        uniqueProfiles.set(profile.profileId, profile);
      }
    }

    return Array.from(uniqueProfiles.values()).sort(
      (a, b) => (a.priority || 100) - (b.priority || 100),
    );
  }

  /**
   * 根据 profileId 获取配置（租户优先）
   */
  async getByProfileId(profileId: string, userId?: string): Promise<AuthProfile | null> {
    logger.debug("[AuthProfileRepo] 根据 profileId 查询", { profileId, userId });

    // 优先查找租户配置
    if (userId) {
      const [tenantProfile] = await this.db
        .select()
        .from(authProfiles)
        .where(
          and(
            eq(authProfiles.configType, "tenant"),
            eq(authProfiles.userId, userId),
            eq(authProfiles.profileId, profileId),
          ),
        )
        .limit(1);

      if (tenantProfile) {
        return tenantProfile;
      }
    }

    // 查找系统配置
    const [systemProfile] = await this.db
      .select()
      .from(authProfiles)
      .where(and(eq(authProfiles.configType, "system"), eq(authProfiles.profileId, profileId)))
      .limit(1);

    return systemProfile || null;
  }

  /**
   * 根据 ID 获取配置
   */
  async getById(id: string): Promise<AuthProfile | null> {
    const [profile] = await this.db
      .select()
      .from(authProfiles)
      .where(eq(authProfiles.id, id))
      .limit(1);

    return profile || null;
  }

  /**
   * 更新 profile 字段
   */
  async update(
    id: string,
    data: Partial<Omit<NewAuthProfile, "id" | "configType" | "profileId">>,
  ): Promise<AuthProfile | null> {
    logger.debug("[AuthProfileRepo] 更新 profile", { id });

    const [updated] = await this.db
      .update(authProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(authProfiles.id, id))
      .returning();

    return updated || null;
  }

  /**
   * 更新运行时使用统计
   */
  async updateUsageStats(id: string, stats: AuthProfileUsageStats): Promise<AuthProfile | null> {
    logger.debug("[AuthProfileRepo] 更新使用统计", { id });

    const [updated] = await this.db
      .update(authProfiles)
      .set({
        usageStats: stats,
        updatedAt: new Date(),
      })
      .where(eq(authProfiles.id, id))
      .returning();

    return updated || null;
  }

  /**
   * 删除 profile
   */
  async delete(id: string): Promise<boolean> {
    logger.debug("[AuthProfileRepo] 删除 profile", { id });

    const result = await this.db.delete(authProfiles).where(eq(authProfiles.id, id)).returning();

    return result.length > 0;
  }

  /**
   * 创建或更新系统级 profile（upsert by profileId）
   */
  async upsertSystemProfile(
    profileId: string,
    config: {
      provider: string;
      credentialMode: string;
      apiKey?: string;
      token?: string;
      tokenExpires?: Date;
      oauthCredentials?: unknown;
      email?: string;
      enabled?: boolean;
      priority?: number;
      modelBindings?: unknown;
      cooldownConfig?: unknown;
      extraConfig?: unknown;
    },
    updatedBy: string,
  ): Promise<AuthProfile> {
    logger.debug("[AuthProfileRepo] upsert 系统 profile", { profileId });

    const existing = await this.getByProfileId(profileId);

    if (existing && existing.configType === "system") {
      // 更新
      const [updated] = await this.db
        .update(authProfiles)
        .set({
          provider: config.provider,
          credentialMode: config.credentialMode,
          apiKey: config.apiKey,
          token: config.token,
          tokenExpires: config.tokenExpires,
          oauthCredentials: config.oauthCredentials,
          email: config.email,
          enabled: config.enabled,
          priority: config.priority,
          modelBindings: config.modelBindings,
          cooldownConfig: config.cooldownConfig,
          extraConfig: config.extraConfig,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(authProfiles.id, existing.id))
        .returning();

      return updated!;
    }

    // 创建
    const [created] = await this.db
      .insert(authProfiles)
      .values({
        id: generateId(),
        configType: "system",
        profileId,
        provider: config.provider,
        credentialMode: config.credentialMode,
        apiKey: config.apiKey,
        token: config.token,
        tokenExpires: config.tokenExpires,
        oauthCredentials: config.oauthCredentials,
        email: config.email,
        enabled: config.enabled,
        priority: config.priority,
        modelBindings: config.modelBindings,
        cooldownConfig: config.cooldownConfig,
        extraConfig: config.extraConfig,
        createdBy: updatedBy,
        updatedBy,
      })
      .returning();

    return created!;
  }

  /**
   * 创建或更新租户级 profile（upsert by profileId + userId）
   */
  async upsertTenantProfile(
    userId: string,
    profileId: string,
    config: {
      provider: string;
      credentialMode: string;
      apiKey?: string;
      token?: string;
      tokenExpires?: Date;
      oauthCredentials?: unknown;
      email?: string;
      enabled?: boolean;
      priority?: number;
      modelBindings?: unknown;
      cooldownConfig?: unknown;
      extraConfig?: unknown;
    },
    updatedBy: string,
  ): Promise<AuthProfile> {
    logger.debug("[AuthProfileRepo] upsert 租户 profile", { profileId, userId });

    const existing = await this.getByProfileId(profileId, userId);

    if (existing && existing.configType === "tenant" && existing.userId === userId) {
      // 更新
      const [updated] = await this.db
        .update(authProfiles)
        .set({
          provider: config.provider,
          credentialMode: config.credentialMode,
          apiKey: config.apiKey,
          token: config.token,
          tokenExpires: config.tokenExpires,
          oauthCredentials: config.oauthCredentials,
          email: config.email,
          enabled: config.enabled,
          priority: config.priority,
          modelBindings: config.modelBindings,
          cooldownConfig: config.cooldownConfig,
          extraConfig: config.extraConfig,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(authProfiles.id, existing.id))
        .returning();

      return updated!;
    }

    // 创建
    const [created] = await this.db
      .insert(authProfiles)
      .values({
        id: generateId(),
        configType: "tenant",
        userId,
        profileId,
        provider: config.provider,
        credentialMode: config.credentialMode,
        apiKey: config.apiKey,
        token: config.token,
        tokenExpires: config.tokenExpires,
        oauthCredentials: config.oauthCredentials,
        email: config.email,
        enabled: config.enabled,
        priority: config.priority,
        modelBindings: config.modelBindings,
        cooldownConfig: config.cooldownConfig,
        extraConfig: config.extraConfig,
        createdBy: updatedBy,
        updatedBy,
      })
      .returning();

    return created!;
  }
}

// ---------------------------------------------------------------------------
// AuthProfileOrderRepository
// ---------------------------------------------------------------------------

/**
 * Auth Profile Order 数据访问层
 *
 * 管理 auth_profile_order 表，控制每个 agent 使用 profile 的优先顺序。
 */
export class AuthProfileOrderRepository {
  constructor(private readonly db: Database) {}

  /**
   * 获取系统级排序列表
   */
  async listSystemOrders(): Promise<AuthProfileOrderRecord[]> {
    return this.db.select().from(authProfileOrder).where(eq(authProfileOrder.configType, "system"));
  }

  /**
   * 获取租户级排序列表
   */
  async listTenantOrders(userId: string): Promise<AuthProfileOrderRecord[]> {
    return this.db
      .select()
      .from(authProfileOrder)
      .where(and(eq(authProfileOrder.configType, "tenant"), eq(authProfileOrder.userId, userId)));
  }

  /**
   * 获取有效的排序列表（租户覆盖系统）
   */
  async listEffectiveOrders(userId?: string): Promise<AuthProfileOrderRecord[]> {
    logger.debug("[AuthProfileOrderRepo] 查询有效排序", { userId });

    const orders: AuthProfileOrderRecord[] = [];

    if (userId) {
      const tenantOrders = await this.listTenantOrders(userId);
      orders.push(...tenantOrders);
    }

    const systemOrders = await this.listSystemOrders();
    orders.push(...systemOrders);

    // 按 agentKey 去重（租户优先）
    const uniqueOrders = new Map<string, AuthProfileOrderRecord>();
    for (const order of orders) {
      if (!uniqueOrders.has(order.agentKey)) {
        uniqueOrders.set(order.agentKey, order);
      }
    }

    return Array.from(uniqueOrders.values());
  }

  /**
   * 获取指定 agent 的有效排序（租户优先）
   */
  async getEffectiveOrder(
    agentKey: string,
    userId?: string,
  ): Promise<AuthProfileOrderRecord | null> {
    logger.debug("[AuthProfileOrderRepo] 查询有效排序", { agentKey, userId });

    // 优先查找租户配置
    if (userId) {
      const [tenantOrder] = await this.db
        .select()
        .from(authProfileOrder)
        .where(
          and(
            eq(authProfileOrder.configType, "tenant"),
            eq(authProfileOrder.userId, userId),
            eq(authProfileOrder.agentKey, agentKey),
          ),
        )
        .limit(1);

      if (tenantOrder) {
        return tenantOrder;
      }
    }

    // 查找系统配置
    const [systemOrder] = await this.db
      .select()
      .from(authProfileOrder)
      .where(
        and(eq(authProfileOrder.configType, "system"), eq(authProfileOrder.agentKey, agentKey)),
      )
      .limit(1);

    return systemOrder || null;
  }

  /**
   * 创建或更新系统级排序
   */
  async upsertSystemOrder(
    agentKey: string,
    profileIds: string[],
    updatedBy: string,
  ): Promise<AuthProfileOrderRecord> {
    logger.debug("[AuthProfileOrderRepo] upsert 系统排序", { agentKey });

    const [existing] = await this.db
      .select()
      .from(authProfileOrder)
      .where(
        and(eq(authProfileOrder.configType, "system"), eq(authProfileOrder.agentKey, agentKey)),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(authProfileOrder)
        .set({
          profileIds,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(authProfileOrder.id, existing.id))
        .returning();

      return updated!;
    }

    const [created] = await this.db
      .insert(authProfileOrder)
      .values({
        id: generateId(),
        configType: "system",
        agentKey,
        profileIds,
        createdBy: updatedBy,
        updatedBy,
      })
      .returning();

    return created!;
  }

  /**
   * 创建或更新租户级排序
   */
  async upsertTenantOrder(
    userId: string,
    agentKey: string,
    profileIds: string[],
    updatedBy: string,
  ): Promise<AuthProfileOrderRecord> {
    logger.debug("[AuthProfileOrderRepo] upsert 租户排序", { agentKey, userId });

    const [existing] = await this.db
      .select()
      .from(authProfileOrder)
      .where(
        and(
          eq(authProfileOrder.configType, "tenant"),
          eq(authProfileOrder.userId, userId),
          eq(authProfileOrder.agentKey, agentKey),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(authProfileOrder)
        .set({
          profileIds,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(authProfileOrder.id, existing.id))
        .returning();

      return updated!;
    }

    const [created] = await this.db
      .insert(authProfileOrder)
      .values({
        id: generateId(),
        configType: "tenant",
        userId,
        agentKey,
        profileIds,
        createdBy: updatedBy,
        updatedBy,
      })
      .returning();

    return created!;
  }

  /**
   * 删除排序记录
   */
  async delete(id: string): Promise<boolean> {
    logger.debug("[AuthProfileOrderRepo] 删除排序", { id });

    const result = await this.db
      .delete(authProfileOrder)
      .where(eq(authProfileOrder.id, id))
      .returning();

    return result.length > 0;
  }
}
