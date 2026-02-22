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

// Agent Todo 相关表
export {
  agentTodos,
  agentTodosRelations,
  // Zod schemas
  insertAgentTodoSchema,
  selectAgentTodoSchema,
} from "./agent-todos.js";

// Agent Todo 相关类型
export type { AgentTodo, NewAgentTodo, TodoItem } from "./agent-todos.js";

// Agent Checkpoint 相关表
export {
  agentCheckpoints,
  agentCheckpointsRelations,
  // Zod schemas
  insertAgentCheckpointSchema,
  selectAgentCheckpointSchema,
} from "./agent-checkpoints.js";

// Agent Checkpoint 相关类型
export type {
  AgentCheckpoint,
  NewAgentCheckpoint,
  AbortReason,
  AgentStateSnapshot,
  ConversationSnapshot,
  CheckpointMetadata,
} from "./agent-checkpoints.js";

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

// 用户自建技能相关表
export {
  userCustomSkills,
  userCustomSkillsRelations,
  // Zod schemas
  insertUserCustomSkillSchema,
  selectUserCustomSkillSchema,
} from "./custom-skills.js";

// 用户自建技能相关类型
export type { UserCustomSkill, NewUserCustomSkill, SkillManifest } from "./custom-skills.js";

// 用户助手配置相关表
export {
  userAssistantConfigs,
  userAssistantConfigsRelations,
  // Zod schemas
  insertUserAssistantConfigSchema,
  selectUserAssistantConfigSchema,
} from "./assistant-configs.js";

// 用户助手配置相关类型
export type {
  UserAssistantConfig,
  NewUserAssistantConfig,
  AssistantPersonality,
  AssistantPreferences,
  AssistantModelConfig,
} from "./assistant-configs.js";

// 用量配额相关表
export {
  usageQuotas,
  usageQuotasRelations,
  // Zod schemas
  insertUsageQuotaSchema,
  selectUsageQuotaSchema,
} from "./usage-quotas.js";

// 用量配额相关类型
export type { UsageQuota, NewUsageQuota } from "./usage-quotas.js";

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
  SkillSourceType,
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

// 设备相关表
export {
  devices,
  devicePairingRequests,
  devicesRelations,
  devicePairingRequestsRelations,
  // Zod schemas
  insertDeviceSchema,
  selectDeviceSchema,
  insertDevicePairingRequestSchema,
  selectDevicePairingRequestSchema,
} from "./devices.js";

// 设备相关类型
export type {
  Device,
  NewDevice,
  DevicePairingRequest,
  NewDevicePairingRequest,
  DeviceAuthToken,
  DevicePlatform,
  PairingRequestStatus,
} from "./devices.js";

// Gateway 配置相关表
export { gatewayConfigs } from "./gateway-configs.js";

// Gateway 配置相关类型
export type { GatewayConfig, NewGatewayConfig } from "./gateway-configs.js";

// 模型配置相关表
export { modelProviders, agentConfigs } from "./model-configs.js";

// 模型配置相关类型
export type {
  ModelProvider,
  NewModelProvider,
  AgentDefaultConfig,
  NewAgentDefaultConfig,
} from "./model-configs.js";

// Auth Profile 配置相关表
export {
  authProfiles,
  authProfileOrder,
  authProfilesRelations,
  authProfileOrderRelations,
  // Zod schemas
  insertAuthProfileSchema,
  selectAuthProfileSchema,
  insertAuthProfileOrderSchema,
  selectAuthProfileOrderSchema,
} from "./auth-profiles.js";

// Auth Profile 配置相关类型
export type {
  AuthProfile,
  NewAuthProfile,
  AuthProfileOrderRecord,
  NewAuthProfileOrderRecord,
  OAuthCredentialsData,
  AuthProfileUsageStats,
  AuthProfileCooldownConfig,
} from "./auth-profiles.js";

// 用户画像记忆相关表 (Phase 1: L3 Archival Memory)
export {
  userProfiles,
  userFacts,
  userPreferencesV2,
  behaviorPatterns,
  userProfilesRelations,
  userFactsRelations,
  userPreferencesV2Relations,
  behaviorPatternsRelations,
  // Zod schemas
  insertUserProfileSchema,
  selectUserProfileSchema,
  insertUserFactSchema,
  selectUserFactSchema,
  insertUserPreferencesV2Schema,
  selectUserPreferencesV2Schema,
  insertBehaviorPatternSchema,
  selectBehaviorPatternSchema,
} from "./profile-memory.js";

// 用户画像记忆相关类型
export type {
  UserProfile,
  NewUserProfile,
  UserFactRecord,
  NewUserFactRecord,
  UserPreferencesV2Record,
  NewUserPreferencesV2Record,
  BehaviorPatternRecord,
  NewBehaviorPatternRecord,
  FactCategoryEnum,
  FactSourceEnum,
  ResponseStyleEnum,
  ConfirmLevelEnum,
  ThinkingLevelEnum,
  VerboseLevelEnum,
  BehaviorPatternTypeEnum,
} from "./profile-memory.js";

// 系统告警表
export {
  systemAlerts,
  // Zod schemas
  insertSystemAlertSchema,
  selectSystemAlertSchema,
} from "./system-alerts.js";

// 系统告警相关类型
export type {
  SystemAlert,
  NewSystemAlert,
  AlertType,
  AlertSeverity,
} from "./system-alerts.js";

// 系统日志表
export {
  systemLogs,
  // Zod schemas
  insertSystemLogSchema,
  selectSystemLogSchema,
} from "./system-logs.js";

// 系统日志相关类型
export type {
  SystemLog,
  NewSystemLog,
  LogLevelEnum,
  SystemLogMetadata,
} from "./system-logs.js";

// 系统指标表
export {
  systemMetrics,
  // Zod schemas
  insertSystemMetricSchema,
  selectSystemMetricSchema,
} from "./system-metrics.js";

// 系统指标相关类型
export type {
  SystemMetric,
  NewSystemMetric,
  MetricType,
} from "./system-metrics.js";

// 积分系统相关表
export {
  creditAccounts,
  creditBatches,
  creditTransactions,
  inviteRecords,
  modelPricing,
  creditAccountsRelations,
  creditBatchesRelations,
  creditTransactionsRelations,
  inviteRecordsRelations,
  // Zod schemas
  insertCreditAccountSchema,
  selectCreditAccountSchema,
  insertCreditBatchSchema,
  selectCreditBatchSchema,
  insertCreditTransactionSchema,
  selectCreditTransactionSchema,
  insertInviteRecordSchema,
  selectInviteRecordSchema,
  insertModelPricingSchema,
  selectModelPricingSchema,
} from "./credits.js";

// 积分系统相关类型
export type {
  CreditAccount,
  NewCreditAccount,
  CreditBatch,
  NewCreditBatch,
  CreditTransaction,
  NewCreditTransaction,
  InviteRecord,
  NewInviteRecord,
  ModelPricingRecord,
  NewModelPricingRecord,
  CreditSource,
  CreditTransactionType,
  TransactionSource,
  InviteStatus,
  CreditTransactionMetadata,
} from "./credits.js";

// 频道配对相关表
export {
  channelPairingRequests,
  userChannelBindings,
  channelPairingRequestsRelations,
  userChannelBindingsRelations,
  // Zod schemas
  insertChannelPairingRequestSchema,
  selectChannelPairingRequestSchema,
  insertUserChannelBindingSchema,
  selectUserChannelBindingSchema,
} from "./channel-pairing.js";

// 频道配对相关类型
export type {
  ChannelPairingRequest,
  NewChannelPairingRequest,
  UserChannelBinding,
  NewUserChannelBinding,
  ChannelPairingStatus,
} from "./channel-pairing.js";
