/**
 * 检查管理员账户脚本
 */

import { config } from "dotenv";
config();

import postgres from "postgres";
import { verifyPassword } from "../src/db/utils/password.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(connectionString, { max: 1 });

  // 查询管理员
  const admins = await sql`SELECT id, username, password_hash, role, status FROM admins`;

  console.log("\n管理员账号列表:");
  console.log("================");

  for (const admin of admins) {
    console.log(`\nID: ${admin.id}`);
    console.log(`Username: ${admin.username}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Status: ${admin.status}`);
    console.log(`Password Hash: ${admin.password_hash.substring(0, 50)}...`);

    // 验证密码 (verifyPassword 是异步函数)
    const testPassword = "Admin@2026!";
    const isValid = await verifyPassword(testPassword, admin.password_hash);
    console.log(`Password '${testPassword}' valid: ${isValid ? "✅ YES" : "❌ NO"}`);
  }

  await sql.end();
}

main().catch(console.error);
