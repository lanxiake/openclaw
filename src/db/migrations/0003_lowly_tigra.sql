CREATE TABLE "usage_quotas" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quota_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"limit_value" integer NOT NULL,
	"used_value" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_assistant_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"personality" jsonb,
	"preferences" jsonb,
	"model_config" jsonb,
	"device_permissions" jsonb,
	"system_prompt" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_custom_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text DEFAULT '1.0.0',
	"code" text,
	"package_file_id" text,
	"manifest" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"test_results" jsonb,
	"synced_devices" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"store_item_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assistant_configs" ADD CONSTRAINT "user_assistant_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_custom_skills" ADD CONSTRAINT "user_custom_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_custom_skills" ADD CONSTRAINT "user_custom_skills_package_file_id_user_files_id_fk" FOREIGN KEY ("package_file_id") REFERENCES "public"."user_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_custom_skills" ADD CONSTRAINT "user_custom_skills_store_item_id_skill_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."skill_store_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_quotas_user_type_period_idx" ON "usage_quotas" USING btree ("user_id","quota_type","period_start");--> statement-breakpoint
CREATE INDEX "usage_quotas_user_id_idx" ON "usage_quotas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_quotas_period_end_idx" ON "usage_quotas" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "user_assistant_configs_user_id_idx" ON "user_assistant_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_assistant_configs_default_idx" ON "user_assistant_configs" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE INDEX "user_custom_skills_user_id_idx" ON "user_custom_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_custom_skills_status_idx" ON "user_custom_skills" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_custom_skills_user_name_idx" ON "user_custom_skills" USING btree ("user_id","name");