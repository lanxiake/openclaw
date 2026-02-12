CREATE TABLE "user_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"storage_bucket" text NOT NULL,
	"category" text DEFAULT 'attachment',
	"source_type" text,
	"source_id" text,
	"thumbnail_key" text,
	"checksum" text,
	"metadata" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"content" text NOT NULL,
	"summary" text,
	"embedding" jsonb,
	"importance" integer DEFAULT 5 NOT NULL,
	"source_type" text,
	"source_id" text,
	"metadata" jsonb,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_files" ADD CONSTRAINT "user_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_files_user_id_idx" ON "user_files" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_files_storage_key_idx" ON "user_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "user_files_category_idx" ON "user_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_memories_user_id_idx" ON "user_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_user_type_idx" ON "user_memories" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_memories_user_category_idx" ON "user_memories" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_memories_importance_idx" ON "user_memories" USING btree ("importance");