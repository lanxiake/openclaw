/**
 * 创建测试管理员账户脚本
 *
 * 使用与 Gateway 相同的 scrypt 密码哈希算法
 */

import { config } from "dotenv";
config();

import postgres from "postgres";
import * as crypto from "crypto";
import { hashPassword } from "../src/db/utils/password.js";

// 生成 ID
function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(connectionString, { max: 1 });

  // 检查是否已存在管理员
  const existing = await sql`SELECT id FROM admins WHERE username = 'admin' LIMIT 1`;

  // 生成新的密码哈希 (使用 scrypt 格式)
  const passwordHash = await hashPassword("Admin@2026!");
  console.log("Password hash generated (scrypt format)");

  if (existing.length > 0) {
    // 更新现有管理员的密码
    console.log("Admin user 'admin' already exists, updating password...");
    await sql`
      UPDATE admins
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE username = 'admin'
    `;
    console.log("\n✅ Admin password updated successfully!\n");
    console.log("  Username: admin");
    console.log("  Password: Admin@2026!");
    console.log(`  ID: ${existing[0].id}`);
  } else {
    // 创建管理员账户
    const adminId = generateId("adm");

    await sql`
      INSERT INTO admins (
        id,
        username,
        password_hash,
        display_name,
        email,
        role,
        status,
        mfa_enabled,
        created_at,
        updated_at
      ) VALUES (
        ${adminId},
        'admin',
        ${passwordHash},
        '超级管理员',
        'admin@mtbot.top',
        'super_admin',
        'active',
        false,
        NOW(),
        NOW()
      )
    `;

    console.log("\n✅ Test admin account created successfully!\n");
    console.log("  Username: admin");
    console.log("  Password: Admin@2026!");
    console.log("  Role: super_admin");
    console.log("  Email: admin@mtbot.top");
    console.log(`  ID: ${adminId}`);
  }

  // 创建一些测试套餐 (如果不存在)
  console.log("\n📦 Checking test plans...\n");

  const existingPlans =
    await sql`SELECT code FROM plans WHERE code IN ('free', 'monthly', 'yearly')`;
  const existingCodes = new Set(existingPlans.map((p) => p.code));

  if (existingCodes.size === 3) {
    console.log("✅ Test plans already exist, skipping creation.");
  } else {
    const plansToCreate = [];

    if (!existingCodes.has("free")) {
      plansToCreate.push({
        id: generateId("pln"),
        name: "免费版",
        code: "free",
        description: "注册赠送600积分，邀请好友获取更多",
        priceMonthly: 0,
        priceYearly: 0,
        features: '{"maxDevices": 5, "maxSkills": 100, "maxFileSize": 50}',
        sortOrder: 1,
      });
    }

    if (!existingCodes.has("monthly")) {
      plansToCreate.push({
        id: generateId("pln"),
        name: "月付版",
        code: "monthly",
        description: "30元/月，每月2000积分，首月3元",
        priceMonthly: 3000,
        priceYearly: 0,
        features: '{"maxDevices": 5, "maxSkills": 100, "maxFileSize": 50, "firstMonthPrice": 300}',
        sortOrder: 2,
      });
    }

    if (!existingCodes.has("yearly")) {
      plansToCreate.push({
        id: generateId("pln"),
        name: "年付版",
        code: "yearly",
        description: "300元/年，每月2000积分",
        priceMonthly: 0,
        priceYearly: 30000,
        features: '{"maxDevices": 5, "maxSkills": 100, "maxFileSize": 50}',
        sortOrder: 3,
      });
    }

    for (const plan of plansToCreate) {
      await sql`
        INSERT INTO plans (id, name, code, description, price_monthly, price_yearly, features, is_active, sort_order)
        VALUES (${plan.id}, ${plan.name}, ${plan.code}, ${plan.description}, ${plan.priceMonthly}, ${plan.priceYearly}, ${plan.features}, true, ${plan.sortOrder})
      `;
      console.log(`✅ Created plan: ${plan.name}`);
    }
  }

  await sql.end();

  console.log("\n🎉 Setup completed!\n");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
