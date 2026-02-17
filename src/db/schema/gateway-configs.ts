/**
 * Gateway 配置表 Schema
 *
 * 用于存储 Gateway 的系统配置和多租户配置
 */

import { pgTable, varchar, integer, boolean, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const gatewayConfigs = pgTable(
  "gateway_configs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // 配置类型
    configType: varchar("config_type", { length: 20 }).notNull().default("system"),

    // 租户 ID (仅当 configType='tenant' 时有效)
    userId: varchar("user_id", { length: 32 }).references(() => users.id, { onDelete: "cascade" }),

    // Gateway 基础配置
    gatewayMode: varchar("gateway_mode", { length: 20 }).notNull().default("local"),
    gatewayPort: integer("gateway_port").default(18789),
    gatewayBind: varchar("gateway_bind", { length: 50 }).default("loopback"),

    // 认证配置
    authMode: varchar("auth_mode", { length: 20 }).notNull().default("none"),
    authToken: varchar("auth_token", { length: 255 }),
    authPassword: varchar("auth_password", { length: 255 }),
    authAllowTailscale: boolean("auth_allow_tailscale").default(false),

    // Control UI 配置
    controlUiEnabled: boolean("control_ui_enabled").default(true),
    controlUiAllowInsecureAuth: boolean("control_ui_allow_insecure_auth").default(false),

    // Tailscale 配置
    tailscaleMode: varchar("tailscale_mode", { length: 20 }).default("off"),
    tailscaleResetOnExit: boolean("tailscale_reset_on_exit").default(false),

    // 扩展配置 (JSON 格式)
    extraConfig: jsonb("extra_config"),

    // 元数据
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: varchar("created_by", { length: 32 }),
    updatedBy: varchar("updated_by", { length: 32 }),
  },
  (table) => ({
    // 系统配置唯一约束
    systemUnique: unique("gateway_configs_system_unique").on(table.configType),

    // 租户配置唯一约束
    tenantUnique: unique("gateway_configs_tenant_unique").on(table.userId),
  })
);

export type GatewayConfig = typeof gatewayConfigs.$inferSelect;
export type NewGatewayConfig = typeof gatewayConfigs.$inferInsert;
