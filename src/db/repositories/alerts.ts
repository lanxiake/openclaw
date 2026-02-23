/**
 * 系统告警数据访问层
 *
 * 提供告警记录的 CRUD 和查询功能。
 * 告警由风险评估器自动生成或手动创建，支持确认和解决操作。
 */

import { eq, and, gte, desc, sql } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  systemAlerts,
  type SystemAlert,
  type AlertType,
  type AlertSeverity,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 系统告警仓库类
 */
export class AlertRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建告警记录
   */
  async create(data: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    source: string;
    auditLogId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SystemAlert> {
    const id = generateId();

    logger.debug("[AlertRepository] 创建告警", {
      id,
      type: data.type,
      severity: data.severity,
      source: data.source,
    });

    const [alert] = await this.db
      .insert(systemAlerts)
      .values({
        id,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        source: data.source,
        auditLogId: data.auditLogId,
        metadata: data.metadata,
        acknowledged: false,
        resolved: false,
        createdAt: new Date(),
      })
      .returning();

    logger.debug("[AlertRepository] 告警创建成功", { id });

    return alert;
  }

  /**
   * 查询告警列表
   *
   * 返回分页结果和未确认计数
   */
  async query(params: {
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: SystemAlert[]; total: number; unacknowledged: number }> {
    const conditions = [];

    if (params.severity) {
      conditions.push(eq(systemAlerts.severity, params.severity));
    }
    if (params.acknowledged !== undefined) {
      conditions.push(eq(systemAlerts.acknowledged, params.acknowledged));
    }
    if (params.resolved !== undefined) {
      conditions.push(eq(systemAlerts.resolved, params.resolved));
    }
    if (params.startDate) {
      conditions.push(gte(systemAlerts.createdAt, params.startDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    logger.debug("[AlertRepository] 查询告警列表", { limit, offset });

    // 并行获取数据、总数、未确认数
    const [alerts, [countResult], [unackResult]] = await Promise.all([
      this.db
        .select()
        .from(systemAlerts)
        .where(whereClause)
        .orderBy(desc(systemAlerts.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemAlerts)
        .where(whereClause),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemAlerts)
        .where(eq(systemAlerts.acknowledged, false)),
    ]);

    return {
      alerts,
      total: countResult?.count ?? 0,
      unacknowledged: unackResult?.count ?? 0,
    };
  }

  /**
   * 根据 ID 查询告警
   */
  async findById(id: string): Promise<SystemAlert | null> {
    logger.debug("[AlertRepository] 查找告警", { id });

    const [alert] = await this.db.select().from(systemAlerts).where(eq(systemAlerts.id, id));

    return alert ?? null;
  }

  /**
   * 确认告警
   *
   * 设置 acknowledged = true，记录确认人和时间
   */
  async acknowledge(id: string, acknowledgedBy: string): Promise<SystemAlert | null> {
    logger.debug("[AlertRepository] 确认告警", { id, acknowledgedBy });

    const [alert] = await this.db
      .update(systemAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(eq(systemAlerts.id, id))
      .returning();

    return alert ?? null;
  }

  /**
   * 解决告警
   *
   * 设置 resolved = true，记录解决时间
   */
  async resolve(id: string): Promise<SystemAlert | null> {
    logger.debug("[AlertRepository] 解决告警", { id });

    const [alert] = await this.db
      .update(systemAlerts)
      .set({
        resolved: true,
        resolvedAt: new Date(),
      })
      .where(eq(systemAlerts.id, id))
      .returning();

    return alert ?? null;
  }

  /**
   * 统计未确认告警数量
   */
  async countUnacknowledged(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemAlerts)
      .where(eq(systemAlerts.acknowledged, false));

    return result?.count ?? 0;
  }

  /**
   * 清理已解决的旧告警
   *
   * 删除已解决且超过保留天数的告警记录
   */
  async cleanupOld(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    logger.debug("[AlertRepository] 清理旧告警", { retentionDays, cutoff });

    const result = await this.db.delete(systemAlerts).where(
      and(
        eq(systemAlerts.resolved, true),
        gte(systemAlerts.createdAt, new Date(0)), // 确保有 createdAt
        sql`${systemAlerts.createdAt} < ${cutoff}`,
      ),
    );

    const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0;

    logger.debug("[AlertRepository] 旧告警清理完成", { deleted });

    return deleted;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 AlertRepository 实例
 */
export function getAlertRepository(db?: Database): AlertRepository {
  return new AlertRepository(db ?? getDatabase());
}
