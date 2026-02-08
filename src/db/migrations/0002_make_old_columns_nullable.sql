-- 补充迁移脚本：将旧列改为可空
-- 这样新代码可以正常工作，同时保留旧数据

-- ============================================
-- 1. users 表 - 将旧列改为可空
-- ============================================
ALTER TABLE "users" ALTER COLUMN "phone_hash" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;

-- ============================================
-- 2. verification_codes 表 - 将旧列改为可空
-- ============================================
ALTER TABLE "verification_codes" ALTER COLUMN "phone_hash" DROP NOT NULL;
ALTER TABLE "verification_codes" ALTER COLUMN "code_hash" DROP NOT NULL;
ALTER TABLE "verification_codes" ALTER COLUMN "type" DROP NOT NULL;

-- ============================================
-- 3. login_attempts 表 - 将旧列改为可空
-- ============================================
ALTER TABLE "login_attempts" ALTER COLUMN "phone_hash" DROP NOT NULL;

-- ============================================
-- 完成
-- ============================================
-- 旧列已改为可空，新代码可以正常工作
