CREATE TABLE "memory_audit_logs" (
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
CREATE TABLE "user_workspace_files" (
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
CREATE INDEX "memory_audit_logs_user_id_idx" ON "memory_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_audit_logs_user_action_idx" ON "memory_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "memory_audit_logs_session_id_idx" ON "memory_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "memory_audit_logs_created_at_idx" ON "memory_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_workspace_files_user_id_idx" ON "user_workspace_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_workspace_files_user_file_idx" ON "user_workspace_files" USING btree ("user_id","file_name");