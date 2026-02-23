/**
 * 仓库层统一导出
 */

// 多租户基础层
export { TenantScopedRepository, getTenantScopedRepository } from "./tenant-scope.js";

// 用户相关仓库
export {
  UserRepository,
  UserDeviceRepository,
  UserSessionRepository,
  LoginAttemptRepository,
  VerificationCodeRepository,
  getUserRepository,
  getUserDeviceRepository,
  getUserSessionRepository,
  getLoginAttemptRepository,
  getVerificationCodeRepository,
} from "./users.js";

// 审计日志仓库
export {
  AuditLogRepository,
  ExportLogRepository,
  getAuditLogRepository,
  getExportLogRepository,
  audit,
} from "./audit.js";

// 订阅与计费仓库
export {
  PlanRepository,
  SkillRepository,
  UserSkillRepository,
  SubscriptionRepository,
  PaymentOrderRepository,
  CouponRepository,
  getPlanRepository,
  getSkillRepository,
  getUserSkillRepository,
  getSubscriptionRepository,
  getPaymentOrderRepository,
  getCouponRepository,
} from "./subscriptions.js";

// 对话与消息仓库
export {
  ConversationRepository,
  MessageRepository,
  getConversationRepository,
  getMessageRepository,
} from "./conversations.js";

// 用户记忆仓库
export { MemoryRepository, getMemoryRepository } from "./memories.js";

// 用户文件仓库
export { FileRepository, getFileRepository } from "./files.js";

// 用户自建技能仓库
export { CustomSkillRepository, getCustomSkillRepository } from "./custom-skills.js";

// 用户助手配置仓库
export { AssistantConfigRepository, getAssistantConfigRepository } from "./assistant-configs.js";

// 用量配额仓库
export { UsageQuotaRepository, getUsageQuotaRepository } from "./usage-quotas.js";

// 管理员仓库
export {
  AdminRepository,
  AdminSessionRepository,
  AdminAuditLogRepository,
  AdminLoginAttemptRepository,
  getAdminRepository,
  getAdminSessionRepository,
  getAdminAuditLogRepository,
  getAdminLoginAttemptRepository,
  adminAudit,
} from "./admins.js";

// 设备仓库
export {
  DeviceRepository,
  DevicePairingRequestRepository,
  getDeviceRepository,
  getDevicePairingRequestRepository,
} from "./devices.js";

// Gateway 配置仓库
export { GatewayConfigRepository } from "./gateway-configs.js";

// 模型配置仓库
export { ModelProviderRepository, AgentDefaultConfigRepository } from "./model-configs.js";

// 系统告警仓库
export { AlertRepository, getAlertRepository } from "./alerts.js";

// 系统日志仓库
export { SystemLogsRepository, getSystemLogsRepository, generateLogId } from "./system-logs.js";

// 系统日志相关类型
export type { SystemLogQueryParams, SystemLogStats } from "./system-logs.js";

// 系统指标仓库
export {
  SystemMetricsRepository,
  getSystemMetricsRepository,
  generateMetricId,
} from "./system-metrics.js";

// 频道配对仓库
export {
  ChannelPairingRequestRepository,
  ChannelBindingRepository,
  getChannelPairingRequestRepository,
  getChannelBindingRepository,
} from "./channel-pairing.js";

// LLM 调用日志仓库
export { LlmCallLogRepository, getLlmCallLogRepository } from "./llm-call-logs.js";

// LLM 调用日志相关类型
export type {
  LlmCallLogQueryParams,
  LlmCallLogStats,
  LlmCallLogInsertParams,
} from "./llm-call-logs.js";
