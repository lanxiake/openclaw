/**
 * 积分系统 Schema
 *
 * 包含积分账户、积分批次、积分流水、邀请记录、模型定价等表。
 * 积分制替代原有的套餐分层制，所有用户通过积分消费大模型调用。
 *
 * 核心概念：
 * - 积分账户（credit_accounts）：每用户一条，记录余额汇总
 * - 积分批次（credit_batches）：每次获得积分为一个独立批次，各有独立过期时间
 * - 积分流水（credit_transactions）：不可变的流水记录，用于审计
 * - 邀请记录（invite_records）：用户邀请关系和奖励
 * - 模型定价（model_pricing）：管理员配置的模型积分消耗规则
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

import { users } from "./users.js";

// ============================================================================
// 积分来源枚举
// ============================================================================

/** 积分批次来源类型 */
export type CreditSource =
  | "register" // 注册赠送
  | "invite" // 邀请奖励
  | "subscription" // 包月发放
  | "purchase" // 加油包购买
  | "admin_grant"; // 管理员手动发放

/** 积分流水类型 */
export type CreditTransactionType =
  | "earn" // 获得积分
  | "consume" // 消费积分
  | "expire" // 过期清零
  | "refund" // 退款返还
  | "admin_adjust"; // 管理员调整

/** 积分流水来源（比 CreditSource 更细化） */
export type TransactionSource =
  | "register" // 注册赠送
  | "invite" // 邀请奖励
  | "subscription" // 包月发放
  | "purchase" // 加油包购买
  | "model_call" // 大模型调用消费
  | "admin_grant" // 管理员发放
  | "expiry_cleanup" // 过期清理
  | "refund"; // 退款

/** 邀请记录状态 */
export type InviteStatus = "completed" | "revoked";

// ============================================================================
// credit_accounts 积分账户表
// ============================================================================

/**
 * 积分账户表
 *
 * 每个用户一条记录，记录积分余额汇总。
 * total_balance = sum(active batches remaining_amount)
 */
export const creditAccounts = pgTable(
  "credit_accounts",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID（唯一） */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 当前可用总积分 */
    totalBalance: integer("total_balance").notNull().default(0),
    /** 历史总获得积分 */
    totalEarned: integer("total_earned").notNull().default(0),
    /** 历史总消费积分 */
    totalConsumed: integer("total_consumed").notNull().default(0),
    /** 历史总过期积分 */
    totalExpired: integer("total_expired").notNull().default(0),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("credit_accounts_user_id_unique_idx").on(table.userId)],
);

// ============================================================================
// credit_batches 积分批次表
// ============================================================================

/**
 * 积分批次表
 *
 * 每次积分获得是一个独立批次，各有独立过期时间。
 * 消费时按 FIFO（先过期先消费）从 remaining_amount 扣减。
 */
export const creditBatches = pgTable(
  "credit_batches",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 来源类型 */
    source: text("source", {
      enum: ["register", "invite", "subscription", "purchase", "admin_grant"],
    }).notNull(),
    /** 原始积分数 */
    originalAmount: integer("original_amount").notNull(),
    /** 剩余积分数 */
    remainingAmount: integer("remaining_amount").notNull(),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 关联来源 ID（订单号/邀请记录ID等） */
    sourceId: text("source_id"),
    /** 描述 */
    description: text("description"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // FIFO 消费查询：按用户+过期时间排序
    index("credit_batches_user_expires_idx").on(table.userId, table.expiresAt),
    // 按来源查询
    index("credit_batches_user_source_idx").on(table.userId, table.source),
    // 过期清理：找出已过期且有余额的批次
    index("credit_batches_expires_remaining_idx").on(table.expiresAt),
  ],
);

// ============================================================================
// credit_transactions 积分流水表
// ============================================================================

/**
 * 积分流水表
 *
 * 每一笔积分变动的明细记录，不可修改，用于审计追溯。
 */
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 用户 ID */
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 关联批次 ID（消费/过期时记录从哪个批次操作） */
    batchId: text("batch_id").references(() => creditBatches.id, { onDelete: "set null" }),
    /** 流水类型 */
    type: text("type", {
      enum: ["earn", "consume", "expire", "refund", "admin_adjust"],
    }).notNull(),
    /** 变动量（正数获得，负数消费/过期） */
    amount: integer("amount").notNull(),
    /** 变动后余额 */
    balanceAfter: integer("balance_after").notNull(),
    /** 流水来源 */
    source: text("source", {
      enum: [
        "register",
        "invite",
        "subscription",
        "purchase",
        "model_call",
        "admin_grant",
        "expiry_cleanup",
        "refund",
      ],
    }).notNull(),
    /** 关联来源 ID */
    sourceId: text("source_id"),
    /** 描述 */
    description: text("description"),
    /** 扩展信息（如 model_name, input_tokens, output_tokens） */
    metadata: jsonb("metadata").$type<CreditTransactionMetadata>(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 用户流水时间线
    index("credit_transactions_user_created_idx").on(table.userId, table.createdAt),
    // 按类型查询
    index("credit_transactions_user_type_idx").on(table.userId, table.type),
    // 按来源追溯
    index("credit_transactions_source_idx").on(table.source, table.sourceId),
  ],
);

/**
 * 积分流水扩展信息类型
 */
export interface CreditTransactionMetadata {
  /** 模型名称（消费时） */
  modelId?: string;
  /** 输入 tokens 数（消费时） */
  inputTokens?: number;
  /** 输出 tokens 数（消费时） */
  outputTokens?: number;
  /** 每百万 input tokens 积分单价 */
  inputPrice?: number;
  /** 每百万 output tokens 积分单价 */
  outputPrice?: number;
  /** 应用的倍率 */
  multiplier?: number;
  /** 管理员 ID（管理员操作时） */
  adminId?: string;
  /** 管理员备注 */
  adminNote?: string;
  /** 其他扩展信息 */
  [key: string]: unknown;
}

// ============================================================================
// invite_records 邀请记录表
// ============================================================================

/**
 * 邀请记录表
 *
 * 记录用户间的邀请关系和积分奖励。
 * 一个被邀请人只能被邀请一次（invitee_user_id UNIQUE）。
 */
export const inviteRecords = pgTable(
  "invite_records",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 邀请人用户 ID */
    inviterUserId: text("inviter_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 被邀请人用户 ID（唯一，一人只能被邀请一次） */
    inviteeUserId: text("invitee_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 奖励的积分数 */
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    /** 状态 */
    status: text("status", {
      enum: ["completed", "revoked"],
    })
      .notNull()
      .default("completed"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 被邀请人唯一约束
    uniqueIndex("invite_records_invitee_unique_idx").on(table.inviteeUserId),
    // 查询某人邀请了多少人
    index("invite_records_inviter_idx").on(table.inviterUserId),
  ],
);

// ============================================================================
// model_pricing 模型定价表
// ============================================================================

/**
 * 模型定价表
 *
 * 管理员配置每个模型的积分消耗规则。
 * 消耗公式：ceil((input_tokens × input_price + output_tokens × output_price) / 1,000,000 × multiplier)
 */
export const modelPricing = pgTable(
  "model_pricing",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 模型标识（如 "anthropic/claude-sonnet-4-20250514"） */
    modelId: text("model_id").unique().notNull(),
    /** 模型显示名称 */
    modelName: text("model_name").notNull(),
    /** 每百万 input tokens 消耗积分 */
    inputPrice: integer("input_price").notNull(),
    /** 每百万 output tokens 消耗积分 */
    outputPrice: integer("output_price").notNull(),
    /** 管理员倍率调节（默认 1.00） */
    multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull().default("1.00"),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("model_pricing_is_active_idx").on(table.isActive)],
);

// ============================================================================
// Relations 关系定义
// ============================================================================

/** 积分账户关系 */
export const creditAccountsRelations = relations(creditAccounts, ({ one }) => ({
  user: one(users, {
    fields: [creditAccounts.userId],
    references: [users.id],
  }),
}));

/** 积分批次关系 */
export const creditBatchesRelations = relations(creditBatches, ({ one, many }) => ({
  user: one(users, {
    fields: [creditBatches.userId],
    references: [users.id],
  }),
  transactions: many(creditTransactions),
}));

/** 积分流水关系 */
export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  batch: one(creditBatches, {
    fields: [creditTransactions.batchId],
    references: [creditBatches.id],
  }),
}));

/** 邀请记录关系 */
export const inviteRecordsRelations = relations(inviteRecords, ({ one }) => ({
  inviter: one(users, {
    fields: [inviteRecords.inviterUserId],
    references: [users.id],
    relationName: "inviter",
  }),
  invitee: one(users, {
    fields: [inviteRecords.inviteeUserId],
    references: [users.id],
    relationName: "invitee",
  }),
}));

// ============================================================================
// Zod Schemas
// ============================================================================

export const insertCreditAccountSchema = createInsertSchema(creditAccounts);
export const selectCreditAccountSchema = createSelectSchema(creditAccounts);
export const insertCreditBatchSchema = createInsertSchema(creditBatches);
export const selectCreditBatchSchema = createSelectSchema(creditBatches);
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions);
export const selectCreditTransactionSchema = createSelectSchema(creditTransactions);
export const insertInviteRecordSchema = createInsertSchema(inviteRecords);
export const selectInviteRecordSchema = createSelectSchema(inviteRecords);
export const insertModelPricingSchema = createInsertSchema(modelPricing);
export const selectModelPricingSchema = createSelectSchema(modelPricing);

// ============================================================================
// Type Exports
// ============================================================================

export type CreditAccount = typeof creditAccounts.$inferSelect;
export type NewCreditAccount = typeof creditAccounts.$inferInsert;
export type CreditBatch = typeof creditBatches.$inferSelect;
export type NewCreditBatch = typeof creditBatches.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type InviteRecord = typeof inviteRecords.$inferSelect;
export type NewInviteRecord = typeof inviteRecords.$inferInsert;
export type ModelPricingRecord = typeof modelPricing.$inferSelect;
export type NewModelPricingRecord = typeof modelPricing.$inferInsert;
