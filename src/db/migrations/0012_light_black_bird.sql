CREATE TABLE "system_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"source" text NOT NULL,
	"audit_log_id" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "system_alerts_created_at_idx" ON "system_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "system_alerts_acknowledged_idx" ON "system_alerts" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "system_alerts_resolved_idx" ON "system_alerts" USING btree ("resolved");