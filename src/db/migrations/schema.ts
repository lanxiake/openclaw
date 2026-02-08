import { pgTable, index, unique, varchar, jsonb, timestamp, foreignKey, boolean, integer, text, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	phone: varchar({ length: 20 }).notNull(),
	phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
	displayName: varchar("display_name", { length: 100 }),
	avatarUrl: varchar("avatar_url", { length: 500 }),
	status: varchar({ length: 20 }).default('active').notNull(),
	preferences: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_users_phone_hash").using("btree", table.phoneHash.asc().nullsLast().op("text_ops")),
	index("idx_users_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("users_phone_key").on(table.phone),
]);

export const userDevices = pgTable("user_devices", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }).notNull(),
	deviceId: varchar("device_id", { length: 64 }).notNull(),
	deviceName: varchar("device_name", { length: 100 }),
	deviceType: varchar("device_type", { length: 20 }).notNull(),
	platform: varchar({ length: 50 }),
	osVersion: varchar("os_version", { length: 50 }),
	appVersion: varchar("app_version", { length: 20 }),
	pushToken: varchar("push_token", { length: 500 }),
	isActive: boolean("is_active").default(true).notNull(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_devices_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_devices_user_id_fkey"
		}),
	unique("user_devices_user_id_device_id_key").on(table.userId, table.deviceId),
]);

export const userSessions = pgTable("user_sessions", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }).notNull(),
	deviceId: varchar("device_id", { length: 32 }),
	refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
}, (table) => [
	index("idx_user_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_fkey"
		}),
	foreignKey({
			columns: [table.deviceId],
			foreignColumns: [userDevices.id],
			name: "user_sessions_device_id_fkey"
		}),
	unique("user_sessions_refresh_token_hash_key").on(table.refreshTokenHash),
]);

export const loginAttempts = pgTable("login_attempts", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }).notNull(),
	userAgent: varchar("user_agent", { length: 500 }),
	success: boolean().notNull(),
	failureReason: varchar("failure_reason", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_login_attempts_ip_address").using("btree", table.ipAddress.asc().nullsLast().op("text_ops")),
	index("idx_login_attempts_phone_hash").using("btree", table.phoneHash.asc().nullsLast().op("text_ops")),
]);

export const verificationCodes = pgTable("verification_codes", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
	codeHash: varchar("code_hash", { length: 64 }).notNull(),
	type: varchar({ length: 20 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	attempts: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }).notNull(),
	planId: varchar("plan_id", { length: 32 }).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	autoRenew: boolean("auto_renew").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "subscriptions_plan_id_fkey"
		}),
]);

export const userSkills = pgTable("user_skills", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }).notNull(),
	skillId: varchar("skill_id", { length: 32 }).notNull(),
	purchasedAt: timestamp("purchased_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_skills_user_id_fkey"
		}),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skills.id],
			name: "user_skills_skill_id_fkey"
		}),
	unique("user_skills_user_id_skill_id_key").on(table.userId, table.skillId),
]);

export const skills = pgTable("skills", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	category: varchar({ length: 50 }),
	price: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("skills_code_key").on(table.code),
]);

export const plans = pgTable("plans", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	priceMonthly: integer("price_monthly").default(0).notNull(),
	priceYearly: integer("price_yearly").default(0).notNull(),
	features: jsonb().default({}),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("plans_code_key").on(table.code),
]);

export const paymentOrders = pgTable("payment_orders", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }).notNull(),
	orderNo: varchar("order_no", { length: 64 }).notNull(),
	orderType: varchar("order_type", { length: 20 }).notNull(),
	amount: integer().notNull(),
	currency: varchar({ length: 10 }).default('CNY').notNull(),
	paymentMethod: varchar("payment_method", { length: 20 }),
	paymentStatus: varchar("payment_status", { length: 20 }).default('pending').notNull(),
	planId: varchar("plan_id", { length: 32 }),
	skillId: varchar("skill_id", { length: 32 }),
	subscriptionId: varchar("subscription_id", { length: 32 }),
	couponId: varchar("coupon_id", { length: 32 }),
	discountAmount: integer("discount_amount").default(0).notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	refundedAt: timestamp("refunded_at", { withTimezone: true, mode: 'string' }),
	refundAmount: integer("refund_amount"),
	externalOrderId: varchar("external_order_id", { length: 100 }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payment_orders_order_no").using("btree", table.orderNo.asc().nullsLast().op("text_ops")),
	index("idx_payment_orders_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payment_orders_user_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "payment_orders_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skills.id],
			name: "payment_orders_skill_id_fkey"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "payment_orders_subscription_id_fkey"
		}),
	unique("payment_orders_order_no_key").on(table.orderNo),
]);

export const couponCodes = pgTable("coupon_codes", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	discountType: varchar("discount_type", { length: 20 }).notNull(),
	discountValue: integer("discount_value").notNull(),
	minAmount: integer("min_amount").default(0).notNull(),
	maxDiscount: integer("max_discount"),
	applicablePlans: varchar("applicable_plans", { length: 32 }).array(),
	applicableSkills: varchar("applicable_skills", { length: 32 }).array(),
	usageLimit: integer("usage_limit"),
	usageCount: integer("usage_count").default(0).notNull(),
	userLimit: integer("user_limit").default(1).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("coupon_codes_code_key").on(table.code),
]);

export const auditLogs = pgTable("audit_logs", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 32 }),
	adminId: varchar("admin_id", { length: 32 }),
	action: varchar({ length: 100 }).notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	resourceId: varchar("resource_id", { length: 32 }),
	category: varchar({ length: 30 }).default('data').notNull(),
	riskLevel: varchar("risk_level", { length: 10 }).default('low').notNull(),
	details: jsonb().default({}),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_logs_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_audit_logs_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "audit_logs_user_id_fkey"
		}),
]);

export const exportLogs = pgTable("export_logs", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	adminId: varchar("admin_id", { length: 32 }).notNull(),
	exportType: varchar("export_type", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	fileUrl: varchar("file_url", { length: 500 }),
	fileSize: integer("file_size"),
	recordCount: integer("record_count"),
	params: jsonb().default({}),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const admins = pgTable("admins", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	avatarUrl: varchar("avatar_url", { length: 500 }),
	role: varchar({ length: 20 }).default('operator').notNull(),
	permissions: jsonb().default({}),
	status: varchar({ length: 20 }).default('active').notNull(),
	mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
	mfaSecret: varchar("mfa_secret", { length: 100 }),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	lastLoginIp: varchar("last_login_ip", { length: 45 }),
	passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: varchar("created_by", { length: 32 }),
}, (table) => [
	index("idx_admins_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("admins_username_key").on(table.username),
	unique("admins_email_key").on(table.email),
]);

export const adminSessions = pgTable("admin_sessions", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	adminId: varchar("admin_id", { length: 32 }).notNull(),
	refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_admin_sessions_admin_id").using("btree", table.adminId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "admin_sessions_admin_id_fkey"
		}),
	unique("admin_sessions_refresh_token_hash_key").on(table.refreshTokenHash),
]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	adminId: varchar("admin_id", { length: 32 }).notNull(),
	action: varchar({ length: 100 }).notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	resourceId: varchar("resource_id", { length: 32 }),
	details: jsonb().default({}),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_admin_audit_logs_admin_id").using("btree", table.adminId.asc().nullsLast().op("text_ops")),
	index("idx_admin_audit_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "admin_audit_logs_admin_id_fkey"
		}),
]);

export const adminLoginAttempts = pgTable("admin_login_attempts", {
	id: varchar({ length: 32 }).primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }).notNull(),
	userAgent: varchar("user_agent", { length: 500 }),
	success: boolean().notNull(),
	failureReason: varchar("failure_reason", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const skillStoreItems = pgTable("skill_store_items", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	readme: text(),
	authorId: text("author_id"),
	authorName: text("author_name"),
	version: text().default('1.0.0').notNull(),
	categoryId: text("category_id"),
	tags: jsonb(),
	status: text().default('pending').notNull(),
	subscriptionLevel: text("subscription_level").default('free').notNull(),
	downloadCount: integer("download_count").default(0).notNull(),
	ratingAvg: numeric("rating_avg", { precision: 3, scale:  2 }).default('0'),
	ratingCount: integer("rating_count").default(0).notNull(),
	iconUrl: text("icon_url"),
	manifestUrl: text("manifest_url"),
	packageUrl: text("package_url"),
	config: jsonb(),
	reviewNote: text("review_note"),
	reviewedBy: text("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	isFeatured: boolean("is_featured").default(false).notNull(),
	featuredOrder: integer("featured_order"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_skill_store_items_author_id").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("idx_skill_store_items_category_id").using("btree", table.categoryId.asc().nullsLast().op("text_ops")),
	index("idx_skill_store_items_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_skill_store_items_download_count").using("btree", table.downloadCount.asc().nullsLast().op("int4_ops")),
	index("idx_skill_store_items_is_featured").using("btree", table.isFeatured.asc().nullsLast().op("int4_ops"), table.featuredOrder.asc().nullsLast().op("int4_ops")),
	index("idx_skill_store_items_rating_avg").using("btree", table.ratingAvg.asc().nullsLast().op("numeric_ops")),
	index("idx_skill_store_items_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_skill_store_items_subscription_level").using("btree", table.subscriptionLevel.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "skill_store_items_author_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [skillCategories.id],
			name: "skill_store_items_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [admins.id],
			name: "skill_store_items_reviewed_by_fkey"
		}).onDelete("set null"),
]);

export const skillCategories = pgTable("skill_categories", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	icon: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	skillCount: integer("skill_count").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_skill_categories_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_skill_categories_sort_order").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
]);

export const skillReviews = pgTable("skill_reviews", {
	id: text().primaryKey().notNull(),
	skillId: text("skill_id").notNull(),
	userId: text("user_id").notNull(),
	rating: integer().notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_skill_reviews_rating").using("btree", table.rating.asc().nullsLast().op("int4_ops")),
	index("idx_skill_reviews_skill_id").using("btree", table.skillId.asc().nullsLast().op("text_ops")),
	index("idx_skill_reviews_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skillStoreItems.id],
			name: "skill_reviews_skill_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "skill_reviews_user_id_fkey"
		}).onDelete("cascade"),
	unique("skill_reviews_skill_id_user_id_key").on(table.skillId, table.userId),
]);

export const userInstalledSkills = pgTable("user_installed_skills", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	skillItemId: text("skill_item_id").notNull(),
	installedVersion: text("installed_version").notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	installedAt: timestamp("installed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_user_installed_skills_skill_item_id").using("btree", table.skillItemId.asc().nullsLast().op("text_ops")),
	index("idx_user_installed_skills_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_installed_skills_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.skillItemId],
			foreignColumns: [skillStoreItems.id],
			name: "user_installed_skills_skill_item_id_fkey"
		}).onDelete("cascade"),
	unique("user_installed_skills_user_id_skill_item_id_key").on(table.userId, table.skillItemId),
]);

export const systemConfigs = pgTable("system_configs", {
	id: text().primaryKey().notNull(),
	key: text().notNull(),
	value: jsonb().notNull(),
	valueType: text("value_type").default('string').notNull(),
	group: text().default('general').notNull(),
	description: text(),
	isSensitive: boolean("is_sensitive").default(false).notNull(),
	isReadonly: boolean("is_readonly").default(false).notNull(),
	requiresRestart: boolean("requires_restart").default(false).notNull(),
	defaultValue: jsonb("default_value"),
	validationRules: jsonb("validation_rules"),
	updatedBy: text("updated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_system_configs_group").using("btree", table.group.asc().nullsLast().op("text_ops")),
	index("idx_system_configs_is_sensitive").using("btree", table.isSensitive.asc().nullsLast().op("bool_ops")),
	index("idx_system_configs_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [admins.id],
			name: "system_configs_updated_by_fkey"
		}).onDelete("set null"),
	unique("system_configs_key_key").on(table.key),
]);

export const configChangeHistory = pgTable("config_change_history", {
	id: text().primaryKey().notNull(),
	configId: text("config_id").notNull(),
	configKey: text("config_key").notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	changeType: text("change_type").notNull(),
	reason: text(),
	changedBy: text("changed_by"),
	changedByName: text("changed_by_name"),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
}, (table) => [
	index("idx_config_change_history_change_type").using("btree", table.changeType.asc().nullsLast().op("text_ops")),
	index("idx_config_change_history_changed_at").using("btree", table.changedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_config_change_history_changed_by").using("btree", table.changedBy.asc().nullsLast().op("text_ops")),
	index("idx_config_change_history_config_id").using("btree", table.configId.asc().nullsLast().op("text_ops")),
	index("idx_config_change_history_config_key").using("btree", table.configKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.configId],
			foreignColumns: [systemConfigs.id],
			name: "config_change_history_config_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [admins.id],
			name: "config_change_history_changed_by_fkey"
		}).onDelete("set null"),
]);
