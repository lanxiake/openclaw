CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"error_name" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"metric_type" text NOT NULL,
	"cpu_usage" numeric(5, 2),
	"memory_usage" numeric(5, 2),
	"disk_usage" numeric(5, 2),
	"active_connections" integer,
	"heap_used" bigint,
	"request_count" integer,
	"error_count" integer,
	"avg_response_time" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "system_logs_level_timestamp_idx" ON "system_logs" USING btree ("level","timestamp");--> statement-breakpoint
CREATE INDEX "system_logs_source_timestamp_idx" ON "system_logs" USING btree ("source","timestamp");--> statement-breakpoint
CREATE INDEX "system_logs_timestamp_idx" ON "system_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "system_metrics_timestamp_type_idx" ON "system_metrics" USING btree ("timestamp","metric_type");--> statement-breakpoint
CREATE INDEX "system_metrics_type_timestamp_idx" ON "system_metrics" USING btree ("metric_type","timestamp");--> statement-breakpoint
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics" USING btree ("timestamp");