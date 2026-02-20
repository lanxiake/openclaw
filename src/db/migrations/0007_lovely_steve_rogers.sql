CREATE TABLE "behavior_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"pattern" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"confirmed" boolean,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'explicit' NOT NULL,
	"extracted_from" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"valid_until" timestamp with time zone,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences_v2" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language" text DEFAULT 'zh-CN' NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"response_style" text DEFAULT 'detailed' NOT NULL,
	"confirm_level" text DEFAULT 'medium' NOT NULL,
	"favorite_skills" jsonb DEFAULT '[]'::jsonb,
	"disabled_skills" jsonb DEFAULT '[]'::jsonb,
	"thinking_level" text DEFAULT 'medium' NOT NULL,
	"verbose_level" text DEFAULT 'normal' NOT NULL,
	"notifications" jsonb DEFAULT '{"enabled":true,"channels":[]}'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_v2_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"nickname" text,
	"avatar_url" text,
	"bio" text,
	"language" text DEFAULT 'zh-CN',
	"timezone" text DEFAULT 'Asia/Shanghai',
	"work_role" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "behavior_patterns" ADD CONSTRAINT "behavior_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences_v2" ADD CONSTRAINT "user_preferences_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "behavior_patterns_user_id_idx" ON "behavior_patterns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "behavior_patterns_user_type_idx" ON "behavior_patterns" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_facts_user_id_idx" ON "user_facts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_facts_user_category_idx" ON "user_facts" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_facts_user_key_idx" ON "user_facts" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "user_preferences_v2_user_id_idx" ON "user_preferences_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");