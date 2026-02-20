CREATE TABLE "auth_profile_order" (
	"id" text PRIMARY KEY NOT NULL,
	"config_type" varchar(20) DEFAULT 'system' NOT NULL,
	"user_id" text,
	"agent_key" varchar(100) DEFAULT 'default' NOT NULL,
	"profile_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "auth_profile_order_unique" UNIQUE("config_type","user_id","agent_key")
);
--> statement-breakpoint
CREATE TABLE "auth_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"config_type" varchar(20) DEFAULT 'system' NOT NULL,
	"user_id" text,
	"profile_id" varchar(100) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"credential_mode" varchar(20) DEFAULT 'api_key' NOT NULL,
	"api_key" varchar(500),
	"token" text,
	"token_expires" timestamp with time zone,
	"oauth_credentials" jsonb,
	"email" varchar(255),
	"enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 100,
	"model_bindings" jsonb,
	"usage_stats" jsonb,
	"cooldown_config" jsonb,
	"extra_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "auth_profiles_unique" UNIQUE("config_type","user_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "auth_profile_order" ADD CONSTRAINT "auth_profile_order_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_profiles" ADD CONSTRAINT "auth_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;