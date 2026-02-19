#!/usr/bin/env node
/**
 * 手动创建配置表
 */

import { getSqlClient } from "../dist/db/connection.js";
import { readFileSync } from "fs";

async function createConfigTables() {
  console.log("=== 创建配置表 ===\n");

  try {
    const sql = getSqlClient();

    // 读取迁移文件
    const migrationSql = readFileSync("src/db/migrations/0005_bumpy_odin.sql", "utf-8");

    console.log("执行 SQL:");
    console.log(migrationSql);
    console.log("");

    // 执行 SQL
    await sql.unsafe(migrationSql);

    console.log("✅ 表创建成功");

    // 插入默认数据
    console.log("\n插入默认数据...");

    // 1. Gateway 配置
    await sql`
      INSERT INTO gateway_configs (
        id, config_type, gateway_mode, gateway_port, gateway_bind,
        auth_mode, control_ui_enabled, tailscale_mode,
        created_by, updated_by
      ) VALUES (
        'system-gateway-config',
        'system',
        'local',
        18789,
        'loopback',
        'none',
        true,
        'off',
        'system',
        'system'
      )
      ON CONFLICT (config_type) DO NOTHING
    `;
    console.log("  ✓ Gateway 配置");

    // 2. 模型提供商配置
    await sql`
      INSERT INTO model_providers (
        id, config_type, provider_key, provider_name,
        base_url, api_key, api_type, models,
        enabled, priority,
        created_by, updated_by
      ) VALUES (
        'system-anthropic-provider',
        'system',
        'custom-anthropic',
        'Anthropic (Custom)',
        'https://api.anthropic.com',
        'sk-ant-placeholder',
        'anthropic-messages',
        '["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20250110"]'::jsonb,
        true,
        100,
        'system',
        'system'
      )
      ON CONFLICT (config_type, user_id, provider_key) DO NOTHING
    `;
    console.log("  ✓ 模型提供商配置");

    // 3. Agent 配置
    await sql`
      INSERT INTO agent_configs (
        id, config_type, primary_model,
        compaction_mode, max_concurrent, subagents_max_concurrent,
        created_by, updated_by
      ) VALUES (
        'system-agent-config',
        'system',
        'claude-opus-4-5-20251101',
        'safeguard',
        4,
        8,
        'system',
        'system'
      )
      ON CONFLICT (config_type) DO NOTHING
    `;
    console.log("  ✓ Agent 配置");

    await sql.end();
    console.log("\n✅ 完成");
  } catch (error) {
    console.error("❌ 失败:", error.message);
    if (error.cause) {
      console.error("原因:", error.cause.message);
    }
  }
}

createConfigTables();
