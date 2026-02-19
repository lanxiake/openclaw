#!/usr/bin/env node
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgresql://localhost:5432/openclaw");

try {
  console.log("开始修改表结构...\n");

  // 修改 model_providers 表
  console.log("1. 修改 model_providers 表...");
  await sql`
    ALTER TABLE model_providers
      ALTER COLUMN id TYPE text,
      ALTER COLUMN user_id TYPE text,
      ALTER COLUMN created_by TYPE text,
      ALTER COLUMN updated_by TYPE text
  `;
  console.log("✅ model_providers 表修改完成\n");

  // 修改 agent_configs 表
  console.log("2. 修改 agent_configs 表...");
  await sql`
    ALTER TABLE agent_configs
      ALTER COLUMN id TYPE text,
      ALTER COLUMN user_id TYPE text,
      ALTER COLUMN created_by TYPE text,
      ALTER COLUMN updated_by TYPE text
  `;
  console.log("✅ agent_configs 表修改完成\n");

  // 修改 gateway_configs 表
  console.log("3. 修改 gateway_configs 表...");
  await sql`
    ALTER TABLE gateway_configs
      ALTER COLUMN id TYPE text,
      ALTER COLUMN user_id TYPE text,
      ALTER COLUMN created_by TYPE text,
      ALTER COLUMN updated_by TYPE text
  `;
  console.log("✅ gateway_configs 表修改完成\n");

  console.log("🎉 所有表结构修改完成！");
} catch (error) {
  console.error("❌ 修改失败:");
  console.error("  错误信息:", error.message);
  console.error("  错误详情:", error);
  process.exit(1);
} finally {
  await sql.end();
}
