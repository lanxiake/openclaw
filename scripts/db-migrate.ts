/**
 * 数据库迁移脚本
 *
 * 将 Schema 推送到数据库
 */

import { config } from "dotenv";
config();

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sql as sqlTemplate } from "drizzle-orm";

// Schema imports
import * as schema from "../src/db/schema/index.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log(
    "Connecting to:",
    connectionString.replace(/:[^:@]+@/, ":***@")
  );

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log("\n📦 Creating tables...\n");

  // 创建表结构 - 使用 drizzle-orm 的 SQL 模板
  // Users 表
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(32) PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      phone_hash VARCHAR(64) NOT NULL,
      display_name VARCHAR(100),
      avatar_url VARCHAR(500),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMP WITH TIME ZONE,
      deleted_at TIMESTAMP WITH TIME ZONE
    )
  `;
  console.log("✅ users table created");

  // User devices 表
  await sql`
    CREATE TABLE IF NOT EXISTS user_devices (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id),
      device_id VARCHAR(64) NOT NULL,
      device_name VARCHAR(100),
      device_type VARCHAR(20) NOT NULL,
      platform VARCHAR(50),
      os_version VARCHAR(50),
      app_version VARCHAR(20),
      push_token VARCHAR(500),
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_active_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, device_id)
    )
  `;
  console.log("✅ user_devices table created");

  // User sessions 表
  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id),
      device_id VARCHAR(32) REFERENCES user_devices(id),
      refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500)
    )
  `;
  console.log("✅ user_sessions table created");

  // Login attempts 表
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id VARCHAR(32) PRIMARY KEY,
      phone_hash VARCHAR(64) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      user_agent VARCHAR(500),
      success BOOLEAN NOT NULL,
      failure_reason VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ login_attempts table created");

  // Verification codes 表
  await sql`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id VARCHAR(32) PRIMARY KEY,
      phone_hash VARCHAR(64) NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      type VARCHAR(20) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      verified_at TIMESTAMP WITH TIME ZONE,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ verification_codes table created");

  // Plans 表
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      price_monthly INTEGER NOT NULL DEFAULT 0,
      price_yearly INTEGER NOT NULL DEFAULT 0,
      features JSONB DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ plans table created");

  // Skills 表
  await sql`
    CREATE TABLE IF NOT EXISTS skills (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      category VARCHAR(50),
      price INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ skills table created");

  // User skills 表
  await sql`
    CREATE TABLE IF NOT EXISTS user_skills (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id),
      skill_id VARCHAR(32) NOT NULL REFERENCES skills(id),
      purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(user_id, skill_id)
    )
  `;
  console.log("✅ user_skills table created");

  // Subscriptions 表
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id),
      plan_id VARCHAR(32) NOT NULL REFERENCES plans(id),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
      current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
      canceled_at TIMESTAMP WITH TIME ZONE,
      auto_renew BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ subscriptions table created");

  // Payment orders 表
  await sql`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id),
      order_no VARCHAR(64) NOT NULL UNIQUE,
      order_type VARCHAR(20) NOT NULL,
      amount INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
      payment_method VARCHAR(20),
      payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      plan_id VARCHAR(32) REFERENCES plans(id),
      skill_id VARCHAR(32) REFERENCES skills(id),
      subscription_id VARCHAR(32) REFERENCES subscriptions(id),
      coupon_id VARCHAR(32),
      discount_amount INTEGER NOT NULL DEFAULT 0,
      paid_at TIMESTAMP WITH TIME ZONE,
      refunded_at TIMESTAMP WITH TIME ZONE,
      refund_amount INTEGER,
      external_order_id VARCHAR(100),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ payment_orders table created");

  // Coupon codes 表
  await sql`
    CREATE TABLE IF NOT EXISTS coupon_codes (
      id VARCHAR(32) PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      discount_type VARCHAR(20) NOT NULL,
      discount_value INTEGER NOT NULL,
      min_amount INTEGER NOT NULL DEFAULT 0,
      max_discount INTEGER,
      applicable_plans VARCHAR(32)[],
      applicable_skills VARCHAR(32)[],
      usage_limit INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0,
      user_limit INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ coupon_codes table created");

  // Audit logs 表
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) REFERENCES users(id),
      admin_id VARCHAR(32),
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id VARCHAR(32),
      category VARCHAR(30) NOT NULL DEFAULT 'data',
      risk_level VARCHAR(10) NOT NULL DEFAULT 'low',
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ audit_logs table created");

  // Export logs 表
  await sql`
    CREATE TABLE IF NOT EXISTS export_logs (
      id VARCHAR(32) PRIMARY KEY,
      admin_id VARCHAR(32) NOT NULL,
      export_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      file_url VARCHAR(500),
      file_size INTEGER,
      record_count INTEGER,
      params JSONB DEFAULT '{}',
      error_message TEXT,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ export_logs table created");

  // Admins 表
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id VARCHAR(32) PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20),
      avatar_url VARCHAR(500),
      role VARCHAR(20) NOT NULL DEFAULT 'operator',
      permissions JSONB DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      mfa_enabled BOOLEAN NOT NULL DEFAULT false,
      mfa_secret VARCHAR(100),
      last_login_at TIMESTAMP WITH TIME ZONE,
      last_login_ip VARCHAR(45),
      password_changed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_by VARCHAR(32)
    )
  `;
  console.log("✅ admins table created");

  // Admin sessions 表
  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id VARCHAR(32) PRIMARY KEY,
      admin_id VARCHAR(32) NOT NULL REFERENCES admins(id),
      refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE
    )
  `;
  console.log("✅ admin_sessions table created");

  // Admin audit logs 表
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id VARCHAR(32) PRIMARY KEY,
      admin_id VARCHAR(32) NOT NULL REFERENCES admins(id),
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id VARCHAR(32),
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ admin_audit_logs table created");

  // Admin login attempts 表
  await sql`
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id VARCHAR(32) PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      user_agent VARCHAR(500),
      success BOOLEAN NOT NULL,
      failure_reason VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ admin_login_attempts table created");

  // 创建索引
  console.log("\n📇 Creating indexes...\n");

  await sql`CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_login_attempts_phone_hash ON login_attempts(phone_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts(ip_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_orders_order_no ON payment_orders(order_no)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at)`;

  console.log("✅ All indexes created");

  // Skill categories 表
  console.log("\n📦 Creating skill store tables...\n");

  await sql`
    CREATE TABLE IF NOT EXISTS skill_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      skill_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ skill_categories table created");

  // Skill store items 表
  await sql`
    CREATE TABLE IF NOT EXISTS skill_store_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      readme TEXT,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT,
      version TEXT NOT NULL DEFAULT '1.0.0',
      category_id TEXT REFERENCES skill_categories(id) ON DELETE SET NULL,
      tags JSONB,
      status TEXT NOT NULL DEFAULT 'pending',
      subscription_level TEXT NOT NULL DEFAULT 'free',
      download_count INTEGER NOT NULL DEFAULT 0,
      rating_avg DECIMAL(3, 2) DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      icon_url TEXT,
      manifest_url TEXT,
      package_url TEXT,
      config JSONB,
      review_note TEXT,
      reviewed_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      featured_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      published_at TIMESTAMP WITH TIME ZONE
    )
  `;
  console.log("✅ skill_store_items table created");

  // Skill reviews 表
  await sql`
    CREATE TABLE IF NOT EXISTS skill_reviews (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skill_store_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(skill_id, user_id)
    )
  `;
  console.log("✅ skill_reviews table created");

  // User installed skills 表
  await sql`
    CREATE TABLE IF NOT EXISTS user_installed_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_item_id TEXT NOT NULL REFERENCES skill_store_items(id) ON DELETE CASCADE,
      installed_version TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(user_id, skill_item_id)
    )
  `;
  console.log("✅ user_installed_skills table created");

  // 创建技能商店索引
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_categories_sort_order ON skill_categories(sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_categories_is_active ON skill_categories(is_active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_status ON skill_store_items(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_category_id ON skill_store_items(category_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_author_id ON skill_store_items(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_is_featured ON skill_store_items(is_featured, featured_order)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_subscription_level ON skill_store_items(subscription_level)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_download_count ON skill_store_items(download_count)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_rating_avg ON skill_store_items(rating_avg)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_store_items_created_at ON skill_store_items(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_reviews_skill_id ON skill_reviews(skill_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_reviews_user_id ON skill_reviews(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skill_reviews_rating ON skill_reviews(rating)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_installed_skills_user_id ON user_installed_skills(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_installed_skills_skill_item_id ON user_installed_skills(skill_item_id)`;

  console.log("✅ Skill store indexes created");

  // 系统配置表
  console.log("\n📦 Creating system config tables...\n");

  await sql`
    CREATE TABLE IF NOT EXISTS system_configs (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value JSONB NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'string',
      "group" TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      is_sensitive BOOLEAN NOT NULL DEFAULT false,
      is_readonly BOOLEAN NOT NULL DEFAULT false,
      requires_restart BOOLEAN NOT NULL DEFAULT false,
      default_value JSONB,
      validation_rules JSONB,
      updated_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ system_configs table created");

  await sql`
    CREATE TABLE IF NOT EXISTS config_change_history (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES system_configs(id) ON DELETE CASCADE,
      config_key TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      change_type TEXT NOT NULL,
      reason TEXT,
      changed_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      changed_by_name TEXT,
      changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT
    )
  `;
  console.log("✅ config_change_history table created");

  // 创建系统配置索引
  await sql`CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_system_configs_group ON system_configs("group")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_system_configs_is_sensitive ON system_configs(is_sensitive)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_config_change_history_config_id ON config_change_history(config_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_config_change_history_config_key ON config_change_history(config_key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_config_change_history_changed_by ON config_change_history(changed_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_config_change_history_changed_at ON config_change_history(changed_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_config_change_history_change_type ON config_change_history(change_type)`;

  console.log("✅ System config indexes created");

  await sql.end();

  console.log("\n🎉 Database migration completed successfully!\n");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
