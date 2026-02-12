import { config } from "dotenv";
import postgres from "postgres";

config();

async function fixResourceType() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("🔧 修复 admin_audit_logs.resource_type 约束...\n");

  try {
    // 方案：删除 NOT NULL 约束
    await sql`ALTER TABLE admin_audit_logs ALTER COLUMN resource_type DROP NOT NULL`;
    console.log("✅ 已删除 resource_type 的 NOT NULL 约束");

    // 同样处理 resource_id
    await sql`ALTER TABLE admin_audit_logs ALTER COLUMN resource_id DROP NOT NULL`;
    console.log("✅ 已删除 resource_id 的 NOT NULL 约束\n");

    // 验证
    const result = await sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'admin_audit_logs' 
        AND column_name IN ('resource_type', 'resource_id')
    `;

    console.log("📋 修复后:");
    result.forEach((r) => {
      console.log(`  - ${r.column_name}: ${r.is_nullable === "YES" ? "NULL" : "NOT NULL"}`);
    });
  } catch (error) {
    console.error("❌ 修复失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixResourceType();
