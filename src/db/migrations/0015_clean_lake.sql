CREATE TABLE "channel_pairing_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_meta" jsonb,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	CONSTRAINT "channel_pairing_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_channel_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"channel" text NOT NULL,
	"channel_user_id" text NOT NULL,
	"display_name" text,
	"verified" boolean DEFAULT false NOT NULL,
	"bound_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "channel_pairing_requests" ADD CONSTRAINT "channel_pairing_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_bindings" ADD CONSTRAINT "user_channel_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cpr_channel_sender_idx" ON "channel_pairing_requests" USING btree ("channel","sender_id");--> statement-breakpoint
CREATE INDEX "cpr_status_idx" ON "channel_pairing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cpr_expires_at_idx" ON "channel_pairing_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ucb_channel_user_unique_idx" ON "user_channel_bindings" USING btree ("channel","channel_user_id");--> statement-breakpoint
CREATE INDEX "ucb_user_id_idx" ON "user_channel_bindings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ucb_channel_idx" ON "user_channel_bindings" USING btree ("channel");