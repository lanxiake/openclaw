#!/usr/bin/env node
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgresql://localhost:5432/openclaw");

try {
  // 查询 model_providers 表的列信息
  const columns = await sql`
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'model_providers'
    ORDER BY ordinal_position
  `;

  console.log("model_providers 表结构:");
  console.table(columns);

  // 特别检查 id 字段
  const idColumn = columns.find((c) => c.column_name === "id");
  if (idColumn) {
    console.log("\nid 字段详情:");
    console.log(`  类型: ${idColumn.data_type}`);
    console.log(`  最大长度: ${idColumn.character_maximum_length || "无限制"}`);
  }
} catch (error) {
  console.error("Error:", error.message);
} finally {
  await sql.end();
}
