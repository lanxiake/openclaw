CREATE TABLE "device_pairing_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"device_id" text NOT NULL,
	"public_key" text NOT NULL,
	"user_id" text,
	"display_name" text,
	"platform" text,
	"client_id" text,
	"client_mode" text,
	"requested_role" text,
	"requested_scopes" jsonb,
	"remote_ip" text,
	"silent" boolean DEFAULT false,
	"is_repair" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "device_pairing_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"public_key" text NOT NULL,
	"user_id" text,
	"display_name" text,
	"platform" text,
	"client_id" text,
	"client_mode" text,
	"role" text,
	"roles" jsonb,
	"scopes" jsonb,
	"tokens" jsonb,
	"fingerprint" text,
	"remote_ip" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_memories" ALTER COLUMN "embedding" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "device_pairing_requests" ADD CONSTRAINT "device_pairing_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_pairing_requests_user_id_idx" ON "device_pairing_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_pairing_requests_status_idx" ON "device_pairing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_pairing_requests_expires_at_idx" ON "device_pairing_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "device_pairing_requests_device_id_idx" ON "device_pairing_requests" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_device_id_unique_idx" ON "devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "devices_is_active_idx" ON "devices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "devices_created_at_idx" ON "devices" USING btree ("created_at");