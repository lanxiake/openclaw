/**
 * 临时脚本：将已通过 db:push 应用的迁移标记为已执行
 *
 * 数据库表已存在但 __drizzle_migrations 为空，
 * 需要插入 0000-0008 的迁移记录，让 db:migrate 只执行 0009。
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

  const entries = [
    { tag: "0000_wandering_the_spike", when: 1770558535857 },
    { tag: "0001_lumpy_killmonger", when: 1770913884677 },
    { tag: "0002_young_sabretooth", when: 1770917524515 },
    { tag: "0003_lowly_tigra", when: 1770918332541 },
    { tag: "0004_dazzling_zombie", when: 1771213272774 },
    { tag: "0005_bumpy_odin", when: 1771329294348 },
    { tag: "0006_strange_shockwave", when: 1771506001882 },
    { tag: "0007_lovely_steve_rogers", when: 1771506086473 },
    { tag: "0008_complex_hardball", when: 1771608498284 },
  ];

  const migrationsDir = join(__dirname, "../src/db/migrations");

  for (const entry of entries) {
    const sqlFilePath = join(migrationsDir, entry.tag + ".sql");
    const content = readFileSync(sqlFilePath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log("Inserted:", entry.tag, "->", hash.slice(0, 16) + "...");
  }

  console.log("Done! Inserted", entries.length, "migration records");
  await sql.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
