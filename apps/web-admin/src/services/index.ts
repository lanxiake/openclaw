/**
 * 服务层统一导出
 */

export { authService } from './auth'
export type { User, LoginResponse, SendCodeResponse } from './auth'

export { adminAuthService } from './admin-auth'
export type { Admin, AdminLoginResponse } from './admin-auth'

export { skillService } from './skills'
export type {
  Skill,
  SkillDetail,
  SkillExecutionResult,
  StoreSkill,
  StoreStats,
  SkillStats,
} from './skills'

export { subscriptionService } from './subscription'
export type {
  Plan,
  Subscription,
  UsageRecord,
  QuotaCheckResult,
  SubscriptionOverview,
} from './subscription'

export { auditService } from './audit'
export type {
  AuditAction,
  AuditLog,
  AuditLogQuery,
  AuditStats,
  AuditConfig,
} from './audit'

export { gateway } from '../lib/gateway-client'
export type { ConnectionState } from '../lib/gateway-client'
