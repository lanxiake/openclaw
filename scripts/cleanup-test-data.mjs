#!/usr/bin/env node
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgresql://localhost:5432/mtbot");

try {
  console.log("清理测试数据...\n");

  // 删除测试提供商
  const result = await sql`
    DELETE FROM model_providers
    WHERE provider_key = 'test-openai'
    RETURNING id, provider_key, provider_name
  `;

  if (result.length > 0) {
    console.log("✅ 已删除测试提供商:");
    result.forEach((r) => {
      console.log(`   - ${r.provider_key} (${r.provider_name})`);
      console.log(`     ID: ${r.id}`);
    });
  } else {
    console.log("ℹ️  没有找到测试提供商");
  }
} catch (error) {
  console.error("❌ 清理失败:", error.message);
  process.exit(1);
} finally {
  await sql.end();
}
