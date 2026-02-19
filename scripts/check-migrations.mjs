#!/usr/bin/env node
/**
 * 检查迁移状态
 */

import { getSqlClient } from "../dist/db/connection.js";

async function checkMigrations() {
  console.log("=== 检查迁移状态 ===\n");

  try {
    const sql = getSqlClient();

    // 检查迁移表
    const migrations = await sql`
      SELECT * FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log("最近的迁移记录:");
    if (migrations.length === 0) {
      console.log("  (无)");
    } else {
      migrations.forEach((m) => {
        console.log(`  - ${m.hash} (${m.created_at})`);
      });
    }

    await sql.end();
    console.log("\n✅ 检查完成");
  } catch (error) {
    console.error("❌ 检查失败:", error.message);
  }
}

checkMigrations();
