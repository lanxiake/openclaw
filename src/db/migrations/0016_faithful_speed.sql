CREATE TABLE "llm_call_logs" (
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
	"metadata" jsonb,
	"called_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "llm_call_logs_user_called_at_idx" ON "llm_call_logs" USING btree ("user_id","called_at");--> statement-breakpoint
CREATE INDEX "llm_call_logs_provider_model_idx" ON "llm_call_logs" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "llm_call_logs_status_idx" ON "llm_call_logs" USING btree ("status","called_at");--> statement-breakpoint
CREATE INDEX "llm_call_logs_called_at_idx" ON "llm_call_logs" USING btree ("called_at");--> statement-breakpoint
CREATE INDEX "llm_call_logs_session_id_idx" ON "llm_call_logs" USING btree ("session_id");