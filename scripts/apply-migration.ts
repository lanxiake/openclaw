import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { getDatabase } from "../src/db/connection.js";

// 加载环境变量
config();

async function applyMigration() {
  console.log("开始应用数据库迁移...");

  try {
    const db = getDatabase();

    // 读取迁移脚本
    const migrationPath = join(
      process.cwd(),
      "src/db/migrations/0006_fix_all_schema_differences.sql",
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("执行迁移脚本...");

    // 执行迁移
    await db.execute(migrationSQL);

    console.log("✅ 迁移成功完成!");
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    process.exit(1);
  }
}

applyMigration();
