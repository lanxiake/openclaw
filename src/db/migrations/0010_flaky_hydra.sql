CREATE TABLE "agent_todos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"session_key" text NOT NULL,
	"run_id" text NOT NULL,
	"items" jsonb NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_todos" ADD CONSTRAINT "agent_todos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_todos" ADD CONSTRAINT "agent_todos_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_todos_session_run_idx" ON "agent_todos" USING btree ("session_key","run_id");--> statement-breakpoint
CREATE INDEX "agent_todos_user_id_idx" ON "agent_todos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_todos_conversation_id_idx" ON "agent_todos" USING btree ("conversation_id");
