/**
 * 数据库迁移脚本
 *
 * 使用 Drizzle ORM 执行数据库迁移
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 加载环境变量
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Connecting to database...");
  console.log(`📍 Database: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);

  // 创建数据库连接
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    console.log("🚀 Running migrations...");

    // 执行迁移
    await migrate(db, {
      migrationsFolder: join(__dirname, "../src/db/migrations"),
    });

    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log("🔌 Database connection closed");
  }
}

main();
