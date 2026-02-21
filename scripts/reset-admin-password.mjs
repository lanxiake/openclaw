#!/usr/bin/env node
/**
 * 重置管理员密码
 */

import { getSqlClient } from "../dist/db/connection.js";
import { hashPassword } from "../dist/db/utils/password.js";

async function resetAdminPassword() {
  const sql = getSqlClient();

  try {
    const username = "admin";
    const newPassword = "Admin@2026";

    console.log(`重置管理员密码: ${username}`);
    console.log(`新密码: ${newPassword}`);
    console.log("");

    // 生成密码哈希
    const passwordHash = await hashPassword(newPassword);
    console.log("密码哈希生成成功");

    // 更新密码、解除锁定、恢复状态
    const result = await sql`
      UPDATE admins
      SET
        password_hash = ${passwordHash},
        status = 'active',
        failed_login_attempts = '0',
        locked_until = NULL,
        last_failed_login_at = NULL,
        updated_at = NOW()
      WHERE username = ${username}
      RETURNING id, username, email, role
    `;

    if (result.length === 0) {
      console.log("❌ 管理员不存在");
      await sql.end();
      return;
    }

    // 清除登录尝试记录
    const deleted = await sql`
      DELETE FROM admin_login_attempts
      WHERE username = ${username}
    `;
    console.log(`已清除 ${deleted.count} 条登录尝试记录`);

    console.log("✅ 密码重置成功");
    console.log("");
    console.log("管理员信息:");
    console.log(`  ID: ${result[0].id}`);
    console.log(`  用户名: ${result[0].username}`);
    console.log(`  邮箱: ${result[0].email}`);
    console.log(`  角色: ${result[0].role}`);
    console.log("");
    console.log("登录信息:");
    console.log(`  用户名: ${username}`);
    console.log(`  密码: ${newPassword}`);

    await sql.end();
  } catch (error) {
    console.error("❌ 操作失败:", error.message);
  }
}

resetAdminPassword();
