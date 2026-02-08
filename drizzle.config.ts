/**
 * Drizzle ORM 配置文件
 *
 * 用于数据库迁移和 studio
 */

import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// 加载环境变量
config();

// 获取数据库连接字符串
const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  console.warn(
    "Warning: DATABASE_URL not set. Drizzle commands will not work."
  );
}

export default defineConfig({
  // Schema 文件路径
  schema: "./src/db/schema/index.ts",
  // 迁移文件输出目录
  out: "./src/db/migrations",
  // 数据库类型
  dialect: "postgresql",
  // 数据库连接配置
  dbCredentials: {
    url: connectionString || "postgresql://localhost:5432/openclaw",
  },
  // 详细日志
  verbose: true,
  // 严格模式
  strict: true,
  // 表名过滤 (可选)
  // tablesFilter: ["users", "user_*", "plans", "skills", "subscriptions", "payment_*", "coupon_*", "audit_*", "export_*"],
});
