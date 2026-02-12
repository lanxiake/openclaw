import { config } from "dotenv";
import postgres from "postgres";

config();

async function checkIdLengths() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("🔍 检查各表 ID 列长度...\n");

  const tables = ["users", "admins", "admin_audit_logs", "admin_sessions", "user_sessions"];

  for (const table of tables) {
    const result = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'id'
    `;

    if (result.length > 0) {
      const col = result[0];
      const length = col.character_maximum_length || "unlimited";
      console.log(`📋 ${table}.id: ${col.data_type}(${length})`);

      if (
        col.data_type === "character varying" &&
        col.character_maximum_length &&
        col.character_maximum_length < 64
      ) {
        console.log(`   ⚠️  长度不足，建议至少 64`);
      }
    }
  }

  await sql.end();
}

checkIdLengths();
