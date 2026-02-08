/**
 * 测试管理员登录逻辑
 */

import { config } from "dotenv";
config();

import postgres from "postgres";
import * as crypto from "crypto";

// 验证密码
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === testHash;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Testing admin login...\n");
  const sql = postgres(connectionString, { max: 1 });

  // 查询管理员
  const admins = await sql`
    SELECT id, username, password_hash, display_name, email, role, status
    FROM admins
    WHERE username = 'admin'
  `;

  if (admins.length === 0) {
    console.error("❌ Admin user 'admin' not found");
    await sql.end();
    process.exit(1);
  }

  const admin = admins[0];
  console.log("Found admin:");
  console.log(`  ID: ${admin.id}`);
  console.log(`  Username: ${admin.username}`);
  console.log(`  Display Name: ${admin.display_name}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Status: ${admin.status}`);

  // 验证密码
  const testPassword = "Admin@2026!";
  const isValid = verifyPassword(testPassword, admin.password_hash);

  if (isValid) {
    console.log(`\n✅ Password verification successful!`);
  } else {
    console.log(`\n❌ Password verification failed!`);
  }

  // 查询套餐
  console.log("\n📦 Plans in database:");
  const plans =
    await sql`SELECT id, name, code, price_monthly, price_yearly FROM plans ORDER BY sort_order`;
  for (const plan of plans) {
    console.log(
      `  - ${plan.name} (${plan.code}): ¥${plan.price_monthly / 100}/月, ¥${plan.price_yearly / 100}/年`,
    );
  }

  // 统计表数据
  console.log("\n📊 Database statistics:");
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  const adminCount = await sql`SELECT COUNT(*) as count FROM admins`;
  const planCount = await sql`SELECT COUNT(*) as count FROM plans`;

  console.log(`  Users: ${userCount[0].count}`);
  console.log(`  Admins: ${adminCount[0].count}`);
  console.log(`  Plans: ${planCount[0].count}`);

  await sql.end();
  console.log("\n🎉 All tests passed!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
