/**
 * 更新管理员密码
 */

import postgres from "postgres";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const connectionString = process.env["DATABASE_URL"] || "postgresql://openclaw_admin:Oc@2026!Pg#Secure@10.157.152.40:22001/openclaw_prod";

/**
 * 哈希密码
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `$scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`;
}

async function updateAdminPassword() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });

  try {
    const username = "admin";
    const newPassword = "Admin@123456";

    console.log("\n[TEST] 更新管理员密码...");
    console.log(`  - 用户名: ${username}`);
    console.log(`  - 新密码: ${newPassword}`);

    // 哈希密码
    console.log("\n[TEST] 哈希密码...");
    const passwordHash = await hashPassword(newPassword);
    console.log(`  - 密码哈希: ${passwordHash.substring(0, 50)}...`);

    // 更新密码
    await sql`
      UPDATE admins
      SET password_hash = ${passwordHash},
          updated_at = NOW()
      WHERE username = ${username}
    `;

    // 查询更新后的管理员
    const [admin] = await sql`
      SELECT id, username, display_name, role, status
      FROM admins
      WHERE username = ${username}
    `;

    console.log("\n[TEST] ✓ 密码更新成功!");
    console.log(`  - ID: ${admin.id}`);
    console.log(`  - 用户名: ${admin.username}`);
    console.log(`  - 显示名称: ${admin.display_name}`);
    console.log(`  - 角色: ${admin.role}`);
    console.log(`  - 状态: ${admin.status}`);

    console.log("\n[TEST] ========== 测试账号信息 ==========");
    console.log(`用户名: ${username}`);
    console.log(`密码: ${newPassword}`);
    console.log("=========================================\n");

  } catch (error) {
    console.error("[TEST] ✗ 更新失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

updateAdminPassword();
