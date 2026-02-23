/**
 * 积分系统数据访问层
 *
 * 包含以下 Repository：
 * - CreditAccountRepository: 积分账户管理
 * - CreditBatchRepository: 积分批次管理（FIFO 消费）
 * - CreditTransactionRepository: 积分流水记录
 * - InviteRepository: 邀请记录管理
 * - ModelPricingRepository: 模型定价配置
 */

import { eq, and, gt, desc, sql, lt } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  creditAccounts,
  creditBatches,
  creditTransactions,
  inviteRecords,
  modelPricing,
  type CreditAccount,
  type CreditBatch,
  type CreditTransaction,
  type CreditTransactionMetadata,
  type InviteRecord,
  type ModelPricingRecord,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// ============================================================================
// CreditAccountRepository 积分账户仓库
// ============================================================================

/**
 * 积分账户仓库
 *
 * 管理用户积分账户的 CRUD 操作。
 * 每个用户有且仅有一个积分账户。
 */
export class CreditAccountRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建积分账户
   */
  async create(userId: string): Promise<CreditAccount> {
    const id = generateId();
    const now = new Date();

    const [account] = await this.db
      .insert(creditAccounts)
      .values({
        id,
        userId,
        totalBalance: 0,
        totalEarned: 0,
        totalConsumed: 0,
        totalExpired: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[credit-account-repo] 积分账户已创建", { userId, accountId: id });
    return account;
  }

  /**
   * 根据用户 ID 查询积分账户
   */
  async findByUserId(userId: string): Promise<CreditAccount | null> {
    const [account] = await this.db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId));
    return account ?? null;
  }

  /**
   * 更新积分余额
   */
  async updateBalance(
    id: string,
    data: Partial<
      Pick<CreditAccount, "totalBalance" | "totalEarned" | "totalConsumed" | "totalExpired">
    >,
  ): Promise<CreditAccount | null> {
    const [account] = await this.db
      .update(creditAccounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(creditAccounts.id, id))
      .returning();

    if (account) {
      logger.info("[credit-account-repo] 积分余额已更新", {
        accountId: id,
        totalBalance: account.totalBalance,
      });
    }
    return account ?? null;
  }

  /**
   * 获取或创建积分账户
   *
   * 如果用户已有账户则返回，否则创建新账户。
   */
  async getOrCreate(userId: string): Promise<CreditAccount> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.create(userId);
  }
}

// ============================================================================
// CreditBatchRepository 积分批次仓库
// ============================================================================

/** 创建积分批次的输入参数 */
interface CreateBatchParams {
  userId: string;
  source: "register" | "invite" | "subscription" | "purchase" | "admin_grant";
  originalAmount: number;
  remainingAmount: number;
  expiresAt: Date;
  sourceId?: string;
  description?: string;
}

/**
 * 积分批次仓库
 *
 * 管理积分批次的创建、查询和扣减。
 * 消费时按 FIFO（先过期先消费）从各批次扣减。
 */
export class CreditBatchRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建积分批次
   */
  async create(params: CreateBatchParams): Promise<CreditBatch> {
    const id = generateId();

    const [batch] = await this.db
      .insert(creditBatches)
      .values({
        id,
        userId: params.userId,
        source: params.source,
        originalAmount: params.originalAmount,
        remainingAmount: params.remainingAmount,
        expiresAt: params.expiresAt,
        sourceId: params.sourceId,
        description: params.description,
        createdAt: new Date(),
      })
      .returning();

    logger.info("[credit-batch-repo] 积分批次已创建", {
      batchId: id,
      userId: params.userId,
      source: params.source,
      amount: params.originalAmount,
      expiresAt: params.expiresAt.toISOString(),
    });
    return batch;
  }

  /**
   * 查询用户所有有效批次（未过期且有余额）
   *
   * 按过期时间升序排列，用于 FIFO 消费。
   * 注意：Mock 环境不支持排序，集成测试验证实际排序。
   */
  async findActiveByUserId(userId: string): Promise<CreditBatch[]> {
    return this.db
      .select()
      .from(creditBatches)
      .where(
        and(
          eq(creditBatches.userId, userId),
          gt(creditBatches.remainingAmount, 0),
          gt(creditBatches.expiresAt, new Date()),
        ),
      )
      .orderBy(creditBatches.expiresAt);
  }

  /**
   * 扣减批次余额
   *
   * 原子操作：remaining_amount = remaining_amount - amount
   */
  async deductAmount(batchId: string, amount: number): Promise<CreditBatch | null> {
    const [batch] = await this.db
      .update(creditBatches)
      .set({
        remainingAmount: sql`${creditBatches.remainingAmount} - ${amount}`,
      })
      .where(eq(creditBatches.id, batchId))
      .returning();

    if (batch) {
      logger.info("[credit-batch-repo] 批次余额已扣减", {
        batchId,
        deducted: amount,
        remaining: batch.remainingAmount,
      });
    }
    return batch ?? null;
  }

  /**
   * 查询已过期且有余额的批次（用于定时清理）
   */
  async findExpiredWithBalance(): Promise<CreditBatch[]> {
    return this.db
      .select()
      .from(creditBatches)
      .where(and(lt(creditBatches.expiresAt, new Date()), gt(creditBatches.remainingAmount, 0)));
  }

  /**
   * 清零过期批次余额
   */
  async clearExpiredBatch(batchId: string): Promise<CreditBatch | null> {
    const [batch] = await this.db
      .update(creditBatches)
      .set({
        remainingAmount: 0,
      })
      .where(eq(creditBatches.id, batchId))
      .returning();

    if (batch) {
      logger.info("[credit-batch-repo] 过期批次已清零", { batchId });
    }
    return batch ?? null;
  }
}

// ============================================================================
// CreditTransactionRepository 积分流水仓库
// ============================================================================

/** 创建积分流水的输入参数 */
interface CreateTransactionParams {
  userId: string;
  batchId?: string;
  type: "earn" | "consume" | "expire" | "refund" | "admin_adjust";
  amount: number;
  balanceAfter: number;
  source:
    | "register"
    | "invite"
    | "subscription"
    | "purchase"
    | "model_call"
    | "admin_grant"
    | "expiry_cleanup"
    | "refund";
  sourceId?: string;
  description?: string;
  metadata?: CreditTransactionMetadata;
}

/** 流水查询分页参数 */
interface TransactionQueryOptions {
  limit?: number;
  offset?: number;
}

/**
 * 积分流水仓库
 *
 * 记录和查询所有积分变动明细。
 * 流水记录不可修改，用于审计追溯。
 */
export class CreditTransactionRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建积分流水
   */
  async create(params: CreateTransactionParams): Promise<CreditTransaction> {
    const id = generateId();

    const [txn] = await this.db
      .insert(creditTransactions)
      .values({
        id,
        userId: params.userId,
        batchId: params.batchId,
        type: params.type,
        amount: params.amount,
        balanceAfter: params.balanceAfter,
        source: params.source,
        sourceId: params.sourceId,
        description: params.description,
        metadata: params.metadata,
        createdAt: new Date(),
      })
      .returning();

    logger.info("[credit-txn-repo] 积分流水已记录", {
      txnId: id,
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceAfter: params.balanceAfter,
      source: params.source,
    });
    return txn;
  }

  /**
   * 查询用户流水列表（按创建时间倒序）
   */
  async findByUserId(
    userId: string,
    options: TransactionQueryOptions = {},
  ): Promise<CreditTransaction[]> {
    const { limit = 50, offset = 0 } = options;

    return this.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * 按类型查询用户流水
   */
  async findByUserIdAndType(
    userId: string,
    type: "earn" | "consume" | "expire" | "refund" | "admin_adjust",
  ): Promise<CreditTransaction[]> {
    return this.db
      .select()
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, type)))
      .orderBy(desc(creditTransactions.createdAt));
  }
}

// ============================================================================
// InviteRepository 邀请记录仓库
// ============================================================================

/** 创建邀请记录的输入参数 */
interface CreateInviteParams {
  inviterUserId: string;
  inviteeUserId: string;
  creditsAwarded: number;
}

/**
 * 邀请记录仓库
 *
 * 管理用户间的邀请关系和积分奖励。
 */
export class InviteRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建邀请记录
   */
  async create(params: CreateInviteParams): Promise<InviteRecord> {
    const id = generateId();

    const [record] = await this.db
      .insert(inviteRecords)
      .values({
        id,
        inviterUserId: params.inviterUserId,
        inviteeUserId: params.inviteeUserId,
        creditsAwarded: params.creditsAwarded,
        status: "completed",
        createdAt: new Date(),
      })
      .returning();

    logger.info("[invite-repo] 邀请记录已创建", {
      recordId: id,
      inviter: params.inviterUserId,
      invitee: params.inviteeUserId,
      credits: params.creditsAwarded,
    });
    return record;
  }

  /**
   * 统计邀请人已发放的积分总数
   */
  async getTotalAwardedCredits(inviterUserId: string): Promise<number> {
    const records = await this.db
      .select()
      .from(inviteRecords)
      .where(
        and(eq(inviteRecords.inviterUserId, inviterUserId), eq(inviteRecords.status, "completed")),
      );

    return records.reduce((sum, r) => sum + r.creditsAwarded, 0);
  }

  /**
   * 统计邀请人数
   */
  async getInviteCount(inviterUserId: string): Promise<number> {
    const records = await this.db
      .select()
      .from(inviteRecords)
      .where(eq(inviteRecords.inviterUserId, inviterUserId));

    return records.length;
  }

  /**
   * 检查用户是否已被邀请
   */
  async isUserInvited(inviteeUserId: string): Promise<boolean> {
    const [record] = await this.db
      .select()
      .from(inviteRecords)
      .where(eq(inviteRecords.inviteeUserId, inviteeUserId));

    return record !== undefined;
  }

  /**
   * 查询邀请人的所有邀请记录
   */
  async findByInviterId(inviterUserId: string): Promise<InviteRecord[]> {
    return this.db
      .select()
      .from(inviteRecords)
      .where(eq(inviteRecords.inviterUserId, inviterUserId))
      .orderBy(desc(inviteRecords.createdAt));
  }
}

// ============================================================================
// ModelPricingRepository 模型定价仓库
// ============================================================================

/** 创建模型定价的输入参数 */
interface CreateModelPricingParams {
  modelId: string;
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  multiplier?: string;
}

/** 更新模型定价的输入参数 */
interface UpdateModelPricingParams {
  modelName?: string;
  inputPrice?: number;
  outputPrice?: number;
  multiplier?: string;
  isActive?: boolean;
}

/**
 * 模型定价仓库
 *
 * 管理各大模型的积分消耗规则。
 * 消耗公式：ceil((input_tokens × input_price + output_tokens × output_price) / 1,000,000 × multiplier)
 */
export class ModelPricingRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建模型定价记录
   */
  async create(params: CreateModelPricingParams): Promise<ModelPricingRecord> {
    const id = generateId();
    const now = new Date();

    const [pricing] = await this.db
      .insert(modelPricing)
      .values({
        id,
        modelId: params.modelId,
        modelName: params.modelName,
        inputPrice: params.inputPrice,
        outputPrice: params.outputPrice,
        multiplier: params.multiplier ?? "1.00",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info("[model-pricing-repo] 模型定价已创建", {
      pricingId: id,
      modelId: params.modelId,
      inputPrice: params.inputPrice,
      outputPrice: params.outputPrice,
    });
    return pricing;
  }

  /**
   * 根据模型 ID 查询定价
   */
  async findByModelId(modelId: string): Promise<ModelPricingRecord | null> {
    const [pricing] = await this.db
      .select()
      .from(modelPricing)
      .where(eq(modelPricing.modelId, modelId));
    return pricing ?? null;
  }

  /**
   * 查询所有激活的模型定价
   */
  async findAllActive(): Promise<ModelPricingRecord[]> {
    return this.db.select().from(modelPricing).where(eq(modelPricing.isActive, true));
  }

  /**
   * 查询所有模型定价（含已禁用）
   */
  async findAll(): Promise<ModelPricingRecord[]> {
    return this.db.select().from(modelPricing);
  }

  /**
   * 根据 ID 删除模型定价
   *
   * @param id 定价记录 ID
   * @returns 是否删除成功
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.delete(modelPricing).where(eq(modelPricing.id, id)).returning();

    if (result.length > 0) {
      logger.info("[model-pricing-repo] 模型定价已删除", {
        pricingId: id,
        modelId: result[0].modelId,
      });
    }
    return result.length > 0;
  }

  /**
   * 更新模型定价
   */
  async update(id: string, params: UpdateModelPricingParams): Promise<ModelPricingRecord | null> {
    const [pricing] = await this.db
      .update(modelPricing)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(eq(modelPricing.id, id))
      .returning();

    if (pricing) {
      logger.info("[model-pricing-repo] 模型定价已更新", {
        pricingId: id,
        modelId: pricing.modelId,
      });
    }
    return pricing ?? null;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 获取积分账户仓库实例 */
export function getCreditAccountRepository(db?: Database): CreditAccountRepository {
  return new CreditAccountRepository(db);
}

/** 获取积分批次仓库实例 */
export function getCreditBatchRepository(db?: Database): CreditBatchRepository {
  return new CreditBatchRepository(db);
}

/** 获取积分流水仓库实例 */
export function getCreditTransactionRepository(db?: Database): CreditTransactionRepository {
  return new CreditTransactionRepository(db);
}

/** 获取邀请记录仓库实例 */
export function getInviteRepository(db?: Database): InviteRepository {
  return new InviteRepository(db);
}

/** 获取模型定价仓库实例 */
export function getModelPricingRepository(db?: Database): ModelPricingRepository {
  return new ModelPricingRepository(db);
}
