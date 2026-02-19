#!/usr/bin/env node
/**
 * 检查管理员账号
 */

import { getSqlClient } from "../dist/db/connection.js";

async function checkAdmin() {
  const sql = getSqlClient();

  try {
    const admins = await sql`
      SELECT id, username, email, role, status
      FROM admins
      LIMIT 5
    `;

    console.log("管理员账号列表:");
    admins.forEach((a) => {
      console.log(`  - ${a.username} (${a.email}) - ${a.role} - ${a.status}`);
    });

    await sql.end();
  } catch (error) {
    console.error("查询失败:", error.message);
  }
}

checkAdmin();
