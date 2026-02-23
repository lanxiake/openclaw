CREATE TABLE "credit_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_consumed" integer DEFAULT 0 NOT NULL,
	"total_expired" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"original_amount" integer NOT NULL,
	"remaining_amount" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"source_id" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"batch_id" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_records" (
	"id" text PRIMARY KEY NOT NULL,
	"inviter_user_id" text NOT NULL,
	"invitee_user_id" text NOT NULL,
	"credits_awarded" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"model_name" text NOT NULL,
	"input_price" integer NOT NULL,
	"output_price" integer NOT NULL,
	"multiplier" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_pricing_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "is_first_month" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "credits_per_period" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_batch_id_credit_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."credit_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_accounts_user_id_unique_idx" ON "credit_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_batches_user_expires_idx" ON "credit_batches" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "credit_batches_user_source_idx" ON "credit_batches" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX "credit_batches_expires_remaining_idx" ON "credit_batches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_created_idx" ON "credit_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_type_idx" ON "credit_transactions" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "credit_transactions_source_idx" ON "credit_transactions" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_records_invitee_unique_idx" ON "invite_records" USING btree ("invitee_user_id");--> statement-breakpoint
CREATE INDEX "invite_records_inviter_idx" ON "invite_records" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "model_pricing_is_active_idx" ON "model_pricing" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_invite_code_unique_idx" ON "users" USING btree ("invite_code") WHERE invite_code IS NOT NULL;