CREATE TABLE "agent_configs" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"config_type" varchar(20) DEFAULT 'system' NOT NULL,
	"user_id" varchar(32),
	"primary_model" varchar(100) DEFAULT 'claude-opus-4-5-20251101',
	"workspace_path" varchar(500),
	"compaction_mode" varchar(50) DEFAULT 'safeguard',
	"max_concurrent" integer DEFAULT 4,
	"subagents_max_concurrent" integer DEFAULT 8,
	"extra_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(32),
	"updated_by" varchar(32),
	CONSTRAINT "agent_configs_system_unique" UNIQUE("config_type"),
	CONSTRAINT "agent_configs_tenant_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "gateway_configs" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"config_type" varchar(20) DEFAULT 'system' NOT NULL,
	"user_id" varchar(32),
	"gateway_mode" varchar(20) DEFAULT 'local' NOT NULL,
	"gateway_port" integer DEFAULT 18789,
	"gateway_bind" varchar(50) DEFAULT 'loopback',
	"auth_mode" varchar(20) DEFAULT 'none' NOT NULL,
	"auth_token" varchar(255),
	"auth_password" varchar(255),
	"auth_allow_tailscale" boolean DEFAULT false,
	"control_ui_enabled" boolean DEFAULT true,
	"control_ui_allow_insecure_auth" boolean DEFAULT false,
	"tailscale_mode" varchar(20) DEFAULT 'off',
	"tailscale_reset_on_exit" boolean DEFAULT false,
	"extra_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(32),
	"updated_by" varchar(32),
	CONSTRAINT "gateway_configs_system_unique" UNIQUE("config_type"),
	CONSTRAINT "gateway_configs_tenant_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"config_type" varchar(20) DEFAULT 'system' NOT NULL,
	"user_id" varchar(32),
	"provider_key" varchar(100) NOT NULL,
	"provider_name" varchar(200),
	"base_url" varchar(500) NOT NULL,
	"api_key" varchar(500) NOT NULL,
	"api_type" varchar(50) DEFAULT 'openai-completions',
	"models" jsonb NOT NULL,
	"enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(32),
	"updated_by" varchar(32),
	CONSTRAINT "model_providers_unique" UNIQUE("config_type","user_id","provider_key")
);
--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_configs" ADD CONSTRAINT "gateway_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;