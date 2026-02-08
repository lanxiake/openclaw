-- 补充迁移脚本：为 admins 表添加缺失的列

-- 添加 MFA 备用码列
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "mfa_backup_codes" jsonb;

-- 添加登录失败相关列
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "last_failed_login_at" timestamp with time zone;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_admins_locked_until" ON "admins" ("locked_until");
CREATE INDEX IF NOT EXISTS "idx_admins_status" ON "admins" ("status");
