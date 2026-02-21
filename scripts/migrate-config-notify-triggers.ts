/**
 * 手动迁移脚本：创建 PostgreSQL LISTEN/NOTIFY 触发器
 *
 * 为配置表 (gateway_configs, model_providers, agent_configs,
 * auth_profiles, system_configs) 添加变更通知触发器。
 *
 * 运行方式: node --import tsx scripts/migrate-config-notify-triggers.ts
 */

import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("❌ DATABASE_URL 环境变量未设置");
  process.exit(1);
}

const sslEnabled = process.env["DATABASE_SSL"];
const ssl =
  sslEnabled === "true" || sslEnabled === "require" ? { rejectUnauthorized: false } : false;

const sql = postgres(connectionString, { ssl });

async function runMigration(): Promise<void> {
  console.log("🔧 开始创建配置变更通知触发器...\n");

  // 1. 创建通知函数
  console.log("  [1/2] 创建 notify_config_change() 函数...");
  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION notify_config_change() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify(
        'config_changed',
        json_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'id', COALESCE(NEW.id, OLD.id),
          'config_type', COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.config_type ELSE NEW.config_type END,
            'system'
          ),
          'user_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
          'ts', extract(epoch from now())
        )::text
      );
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("    ✅ 函数创建成功");

  // 2. 为每张配置表创建触发器
  const tables = [
    "gateway_configs",
    "model_providers",
    "agent_configs",
    "auth_profiles",
    "auth_profile_order",
    "system_configs",
  ];

  console.log("  [2/2] 创建表级触发器...");
  for (const table of tables) {
    const triggerName = `${table}_config_notify`;

    // 先删除旧触发器（幂等）
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table};`);

    // 对 system_configs 表特殊处理（没有 config_type 和 user_id 列）
    if (table === "system_configs") {
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION notify_system_config_change() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify(
            'config_changed',
            json_build_object(
              'table', TG_TABLE_NAME,
              'operation', TG_OP,
              'id', COALESCE(NEW.id, OLD.id),
              'config_type', 'system',
              'key', CASE WHEN TG_OP = 'DELETE' THEN OLD.key ELSE NEW.key END,
              'ts', extract(epoch from now())
            )::text
          );
          RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
      `);

      await sql.unsafe(`
        CREATE TRIGGER ${triggerName}
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION notify_system_config_change();
      `);
    } else {
      await sql.unsafe(`
        CREATE TRIGGER ${triggerName}
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION notify_config_change();
      `);
    }

    console.log(`    ✅ ${table} → ${triggerName}`);
  }

  console.log("\n✅ 所有触发器创建完成！");
  console.log("   通知频道: config_changed");
  console.log("   覆盖表:  ", tables.join(", "));
}

runMigration()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 迁移失败:", error);
    sql.end().then(() => process.exit(1));
  });
