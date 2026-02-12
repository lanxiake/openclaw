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
