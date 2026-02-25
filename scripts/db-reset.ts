/**
 * 开发环境数据库全量重置脚本
 *
 * 一键清空并还原所有数据存储到初始状态，包括：
 * - PostgreSQL: DROP SCHEMA → 重新迁移 → seed 测试数据
 * - Redis: FLUSHDB 清空当前数据库
 * - MinIO: 清空所有 bucket 内的对象
 * - Milvus: 删除并重建 collection
 * - Neo4j: 清空所有节点和关系
 *
 * 使用方式:
 *   pnpm db:reset               # 重置全部 + seed
 *   pnpm db:reset --no-seed     # 重置全部，不 seed
 *   pnpm db:reset --pg          # 仅重置 PostgreSQL
 *   pnpm db:reset --redis       # 仅重置 Redis
 *   pnpm db:reset --minio       # 仅重置 MinIO
 *   pnpm db:reset --milvus      # 仅重置 Milvus
 *   pnpm db:reset --neo4j       # 仅重置 Neo4j
 *   pnpm db:reset --force       # 跳过确认提示
 */

import { config } from "dotenv";
import { createInterface } from "node:readline";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 加载环境变量
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 重置结果记录 */
interface ResetResult {
  service: string;
  success: boolean;
  message: string;
  durationMs: number;
}

/** 命令行参数解析结果 */
interface CliOptions {
  force: boolean;
  noSeed: boolean;
  pg: boolean;
  redis: boolean;
  minio: boolean;
  milvus: boolean;
  neo4j: boolean;
  /** 是否指定了任何单独的服务 flag */
  hasServiceFilter: boolean;
}

/**
 * 解析命令行参数
 *
 * @returns 解析后的选项对象
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const pg = args.includes("--pg");
  const redis = args.includes("--redis");
  const minio = args.includes("--minio");
  const milvus = args.includes("--milvus");
  const neo4j = args.includes("--neo4j");

  return {
    force: args.includes("--force"),
    noSeed: args.includes("--no-seed"),
    pg,
    redis,
    minio,
    milvus,
    neo4j,
    hasServiceFilter: pg || redis || minio || milvus || neo4j,
  };
}

/**
 * 脱敏连接字符串中的密码
 *
 * 将 URL 中的密码部分替换为 ****
 *
 * @param url - 原始连接字符串
 * @returns 脱敏后的字符串
 */
function maskPassword(url: string): string {
  return url.replace(/:[^:@]+@/, ":****@");
}

/**
 * 打印将要重置的目标服务信息
 *
 * @param opts - 命令行选项
 */
function printTargets(opts: CliOptions): void {
  const resetAll = !opts.hasServiceFilter;

  console.log("\n========================================");
  console.log("  OpenClaw 开发环境数据库重置");
  console.log("========================================\n");

  if (resetAll || opts.pg) {
    const dbUrl = process.env["DATABASE_URL"] || "(未配置)";
    console.log(`  [PostgreSQL] ${maskPassword(dbUrl)}`);
  }
  if (resetAll || opts.redis) {
    const redisUrl = process.env["REDIS_URL"] || "(未配置)";
    console.log(`  [Redis]      ${maskPassword(redisUrl)}`);
  }
  if (resetAll || opts.minio) {
    const endpoint = process.env["MINIO_ENDPOINT"] || "localhost";
    const port = process.env["MINIO_PORT"] || "9000";
    console.log(`  [MinIO]      ${endpoint}:${port}`);
  }
  if (resetAll || opts.milvus) {
    const addr = process.env["MILVUS_ADDRESS"] || "localhost:19530";
    console.log(`  [Milvus]     ${addr}`);
  }
  if (resetAll || opts.neo4j) {
    const uri = process.env["NEO4J_URI"] || "(未配置)";
    console.log(`  [Neo4j]      ${uri}`);
  }

  console.log(`\n  Seed 数据:    ${opts.noSeed ? "否" : "是"}`);
  console.log("");
}

/**
 * 等待用户在终端输入确认
 *
 * @returns 用户是否输入了 "yes"
 */
async function confirmReset(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('  ⚠️  以上数据将被完全清除！输入 "yes" 确认: ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

// ============================================================
//  各服务的重置实现
// ============================================================

/**
 * 重置 PostgreSQL
 *
 * 执行 DROP SCHEMA public CASCADE → CREATE SCHEMA public → 运行 Drizzle 迁移
 *
 * @returns 重置结果
 */
async function resetPostgres(): Promise<ResetResult> {
  const start = Date.now();
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    return {
      service: "PostgreSQL",
      success: false,
      message: "DATABASE_URL 未配置",
      durationMs: Date.now() - start,
    };
  }

  // 使用单连接执行 DDL 操作
  const sql = postgres(connectionString, { max: 1 });

  try {
    // === 预检: 在执行破坏性操作前验证所有 extension 可用 ===
    const requiredExtensions = [{ name: "uuid-ossp" }, { name: "pg_trgm" }, { name: "btree_gin" }];

    console.log("  [PostgreSQL] 正在预检 extensions...");
    const unavailable: string[] = [];
    for (const ext of requiredExtensions) {
      const rows = await sql`
        SELECT count(*)::int AS cnt
        FROM pg_available_extensions
        WHERE name = ${ext.name}
      `;
      if (rows[0].cnt === 0) {
        unavailable.push(ext.name);
        console.warn(`  [PostgreSQL]   ! ${ext.name}: 不可用`);
      } else {
        console.log(`  [PostgreSQL]   + ${ext.name}: 可用`);
      }
    }

    if (unavailable.length > 0) {
      throw new Error(`关键 extension 不可用: ${unavailable.join(", ")}`);
    }

    // === 预检通过，开始执行破坏性操作 ===
    console.log("  [PostgreSQL] 正在清除所有表...");

    // 删除 public schema 及其所有对象，然后重建
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;

    // 删除 drizzle 迁移追踪 schema，确保迁移从零开始执行
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

    // 重新创建 extensions
    console.log("  [PostgreSQL] 正在恢复 extensions...");
    for (const ext of requiredExtensions) {
      await sql`CREATE EXTENSION IF NOT EXISTS ${sql(ext.name)}`;
    }
    console.log("  [PostgreSQL] Schema 已清除，extensions 已恢复");

    // 运行 Drizzle 迁移重建所有表
    console.log("  [PostgreSQL] 正在运行迁移...");
    const db = drizzle(sql);
    await migrate(db, {
      migrationsFolder: join(__dirname, "../src/db/migrations"),
    });
    console.log("  [PostgreSQL] 迁移完成");

    return {
      service: "PostgreSQL",
      success: true,
      message: "Schema 清除 + 迁移完成",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [PostgreSQL] 重置失败: ${msg}`);
    return {
      service: "PostgreSQL",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  } finally {
    await sql.end();
  }
}

/**
 * 重置 Redis
 *
 * 执行 FLUSHDB 清空当前数据库（不影响其他 db 索引）
 *
 * @returns 重置结果
 */
async function resetRedis(): Promise<ResetResult> {
  const start = Date.now();
  const redisUrl = process.env["REDIS_URL"];

  if (!redisUrl) {
    return {
      service: "Redis",
      success: false,
      message: "REDIS_URL 未配置",
      durationMs: Date.now() - start,
    };
  }

  console.log("  [Redis]      正在清空数据库...");

  let closeRedis: (() => Promise<void>) | null = null;

  try {
    // 动态导入避免在未安装时报错
    const redisModule = await import("../src/infrastructure/redis/connection.js");
    closeRedis = redisModule.closeRedisConnection;
    const redis = redisModule.getRedis();

    // FLUSHDB 只清除当前 db，比 FLUSHALL 更安全
    await redis.flushdb();
    console.log("  [Redis]      数据已清空");

    return {
      service: "Redis",
      success: true,
      message: "FLUSHDB 完成",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [Redis]      重置失败: ${msg}`);
    return {
      service: "Redis",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  } finally {
    if (closeRedis) {
      try {
        await closeRedis();
      } catch {
        // 忽略关闭时的错误
      }
    }
  }
}

/**
 * 重置 MinIO
 *
 * 遍历所有预定义 bucket，删除其中全部对象。保留 bucket 结构。
 *
 * @returns 重置结果
 */
async function resetMinio(): Promise<ResetResult> {
  const start = Date.now();
  const endpoint = process.env["MINIO_ENDPOINT"];

  if (!endpoint) {
    return {
      service: "MinIO",
      success: false,
      message: "MINIO_ENDPOINT 未配置",
      durationMs: Date.now() - start,
    };
  }

  console.log("  [MinIO]      正在清空所有 bucket...");

  try {
    const { getMinio, BUCKETS } = await import("../src/infrastructure/minio/connection.js");
    const client = getMinio();

    let totalDeleted = 0;

    for (const bucketName of Object.values(BUCKETS)) {
      // 检查 bucket 是否存在
      const exists = await client.bucketExists(bucketName);
      if (!exists) {
        console.log(`  [MinIO]      Bucket '${bucketName}' 不存在，跳过`);
        continue;
      }

      // 收集 bucket 中所有对象名
      const objectNames: string[] = [];
      const objectStream = client.listObjects(bucketName, "", true);

      await new Promise<void>((resolve, reject) => {
        objectStream.on("data", (obj) => {
          if (obj.name) {
            objectNames.push(obj.name);
          }
        });
        objectStream.on("end", resolve);
        objectStream.on("error", reject);
      });

      if (objectNames.length === 0) {
        console.log(`  [MinIO]      Bucket '${bucketName}' 已为空`);
        continue;
      }

      // 批量删除对象
      await client.removeObjects(bucketName, objectNames);
      totalDeleted += objectNames.length;
      console.log(`  [MinIO]      Bucket '${bucketName}': 已删除 ${objectNames.length} 个对象`);
    }

    console.log(`  [MinIO]      清空完成，共删除 ${totalDeleted} 个对象`);

    return {
      service: "MinIO",
      success: true,
      message: `清空完成，共删除 ${totalDeleted} 个对象`,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [MinIO]      重置失败: ${msg}`);
    return {
      service: "MinIO",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 重置 Milvus 向量数据库
 *
 * 删除 openclaw_memories collection 并重新创建（含 HNSW 索引）
 * Milvus SDK 在连接失败时可能抛出 unhandled rejection，这里通过临时拦截来防止进程崩溃。
 *
 * @returns 重置结果
 */
async function resetMilvus(): Promise<ResetResult> {
  const start = Date.now();
  const address = process.env["MILVUS_ADDRESS"];

  if (!address) {
    return {
      service: "Milvus",
      success: false,
      message: "MILVUS_ADDRESS 未配置",
      durationMs: Date.now() - start,
    };
  }

  console.log("  [Milvus]     正在重置 collection...");

  // 临时拦截 unhandled rejection，防止 gRPC 连接失败导致进程崩溃
  let grpcError: Error | null = null;
  const rejectionHandler = (error: unknown) => {
    grpcError = error instanceof Error ? error : new Error(String(error));
  };
  process.on("unhandledRejection", rejectionHandler);

  try {
    const { dropCollection, ensureCollection } =
      await import("../src/infrastructure/milvus/vector-store.js");
    const { closeMilvusConnection } = await import("../src/infrastructure/milvus/connection.js");

    // 先删除现有 collection（如果存在）
    try {
      await dropCollection();
      console.log("  [Milvus]     Collection 已删除");
    } catch {
      // collection 不存在或连接失败时忽略
      console.log("  [Milvus]     Collection 不存在或连接失败，跳过删除");
    }

    // 检查是否有 gRPC 级别的连接错误
    if (grpcError) {
      throw grpcError;
    }

    // 重新创建 collection + 索引 + 加载
    await ensureCollection();
    console.log("  [Milvus]     Collection 已重建");

    await closeMilvusConnection();

    return {
      service: "Milvus",
      success: true,
      message: "Collection 删除 + 重建完成",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [Milvus]     重置失败: ${msg}`);

    // 尝试关闭连接
    try {
      const { closeMilvusConnection } = await import("../src/infrastructure/milvus/connection.js");
      await closeMilvusConnection();
    } catch {
      // 忽略关闭时的错误
    }

    return {
      service: "Milvus",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  } finally {
    process.removeListener("unhandledRejection", rejectionHandler);
  }
}

/**
 * 重置 Neo4j 图数据库
 *
 * 执行 MATCH (n) DETACH DELETE n 清除所有节点和关系
 *
 * @returns 重置结果
 */
async function resetNeo4j(): Promise<ResetResult> {
  const start = Date.now();
  const uri = process.env["NEO4J_URI"];
  const user = process.env["NEO4J_USER"];
  const password = process.env["NEO4J_PASSWORD"];

  if (!uri || !user || !password) {
    return {
      service: "Neo4j",
      success: false,
      message: "NEO4J_URI/USER/PASSWORD 未完整配置",
      durationMs: Date.now() - start,
    };
  }

  console.log("  [Neo4j]      正在清空图数据库...");

  try {
    // 动态导入 neo4j-driver
    const neo4j = await import("neo4j-driver");
    const driver = neo4j.default.driver(uri, neo4j.default.auth.basic(user, password));

    try {
      const session = driver.session();
      try {
        // 单次删除所有节点和关系（仅适用于开发环境小数据量场景）
        const deleteResult = await session.run(
          "MATCH (n) DETACH DELETE n RETURN count(n) AS deleted",
        );
        const deletedCount = deleteResult.records[0]?.get("deleted")?.toNumber() ?? 0;
        console.log(`  [Neo4j]      已删除 ${deletedCount} 个节点（含关系）`);

        // 删除所有约束（使用反引号转义标识符）
        const constraints = await session.run("SHOW CONSTRAINTS");
        for (const record of constraints.records) {
          const constraintName = record.get("name");
          if (constraintName) {
            await session.run(`DROP CONSTRAINT \`${constraintName}\` IF EXISTS`);
          }
        }
        console.log(`  [Neo4j]      已清除 ${constraints.records.length} 个约束`);

        // 删除所有用户索引（跳过系统内置 LOOKUP 索引）
        const indexes = await session.run("SHOW INDEXES");
        for (const record of indexes.records) {
          const indexName = record.get("name");
          const indexType = record.get("type");
          if (indexName && indexType !== "LOOKUP") {
            await session.run(`DROP INDEX \`${indexName}\` IF EXISTS`);
          }
        }
        console.log("  [Neo4j]      索引已清除");
      } finally {
        await session.close();
      }
    } finally {
      await driver.close();
    }

    return {
      service: "Neo4j",
      success: true,
      message: "节点、关系、约束、索引已清除",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [Neo4j]      重置失败: ${msg}`);
    return {
      service: "Neo4j",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 执行 seed 数据填充
 *
 * 复用 seed-dev.ts 中的 runSeed() 函数。
 * 由于 PG 重置后旧连接已失效，这里先 reset 单例再获取新连接。
 *
 * @returns 重置结果
 */
async function seedData(): Promise<ResetResult> {
  const start = Date.now();

  console.log("\n  [Seed]       正在创建测试数据...");

  try {
    const { resetConnection, getDatabase, closeConnection } =
      await import("../src/db/connection.js");
    const { runSeed } = await import("./seed-dev.js");

    // 重置单例连接，确保拿到新的数据库连接
    await resetConnection();
    const db = getDatabase();
    await runSeed(db);

    return {
      service: "Seed",
      success: true,
      message: "测试数据创建完成",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [Seed]       填充失败: ${msg}`);
    return {
      service: "Seed",
      success: false,
      message: msg,
      durationMs: Date.now() - start,
    };
  } finally {
    try {
      const { closeConnection } = await import("../src/db/connection.js");
      await closeConnection();
    } catch {
      // 忽略关闭时的错误
    }
  }
}

/**
 * 打印重置结果摘要表
 *
 * @param results - 各服务的重置结果
 */
function printSummary(results: ResetResult[]): void {
  console.log("\n========================================");
  console.log("  重置结果摘要");
  console.log("========================================\n");

  const maxServiceLen = results.length > 0 ? Math.max(...results.map((r) => r.service.length)) : 0;

  for (const r of results) {
    const status = r.success ? "OK" : "FAIL";
    const icon = r.success ? "✓" : "✗";
    const servicePad = r.service.padEnd(maxServiceLen);
    const durationStr = `${r.durationMs}ms`;
    console.log(`  ${icon} [${status}] ${servicePad}  ${durationStr.padStart(8)}  ${r.message}`);
  }

  const allSuccess = results.every((r) => r.success);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log("");
  if (allSuccess) {
    console.log(`  全部完成 (总耗时 ${totalMs}ms)`);
  } else {
    const failCount = results.filter((r) => !r.success).length;
    console.log(`  ${failCount} 项失败 (总耗时 ${totalMs}ms)`);
  }
  console.log("");
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const opts = parseArgs();
  const resetAll = !opts.hasServiceFilter;

  // 1. 打印目标信息
  printTargets(opts);

  // 2. 安全确认
  if (!opts.force) {
    const confirmed = await confirmReset();
    if (!confirmed) {
      console.log("\n  已取消。\n");
      process.exit(0);
    }
  }

  console.log("\n  开始重置...\n");

  const results: ResetResult[] = [];

  // 3. 按顺序执行各服务重置
  if (resetAll || opts.pg) {
    results.push(await resetPostgres());
  }
  if (resetAll || opts.redis) {
    results.push(await resetRedis());
  }
  if (resetAll || opts.minio) {
    results.push(await resetMinio());
  }
  if (resetAll || opts.milvus) {
    results.push(await resetMilvus());
  }
  if (resetAll || opts.neo4j) {
    results.push(await resetNeo4j());
  }

  // 4. Seed 数据（仅在 PG 重置成功时执行）
  const pgResult = results.find((r) => r.service === "PostgreSQL");
  const pgResetOk = pgResult?.success ?? false;

  if (!opts.noSeed && (resetAll || opts.pg) && pgResetOk) {
    results.push(await seedData());
  } else if (!opts.noSeed && opts.pg && !pgResetOk) {
    console.log("\n  [Seed]       PostgreSQL 重置失败，跳过 seed");
  }

  // 5. 打印摘要
  printSummary(results);

  // 按结果退出
  const allSuccess = results.every((r) => r.success);
  process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
