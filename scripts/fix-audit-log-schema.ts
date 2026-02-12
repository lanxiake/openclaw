/**
 * 修复 admin_audit_logs 表 Schema
 * 添加缺失的列以匹配代码定义
 */

import { config } from "dotenv";
import postgres from "postgres";

config();

async function fixAuditLogSchema() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("🔧 修复 admin_audit_logs 表 Schema...\n");

  try {
    // 检查当前列
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'admin_audit_logs'
    `;

    const columnNames = columns.map((c) => c.column_name);
    console.log("📋 当前列:", columnNames.join(", "));

    // 需要添加的列
    const columnsToAdd = [
      { name: "admin_username", type: "text", notNull: true, default: "'unknown'" },
      { name: "target_type", type: "text", notNull: false },
      { name: "target_id", type: "text", notNull: false },
      { name: "target_name", type: "text", notNull: false },
      { name: "before_snapshot", type: "jsonb", notNull: false },
      { name: "after_snapshot", type: "jsonb", notNull: false },
      { name: "risk_level", type: "text", notNull: true, default: "'low'" },
    ];

    console.log("\n🔍 检查需要添加的列...");

    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        console.log(`  ➕ 添加列: ${col.name}`);

        let alterSql = `ALTER TABLE admin_audit_logs ADD COLUMN ${col.name} ${col.type}`;
        if (col.notNull) {
          alterSql += ` NOT NULL DEFAULT ${col.default}`;
        }

        await sql.unsafe(alterSql);
        console.log(`     ✅ 已添加`);
      } else {
        console.log(`  ✓ 列已存在: ${col.name}`);
      }
    }

    // 检查是否需要重命名列
    if (columnNames.includes("resource_type") && !columnNames.includes("target_type")) {
      console.log("\n  🔄 重命名 resource_type -> target_type");
      // 不重命名，而是添加新列并复制数据
      if (!columnNames.includes("target_type")) {
        await sql`ALTER TABLE admin_audit_logs ADD COLUMN target_type text`;
        await sql`UPDATE admin_audit_logs SET target_type = resource_type`;
        console.log("     ✅ 已添加 target_type 列");
      }
    }

    if (columnNames.includes("resource_id") && !columnNames.includes("target_id")) {
      console.log("  🔄 重命名 resource_id -> target_id");
      if (!columnNames.includes("target_id")) {
        await sql`ALTER TABLE admin_audit_logs ADD COLUMN target_id text`;
        await sql`UPDATE admin_audit_logs SET target_id = resource_id`;
        console.log("     ✅ 已添加 target_id 列");
      }
    }

    console.log("\n✅ Schema 修复完成！\n");

    // 验证修复结果
    const updatedColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'admin_audit_logs'
      ORDER BY ordinal_position
    `;

    console.log("📋 修复后的列:");
    updatedColumns.forEach((c) => {
      console.log(`  - ${c.column_name}: ${c.data_type}`);
    });
  } catch (error) {
    console.error("❌ 修复失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixAuditLogSchema();
