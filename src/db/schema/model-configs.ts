/**
 * 模型提供商配置表 Schema
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const modelProviders = pgTable(
  "model_providers",
  {
    id: text("id").primaryKey(),

    // 配置类型
    configType: varchar("config_type", { length: 20 }).notNull().default("system"),

    // 租户 ID
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),

    // 提供商信息
    providerKey: varchar("provider_key", { length: 100 }).notNull(),
    providerName: varchar("provider_name", { length: 200 }),

    // API 配置
    baseUrl: varchar("base_url", { length: 500 }).notNull(),
    apiKey: varchar("api_key", { length: 500 }).notNull(),
    apiType: varchar("api_type", { length: 50 }).default("openai-completions"),

    // 模型列表
    models: jsonb("models").notNull(),

    // 状态
    enabled: boolean("enabled").default(true),
    priority: integer("priority").default(100),

    // 元数据
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => ({
    // 唯一约束
    providerUnique: unique("model_providers_unique").on(
      table.configType,
      table.userId,
      table.providerKey,
    ),
  }),
);

export type ModelProvider = typeof modelProviders.$inferSelect;
export type NewModelProvider = typeof modelProviders.$inferInsert;

/**
 * Agent 配置表 Schema
 */
export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),

    // 配置类型
    configType: varchar("config_type", { length: 20 }).notNull().default("system"),

    // 租户 ID
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),

    // 默认模型
    primaryModel: varchar("primary_model", { length: 100 }).default(
      "anthropic/claude-opus-4-5-20251101",
    ),

    // 工作空间
    workspacePath: varchar("workspace_path", { length: 500 }),

    // 压缩模式
    compactionMode: varchar("compaction_mode", { length: 50 }).default("safeguard"),

    // 并发配置
    maxConcurrent: integer("max_concurrent").default(4),
    subagentsMaxConcurrent: integer("subagents_max_concurrent").default(8),

    // 扩展配置
    extraConfig: jsonb("extra_config"),

    // 元数据
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => ({
    // 唯一约束
    systemUnique: unique("agent_configs_system_unique").on(table.configType),
    tenantUnique: unique("agent_configs_tenant_unique").on(table.userId),
  }),
);

export type AgentDefaultConfig = typeof agentConfigs.$inferSelect;
export type NewAgentDefaultConfig = typeof agentConfigs.$inferInsert;
