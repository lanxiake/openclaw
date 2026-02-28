/**
 * 检测数据库连接是否正常
 *
 * 用法（在项目根目录）：
 *   pnpm db:check
 * 或：pnpm exec tsx scripts/check-db.ts
 *
 * 会读取 .env 或 apps/api-server/.env 中的 DATABASE_URL，执行 SELECT 1 与版本查询。
 *
 * 仅检查端口是否可达（不验证数据库认证）可用 PowerShell：
 *   Test-NetConnection -ComputerName 10.157.152.40 -Port 22001
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

// 加载 .env：从项目根执行时用 apps/api-server/.env，在 api-server 目录执行时用 .env
const cwd = process.cwd();
const envPath =
  process.env.ENV_PATH ??
  (existsSync(resolve(cwd, ".env")) ? resolve(cwd, ".env") : resolve(cwd, "apps/api-server/.env"));
config({ path: envPath });

const connectionString = process.env.DATABASE_URL;

async function main(): Promise<void> {
  if (!connectionString) {
    console.error("未设置 DATABASE_URL。请在 apps/api-server/.env 中配置，或设置环境变量。");
    process.exit(1);
  }

  // 隐藏密码后打印连接信息
  const safeUrl = connectionString.replace(
    /:\/\/[^:]+:[^@]+@/,
    "://***:***@",
  );
  console.log("连接目标:", safeUrl);
  console.log("");

  const sql = postgres(connectionString, { max: 1, connect_timeout: 12 });

  try {
    const start = Date.now();
    const [row] = await sql`SELECT 1 as ok, current_database() as db, version() as version`;
    const ms = Date.now() - start;

    console.log("数据库连接正常");
    console.log("  数据库:", row?.db ?? "-");
    console.log("  耗时:", `${ms} ms`);
    console.log("  版本:", (row?.version ?? "").split("\n")[0]);
    process.exit(0);
  } catch (err: unknown) {
    const e = err as Error & { code?: string; address?: string; port?: number };
    console.error("数据库连接失败:");
    console.error("  ", e.message ?? err);
    if (e.code === "CONNECT_TIMEOUT" && e.address) {
      console.error(`  地址: ${e.address}:${e.port ?? "?"}`);
      console.error("  建议: 检查网络/VPN、防火墙或改用本地数据库。");
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
