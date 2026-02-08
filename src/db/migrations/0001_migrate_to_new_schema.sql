-- 迁移脚本：从旧schema升级到新schema
-- 执行前请先备份数据库！

-- ============================================
-- 1. users 表迁移
-- ============================================

-- 添加新列
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wechat_open_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wechat_union_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_backup_codes" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- 迁移数据：将 status='active' 映射到 is_active=true
UPDATE "users" SET "is_active" = ("status" = 'active') WHERE "is_active" IS NULL;

-- 删除旧列（谨慎操作！）
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_hash";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "status";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at";

-- 创建新索引
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users" ("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_wechat_openid_unique_idx" ON "users" ("wechat_open_id") WHERE "wechat_open_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users" ("is_active");

-- 删除旧索引
DROP INDEX IF EXISTS "idx_users_phone_hash";
DROP INDEX IF EXISTS "idx_users_status";

-- ============================================
-- 2. user_devices 表迁移
-- ============================================

-- 添加新列
ALTER TABLE "user_devices" ADD COLUMN IF NOT EXISTS "alias" text;
ALTER TABLE "user_devices" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_devices" ADD COLUMN IF NOT EXISTS "linked_at" timestamp with time zone DEFAULT now() NOT NULL;

-- 迁移数据：将 device_name 映射到 alias
UPDATE "user_devices" SET "alias" = "device_name" WHERE "alias" IS NULL;
UPDATE "user_devices" SET "linked_at" = "created_at" WHERE "linked_at" IS NULL;

-- 删除旧列（谨慎操作！）
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "device_name";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "device_type";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "platform";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "os_version";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "app_version";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "push_token";
-- ALTER TABLE "user_devices" DROP COLUMN IF EXISTS "is_active";

-- 创建新索引
CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_device_unique_idx" ON "user_devices" ("user_id", "device_id");
CREATE INDEX IF NOT EXISTS "user_devices_device_id_idx" ON "user_devices" ("device_id");

-- ============================================
-- 3. user_sessions 表迁移
-- ============================================

-- 添加新列
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "revoked" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "last_refreshed_at" timestamp with time zone;

-- 迁移数据：将 revoked_at 映射到 revoked
UPDATE "user_sessions" SET "revoked" = ("revoked_at" IS NOT NULL) WHERE "revoked" IS NULL;
UPDATE "user_sessions" SET "last_refreshed_at" = "last_used_at" WHERE "last_refreshed_at" IS NULL;

-- 删除旧列（谨慎操作！）
-- ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "revoked_at";
-- ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "last_used_at";

-- 创建新索引
CREATE INDEX IF NOT EXISTS "user_sessions_refresh_token_hash_idx" ON "user_sessions" ("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions" ("expires_at");

-- ============================================
-- 4. login_attempts 表迁移
-- ============================================

-- 添加新列
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "identifier" text;
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "identifier_type" text;
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "attempted_at" timestamp with time zone DEFAULT now() NOT NULL;

-- 迁移数据：将 phone_hash 映射到 identifier
UPDATE "login_attempts" SET "identifier" = "phone_hash" WHERE "identifier" IS NULL;
UPDATE "login_attempts" SET "identifier_type" = 'phone' WHERE "identifier_type" IS NULL;
UPDATE "login_attempts" SET "attempted_at" = "created_at" WHERE "attempted_at" IS NULL;

-- 删除旧列（谨慎操作！）
-- ALTER TABLE "login_attempts" DROP COLUMN IF EXISTS "phone_hash";

-- 创建新索引
CREATE INDEX IF NOT EXISTS "login_attempts_identifier_ip_idx" ON "login_attempts" ("identifier", "ip_address");
CREATE INDEX IF NOT EXISTS "login_attempts_attempted_at_idx" ON "login_attempts" ("attempted_at");
CREATE INDEX IF NOT EXISTS "login_attempts_ip_address_idx" ON "login_attempts" ("ip_address");

-- 删除旧索引
DROP INDEX IF EXISTS "idx_login_attempts_phone_hash";

-- ============================================
-- 5. verification_codes 表迁移
-- ============================================

-- 添加新列
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "target" text;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "target_type" text;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "purpose" text;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "used" boolean DEFAULT false NOT NULL;

-- 迁移数据：将 phone_hash 映射到 target，code_hash 映射到 code，type 映射到 purpose
UPDATE "verification_codes" SET "target" = "phone_hash" WHERE "target" IS NULL;
UPDATE "verification_codes" SET "target_type" = 'phone' WHERE "target_type" IS NULL;
UPDATE "verification_codes" SET "code" = "code_hash" WHERE "code" IS NULL;
UPDATE "verification_codes" SET "purpose" = "type" WHERE "purpose" IS NULL;
UPDATE "verification_codes" SET "used" = ("verified_at" IS NOT NULL) WHERE "used" IS NULL;

-- 删除旧列（谨慎操作！）
-- ALTER TABLE "verification_codes" DROP COLUMN IF EXISTS "phone_hash";
-- ALTER TABLE "verification_codes" DROP COLUMN IF EXISTS "code_hash";
-- ALTER TABLE "verification_codes" DROP COLUMN IF EXISTS "type";
-- ALTER TABLE "verification_codes" DROP COLUMN IF EXISTS "verified_at";

-- 创建新索引
CREATE INDEX IF NOT EXISTS "verification_codes_target_purpose_idx" ON "verification_codes" ("target", "purpose");
CREATE INDEX IF NOT EXISTS "verification_codes_expires_at_idx" ON "verification_codes" ("expires_at");

-- ============================================
-- 完成
-- ============================================
-- 迁移完成！请验证数据完整性后再删除旧列。
