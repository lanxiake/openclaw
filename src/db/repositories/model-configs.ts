/**
 * 模型配置 Repository
 *
 * 提供模型提供商和Agent配置的数据访问方法
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "../connection.js";
import {
  modelProviders,
  agentConfigs,
  type ModelProvider,
  type NewModelProvider,
  type AgentDefaultConfig,
  type NewAgentDefaultConfig,
} from "../schema/model-configs.js";
import { generateId } from "../utils/id.js";

/**
 * 模型提供商 Repository
 */
export class ModelProviderRepository {
  constructor(private readonly db: Database) {}

  /**
   * 获取系统配置的所有提供商
   */
  async listSystemProviders(): Promise<ModelProvider[]> {
    return this.db
      .select()
      .from(modelProviders)
      .where(and(eq(modelProviders.configType, "system"), eq(modelProviders.enabled, true)))
      .orderBy(modelProviders.priority);
  }

  /**
   * 获取租户配置的所有提供商
   */
  async listTenantProviders(userId: string): Promise<ModelProvider[]> {
    return this.db
      .select()
      .from(modelProviders)
      .where(
        and(
          eq(modelProviders.configType, "tenant"),
          eq(modelProviders.userId, userId),
          eq(modelProviders.enabled, true)
        )
      )
      .orderBy(modelProviders.priority);
  }

  /**
   * 获取有效的提供商列表 (租户配置 + 系统配置)
   */
  async listEffectiveProviders(userId?: string): Promise<ModelProvider[]> {
    const providers: ModelProvider[] = [];

    // 1. 获取租户配置
    if (userId) {
      const tenantProviders = await this.listTenantProviders(userId);
      providers.push(...tenantProviders);
    }

    // 2. 获取系统配置
    const systemProviders = await this.listSystemProviders();
    providers.push(...systemProviders);

    // 3. 去重 (租户配置优先)
    const uniqueProviders = new Map<string, ModelProvider>();
    for (const provider of providers) {
      if (!uniqueProviders.has(provider.providerKey)) {
        uniqueProviders.set(provider.providerKey, provider);
      }
    }

    return Array.from(uniqueProviders.values()).sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  /**
   * 根据提供商Key获取配置
   */
  async getProviderByKey(providerKey: string, userId?: string): Promise<ModelProvider | null> {
    // 优先查找租户配置
    if (userId) {
      const [tenantProvider] = await this.db
        .select()
        .from(modelProviders)
        .where(
          and(
            eq(modelProviders.configType, "tenant"),
            eq(modelProviders.userId, userId),
            eq(modelProviders.providerKey, providerKey)
          )
        )
        .limit(1);

      if (tenantProvider) {
        return tenantProvider;
      }
    }

    // 查找系统配置
    const [systemProvider] = await this.db
      .select()
      .from(modelProviders)
      .where(and(eq(modelProviders.configType, "system"), eq(modelProviders.providerKey, providerKey)))
      .limit(1);

    return systemProvider || null;
  }

  /**
   * 创建或更新系统提供商配置
   */
  async upsertSystemProvider(
    providerKey: string,
    config: {
      providerName?: string;
      baseUrl: string;
      apiKey: string;
      apiType?: string;
      models: unknown;
      enabled?: boolean;
      priority?: number;
    },
    updatedBy: string
  ): Promise<ModelProvider> {
    const existing = await this.getProviderByKey(providerKey);

    if (existing && existing.configType === "system") {
      // 更新
      const [updated] = await this.db
        .update(modelProviders)
        .set({
          providerName: config.providerName,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          apiType: config.apiType,
          models: config.models,
          enabled: config.enabled,
          priority: config.priority,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(modelProviders.id, existing.id))
        .returning();

      return updated!;
    } else {
      // 创建
      const [created] = await this.db
        .insert(modelProviders)
        .values({
          id: generateId(),
          configType: "system",
          providerKey,
          providerName: config.providerName,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          apiType: config.apiType,
          models: config.models,
          enabled: config.enabled,
          priority: config.priority,
          createdBy: updatedBy,
          updatedBy,
        })
        .returning();

      return created!;
    }
  }

  /**
   * 创建或更新租户提供商配置
   */
  async upsertTenantProvider(
    userId: string,
    providerKey: string,
    config: {
      providerName?: string;
      baseUrl: string;
      apiKey: string;
      apiType?: string;
      models: unknown;
      enabled?: boolean;
      priority?: number;
    },
    updatedBy: string
  ): Promise<ModelProvider> {
    const existing = await this.getProviderByKey(providerKey, userId);

    if (existing && existing.configType === "tenant" && existing.userId === userId) {
      // 更新
      const [updated] = await this.db
        .update(modelProviders)
        .set({
          providerName: config.providerName,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          apiType: config.apiType,
          models: config.models,
          enabled: config.enabled,
          priority: config.priority,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(modelProviders.id, existing.id))
        .returning();

      return updated!;
    } else {
      // 创建
      const [created] = await this.db
        .insert(modelProviders)
        .values({
          id: generateId(),
          configType: "tenant",
          userId,
          providerKey,
          providerName: config.providerName,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          apiType: config.apiType,
          models: config.models,
          enabled: config.enabled,
          priority: config.priority,
          createdBy: updatedBy,
          updatedBy,
        })
        .returning();

      return created!;
    }
  }
}

/**
 * Agent 配置 Repository
 */
export class AgentDefaultConfigRepository {
  constructor(private readonly db: Database) {}

  /**
   * 获取系统配置
   */
  async getSystemConfig(): Promise<AgentDefaultConfig | null> {
    const [config] = await this.db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.configType, "system"))
      .limit(1);

    return config || null;
  }

  /**
   * 获取租户配置
   */
  async getTenantConfig(userId: string): Promise<AgentDefaultConfig | null> {
    const [config] = await this.db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.configType, "tenant"), eq(agentConfigs.userId, userId)))
      .limit(1);

    return config || null;
  }

  /**
   * 获取有效配置 (租户优先)
   */
  async getEffectiveConfig(userId?: string): Promise<AgentDefaultConfig | null> {
    if (userId) {
      const tenantConfig = await this.getTenantConfig(userId);
      if (tenantConfig) {
        return tenantConfig;
      }
    }

    return this.getSystemConfig();
  }

  /**
   * 创建或更新系统配置
   */
  async upsertSystemConfig(config: Partial<NewAgentDefaultConfig>, updatedBy: string): Promise<AgentDefaultConfig> {
    const existing = await this.getSystemConfig();

    if (existing) {
      const [updated] = await this.db
        .update(agentConfigs)
        .set({
          ...config,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(agentConfigs.id, existing.id))
        .returning();

      return updated!;
    } else {
      const [created] = await this.db
        .insert(agentConfigs)
        .values({
          id: generateId(),
          configType: "system",
          ...config,
          createdBy: updatedBy,
          updatedBy,
        })
        .returning();

      return created!;
    }
  }

  /**
   * 创建或更新租户配置
   */
  async upsertTenantConfig(
    userId: string,
    config: Partial<NewAgentDefaultConfig>,
    updatedBy: string
  ): Promise<AgentDefaultConfig> {
    const existing = await this.getTenantConfig(userId);

    if (existing) {
      const [updated] = await this.db
        .update(agentConfigs)
        .set({
          ...config,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(agentConfigs.id, existing.id))
        .returning();

      return updated!;
    } else {
      const [created] = await this.db
        .insert(agentConfigs)
        .values({
          id: generateId(),
          configType: "tenant",
          userId,
          ...config,
          createdBy: updatedBy,
          updatedBy,
        })
        .returning();

      return created!;
    }
  }
}
