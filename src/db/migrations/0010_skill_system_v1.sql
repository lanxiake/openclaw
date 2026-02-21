ALTER TABLE "skill_store_items" ADD COLUMN "source_type" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD COLUMN "package_storage_key" text;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD COLUMN "package_hash" text;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD COLUMN "package_size" integer;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD COLUMN "created_by_admin_id" text;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD CONSTRAINT "skill_store_items_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_store_items_source_type_idx" ON "skill_store_items" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "skill_store_items_is_system_idx" ON "skill_store_items" USING btree ("is_system");