ALTER TABLE "llm_call_logs" ADD COLUMN "input_content" text;--> statement-breakpoint
ALTER TABLE "llm_call_logs" ADD COLUMN "output_content" text;--> statement-breakpoint
ALTER TABLE "llm_call_logs" ADD COLUMN "credits_consumed" integer;