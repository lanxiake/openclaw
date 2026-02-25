-- 补充 skill_store_items 表缺失的列
-- 迁移 0010_skill_system_v1.sql 未注册到 journal，导致从零全量迁移时不会执行
-- 使用 IF NOT EXISTS 确保幂等

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "source_type" text DEFAULT 'user' NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'package_storage_key'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "package_storage_key" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'package_hash'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "package_hash" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'package_size'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "package_size" integer;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'created_by_admin_id'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "created_by_admin_id" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_store_items' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE "skill_store_items" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'skill_store_items_created_by_admin_id_admins_id_fk'
  ) THEN
    ALTER TABLE "skill_store_items" ADD CONSTRAINT "skill_store_items_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_store_items_source_type_idx" ON "skill_store_items" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_store_items_is_system_idx" ON "skill_store_items" USING btree ("is_system");
