/**
 * 将 migration 0009 标记为已执行（跳过）
 *
 * 因远程数据库无 pgvector 扩展，embedding 列保持 jsonb 类型。
 */

import { config } from "dotenv";
config();

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  const tag = "0009_oval_black_bolt";
  const when = 1771663844100;
  const sqlFilePath = join(__dirname, "../src/db/migrations", tag + ".sql");
  const content = readFileSync(sqlFilePath, "utf-8");
  const hash = createHash("sha256").update(content).digest("hex");

  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${when})
  `;
  console.log(
    "Skipped migration 0009 (pgvector not available), marked as applied:",
    hash.slice(0, 16) + "...",
  );

  await sql.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
