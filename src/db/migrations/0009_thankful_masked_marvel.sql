ALTER TABLE "agent_configs" ALTER COLUMN "primary_model" SET DEFAULT 'anthropic/claude-opus-4-5-20251101';--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "session_key" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_status" text DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "queue_order" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_session_key_idx" ON "conversations" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("conversation_id","message_status");