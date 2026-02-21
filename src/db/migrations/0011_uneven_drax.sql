CREATE TABLE "agent_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"session_key" text NOT NULL,
	"run_id" text NOT NULL,
	"abort_reason" text NOT NULL,
	"agent_state" jsonb,
	"conversation_snapshot" jsonb,
	"metadata" jsonb,
	"resumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_checkpoints_user_id_idx" ON "agent_checkpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_checkpoints_conversation_id_idx" ON "agent_checkpoints" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_checkpoints_session_key_idx" ON "agent_checkpoints" USING btree ("session_key");