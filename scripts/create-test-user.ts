/**
 * 创建测试用户账号
 * 用于集成测试 Phase 2
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/db/schema/users.js";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

// 加载环境变量
config();

const scryptAsync = promisify(scrypt);

const connectionString = process.env["DATABASE_URL"];

/**
 * 哈希密码
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `$scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`;
}

async function createTestUser() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    const email = "test@example.com";
    const phone = "+8613800138000";
    const password = "TestP@ssw0rd123";
    const displayName = "测试用户";

    console.log("\n[TEST] 创建测试用户账号...");
    console.log(`  - 邮箱: ${email}`);
    console.log(`  - 手机: ${phone}`);
    console.log(`  - 密码: ${password}`);
    console.log(`  - 显示名称: ${displayName}`);

    // 哈希密码
    console.log("\n[TEST] 哈希密码...");
    const passwordHash = await hashPassword(password);
    console.log(`  - 密码哈希: ${passwordHash.substring(0, 50)}...`);

    // 创建用户
    const userId = `user-test-${Date.now()}`;
    await sql`
      INSERT INTO users (
        id, email, phone, password_hash, display_name,
        is_active, email_verified, phone_verified, mfa_enabled
      ) VALUES (
        ${userId}, ${email}, ${phone}, ${passwordHash}, ${displayName},
        ${true}, ${true}, ${true}, ${false}
      )
    `;

    // 查询创建的用户
    const [user] = await sql`
      SELECT * FROM users WHERE id = ${userId}
    `;

    console.log("\n[TEST] ✓ 用户创建成功!");
    console.log(`  - ID: ${user.id}`);
    console.log(`  - 邮箱: ${user.email}`);
    console.log(`  - 手机: ${user.phone}`);
    console.log(`  - 显示名称: ${user.display_name}`);
    console.log(`  - 激活状态: ${user.is_active}`);

    console.log("\n[TEST] ========== 测试账号信息 ==========");
    console.log(`邮箱: ${email}`);
    console.log(`手机: ${phone}`);
    console.log(`密码: ${password}`);
    console.log("=========================================\n");

  } catch (error) {
    console.error("[TEST] ✗ 创建失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createTestUser();
