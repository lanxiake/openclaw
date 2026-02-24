/**
 * LLM 调用日志数据访问层
 *
 * 提供 LLM API 调用日志的写入、查询、聚合统计和清理功能。
 * 支持按用户、模型、Provider、状态、频道和时间范围过滤。
 */

import { eq, and, gte, lte, lt, desc, sql, like } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import { llmCallLogs, type LlmCallLog, type LlmCallStatus, users } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// ==================== 类型定义 ====================

/**
 * LLM 调用日志查询参数
 */
export interface LlmCallLogQueryParams {
  /** 用户 ID */
  userId?: string;
  /** 用户名称（模糊搜索） */
  userName?: string;
  /** 模型提供商 */
  provider?: string;
  /** 模型标识 */
  model?: string;
  /** 调用状态 */
  status?: LlmCallStatus;
  /** 消息来源频道 */
  channel?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 分页大小 (默认 50) */
  limit?: number;
  /** 分页偏移 */
  offset?: number;
}

/**
 * LLM 调用日志聚合统计
 */
export interface LlmCallLogStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 成功调用次数 */
  successCalls: number;
  /** 失败调用次数 (包含 error, timeout, rate_limited, auth_error) */
  errorCalls: number;
  /** 总输入 Token 数 */
  totalInputTokens: number;
  /** 总输出 Token 数 */
  totalOutputTokens: number;
  /** 平均耗时 (毫秒) */
  avgDurationMs: number;
  /** 按 Provider 分组计数 */
  byProvider: Record<string, number>;
  /** 按 Model 分组计数 */
  byModel: Record<string, number>;
}

/**
 * LLM 调用日志写入参数
 *
 * 插入时不需要 id 和 createdAt（自动生成）
 */
export interface LlmCallLogInsertParams {
  userId?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  channel?: string | null;
  provider: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
  totalTokens?: number | null;
  durationMs?: number | null;
  status: LlmCallStatus;
  errorMessage?: string | null;
  inputContent?: string | null;
  outputContent?: string | null;
  creditsConsumed?: number | null;
  metadata?: Record<string, unknown> | null;
  calledAt: Date;
}

// ==================== Repository ====================

/**
 * LLM 调用日志仓库类
 *
 * 提供 LLM 调用日志的写入、查询、聚合统计和清理功能。
 */
export class LlmCallLogRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 插入单条 LLM 调用日志
   */
  async insert(entry: LlmCallLogInsertParams): Promise<void> {
    const id = generateId();

    logger.debug("[LlmCallLogRepo] insert", {
      id,
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
    });

    await this.db.insert(llmCallLogs).values({
      id,
      userId: entry.userId ?? null,
      sessionId: entry.sessionId ?? null,
      runId: entry.runId ?? null,
      channel: entry.channel ?? null,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      cacheReadTokens: entry.cacheReadTokens ?? null,
      cacheWriteTokens: entry.cacheWriteTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      durationMs: entry.durationMs ?? null,
      status: entry.status,
      errorMessage: entry.errorMessage ?? null,
      inputContent: entry.inputContent ?? null,
      outputContent: entry.outputContent ?? null,
      creditsConsumed: entry.creditsConsumed ?? null,
      metadata: entry.metadata ?? null,
      calledAt: entry.calledAt,
    });
  }

  /**
   * 批量插入 LLM 调用日志
   */
  async insertBatch(entries: LlmCallLogInsertParams[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    logger.debug(`[LlmCallLogRepo] insertBatch: ${entries.length} 条`);

    const values = entries.map((entry) => ({
      id: generateId(),
      userId: entry.userId ?? null,
      sessionId: entry.sessionId ?? null,
      runId: entry.runId ?? null,
      channel: entry.channel ?? null,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      cacheReadTokens: entry.cacheReadTokens ?? null,
      cacheWriteTokens: entry.cacheWriteTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      durationMs: entry.durationMs ?? null,
      status: entry.status,
      errorMessage: entry.errorMessage ?? null,
      inputContent: entry.inputContent ?? null,
      outputContent: entry.outputContent ?? null,
      creditsConsumed: entry.creditsConsumed ?? null,
      metadata: entry.metadata ?? null,
      calledAt: entry.calledAt,
    }));

    await this.db.insert(llmCallLogs).values(values);
  }

  /**
   * 查询 LLM 调用日志
   *
   * 支持多维度过滤和分页，LEFT JOIN users 表获取用户名称
   */
  async query(params: LlmCallLogQueryParams): Promise<{
    logs: (LlmCallLog & { userName?: string | null })[];
    total: number;
    hasMore: boolean;
  }> {
    const conditions = [];

    if (params.userId) {
      conditions.push(eq(llmCallLogs.userId, params.userId));
    }
    if (params.userName) {
      conditions.push(like(users.displayName, `%${params.userName}%`));
    }
    if (params.provider) {
      conditions.push(eq(llmCallLogs.provider, params.provider));
    }
    if (params.model) {
      conditions.push(eq(llmCallLogs.model, params.model));
    }
    if (params.status) {
      conditions.push(eq(llmCallLogs.status, params.status));
    }
    if (params.channel) {
      conditions.push(eq(llmCallLogs.channel, params.channel));
    }
    if (params.startTime) {
      conditions.push(gte(llmCallLogs.calledAt, params.startTime));
    }
    if (params.endTime) {
      conditions.push(lte(llmCallLogs.calledAt, params.endTime));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    logger.debug("[LlmCallLogRepo] query", { limit, offset, filters: conditions.length });

    /** 并行获取日志数据（含用户名）和总数 */
    const [rows, [countResult]] = await Promise.all([
      this.db
        .select({
          log: llmCallLogs,
          userName: users.displayName,
        })
        .from(llmCallLogs)
        .leftJoin(users, eq(llmCallLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(llmCallLogs.calledAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(llmCallLogs)
        .leftJoin(users, eq(llmCallLogs.userId, users.id))
        .where(whereClause),
    ]);

    const total = countResult?.count ?? 0;

    /** 合并日志数据与用户名 */
    const logs = rows.map((row) => ({
      ...row.log,
      userName: row.userName,
    }));

    return {
      logs,
      total,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * 获取 LLM 调用聚合统计
   *
   * 查询所有匹配记录，在内存中进行多维度聚合。
   */
  async getStats(params?: { startTime?: Date; endTime?: Date }): Promise<LlmCallLogStats> {
    const conditions = [];
    if (params?.startTime) {
      conditions.push(gte(llmCallLogs.calledAt, params.startTime));
    }
    if (params?.endTime) {
      conditions.push(lte(llmCallLogs.calledAt, params.endTime));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    /** 查询所有匹配的日志 */
    const rows = await this.db.select().from(llmCallLogs).where(whereClause);

    /** 在内存中聚合 */
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let successCalls = 0;
    let errorCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const row of rows) {
      /** 按 provider 计数 */
      byProvider[row.provider] = (byProvider[row.provider] ?? 0) + 1;

      /** 按 model 计数 */
      byModel[row.model] = (byModel[row.model] ?? 0) + 1;

      /** 成功/失败计数 */
      if (row.status === "success") {
        successCalls += 1;
      } else {
        errorCalls += 1;
      }

      /** Token 累计 */
      if (row.inputTokens != null) {
        totalInputTokens += row.inputTokens;
      }
      if (row.outputTokens != null) {
        totalOutputTokens += row.outputTokens;
      }

      /** 耗时累计 */
      if (row.durationMs != null) {
        totalDurationMs += row.durationMs;
        durationCount += 1;
      }
    }

    return {
      totalCalls: rows.length,
      successCalls,
      errorCalls,
      totalInputTokens,
      totalOutputTokens,
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      byProvider,
      byModel,
    };
  }

  /**
   * 清理旧 LLM 调用日志
   *
   * 删除指定时间之前的所有记录
   *
   * @param olderThan 截止日期，该日期之前的记录将被删除
   * @returns 删除的记录数
   */
  async cleanup(olderThan: Date): Promise<number> {
    logger.debug("[LlmCallLogRepo] cleanup", { olderThan: olderThan.toISOString() });

    const deleted = await this.db
      .delete(llmCallLogs)
      .where(lt(llmCallLogs.calledAt, olderThan))
      .returning();

    logger.debug("[LlmCallLogRepo] cleanup 完成", { deleted: deleted.length });

    return deleted.length;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 LlmCallLogRepository 实例
 */
export function getLlmCallLogRepository(db?: Database): LlmCallLogRepository {
  logger.debug("[LlmCallLogRepo] 创建 LlmCallLogRepository");
  return new LlmCallLogRepository(db ?? getDatabase());
}
