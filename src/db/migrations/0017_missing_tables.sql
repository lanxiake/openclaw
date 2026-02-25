-- 补充创建 llm_call_logs、memory_audit_logs、user_workspace_files 表
-- 这些表的迁移文件此前未注册到 journal，导致从零全量迁移时不会被执行

CREATE TABLE IF NOT EXISTS "llm_call_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"run_id" text,
	"channel" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"total_tokens" integer,
	"duration_ms" integer,
	"status" text NOT NULL,
	"error_message" text,
	"input_content" text,
	"output_content" text,
	"credits_consumed" integer,
	"metadata" jsonb,
	"called_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_call_logs_user_called_at_idx" ON "llm_call_logs" USING btree ("user_id","called_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_call_logs_provider_model_idx" ON "llm_call_logs" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_call_logs_status_idx" ON "llm_call_logs" USING btree ("status","called_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_call_logs_called_at_idx" ON "llm_call_logs" USING btree ("called_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_call_logs_session_id_idx" ON "llm_call_logs" USING btree ("session_id");--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "user_workspace_files" ADD CONSTRAINT "user_workspace_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_audit_logs_user_id_idx" ON "memory_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_audit_logs_user_action_idx" ON "memory_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_audit_logs_session_id_idx" ON "memory_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_audit_logs_created_at_idx" ON "memory_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_workspace_files_user_id_idx" ON "user_workspace_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_workspace_files_user_file_idx" ON "user_workspace_files" USING btree ("user_id","file_name");
