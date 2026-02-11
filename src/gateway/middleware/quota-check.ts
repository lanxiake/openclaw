/**
 * 配额检查中间件
 *
 * 在 RPC 方法执行前检查用户配额
 * 支持多种配额类型：AI 调用、Token、存储等
 */

import { getLogger } from "../../shared/logging/logger.js";
import type {
  GatewayRequestContext,
  QuotaCheckResult,
  QuotaType,
  QuotaUsageRecord,
} from "../user-context.js";

const logger = getLogger();

// ============================================================================
// 配额配置
// ============================================================================

/**
 * 需要配额检查的 RPC 方法映射
 *
 * key: RPC 方法名
 * value: 配额类型
 */
const QUOTA_REQUIRED_METHODS: Record<string, QuotaType> = {
  // AI 调用相关
  "chat.send": "aiCalls",
  "chat.stream": "aiCalls",
  "agent.run": "aiCalls",
  "agent.message": "aiCalls",

  // 技能相关
  "skill.execute": "skills",
  "assistant.skill.execute": "skills",

  // 存储相关
  "file.upload": "storage",
  "media.upload": "storage",
};

/**
 * 配额消耗量估算
 *
 * 某些方法可能消耗多个单位
 */
const QUOTA_CONSUMPTION: Record<string, number> = {
  "chat.send": 1,
  "chat.stream": 1,
  "agent.run": 1,
  "agent.message": 1,
  "skill.execute": 1,
  "assistant.skill.execute": 1,
  "file.upload": 1,
  "media.upload": 1,
};

// ============================================================================
// 配额检查服务接口
// ============================================================================

/**
 * 配额服务接口
 *
 * 由外部实现，提供配额查询和记录功能
 */
export interface QuotaService {
  /**
   * 检查用户配额
   */
  checkQuota(userId: string, quotaType: QuotaType): Promise<QuotaCheckResult>;

  /**
   * 记录配额使用
   */
  recordUsage(record: QuotaUsageRecord): Promise<void>;

  /**
   * 获取用户配额摘要
   */
  getQuotaSummary(userId: string): Promise<Record<QuotaType, QuotaCheckResult>>;
}

// ============================================================================
// 内存配额服务 (开发/测试用)
// ============================================================================

/**
 * 内存配额服务
 *
 * 用于开发和测试环境，不持久化
 */
export class InMemoryQuotaService implements QuotaService {
  private usage: Map<string, Map<QuotaType, number>> = new Map();
  private limits: Map<string, Map<QuotaType, number>> = new Map();

  /**
   * 设置用户配额限制
   */
  setUserLimits(userId: string, limits: Partial<Record<QuotaType, number>>): void {
    if (!this.limits.has(userId)) {
      this.limits.set(userId, new Map());
    }
    const userLimits = this.limits.get(userId)!;
    for (const [type, limit] of Object.entries(limits)) {
      userLimits.set(type as QuotaType, limit);
    }
  }

  async checkQuota(userId: string, quotaType: QuotaType): Promise<QuotaCheckResult> {
    const userUsage = this.usage.get(userId);
    const userLimits = this.limits.get(userId);

    const used = userUsage?.get(quotaType) ?? 0;
    const limit = userLimits?.get(quotaType) ?? -1; // -1 表示无限制

    const remaining = limit === -1 ? Infinity : Math.max(0, limit - used);
    const allowed = limit === -1 || used < limit;

    return {
      allowed,
      quotaType,
      used,
      limit,
      remaining: limit === -1 ? -1 : remaining,
      reason: allowed ? undefined : `${quotaType} quota exceeded (${used}/${limit})`,
    };
  }

  async recordUsage(record: QuotaUsageRecord): Promise<void> {
    if (!this.usage.has(record.userId)) {
      this.usage.set(record.userId, new Map());
    }
    const userUsage = this.usage.get(record.userId)!;
    const current = userUsage.get(record.quotaType) ?? 0;
    userUsage.set(record.quotaType, current + record.amount);

    logger.debug("[quota] Usage recorded", {
      userId: record.userId,
      quotaType: record.quotaType,
      amount: record.amount,
      newTotal: current + record.amount,
    });
  }

  async getQuotaSummary(userId: string): Promise<Record<QuotaType, QuotaCheckResult>> {
    const quotaTypes: QuotaType[] = ["aiCalls", "tokens", "storage", "devices", "agents", "skills"];

    const summary: Partial<Record<QuotaType, QuotaCheckResult>> = {};
    for (const type of quotaTypes) {
      summary[type] = await this.checkQuota(userId, type);
    }

    return summary as Record<QuotaType, QuotaCheckResult>;
  }

  /**
   * 重置用户配额使用量 (用于测试)
   */
  resetUsage(userId: string): void {
    this.usage.delete(userId);
  }

  /**
   * 清空所有数据 (用于测试)
   */
  clear(): void {
    this.usage.clear();
    this.limits.clear();
  }
}

// ============================================================================
// 配额检查中间件
// ============================================================================

// 默认配额服务实例
let quotaServiceInstance: QuotaService | null = null;

/**
 * 设置配额服务实例
 */
export function setQuotaService(service: QuotaService): void {
  quotaServiceInstance = service;
}

/**
 * 获取配额服务实例
 */
export function getQuotaService(): QuotaService {
  if (!quotaServiceInstance) {
    // 默认使用内存服务
    quotaServiceInstance = new InMemoryQuotaService();
    logger.warn("[quota] Using in-memory quota service (not for production)");
  }
  return quotaServiceInstance;
}

/**
 * 检查用户配额
 *
 * @param userId 用户 ID
 * @param method RPC 方法名
 * @param context 请求上下文
 * @returns 检查结果
 */
export async function checkUserQuota(
  userId: string | undefined,
  method: string,
  context: GatewayRequestContext,
): Promise<QuotaCheckResult | null> {
  // 未认证用户跳过配额检查 (由认证中间件处理)
  if (!userId) {
    return null;
  }

  // 检查方法是否需要配额
  const quotaType = QUOTA_REQUIRED_METHODS[method];
  if (!quotaType) {
    return null; // 不需要配额检查
  }

  logger.debug("[quota] Checking quota", {
    userId,
    method,
    quotaType,
    requestId: context.requestId,
  });

  const service = getQuotaService();
  const result = await service.checkQuota(userId, quotaType);

  if (!result.allowed) {
    logger.warn("[quota] Quota exceeded", {
      userId,
      method,
      quotaType,
      used: result.used,
      limit: result.limit,
      requestId: context.requestId,
    });
  }

  return result;
}

/**
 * 记录配额使用
 *
 * 在 RPC 方法成功执行后调用
 *
 * @param userId 用户 ID
 * @param method RPC 方法名
 * @param context 请求上下文
 * @param customAmount 自定义消耗量 (可选)
 */
export async function recordQuotaUsage(
  userId: string | undefined,
  method: string,
  context: GatewayRequestContext,
  customAmount?: number,
): Promise<void> {
  if (!userId) {
    return;
  }

  const quotaType = QUOTA_REQUIRED_METHODS[method];
  if (!quotaType) {
    return;
  }

  const amount = customAmount ?? QUOTA_CONSUMPTION[method] ?? 1;

  const service = getQuotaService();
  await service.recordUsage({
    userId,
    quotaType,
    amount,
    timestamp: new Date(),
    requestId: context.requestId,
  });

  logger.debug("[quota] Usage recorded", {
    userId,
    method,
    quotaType,
    amount,
    requestId: context.requestId,
  });
}

/**
 * 创建配额检查错误响应
 */
export function createQuotaExceededError(result: QuotaCheckResult) {
  return {
    code: "QUOTA_EXCEEDED",
    message: result.reason || `${result.quotaType} quota exceeded`,
    details: {
      quotaType: result.quotaType,
      used: result.used,
      limit: result.limit,
      remaining: result.remaining,
      resetsAt: result.resetsAt?.toISOString(),
    },
  };
}

// ============================================================================
// 导出
// ============================================================================

export { QUOTA_REQUIRED_METHODS, QUOTA_CONSUMPTION };
