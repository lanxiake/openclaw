import { config } from "dotenv";
import postgres from "postgres";

config();

async function checkAuditLogSchema() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("🔍 检查 admin_audit_logs 表结构...\n");

  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs'
    ORDER BY ordinal_position
  `;

  console.log("📋 当前列:");
  columns.forEach((c) => {
    console.log(
      `  - ${c.column_name}: ${c.data_type} ${c.is_nullable === "NO" ? "NOT NULL" : "NULL"}`,
    );
  });

  console.log("\n🔍 检查是否缺少 admin_username 列...");
  const hasAdminUsername = columns.some((c) => c.column_name === "admin_username");

  if (!hasAdminUsername) {
    console.log("  ❌ 缺少 admin_username 列");
    console.log("\n💡 修复方案:");
    console.log(
      "  ALTER TABLE admin_audit_logs ADD COLUMN admin_username text NOT NULL DEFAULT 'unknown';",
    );
  } else {
    console.log("  ✅ admin_username 列存在");
  }

  await sql.end();
}

checkAuditLogSchema();
