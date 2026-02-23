/**
 * CreditService 积分服务 - 核心业务逻辑层
 *
 * 协调多个 Repository 实现积分系统的完整业务流程：
 * - 注册赠送积分
 * - 邀请奖励积分（含上限检查）
 * - FIFO 积分消费
 * - 包月/加油包积分发放
 * - 模型调用积分计算
 * - 过期批次清理
 * - 余额查询与流水查询
 */

import {
  type CreditAccountRepository,
  type CreditBatchRepository,
  type CreditTransactionRepository,
  type InviteRepository,
  type ModelPricingRepository,
  getCreditAccountRepository,
  getCreditBatchRepository,
  getCreditTransactionRepository,
  getInviteRepository,
  getModelPricingRepository,
} from "../../db/repositories/credits.js";
import type {
  CreditAccount,
  CreditTransaction,
  CreditTransactionMetadata,
  ModelPricingRecord,
} from "../../db/schema/index.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/** CreditService 依赖注入参数 */
export interface CreditServiceDeps {
  accountRepo?: CreditAccountRepository;
  batchRepo?: CreditBatchRepository;
  txnRepo?: CreditTransactionRepository;
  inviteRepo?: InviteRepository;
  pricingRepo?: ModelPricingRepository;
}

/** 注册赠送选项 */
export interface RegistrationBonusOptions {
  /** 赠送积分数（默认 300） */
  amount?: number;
  /** 过期月数（默认 3） */
  expiryMonths?: number;
}

/** 邀请奖励选项 */
export interface InviteRewardOptions {
  /** 奖励积分数（默认 200） */
  amount?: number;
  /** 邀请积分总上限（默认 2000） */
  maxTotal?: number;
  /** 过期月数（默认 3） */
  expiryMonths?: number;
}

/** 积分发放选项（包月/加油包） */
export interface GrantCreditsOptions {
  /** 发放积分数 */
  amount: number;
  /** 过期月数 */
  expiryMonths: number;
  /** 关联订单 ID */
  sourceId?: string;
  /** 描述 */
  description?: string;
}

/** 积分消费选项 */
export interface ConsumeCreditsOptions {
  /** 消费来源 */
  source: "model_call" | "admin_grant" | "refund";
  /** 描述 */
  description?: string;
  /** 扩展元数据 */
  metadata?: CreditTransactionMetadata;
  /** 关联来源 ID */
  sourceId?: string;
}

/** 积分操作结果 */
export interface CreditOperationResult {
  /** 是否成功 */
  success: boolean;
  /** 实际发放/消费的积分数 */
  creditsGranted: number;
  /** 操作后的余额 */
  newBalance: number;
  /** 失败原因 */
  reason?: string;
}

/** 积分消费结果 */
export interface ConsumeResult {
  /** 是否成功 */
  success: boolean;
  /** 实际消费的积分数 */
  consumed: number;
  /** 消费后的余额 */
  newBalance: number;
  /** 失败原因 */
  reason?: string;
}

/** 过期清理结果 */
export interface CleanupResult {
  /** 清理的批次数 */
  batchesCleaned: number;
  /** 清理的总积分数 */
  creditsExpired: number;
}

/** 模型定价设置参数 */
export interface SetModelPricingParams {
  modelId: string;
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  multiplier?: string;
}

// ============================================================================
// 默认配置
// ============================================================================

/** 注册赠送默认积分 */
const DEFAULT_REGISTER_BONUS = 300;

/** 邀请奖励默认积分 */
const DEFAULT_INVITE_BONUS = 200;

/** 邀请积分默认上限 */
const DEFAULT_INVITE_MAX = 2000;

/** 默认过期月数 */
const DEFAULT_EXPIRY_MONTHS = 3;

// ============================================================================
// CreditService
// ============================================================================

/**
 * 积分服务
 *
 * 协调多个 Repository 完成积分系统的核心业务逻辑。
 * 支持依赖注入以便测试。
 */
export class CreditService {
  private readonly accountRepo: CreditAccountRepository;
  private readonly batchRepo: CreditBatchRepository;
  private readonly txnRepo: CreditTransactionRepository;
  private readonly inviteRepo: InviteRepository;
  private readonly pricingRepo: ModelPricingRepository;

  constructor(deps: CreditServiceDeps = {}) {
    this.accountRepo = deps.accountRepo ?? getCreditAccountRepository();
    this.batchRepo = deps.batchRepo ?? getCreditBatchRepository();
    this.txnRepo = deps.txnRepo ?? getCreditTransactionRepository();
    this.inviteRepo = deps.inviteRepo ?? getInviteRepository();
    this.pricingRepo = deps.pricingRepo ?? getModelPricingRepository();
  }

  // --------------------------------------------------------------------------
  // 注册赠送积分
  // --------------------------------------------------------------------------

  /**
   * 为新用户赠送注册积分
   *
   * 流程：
   * 1. 检查用户是否已有积分账户（防止重复赠送）
   * 2. 创建积分账户
   * 3. 创建积分批次
   * 4. 更新账户余额
   * 5. 记录流水
   *
   * @param userId 用户 ID
   * @param options 赠送选项（可选，用于覆盖默认配置）
   * @returns 操作结果
   */
  async grantRegistrationBonus(
    userId: string,
    options?: RegistrationBonusOptions,
  ): Promise<CreditOperationResult> {
    const amount = options?.amount ?? DEFAULT_REGISTER_BONUS;
    const expiryMonths = options?.expiryMonths ?? DEFAULT_EXPIRY_MONTHS;

    logger.info("[credit-service] 开始赠送注册积分", { userId, amount, expiryMonths });

    // 1. 检查是否已有账户（防止重复赠送）
    const existingAccount = await this.accountRepo.findByUserId(userId);
    if (existingAccount) {
      logger.info("[credit-service] 用户已有积分账户，跳过注册赠送", { userId });
      return {
        success: false,
        creditsGranted: 0,
        newBalance: existingAccount.totalBalance,
        reason: "用户已有积分账户，不可重复赠送",
      };
    }

    // 2. 创建积分账户
    const account = await this.accountRepo.create(userId);

    // 3. 创建积分批次
    const expiresAt = this.calculateExpiryDate(expiryMonths);
    await this.batchRepo.create({
      userId,
      source: "register",
      originalAmount: amount,
      remainingAmount: amount,
      expiresAt,
      description: `注册赠送 ${amount} 积分`,
    });

    // 4. 更新账户余额
    const updatedAccount = await this.accountRepo.updateBalance(account.id, {
      totalBalance: amount,
      totalEarned: amount,
    });

    const newBalance = updatedAccount?.totalBalance ?? amount;

    // 5. 记录流水
    await this.txnRepo.create({
      userId,
      type: "earn",
      amount,
      balanceAfter: newBalance,
      source: "register",
      description: `注册赠送 ${amount} 积分`,
    });

    logger.info("[credit-service] 注册积分赠送完成", {
      userId,
      amount,
      newBalance,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      success: true,
      creditsGranted: amount,
      newBalance,
    };
  }

  // --------------------------------------------------------------------------
  // 邀请奖励积分
  // --------------------------------------------------------------------------

  /**
   * 为邀请人发放邀请奖励积分
   *
   * 流程：
   * 1. 检查被邀请人是否已被邀请过
   * 2. 检查邀请人已获得的邀请积分是否达到上限
   * 3. 创建邀请记录
   * 4. 创建积分批次
   * 5. 更新账户余额
   * 6. 记录流水
   *
   * @param inviterUserId 邀请人用户 ID
   * @param inviteeUserId 被邀请人用户 ID
   * @param options 奖励选项
   * @returns 操作结果
   */
  async grantInviteReward(
    inviterUserId: string,
    inviteeUserId: string,
    options?: InviteRewardOptions,
  ): Promise<CreditOperationResult> {
    const amount = options?.amount ?? DEFAULT_INVITE_BONUS;
    const maxTotal = options?.maxTotal ?? DEFAULT_INVITE_MAX;
    const expiryMonths = options?.expiryMonths ?? DEFAULT_EXPIRY_MONTHS;

    logger.info("[credit-service] 开始发放邀请奖励", {
      inviterUserId,
      inviteeUserId,
      amount,
      maxTotal,
    });

    // 1. 检查被邀请人是否已被邀请过
    const isAlreadyInvited = await this.inviteRepo.isUserInvited(inviteeUserId);
    if (isAlreadyInvited) {
      logger.info("[credit-service] 被邀请人已被邀请过", { inviteeUserId });
      return {
        success: false,
        creditsGranted: 0,
        newBalance: 0,
        reason: "该用户已被邀请，不可重复邀请",
      };
    }

    // 2. 检查邀请积分上限
    const totalAwarded = await this.inviteRepo.getTotalAwardedCredits(inviterUserId);
    if (totalAwarded + amount > maxTotal) {
      logger.info("[credit-service] 邀请积分已达上限", {
        inviterUserId,
        totalAwarded,
        maxTotal,
      });
      return {
        success: false,
        creditsGranted: 0,
        newBalance: 0,
        reason: `邀请积分已达上限 ${maxTotal}，当前已发放 ${totalAwarded}`,
      };
    }

    // 3. 创建邀请记录
    await this.inviteRepo.create({
      inviterUserId,
      inviteeUserId,
      creditsAwarded: amount,
    });

    // 4. 获取或创建账户
    const account = await this.accountRepo.getOrCreate(inviterUserId);

    // 5. 创建积分批次
    const expiresAt = this.calculateExpiryDate(expiryMonths);
    await this.batchRepo.create({
      userId: inviterUserId,
      source: "invite",
      originalAmount: amount,
      remainingAmount: amount,
      expiresAt,
      description: `邀请用户 ${inviteeUserId} 奖励 ${amount} 积分`,
    });

    // 6. 更新账户余额
    const newBalance = account.totalBalance + amount;
    const newEarned = account.totalEarned + amount;
    await this.accountRepo.updateBalance(account.id, {
      totalBalance: newBalance,
      totalEarned: newEarned,
    });

    // 7. 记录流水
    await this.txnRepo.create({
      userId: inviterUserId,
      type: "earn",
      amount,
      balanceAfter: newBalance,
      source: "invite",
      description: `邀请用户 ${inviteeUserId} 奖励 ${amount} 积分`,
    });

    logger.info("[credit-service] 邀请奖励发放完成", {
      inviterUserId,
      inviteeUserId,
      amount,
      newBalance,
    });

    return {
      success: true,
      creditsGranted: amount,
      newBalance,
    };
  }

  // --------------------------------------------------------------------------
  // FIFO 积分消费
  // --------------------------------------------------------------------------

  /**
   * 消费积分（FIFO）
   *
   * 流程：
   * 1. 验证消费金额
   * 2. 获取用户账户
   * 3. 检查余额是否充足
   * 4. 获取有效批次（按过期时间排序）
   * 5. FIFO 逐批扣减
   * 6. 更新账户余额
   * 7. 记录消费流水
   *
   * @param userId 用户 ID
   * @param amount 消费积分数（正数）
   * @param options 消费选项
   * @returns 消费结果
   */
  async consumeCredits(
    userId: string,
    amount: number,
    options: ConsumeCreditsOptions,
  ): Promise<ConsumeResult> {
    // 1. 验证消费金额
    if (amount <= 0) {
      throw new Error(`消费金额必须为正数，当前: ${amount}`);
    }

    logger.info("[credit-service] 开始消费积分", {
      userId,
      amount,
      source: options.source,
    });

    // 2. 获取用户账户
    const account = await this.accountRepo.findByUserId(userId);
    if (!account) {
      logger.info("[credit-service] 用户账户不存在", { userId });
      return {
        success: false,
        consumed: 0,
        newBalance: 0,
        reason: "用户积分账户不存在",
      };
    }

    // 3. 检查余额
    if (account.totalBalance < amount) {
      logger.info("[credit-service] 积分余额不足", {
        userId,
        balance: account.totalBalance,
        required: amount,
      });
      return {
        success: false,
        consumed: 0,
        newBalance: account.totalBalance,
        reason: `积分余额不足，当前余额 ${account.totalBalance}，需要 ${amount}`,
      };
    }

    // 4. 获取有效批次（FIFO 排序）
    const activeBatches = await this.batchRepo.findActiveByUserId(userId);

    // 5. FIFO 逐批扣减
    let remaining = amount;
    for (const batch of activeBatches) {
      if (remaining <= 0) {
        break;
      }

      const deduct = Math.min(remaining, batch.remainingAmount);
      await this.batchRepo.deductAmount(batch.id, deduct);
      remaining -= deduct;

      logger.info("[credit-service] 从批次扣减积分", {
        batchId: batch.id,
        deducted: deduct,
        remaining,
      });
    }

    // 6. 更新账户余额
    const newBalance = account.totalBalance - amount;
    const newConsumed = account.totalConsumed + amount;
    await this.accountRepo.updateBalance(account.id, {
      totalBalance: newBalance,
      totalConsumed: newConsumed,
    });

    // 7. 记录消费流水
    await this.txnRepo.create({
      userId,
      type: "consume",
      amount: -amount,
      balanceAfter: newBalance,
      source: options.source,
      sourceId: options.sourceId,
      description: options.description,
      metadata: options.metadata,
    });

    logger.info("[credit-service] 积分消费完成", {
      userId,
      consumed: amount,
      newBalance,
    });

    return {
      success: true,
      consumed: amount,
      newBalance,
    };
  }

  // --------------------------------------------------------------------------
  // 余额查询
  // --------------------------------------------------------------------------

  /**
   * 获取用户积分余额
   *
   * @param userId 用户 ID
   * @returns 积分账户信息，不存在则返回 null
   */
  async getBalance(userId: string): Promise<CreditAccount | null> {
    return this.accountRepo.findByUserId(userId);
  }

  // --------------------------------------------------------------------------
  // 模型调用积分计算
  // --------------------------------------------------------------------------

  /**
   * 计算模型调用的积分消耗
   *
   * 公式：ceil((inputTokens × inputPrice + outputTokens × outputPrice) / 1_000_000 × multiplier)
   * 最少消耗 1 积分
   *
   * @param modelId 模型标识
   * @param inputTokens 输入 token 数
   * @param outputTokens 输出 token 数
   * @param globalMultiplier 全局倍率（默认 1.0）
   * @returns 消耗的积分数
   */
  async calculateModelCallCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    globalMultiplier: number = 1.0,
  ): Promise<number> {
    logger.info("[credit-service] 计算模型调用成本", {
      modelId,
      inputTokens,
      outputTokens,
      globalMultiplier,
    });

    // 查找模型定价
    const pricing = await this.pricingRepo.findByModelId(modelId);
    if (!pricing) {
      throw new Error(`模型 ${modelId} 未配置定价`);
    }

    if (!pricing.isActive) {
      throw new Error(`模型 ${modelId} 已被禁用`);
    }

    // 计算积分消耗
    const modelMultiplier = parseFloat(pricing.multiplier);
    const rawCost =
      ((inputTokens * pricing.inputPrice + outputTokens * pricing.outputPrice) / 1_000_000) *
      modelMultiplier *
      globalMultiplier;

    // 向上取整，最少 1 积分
    const cost = Math.max(1, Math.ceil(rawCost));

    logger.info("[credit-service] 模型调用成本计算结果", {
      modelId,
      rawCost,
      cost,
      modelMultiplier,
      globalMultiplier,
    });

    return cost;
  }

  /**
   * 设置模型定价（便捷方法，用于测试和管理）
   *
   * @param params 定价参数
   */
  async setModelPricing(params: SetModelPricingParams): Promise<void> {
    logger.info("[credit-service] 设置模型定价", { modelId: params.modelId });

    const existing = await this.pricingRepo.findByModelId(params.modelId);
    if (existing) {
      await this.pricingRepo.update(existing.id, {
        modelName: params.modelName,
        inputPrice: params.inputPrice,
        outputPrice: params.outputPrice,
        multiplier: params.multiplier,
      });
    } else {
      await this.pricingRepo.create(params);
    }
  }

  // --------------------------------------------------------------------------
  // 过期批次清理
  // --------------------------------------------------------------------------

  /**
   * 清理所有过期且有余额的批次
   *
   * 流程：
   * 1. 查询所有过期且有余额的批次
   * 2. 逐个清零
   * 3. 更新对应用户的账户余额
   * 4. 记录过期流水
   *
   * @returns 清理结果
   */
  async cleanupExpiredBatches(): Promise<CleanupResult> {
    logger.info("[credit-service] 开始清理过期批次");

    const expiredBatches = await this.batchRepo.findExpiredWithBalance();

    if (expiredBatches.length === 0) {
      logger.info("[credit-service] 没有需要清理的过期批次");
      return { batchesCleaned: 0, creditsExpired: 0 };
    }

    let totalExpired = 0;

    // 按用户分组处理
    const batchesByUser = new Map<string, typeof expiredBatches>();
    for (const batch of expiredBatches) {
      const userBatches = batchesByUser.get(batch.userId) ?? [];
      userBatches.push(batch);
      batchesByUser.set(batch.userId, userBatches);
    }

    for (const [userId, userBatches] of batchesByUser) {
      let userExpired = 0;

      for (const batch of userBatches) {
        const expiredAmount = batch.remainingAmount;
        await this.batchRepo.clearExpiredBatch(batch.id);
        userExpired += expiredAmount;
        totalExpired += expiredAmount;

        logger.info("[credit-service] 清零过期批次", {
          batchId: batch.id,
          userId,
          expiredAmount,
        });
      }

      // 更新用户账户余额
      const account = await this.accountRepo.findByUserId(userId);
      if (account) {
        await this.accountRepo.updateBalance(account.id, {
          totalBalance: account.totalBalance - userExpired,
          totalExpired: account.totalExpired + userExpired,
        });

        // 记录过期流水
        await this.txnRepo.create({
          userId,
          type: "expire",
          amount: -userExpired,
          balanceAfter: account.totalBalance - userExpired,
          source: "expiry_cleanup",
          description: `${userBatches.length} 个批次过期，共 ${userExpired} 积分`,
        });
      }
    }

    logger.info("[credit-service] 过期批次清理完成", {
      batchesCleaned: expiredBatches.length,
      creditsExpired: totalExpired,
    });

    return {
      batchesCleaned: expiredBatches.length,
      creditsExpired: totalExpired,
    };
  }

  // --------------------------------------------------------------------------
  // 包月积分发放
  // --------------------------------------------------------------------------

  /**
   * 为包月用户发放积分
   *
   * @param userId 用户 ID
   * @param options 发放选项
   * @returns 操作结果
   */
  async grantSubscriptionCredits(
    userId: string,
    options: GrantCreditsOptions,
  ): Promise<CreditOperationResult> {
    return this.grantCreditsInternal(userId, "subscription", options);
  }

  // --------------------------------------------------------------------------
  // 加油包积分发放
  // --------------------------------------------------------------------------

  /**
   * 为用户发放加油包积分
   *
   * @param userId 用户 ID
   * @param options 发放选项
   * @returns 操作结果
   */
  async grantBoosterCredits(
    userId: string,
    options: GrantCreditsOptions,
  ): Promise<CreditOperationResult> {
    return this.grantCreditsInternal(userId, "purchase", options);
  }

  // --------------------------------------------------------------------------
  // 流水查询
  // --------------------------------------------------------------------------

  /**
   * 查询用户积分流水历史
   *
   * @param userId 用户 ID
   * @param options 分页选项
   * @returns 流水列表
   */
  async getTransactionHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<CreditTransaction[]> {
    return this.txnRepo.findByUserId(userId, options);
  }

  // --------------------------------------------------------------------------
  // 管理员手动发放
  // --------------------------------------------------------------------------

  /**
   * 管理员手动发放积分
   *
   * 使用 admin_grant 来源调用内部发放方法。
   * 在流水 metadata 中记录管理员 ID 和备注信息。
   *
   * @param userId 目标用户 ID
   * @param options 发放选项
   * @param adminId 操作管理员 ID
   * @param adminNote 管理员备注
   * @returns 操作结果
   */
  async adminGrantCredits(
    userId: string,
    options: GrantCreditsOptions,
    adminId: string,
    adminNote?: string,
  ): Promise<CreditOperationResult> {
    logger.info("[credit-service] 管理员手动发放积分", {
      userId,
      amount: options.amount,
      adminId,
      adminNote,
    });

    return this.grantCreditsInternal(userId, "admin_grant", {
      ...options,
      description: options.description ?? `管理员 ${adminId} 手动发放 ${options.amount} 积分`,
      metadata: {
        adminId,
        adminNote,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 模型定价管理
  // --------------------------------------------------------------------------

  /**
   * 获取所有模型定价
   *
   * @param activeOnly 是否仅返回激活的（默认 true）
   * @returns 定价列表
   */
  async getAllModelPricings(activeOnly = true): Promise<ModelPricingRecord[]> {
    if (activeOnly) {
      return this.pricingRepo.findAllActive();
    }
    return this.pricingRepo.findAll();
  }

  /**
   * 获取指定模型定价
   *
   * @param modelId 模型标识
   * @returns 定价记录，不存在返回 null
   */
  async getModelPricing(modelId: string): Promise<ModelPricingRecord | null> {
    return this.pricingRepo.findByModelId(modelId);
  }

  /**
   * 删除模型定价
   *
   * @param modelId 模型标识
   * @returns 是否删除成功
   */
  async deleteModelPricing(modelId: string): Promise<boolean> {
    logger.info("[credit-service] 删除模型定价", { modelId });

    const existing = await this.pricingRepo.findByModelId(modelId);
    if (!existing) {
      logger.info("[credit-service] 模型定价不存在", { modelId });
      return false;
    }
    return this.pricingRepo.deleteById(existing.id);
  }

  // --------------------------------------------------------------------------
  // 内部辅助方法
  // --------------------------------------------------------------------------

  /**
   * 通用积分发放内部方法
   *
   * @param userId 用户 ID
   * @param source 积分来源
   * @param options 发放选项
   * @returns 操作结果
   */
  private async grantCreditsInternal(
    userId: string,
    source: "subscription" | "purchase" | "admin_grant",
    options: GrantCreditsOptions & { metadata?: CreditTransactionMetadata },
  ): Promise<CreditOperationResult> {
    const { amount, expiryMonths, sourceId, description, metadata } = options;

    logger.info("[credit-service] 开始发放积分", {
      userId,
      source,
      amount,
      expiryMonths,
    });

    // 获取或创建账户
    const account = await this.accountRepo.getOrCreate(userId);

    // 创建积分批次
    const expiresAt = this.calculateExpiryDate(expiryMonths);
    const desc = description ?? `${source} 发放 ${amount} 积分`;
    await this.batchRepo.create({
      userId,
      source,
      originalAmount: amount,
      remainingAmount: amount,
      expiresAt,
      sourceId,
      description: desc,
    });

    // 更新账户余额
    const newBalance = account.totalBalance + amount;
    const newEarned = account.totalEarned + amount;
    await this.accountRepo.updateBalance(account.id, {
      totalBalance: newBalance,
      totalEarned: newEarned,
    });

    // 记录流水
    await this.txnRepo.create({
      userId,
      type: "earn",
      amount,
      balanceAfter: newBalance,
      source,
      sourceId,
      description: desc,
      metadata,
    });

    logger.info("[credit-service] 积分发放完成", {
      userId,
      source,
      amount,
      newBalance,
    });

    return {
      success: true,
      creditsGranted: amount,
      newBalance,
    };
  }

  /**
   * 计算过期时间
   *
   * @param months 从现在起的月数
   * @returns 过期时间
   */
  private calculateExpiryDate(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 获取 CreditService 实例 */
export function getCreditService(deps?: CreditServiceDeps): CreditService {
  return new CreditService(deps);
}
