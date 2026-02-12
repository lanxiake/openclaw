/**
 * 创建管理员测试账号
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { admins } from "../src/db/schema/admins.js";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const connectionString =
  process.env["DATABASE_URL"] ||
  "postgresql://openclaw_admin:Oc@2026!Pg#Secure@10.157.152.40:22001/openclaw_prod";

/**
 * 哈希密码
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `$scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`;
}

async function createTestAdmin() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    const username = "admin";
    const password = "Admin@123456";
    const displayName = "测试管理员";

    console.log("\n[TEST] 创建管理员账号...");
    console.log(`  - 用户名: ${username}`);
    console.log(`  - 密码: ${password}`);
    console.log(`  - 显示名称: ${displayName}`);

    // 哈希密码
    console.log("\n[TEST] 哈希密码...");
    const passwordHash = await hashPassword(password);
    console.log(`  - 密码哈希: ${passwordHash.substring(0, 50)}...`);

    // 创建管理员（只使用数据库中存在的列）
    const adminId = `admin-${Date.now()}`;
    await sql`
      INSERT INTO admins (
        id, username, password_hash, display_name, email,
        role, permissions, status, mfa_enabled
      ) VALUES (
        ${adminId}, ${username}, ${passwordHash}, ${displayName}, ${"admin@openclaw.ai"},
        ${"super_admin"}, ${JSON.stringify([])}, ${"active"}, ${false}
      )
    `;

    // 查询创建的管理员
    const [admin] = await sql`
      SELECT * FROM admins WHERE id = ${adminId}
    `;

    console.log("\n[TEST] ✓ 管理员创建成功!");
    console.log(`  - ID: ${admin.id}`);
    console.log(`  - 用户名: ${admin.username}`);
    console.log(`  - 显示名称: ${admin.displayName}`);
    console.log(`  - 角色: ${admin.role}`);
    console.log(`  - 状态: ${admin.status}`);

    console.log("\n[TEST] ========== 测试账号信息 ==========");
    console.log(`用户名: ${username}`);
    console.log(`密码: ${password}`);
    console.log("=========================================\n");
  } catch (error) {
    console.error("[TEST] ✗ 创建失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createTestAdmin();
