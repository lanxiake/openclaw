#!/usr/bin/env node
/**
 * 检查 admin_login_attempts 表结构
 */

import { getSqlClient } from "../dist/db/connection.js";

async function checkTable() {
  const sql = getSqlClient();

  try {
    // 查看表结构
    const columns = await sql`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_login_attempts'
      ORDER BY ordinal_position
    `;

    console.log("admin_login_attempts 表结构:");
    console.log("");
    columns.forEach((c) => {
      const length = c.character_maximum_length ? `(${c.character_maximum_length})` : "";
      const nullable = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
      console.log(`  ${c.column_name.padEnd(20)} ${c.data_type}${length.padEnd(10)} ${nullable}`);
    });

    await sql.end();
  } catch (error) {
    console.error("查询失败:", error.message);
  }
}

checkTable();
