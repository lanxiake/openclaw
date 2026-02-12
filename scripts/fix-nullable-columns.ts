import { config } from "dotenv";
import { getDatabase } from "../src/db/connection.js";

config();

async function fixNullableColumns() {
  console.log("开始修复nullable列约束...");

  try {
    const db = getDatabase();

    // 修复users表的phone列为可选
    console.log("\\n1. 修复users.phone列为可选 (NOT NULL -> NULL)");
    await db.execute(`
      ALTER TABLE "users"
        ALTER COLUMN "phone" DROP NOT NULL;
    `);
    console.log("✅ users.phone列修复完成");

    console.log("\\n✅ 所有nullable列修复完成!");
  } catch (error) {
    console.error("❌ nullable列修复失败:", error);
    process.exit(1);
  }
}

fixNullableColumns();
