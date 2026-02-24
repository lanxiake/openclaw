/**
 * 记忆审计日志数据访问层
 *
 * 提供记忆系统审计日志的写入和查询功能。
 * 注意：审计日志不继承 TenantScopedRepository，因为它需要支持跨用户查询（管理员场景）。
 *
 * 核心行为：
 * - log: 异步写入审计日志（fire-and-forget 场景由调用方控制）
 * - findByUser: 按用户 ID 查询日志，支持操作类型过滤和分页
 * - findBySession: 按会话 ID 查询日志
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  memoryAuditLogs,
  type MemoryAuditLog,
  type MemoryAuditAction,
  type MemoryAuditSource,
  type MemoryAuditDetails,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 审计日志写入参数
 */
export interface LogMemoryAccessParams {
  /** 目标用户 ID */
  userId: string;
  /** 操作类型 */
  action: MemoryAuditAction;
  /** 操作来源 */
  source: MemoryAuditSource;
  /** 目标记录 ID */
  targetId?: string;
  /** 会话 ID */
  sessionId?: string;
  /** Agent ID */
  agentId?: string;
  /** 管理员 ID */
  adminId?: string;
  /** 操作详情 */
  details?: MemoryAuditDetails;
}

// ==================== MemoryAuditRepository ====================

/**
 * 记忆审计日志仓库
 *
 * 管理记忆系统的审计日志，支持写入和多维度查询
 */
export class MemoryAuditRepository {
  constructor(private readonly db: Database) {
    logger.debug("[MemoryAuditRepository] 构造成功");
  }

  /**
   * 写入审计日志
   *
   * @param params - 审计日志参数
   * @returns 创建的审计日志记录
   */
  async log(params: LogMemoryAccessParams): Promise<MemoryAuditLog> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[MemoryAuditRepository] 写入审计日志, id=${id}, userId=${params.userId}, action=${params.action}, source=${params.source}`,
    );

    const [log] = await this.db
      .insert(memoryAuditLogs)
      .values({
        id,
        userId: params.userId,
        action: params.action,
        source: params.source,
        targetId: params.targetId,
        sessionId: params.sessionId,
        agentId: params.agentId,
        adminId: params.adminId,
        details: params.details,
        createdAt: now,
      })
      .returning();

    return log;
  }

  /**
   * 按用户 ID 查询审计日志
   *
   * @param userId - 用户 ID
   * @param options - 查询选项（操作类型过滤、来源过滤、分页）
   * @returns 日志记录数组和总数
   */
  async findByUser(
    userId: string,
    options?: {
      action?: MemoryAuditAction;
      source?: MemoryAuditSource;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: MemoryAuditLog[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[MemoryAuditRepository] 按用户查询日志, userId=${userId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(memoryAuditLogs.userId, userId)];

    if (options?.action) {
      conditions.push(eq(memoryAuditLogs.action, options.action));
    }

    if (options?.source) {
      conditions.push(eq(memoryAuditLogs.source, options.source));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(memoryAuditLogs)
      .where(whereClause);

    const logs = await this.db
      .select()
      .from(memoryAuditLogs)
      .where(whereClause)
      .orderBy(desc(memoryAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 按会话 ID 查询审计日志
   *
   * @param sessionId - 会话 ID
   * @returns 日志记录数组
   */
  async findBySession(sessionId: string): Promise<MemoryAuditLog[]> {
    logger.debug(`[MemoryAuditRepository] 按会话查询日志, sessionId=${sessionId}`);

    const logs = await this.db
      .select()
      .from(memoryAuditLogs)
      .where(eq(memoryAuditLogs.sessionId, sessionId))
      .orderBy(desc(memoryAuditLogs.createdAt));

    return logs;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 MemoryAuditRepository 实例
 *
 * @param db - Drizzle ORM 数据库实例
 * @returns MemoryAuditRepository 实例
 */
export function getMemoryAuditRepository(db: Database): MemoryAuditRepository {
  logger.debug("[getMemoryAuditRepository] 创建实例");
  return new MemoryAuditRepository(db);
}
