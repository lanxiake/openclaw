CREATE TABLE "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text,
	"admin_username" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_name" text,
	"details" jsonb,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"ip_address" text,
	"user_agent" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"ip_address" text NOT NULL,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"user_agent" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"avatar_url" text,
	"role" text DEFAULT 'operator' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"permissions" jsonb,
	"mfa_secret" text,
	"mfa_backup_codes" jsonb,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" text DEFAULT '0' NOT NULL,
	"last_failed_login_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" text,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"device_id" text,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"details" jsonb,
	"before_state" jsonb,
	"after_state" jsonb,
	"result" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_change_history" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text NOT NULL,
	"config_key" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"change_type" text NOT NULL,
	"reason" text,
	"changed_by" text,
	"changed_by_name" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"min_amount" integer DEFAULT 0 NOT NULL,
	"max_discount" integer,
	"applicable_plans" jsonb,
	"applicable_skills" jsonb,
	"total_limit" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "export_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"export_type" text NOT NULL,
	"status" text NOT NULL,
	"format" text NOT NULL,
	"file_path" text,
	"file_size" text,
	"params" jsonb,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"download_count" text DEFAULT '0' NOT NULL,
	"last_download_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"identifier_type" text NOT NULL,
	"ip_address" text NOT NULL,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"user_agent" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"order_no" text NOT NULL,
	"order_type" text NOT NULL,
	"subscription_id" text,
	"skill_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer NOT NULL,
	"coupon_id" text,
	"payment_method" text,
	"payment_status" text NOT NULL,
	"external_payment_id" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "payment_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer NOT NULL,
	"tokens_per_month" integer NOT NULL,
	"storage_mb" integer NOT NULL,
	"max_devices" integer NOT NULL,
	"features" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "skill_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"skill_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_store_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"readme" text,
	"author_id" text,
	"author_name" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"category_id" text,
	"tags" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"subscription_level" text DEFAULT 'free' NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0 NOT NULL,
	"icon_url" text,
	"manifest_url" text,
	"package_url" text,
	"config" jsonb,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"billing_cycle" text DEFAULT 'once',
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"billing_cycle" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"canceled_at" timestamp with time zone,
	"cancel_reason" text,
	"trial_ends_at" timestamp with time zone,
	"external_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"value_type" text DEFAULT 'string' NOT NULL,
	"group" text DEFAULT 'general' NOT NULL,
	"description" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"requires_restart" boolean DEFAULT false NOT NULL,
	"default_value" jsonb,
	"validation_rules" jsonb,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"alias" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_installed_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skill_item_id" text NOT NULL,
	"installed_version" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"email" text,
	"wechat_open_id" text,
	"wechat_union_id" text,
	"password_hash" text,
	"display_name" text,
	"avatar_url" text,
	"mfa_secret" text,
	"mfa_backup_codes" jsonb,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"preferences" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"target_type" text NOT NULL,
	"code" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"attempts" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_change_history" ADD CONSTRAINT "config_change_history_config_id_system_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."system_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_change_history" ADD CONSTRAINT "config_change_history_changed_by_admins_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_reviews" ADD CONSTRAINT "skill_reviews_skill_id_skill_store_items_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_reviews" ADD CONSTRAINT "skill_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD CONSTRAINT "skill_store_items_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD CONSTRAINT "skill_store_items_category_id_skill_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."skill_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_store_items" ADD CONSTRAINT "skill_store_items_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_installed_skills" ADD CONSTRAINT "user_installed_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_installed_skills" ADD CONSTRAINT "user_installed_skills_skill_item_id_skill_store_items_id_fk" FOREIGN KEY ("skill_item_id") REFERENCES "public"."skill_store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_risk_level_idx" ON "admin_audit_logs" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_username_ip_idx" ON "admin_login_attempts" USING btree ("username","ip_address");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_attempted_at_idx" ON "admin_login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_ip_address_idx" ON "admin_login_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_refresh_token_hash_idx" ON "admin_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admins_username_unique_idx" ON "admins" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_unique_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admins_role_idx" ON "admins" USING btree ("role");--> statement-breakpoint
CREATE INDEX "admins_status_idx" ON "admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_category_idx" ON "audit_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "audit_logs_risk_level_idx" ON "audit_logs" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_ip_address_idx" ON "audit_logs" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "config_change_history_config_id_idx" ON "config_change_history" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "config_change_history_config_key_idx" ON "config_change_history" USING btree ("config_key");--> statement-breakpoint
CREATE INDEX "config_change_history_changed_by_idx" ON "config_change_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "config_change_history_changed_at_idx" ON "config_change_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "config_change_history_change_type_idx" ON "config_change_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "coupon_codes_is_active_idx" ON "coupon_codes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "coupon_codes_expires_at_idx" ON "coupon_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "export_logs_user_id_idx" ON "export_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "export_logs_status_idx" ON "export_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_logs_expires_at_idx" ON "export_logs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "login_attempts_identifier_ip_idx" ON "login_attempts" USING btree ("identifier","ip_address");--> statement-breakpoint
CREATE INDEX "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_address_idx" ON "login_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "payment_orders_user_id_idx" ON "payment_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_orders_payment_status_idx" ON "payment_orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "payment_orders_order_type_idx" ON "payment_orders" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "payment_orders_created_at_idx" ON "payment_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "plans_is_active_idx" ON "plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "plans_sort_order_idx" ON "plans" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "skill_categories_sort_order_idx" ON "skill_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "skill_categories_is_active_idx" ON "skill_categories" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_reviews_skill_user_unique_idx" ON "skill_reviews" USING btree ("skill_id","user_id");--> statement-breakpoint
CREATE INDEX "skill_reviews_skill_id_idx" ON "skill_reviews" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_reviews_user_id_idx" ON "skill_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_reviews_rating_idx" ON "skill_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "skill_store_items_status_idx" ON "skill_store_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "skill_store_items_category_id_idx" ON "skill_store_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "skill_store_items_author_id_idx" ON "skill_store_items" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "skill_store_items_is_featured_idx" ON "skill_store_items" USING btree ("is_featured","featured_order");--> statement-breakpoint
CREATE INDEX "skill_store_items_subscription_level_idx" ON "skill_store_items" USING btree ("subscription_level");--> statement-breakpoint
CREATE INDEX "skill_store_items_download_count_idx" ON "skill_store_items" USING btree ("download_count");--> statement-breakpoint
CREATE INDEX "skill_store_items_rating_avg_idx" ON "skill_store_items" USING btree ("rating_avg");--> statement-breakpoint
CREATE INDEX "skill_store_items_created_at_idx" ON "skill_store_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "skills_type_idx" ON "skills" USING btree ("type");--> statement-breakpoint
CREATE INDEX "skills_is_active_idx" ON "skills" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "system_configs_key_unique_idx" ON "system_configs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "system_configs_group_idx" ON "system_configs" USING btree ("group");--> statement-breakpoint
CREATE INDEX "system_configs_is_sensitive_idx" ON "system_configs" USING btree ("is_sensitive");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_device_unique_idx" ON "user_devices" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "user_devices_user_id_idx" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_devices_device_id_idx" ON "user_devices" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_installed_skills_user_skill_unique_idx" ON "user_installed_skills" USING btree ("user_id","skill_item_id");--> statement-breakpoint
CREATE INDEX "user_installed_skills_user_id_idx" ON "user_installed_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_installed_skills_skill_item_id_idx" ON "user_installed_skills" USING btree ("skill_item_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_refresh_token_hash_idx" ON "user_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_skills_user_skill_unique_idx" ON "user_skills" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "user_skills_user_id_idx" ON "user_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_skills_expires_at_idx" ON "user_skills" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique_idx" ON "users" USING btree ("phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_wechat_openid_unique_idx" ON "users" USING btree ("wechat_open_id") WHERE wechat_open_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "verification_codes_target_purpose_idx" ON "verification_codes" USING btree ("target","purpose");--> statement-breakpoint
CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes" USING btree ("expires_at");