-- ============================================================
-- Memory System 初始化脚本
--
-- 用途：清理旧测试数据 + 创建缺失表 + 重置记忆模板种子数据
-- 执行方式：psql $DATABASE_URL -f scripts/memory-system-init.sql
-- ============================================================

BEGIN;

-- ============================================================
-- Part 1: 清理记忆系统相关测试数据
-- ============================================================

-- 1.1 清空 profile memory 表（用户画像数据）
TRUNCATE TABLE user_profiles CASCADE;
TRUNCATE TABLE user_facts CASCADE;
TRUNCATE TABLE user_preferences_v2 CASCADE;
TRUNCATE TABLE behavior_patterns CASCADE;

-- 1.2 清空记忆相关的 system_configs 种子数据（Gateway 启动时会重新 seed）
DELETE FROM system_configs WHERE "group" = 'memory';

-- 1.3 清空旧的 user_memories 表数据（如果有）
TRUNCATE TABLE user_memories CASCADE;

-- ============================================================
-- Part 2: 创建缺失的表（来自 migration 0017_magenta_scream.sql）
-- ============================================================

-- 2.1 创建 memory_audit_logs 表
CREATE TABLE IF NOT EXISTS "memory_audit_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "action" text NOT NULL,
    "target_id" text,
    "source" text NOT NULL,
    "session_id" text,
    "agent_id" text,
    "admin_id" text,
    "details" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2.2 创建 user_workspace_files 表
CREATE TABLE IF NOT EXISTS "user_workspace_files" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "file_name" text NOT NULL,
    "content" text NOT NULL,
    "is_customized" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_workspace_files_user_file_unique" UNIQUE("user_id","file_name")
);

-- 2.3 添加外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_workspace_files_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "user_workspace_files"
            ADD CONSTRAINT "user_workspace_files_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
            ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- 2.4 创建索引
CREATE INDEX IF NOT EXISTS "memory_audit_logs_user_id_idx"
    ON "memory_audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "memory_audit_logs_user_action_idx"
    ON "memory_audit_logs" USING btree ("user_id","action");
CREATE INDEX IF NOT EXISTS "memory_audit_logs_session_id_idx"
    ON "memory_audit_logs" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "memory_audit_logs_created_at_idx"
    ON "memory_audit_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "user_workspace_files_user_id_idx"
    ON "user_workspace_files" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_workspace_files_user_file_idx"
    ON "user_workspace_files" USING btree ("user_id","file_name");

COMMIT;

-- ============================================================
-- 验证
-- ============================================================
SELECT '=== 验证结果 ===' AS info;

SELECT 'memory_audit_logs' AS table_name,
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_audit_logs') AS exists;

SELECT 'user_workspace_files' AS table_name,
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_workspace_files') AS exists;

SELECT 'system_configs (memory)' AS check_name,
       count(*) AS count
FROM system_configs WHERE "group" = 'memory';

SELECT 'user_workspace_files' AS check_name,
       count(*) AS count
FROM user_workspace_files;
