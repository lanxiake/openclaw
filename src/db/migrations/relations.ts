import { relations } from "drizzle-orm/relations";
import { users, userDevices, userSessions, subscriptions, plans, userSkills, skills, paymentOrders, auditLogs, admins, adminSessions, adminAuditLogs, skillStoreItems, skillCategories, skillReviews, userInstalledSkills, systemConfigs, configChangeHistory } from "./schema";

export const userDevicesRelations = relations(userDevices, ({one, many}) => ({
	user: one(users, {
		fields: [userDevices.userId],
		references: [users.id]
	}),
	userSessions: many(userSessions),
}));

export const usersRelations = relations(users, ({many}) => ({
	userDevices: many(userDevices),
	userSessions: many(userSessions),
	subscriptions: many(subscriptions),
	userSkills: many(userSkills),
	paymentOrders: many(paymentOrders),
	auditLogs: many(auditLogs),
	skillStoreItems: many(skillStoreItems),
	skillReviews: many(skillReviews),
	userInstalledSkills: many(userInstalledSkills),
}));

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
	userDevice: one(userDevices, {
		fields: [userSessions.deviceId],
		references: [userDevices.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
	plan: one(plans, {
		fields: [subscriptions.planId],
		references: [plans.id]
	}),
	paymentOrders: many(paymentOrders),
}));

export const plansRelations = relations(plans, ({many}) => ({
	subscriptions: many(subscriptions),
	paymentOrders: many(paymentOrders),
}));

export const userSkillsRelations = relations(userSkills, ({one}) => ({
	user: one(users, {
		fields: [userSkills.userId],
		references: [users.id]
	}),
	skill: one(skills, {
		fields: [userSkills.skillId],
		references: [skills.id]
	}),
}));

export const skillsRelations = relations(skills, ({many}) => ({
	userSkills: many(userSkills),
	paymentOrders: many(paymentOrders),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({one}) => ({
	user: one(users, {
		fields: [paymentOrders.userId],
		references: [users.id]
	}),
	plan: one(plans, {
		fields: [paymentOrders.planId],
		references: [plans.id]
	}),
	skill: one(skills, {
		fields: [paymentOrders.skillId],
		references: [skills.id]
	}),
	subscription: one(subscriptions, {
		fields: [paymentOrders.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
}));

export const adminSessionsRelations = relations(adminSessions, ({one}) => ({
	admin: one(admins, {
		fields: [adminSessions.adminId],
		references: [admins.id]
	}),
}));

export const adminsRelations = relations(admins, ({many}) => ({
	adminSessions: many(adminSessions),
	adminAuditLogs: many(adminAuditLogs),
	skillStoreItems: many(skillStoreItems),
	systemConfigs: many(systemConfigs),
	configChangeHistories: many(configChangeHistory),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({one}) => ({
	admin: one(admins, {
		fields: [adminAuditLogs.adminId],
		references: [admins.id]
	}),
}));

export const skillStoreItemsRelations = relations(skillStoreItems, ({one, many}) => ({
	user: one(users, {
		fields: [skillStoreItems.authorId],
		references: [users.id]
	}),
	skillCategory: one(skillCategories, {
		fields: [skillStoreItems.categoryId],
		references: [skillCategories.id]
	}),
	admin: one(admins, {
		fields: [skillStoreItems.reviewedBy],
		references: [admins.id]
	}),
	skillReviews: many(skillReviews),
	userInstalledSkills: many(userInstalledSkills),
}));

export const skillCategoriesRelations = relations(skillCategories, ({many}) => ({
	skillStoreItems: many(skillStoreItems),
}));

export const skillReviewsRelations = relations(skillReviews, ({one}) => ({
	skillStoreItem: one(skillStoreItems, {
		fields: [skillReviews.skillId],
		references: [skillStoreItems.id]
	}),
	user: one(users, {
		fields: [skillReviews.userId],
		references: [users.id]
	}),
}));

export const userInstalledSkillsRelations = relations(userInstalledSkills, ({one}) => ({
	user: one(users, {
		fields: [userInstalledSkills.userId],
		references: [users.id]
	}),
	skillStoreItem: one(skillStoreItems, {
		fields: [userInstalledSkills.skillItemId],
		references: [skillStoreItems.id]
	}),
}));

export const systemConfigsRelations = relations(systemConfigs, ({one, many}) => ({
	admin: one(admins, {
		fields: [systemConfigs.updatedBy],
		references: [admins.id]
	}),
	configChangeHistories: many(configChangeHistory),
}));

export const configChangeHistoryRelations = relations(configChangeHistory, ({one}) => ({
	systemConfig: one(systemConfigs, {
		fields: [configChangeHistory.configId],
		references: [systemConfigs.id]
	}),
	admin: one(admins, {
		fields: [configChangeHistory.changedBy],
		references: [admins.id]
	}),
}));