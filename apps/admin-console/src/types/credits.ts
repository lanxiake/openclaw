/**
 * 积分管理类型定义
 */

/**
 * 积分账户余额
 */
export interface CreditBalance {
  id: string
  userId: string
  totalBalance: number
  totalEarned: number
  totalConsumed: number
  totalExpired: number
  createdAt: string
  updatedAt: string
}

/**
 * 积分流水记录
 */
export interface CreditTransaction {
  id: string
  userId: string
  batchId?: string
  type: 'earn' | 'consume' | 'expire' | 'refund' | 'admin_adjust'
  amount: number
  balanceAfter: number
  source: string
  sourceId?: string
  description?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

/**
 * 积分流水查询参数
 */
export interface CreditHistoryQuery {
  limit?: number
  offset?: number
}

/**
 * 积分流水响应
 */
export interface CreditHistoryResponse {
  data: CreditTransaction[]
  meta: {
    limit: number
    offset: number
    count: number
    hasMore: boolean
  }
}

/**
 * 管理员发放积分请求
 */
export interface GrantCreditsRequest {
  amount: number
  expiryMonths?: number
  description?: string
  adminNote?: string
}

/**
 * 积分操作结果
 */
export interface CreditOperationResult {
  success: boolean
  creditsGranted: number
  newBalance: number
  reason?: string
}

/**
 * 模型定价
 */
export interface ModelPricing {
  id: string
  modelId: string
  modelName: string
  inputPrice: number
  outputPrice: number
  multiplier: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 创建/更新模型定价请求
 */
export interface UpsertModelPricingRequest {
  modelName: string
  inputPrice: number
  outputPrice: number
  multiplier?: string
}

/**
 * 过期清理结果
 */
export interface CleanupResult {
  batchesCleaned: number
  creditsExpired: number
}
