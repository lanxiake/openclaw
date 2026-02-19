#!/usr/bin/env node
/**
 * 检查数据库表是否存在
 */

import { getDatabase, getSqlClient } from "../dist/db/connection.js";

async function checkTables() {
  console.log("=== 检查数据库表 ===\n");

  try {
    const sql = getSqlClient();

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('gateway_configs', 'model_providers', 'agent_configs')
      ORDER BY table_name
    `;

    console.log("找到的表:");
    if (tables.length === 0) {
      console.log("  (无)");
    } else {
      tables.forEach((t) => {
        console.log(`  - ${t.table_name}`);
      });
    }

    // 检查 model_providers 表结构
    if (tables.some((t) => t.table_name === "model_providers")) {
      console.log("\nmodel_providers 表结构:");
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'model_providers'
        ORDER BY ordinal_position
      `;
      columns.forEach((c) => {
        console.log(
          `  - ${c.column_name}: ${c.data_type} ${c.is_nullable === "NO" ? "NOT NULL" : ""}`,
        );
      });

      // 检查是否有数据
      const count = await sql`SELECT COUNT(*) as count FROM model_providers`;
      console.log(`\n记录数: ${count[0].count}`);
    }

    await sql.end();
    console.log("\n✅ 检查完成");
  } catch (error) {
    console.error("❌ 检查失败:", error.message);
  }
}

checkTables();
