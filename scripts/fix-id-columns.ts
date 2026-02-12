import { config } from "dotenv";
import { getDatabase } from "../src/db/connection.js";

config();

async function fixIdColumns() {
  console.log("开始修复ID列长度...");

  try {
    const db = getDatabase();

    // 修复users表的id列
    console.log("\\n1. 修复users.id列长度 (32 -> 64)");
    await db.execute(`
      ALTER TABLE "users"
        ALTER COLUMN "id" TYPE varchar(64);
    `);
    console.log("✅ users.id列修复完成");

    // 修复admins表的id列
    console.log("\\n2. 修复admins.id列长度 (32 -> 64)");
    await db.execute(`
      ALTER TABLE "admins"
        ALTER COLUMN "id" TYPE varchar(64);
    `);
    console.log("✅ admins.id列修复完成");

    // 修复其他可能受影响的表
    const tables = [
      "user_sessions",
      "admin_sessions",
      "user_devices",
      "verification_codes",
      "login_attempts",
      "admin_login_attempts",
      "audit_logs",
      "export_logs",
      "subscriptions",
      "payment_orders",
      "plans",
    ];

    for (const table of tables) {
      try {
        console.log(`\\n3. 检查并修复${table}.id列`);
        await db.execute(`
          ALTER TABLE "${table}"
            ALTER COLUMN "id" TYPE varchar(64);
        `);
        console.log(`✅ ${table}.id列修复完成`);
      } catch (error: any) {
        if (error.message?.includes("does not exist")) {
          console.log(`ℹ️  ${table}表不存在,跳过`);
        } else {
          console.log(`⚠️  ${table}.id列修复失败:`, error.message);
        }
      }
    }

    console.log("\\n✅ 所有ID列长度修复完成!");
  } catch (error) {
    console.error("❌ ID列修复失败:", error);
    process.exit(1);
  }
}

fixIdColumns();
