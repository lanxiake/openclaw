/**
 * Schema 统一导出
 *
 * 汇总所有数据库表定义
 */

// 用户相关表
export {
  users,
  userDevices,
  userSessions,
  loginAttempts,
  verificationCodes,
  usersRelations,
  userDevicesRelations,
  userSessionsRelations,
  // Zod schemas
  insertUserSchema,
  selectUserSchema,
  insertUserDeviceSchema,
  selectUserDeviceSchema,
  insertUserSessionSchema,
  selectUserSessionSchema,
  insertLoginAttemptSchema,
  selectLoginAttemptSchema,
  insertVerificationCodeSchema,
  selectVerificationCodeSchema,
} from "./users.js";

// 用户相关类型
export type {
  User,
  NewUser,
  UserDevice,
  NewUserDevice,
  UserSession,
  NewUserSession,
  LoginAttempt,
  NewLoginAttempt,
  VerificationCode,
  NewVerificationCode,
  UserPreferences,
} from "./users.js";

// 对话与消息相关表
export {
  conversations,
  messages,
  conversationsRelations,
  messagesRelations,
  // Zod schemas
  insertConversationSchema,
  selectConversationSchema,
  insertMessageSchema,
  selectMessageSchema,
} from "./conversations.js";

// 对话与消息相关类型
export type {
  Conversation,
  NewConversation,
  Message,
  NewMessage,
  AgentConfig,
  MessageAttachment,
} from "./conversations.js";

// 用户记忆相关表
export {
  userMemories,
  userMemoriesRelations,
  // Zod schemas
  insertUserMemorySchema,
  selectUserMemorySchema,
} from "./memories.js";

// 用户记忆相关类型
export type { UserMemory, NewUserMemory } from "./memories.js";

// 用户文件相关表
export {
  userFiles,
  userFilesRelations,
  // Zod schemas
  insertUserFileSchema,
  selectUserFileSchema,
} from "./files.js";

// 用户文件相关类型
export type { UserFile, NewUserFile } from "./files.js";

// 订阅与计费相关表
export {
  plans,
  skills,
  userSkills,
  subscriptions,
  paymentOrders,
  couponCodes,
  plansRelations,
  skillsRelations,
  userSkillsRelations,
  subscriptionsRelations,
  paymentOrdersRelations,
  // Zod schemas
  insertPlanSchema,
  selectPlanSchema,
  insertSkillSchema,
  selectSkillSchema,
  insertUserSkillSchema,
  selectUserSkillSchema,
  insertSubscriptionSchema,
  selectSubscriptionSchema,
  insertPaymentOrderSchema,
  selectPaymentOrderSchema,
  insertCouponCodeSchema,
  selectCouponCodeSchema,
} from "./subscriptions.js";

// 订阅相关类型
export type {
  Plan,
  NewPlan,
  Skill,
  NewSkill,
  UserSkill,
  NewUserSkill,
  Subscription,
  NewSubscription,
  PaymentOrder,
  NewPaymentOrder,
  CouponCode,
  NewCouponCode,
  PlanFeatures,
} from "./subscriptions.js";

// 审计日志相关表
export {
  auditLogs,
  exportLogs,
  auditLogsRelations,
  exportLogsRelations,
  // Zod schemas
  insertAuditLogSchema,
  selectAuditLogSchema,
  insertExportLogSchema,
  selectExportLogSchema,
} from "./audit.js";

// 审计相关类型
export type {
  AuditLog,
  NewAuditLog,
  ExportLog,
  NewExportLog,
  AuditLogDetails,
  AuditRiskLevel,
  AuditCategory,
  ExportParams,
} from "./audit.js";

// 管理员相关表
export {
  admins,
  adminSessions,
  adminAuditLogs,
  adminLoginAttempts,
  adminsRelations,
  adminSessionsRelations,
  adminAuditLogsRelations,
  // Zod schemas
  insertAdminSchema,
  selectAdminSchema,
  insertAdminSessionSchema,
  selectAdminSessionSchema,
  insertAdminAuditLogSchema,
  selectAdminAuditLogSchema,
  insertAdminLoginAttemptSchema,
  selectAdminLoginAttemptSchema,
} from "./admins.js";

// 管理员相关类型
export type {
  Admin,
  NewAdmin,
  AdminSession,
  NewAdminSession,
  AdminAuditLog,
  NewAdminAuditLog,
  AdminLoginAttempt,
  NewAdminLoginAttempt,
  AdminRole,
  AdminStatus,
  AdminPermissions,
  AdminAuditLogDetails,
} from "./admins.js";

// 技能商店相关表
export {
  skillCategories,
  skillStoreItems,
  skillReviews,
  userInstalledSkills,
  skillCategoriesRelations,
  skillStoreItemsRelations,
  skillReviewsRelations,
  userInstalledSkillsRelations,
  // Zod schemas
  insertSkillCategorySchema,
  selectSkillCategorySchema,
  insertSkillStoreItemSchema,
  selectSkillStoreItemSchema,
  insertSkillReviewSchema,
  selectSkillReviewSchema,
  insertUserInstalledSkillSchema,
  selectUserInstalledSkillSchema,
} from "./skill-store.js";

// 技能商店相关类型
export type {
  SkillCategory,
  NewSkillCategory,
  SkillStoreItem,
  NewSkillStoreItem,
  SkillReview,
  NewSkillReview,
  UserInstalledSkill,
  NewUserInstalledSkill,
  SkillStatus,
  SubscriptionLevel,
} from "./skill-store.js";

// 系统配置相关表
export {
  systemConfigs,
  configChangeHistory,
  systemConfigsRelations,
  configChangeHistoryRelations,
  // Zod schemas
  insertSystemConfigSchema,
  selectSystemConfigSchema,
  insertConfigChangeHistorySchema,
  selectConfigChangeHistorySchema,
  // 配置常量
  CONFIG_GROUPS,
  CONFIG_KEYS,
} from "./system-config.js";

// 系统配置相关类型
export type {
  SystemConfig,
  NewSystemConfig,
  ConfigChangeHistory,
  NewConfigChangeHistory,
  ConfigValueType,
  ConfigGroup,
  ConfigKey,
} from "./system-config.js";
