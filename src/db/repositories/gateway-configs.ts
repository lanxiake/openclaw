/**
 * Gateway 配置 Repository
 *
 * 提供 Gateway 配置的数据访问方法
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "../connection.js";
import { gatewayConfigs, type GatewayConfig, type NewGatewayConfig } from "../schema/gateway-configs.js";
import { generateId } from "../utils/id.js";

/**
 * Gateway 配置 Repository
 */
export class GatewayConfigRepository {
  constructor(private readonly db: Database) {}

  /**
   * 获取系统配置
   */
  async getSystemConfig(): Promise<GatewayConfig | null> {
    const [config] = await this.db
      .select()
      .from(gatewayConfigs)
      .where(eq(gatewayConfigs.configType, "system"))
      .limit(1);

    return config || null;
  }

  /**
   * 获取租户配置
   */
  async getTenantConfig(userId: string): Promise<GatewayConfig | null> {
    const [config] = await this.db
      .select()
      .from(gatewayConfigs)
      .where(and(eq(gatewayConfigs.configType, "tenant"), eq(gatewayConfigs.userId, userId)))
      .limit(1);

    return config || null;
  }

  /**
   * 获取有效配置 (租户配置优先,否则使用系统配置)
   */
  async getEffectiveConfig(userId?: string): Promise<GatewayConfig | null> {
    // 如果提供了 userId,先尝试获取租户配置
    if (userId) {
      const tenantConfig = await this.getTenantConfig(userId);
      if (tenantConfig) {
        return tenantConfig;
      }
    }

    // 否则返回系统配置
    return this.getSystemConfig();
  }

  /**
   * 创建或更新系统配置
   */
  async upsertSystemConfig(
    config: Partial<NewGatewayConfig>,
    updatedBy: string
  ): Promise<GatewayConfig> {
    const existingConfig = await this.getSystemConfig();

    if (existingConfig) {
      // 更新现有配置
      const [updated] = await this.db
        .update(gatewayConfigs)
        .set({
          ...config,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(gatewayConfigs.id, existingConfig.id))
        .returning();

      return updated!;
    } else {
      // 创建新配置
      const [created] = await this.db
        .insert(gatewayConfigs)
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
    config: Partial<NewGatewayConfig>,
    updatedBy: string
  ): Promise<GatewayConfig> {
    const existingConfig = await this.getTenantConfig(userId);

    if (existingConfig) {
      // 更新现有配置
      const [updated] = await this.db
        .update(gatewayConfigs)
        .set({
          ...config,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(gatewayConfigs.id, existingConfig.id))
        .returning();

      return updated!;
    } else {
      // 创建新配置
      const [created] = await this.db
        .insert(gatewayConfigs)
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

  /**
   * 删除租户配置
   */
  async deleteTenantConfig(userId: string): Promise<void> {
    await this.db
      .delete(gatewayConfigs)
      .where(and(eq(gatewayConfigs.configType, "tenant"), eq(gatewayConfigs.userId, userId)));
  }

  /**
   * 列出所有租户配置
   */
  async listTenantConfigs(): Promise<GatewayConfig[]> {
    return this.db.select().from(gatewayConfigs).where(eq(gatewayConfigs.configType, "tenant"));
  }
}
