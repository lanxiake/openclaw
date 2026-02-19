#!/usr/bin/env node
/**
 * 创建测试管理员
 */

import { getSqlClient } from "../dist/db/connection.js";
import bcrypt from "bcrypt";
import { generateId } from "../dist/utils/id.js";

async function createTestAdmin() {
  const sql = getSqlClient();

  try {
    const username = "testadmin2";
    const password = "Test@2026";
    const email = "test2@openclaw.ai";

    // 检查是否已存在
    const existing = await sql`
      SELECT id FROM admins WHERE username = ${username}
    `;

    if (existing.length > 0) {
      console.log("管理员已存在,更新密码...");
      const hashedPassword = await bcrypt.hash(password, 10);
      await sql`
        UPDATE admins
        SET password_hash = ${hashedPassword}
        WHERE username = ${username}
      `;
      console.log("✅ 密码已更新");
    } else {
      console.log("创建新管理员...");
      const hashedPassword = await bcrypt.hash(password, 10);
      await sql`
        INSERT INTO admins (
          id, username, email, password_hash, role, status
        ) VALUES (
          ${generateId()},
          ${username},
          ${email},
          ${hashedPassword},
          'super_admin',
          'active'
        )
      `;
      console.log("✅ 管理员创建成功");
    }

    console.log(`\n登录信息:`);
    console.log(`  用户名: ${username}`);
    console.log(`  密码: ${password}`);

    await sql.end();
  } catch (error) {
    console.error("操作失败:", error.message);
  }
}

createTestAdmin();
