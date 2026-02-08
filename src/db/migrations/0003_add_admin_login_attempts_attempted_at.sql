-- 补充迁移脚本：为 admin_login_attempts 表添加 attempted_at 列

ALTER TABLE "admin_login_attempts" ADD COLUMN IF NOT EXISTS "attempted_at" timestamp with time zone DEFAULT now() NOT NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_admin_login_attempts_attempted_at" ON "admin_login_attempts" ("attempted_at");
CREATE INDEX IF NOT EXISTS "idx_admin_login_attempts_ip_address" ON "admin_login_attempts" ("ip_address");
CREATE INDEX IF NOT EXISTS "idx_admin_login_attempts_username" ON "admin_login_attempts" ("username");
