/**
 * 手动应用 auth_profiles 迁移
 */
import postgres from "postgres";
import { config } from "dotenv";

config();

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  try {
    // 创建 auth_profiles 表
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "auth_profiles" (
        "id" text PRIMARY KEY NOT NULL,
        "config_type" varchar(20) DEFAULT 'system' NOT NULL,
        "user_id" text,
        "profile_id" varchar(100) NOT NULL,
        "provider" varchar(100) NOT NULL,
        "credential_mode" varchar(20) DEFAULT 'api_key' NOT NULL,
        "api_key" varchar(500),
        "token" text,
        "token_expires" timestamp with time zone,
        "oauth_credentials" jsonb,
        "email" varchar(255),
        "enabled" boolean DEFAULT true,
        "priority" integer DEFAULT 100,
        "model_bindings" jsonb,
        "usage_stats" jsonb,
        "cooldown_config" jsonb,
        "extra_config" jsonb,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        "created_by" text,
        "updated_by" text,
        CONSTRAINT "auth_profiles_unique" UNIQUE("config_type","user_id","profile_id")
      );
    `);
    console.log("✅ auth_profiles table created");

    // 创建 auth_profile_order 表
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "auth_profile_order" (
        "id" text PRIMARY KEY NOT NULL,
        "config_type" varchar(20) DEFAULT 'system' NOT NULL,
        "user_id" text,
        "agent_key" varchar(100) DEFAULT 'default' NOT NULL,
        "profile_ids" jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        "created_by" text,
        "updated_by" text,
        CONSTRAINT "auth_profile_order_unique" UNIQUE("config_type","user_id","agent_key")
      );
    `);
    console.log("✅ auth_profile_order table created");

    // 添加外键约束
    await sql.unsafe(`
      ALTER TABLE "auth_profiles" DROP CONSTRAINT IF EXISTS "auth_profiles_user_id_users_id_fk";
      ALTER TABLE "auth_profiles" ADD CONSTRAINT "auth_profiles_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);

    await sql.unsafe(`
      ALTER TABLE "auth_profile_order" DROP CONSTRAINT IF EXISTS "auth_profile_order_user_id_users_id_fk";
      ALTER TABLE "auth_profile_order" ADD CONSTRAINT "auth_profile_order_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log("✅ Foreign key constraints added");

    // 验证表存在
    const tables = await sql`
      SELECT tablename FROM pg_tables
      WHERE tablename IN ('auth_profiles', 'auth_profile_order')
    `;
    console.log(
      "Tables found:",
      tables.map((t) => t.tablename),
    );
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
