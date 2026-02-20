-- 完整的 Schema 差异修复迁移脚本
-- 修复所有代码定义与生产数据库之间的差异

-- ============================================
-- 1. 修复 admins 表的数据类型差异
-- ============================================

-- 将 failed_login_attempts 从 text 转换为 integer
-- 先将现有的文本值转换为整数，无效值设为 0
ALTER TABLE "admins"
  ALTER COLUMN "failed_login_attempts"
  TYPE integer
  USING CASE
    WHEN "failed_login_attempts" ~ '^\d+$' THEN "failed_login_attempts"::integer
    ELSE 0
  END;

-- 确保默认值为 0
ALTER TABLE "admins"
  ALTER COLUMN "failed_login_attempts"
  SET DEFAULT 0;

-- ============================================
-- 2. 修复 payment_orders 表缺失的 plan_id 列
-- ============================================

-- 添加 plan_id 列（允许 NULL，因为不是所有订单都关联套餐）
ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "plan_id" text;

-- 添加外键约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_orders_plan_id_plans_id_fk'
  ) THEN
    ALTER TABLE "payment_orders"
      ADD CONSTRAINT "payment_orders_plan_id_plans_id_fk"
      FOREIGN KEY ("plan_id")
      REFERENCES "plans"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS "payment_orders_plan_id_idx"
  ON "payment_orders" ("plan_id");

-- ============================================
-- 3. 修复 user_sessions 表缺失的 device_id 列
-- ============================================

-- 添加 device_id 列（允许 NULL，因为旧会话可能没有设备信息）
ALTER TABLE "user_sessions"
  ADD COLUMN IF NOT EXISTS "device_id" text;

-- 添加外键约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_sessions_device_id_user_devices_id_fk'
  ) THEN
    ALTER TABLE "user_sessions"
      ADD CONSTRAINT "user_sessions_device_id_user_devices_id_fk"
      FOREIGN KEY ("device_id")
      REFERENCES "user_devices"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS "user_sessions_device_id_idx"
  ON "user_sessions" ("device_id");

-- ============================================
-- 4. 修复 export_logs 表的数据类型差异
-- ============================================

-- 将 file_size 从 text 转换为 integer（字节数）
-- 先添加新列
ALTER TABLE "export_logs"
  ADD COLUMN IF NOT EXISTS "file_size_bytes" integer;

-- 迁移数据：尝试将文本转换为整数
UPDATE "export_logs"
SET "file_size_bytes" = CASE
  WHEN "file_size" ~ '^\d+$' THEN "file_size"::integer
  ELSE NULL
END
WHERE "file_size_bytes" IS NULL;

-- 删除旧列
ALTER TABLE "export_logs"
  DROP COLUMN IF EXISTS "file_size";

-- 重命名新列
ALTER TABLE "export_logs"
  RENAME COLUMN "file_size_bytes" TO "file_size";

-- 将 download_count 从 text 转换为 integer
ALTER TABLE "export_logs"
  ALTER COLUMN "download_count"
  TYPE integer
  USING CASE
    WHEN "download_count" ~ '^\d+$' THEN "download_count"::integer
    ELSE 0
  END;

-- 确保默认值为 0
ALTER TABLE "export_logs"
  ALTER COLUMN "download_count"
  SET DEFAULT 0;

-- ============================================
-- 5. 修复 verification_codes 表的数据类型差异
-- ============================================

-- 将 attempts 从 text 转换为 integer
ALTER TABLE "verification_codes"
  ALTER COLUMN "attempts"
  TYPE integer
  USING CASE
    WHEN "attempts" ~ '^\d+$' THEN "attempts"::integer
    ELSE 0
  END;

-- 确保默认值为 0
ALTER TABLE "verification_codes"
  ALTER COLUMN "attempts"
  SET DEFAULT 0;

-- ============================================
-- 6. 确保所有必要的索引都已创建
-- ============================================

-- admins 表索引（如果不存在则创建）
CREATE INDEX IF NOT EXISTS "idx_admins_locked_until"
  ON "admins" ("locked_until");

CREATE INDEX IF NOT EXISTS "idx_admins_status"
  ON "admins" ("status");

-- admin_login_attempts 表索引
CREATE INDEX IF NOT EXISTS "admin_login_attempts_username_ip_idx"
  ON "admin_login_attempts" ("username", "ip_address");

CREATE INDEX IF NOT EXISTS "admin_login_attempts_attempted_at_idx"
  ON "admin_login_attempts" ("attempted_at");

CREATE INDEX IF NOT EXISTS "admin_login_attempts_ip_address_idx"
  ON "admin_login_attempts" ("ip_address");

-- ============================================
-- 迁移完成
-- ============================================

-- 验证关键表结构
DO $$
DECLARE
  v_count integer;
BEGIN
  -- 验证 admins.failed_login_attempts 是 integer 类型
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'admins'
    AND column_name = 'failed_login_attempts'
    AND data_type = 'integer';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'admins.failed_login_attempts 类型转换失败';
  END IF;

  -- 验证 payment_orders.plan_id 列存在
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'payment_orders'
    AND column_name = 'plan_id';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'payment_orders.plan_id 列创建失败';
  END IF;

  -- 验证 user_sessions.device_id 列存在
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'user_sessions'
    AND column_name = 'device_id';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'user_sessions.device_id 列创建失败';
  END IF;

  RAISE NOTICE '✓ Schema 差异修复迁移成功完成';
END $$;
