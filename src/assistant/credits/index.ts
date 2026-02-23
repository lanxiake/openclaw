/**
 * 积分模块入口 - Credits Module Entry
 *
 * 导出积分系统的所有公共 API，包括：
 * - CreditService 类及工厂函数
 * - 业务逻辑相关类型
 * - 数据库 Repository 及 Schema 类型（re-export）
 */

// ============================================================================
// Service 层导出
// ============================================================================

export { CreditService, getCreditService } from "./credit-service.js";

// Service 类型导出
export type {
  CreditServiceDeps,
  RegistrationBonusOptions,
  InviteRewardOptions,
  GrantCreditsOptions,
  ConsumeCreditsOptions,
  CreditOperationResult,
  ConsumeResult,
  CleanupResult,
  SetModelPricingParams,
} from "./credit-service.js";

// ============================================================================
// Repository 层 re-export（便于外部直接使用）
// ============================================================================

export {
  CreditAccountRepository,
  CreditBatchRepository,
  CreditTransactionRepository,
  InviteRepository,
  ModelPricingRepository,
  getCreditAccountRepository,
  getCreditBatchRepository,
  getCreditTransactionRepository,
  getInviteRepository,
  getModelPricingRepository,
} from "../../db/repositories/credits.js";

// ============================================================================
// Schema 类型 re-export
// ============================================================================

export type {
  CreditAccount,
  CreditBatch,
  CreditTransaction,
  CreditTransactionMetadata,
  InviteRecord,
  ModelPricingRecord,
  CreditSource,
  CreditTransactionType,
  TransactionSource,
  InviteStatus,
} from "../../db/schema/credits.js";
