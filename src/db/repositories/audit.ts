/**
 * 审计日志数据访问层
 *
 * 提供审计日志写入和查询功能
 */

import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  auditLogs,
  exportLogs,
  type AuditLog,
  type NewAuditLog,
  type AuditRiskLevel,
  type AuditCategory,
  type AuditLogDetails,
  type ExportLog,
  type NewExportLog,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../shared/logging/logger.js";

const logger = getLogger();

/**
 * 审计日志仓库类
 */
export class AuditLogRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 写入审计日志
   */
  async log(data: {
    userId?: string;
    deviceId?: string;
    category: AuditCategory;
    action: string;
    resourceType?: string;
    resourceId?: string;
    riskLevel?: AuditRiskLevel;
    ipAddress?: string;
    userAgent?: string;
    details?: AuditLogDetails;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    result: "success" | "failure" | "partial";
    errorMessage?: string;
  }): Promise<AuditLog> {
    const id = generateId();

    const [log] = await this.db
      .insert(auditLogs)
      .values({
        id,
        ...data,
        riskLevel: data.riskLevel ?? "low",
        createdAt: new Date(),
      })
      .returning();

    // 高风险操作额外记录到文件日志
    if (data.riskLevel === "high" || data.riskLevel === "critical") {
      logger.warn("[audit] High-risk operation", {
        auditLogId: id,
        category: data.category,
        action: data.action,
        riskLevel: data.riskLevel,
        userId: data.userId,
      });
    }

    return log;
  }

  /**
   * 查询审计日志
   */
  async query(params: {
    userId?: string;
    category?: AuditCategory;
    riskLevel?: AuditRiskLevel;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions = [];

    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId));
    }
    if (params.category) {
      conditions.push(eq(auditLogs.category, params.category));
    }
    if (params.riskLevel) {
      conditions.push(eq(auditLogs.riskLevel, params.riskLevel));
    }
    if (params.startDate) {
      conditions.push(gte(auditLogs.createdAt, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(auditLogs.createdAt, params.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    // 获取数据
    const logs = await this.db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);

    return {
      logs,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 根据 ID 获取日志
   */
  async findById(id: string): Promise<AuditLog | null> {
    const [log] = await this.db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log ?? null;
  }

  /**
   * 获取用户最近的审计日志
   */
  async getRecentByUser(userId: string, limit: number = 20): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * 获取高风险操作日志
   */
  async getHighRiskLogs(since: Date, limit: number = 100): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(
        and(gte(auditLogs.createdAt, since), sql`${auditLogs.riskLevel} IN ('high', 'critical')`),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * 清理过期日志
   *
   * 注意: 生产环境应使用分区表自动清理
   */
  async cleanupOld(retentionDays: number = 365): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.db.delete(auditLogs).where(sql`${auditLogs.createdAt} < ${cutoff}`);
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info("[audit-repo] Cleaned up old audit logs", {
        count,
        cutoffDate: cutoff.toISOString(),
      });
    }
    return count;
  }
}

/**
 * 导出日志仓库类
 */
export class ExportLogRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建导出请求
   */
  async create(data: {
    userId: string;
    exportType: "user_data" | "audit_logs" | "chat_history" | "files";
    format: "json" | "csv" | "zip";
    params?: Record<string, unknown>;
    expiresInMs?: number;
  }): Promise<ExportLog> {
    const id = generateId();
    const expiresAt = new Date(
      Date.now() + (data.expiresInMs ?? 7 * 24 * 60 * 60 * 1000), // 默认 7 天
    );

    const [log] = await this.db
      .insert(exportLogs)
      .values({
        id,
        userId: data.userId,
        exportType: data.exportType,
        format: data.format,
        status: "pending",
        params: data.params,
        requestedAt: new Date(),
        expiresAt,
      })
      .returning();

    logger.info("[export-log-repo] Export request created", {
      exportId: id,
      userId: data.userId,
      exportType: data.exportType,
    });

    return log;
  }

  /**
   * 更新导出状态为处理中
   */
  async markProcessing(id: string): Promise<void> {
    await this.db.update(exportLogs).set({ status: "processing" }).where(eq(exportLogs.id, id));
  }

  /**
   * 标记导出完成
   */
  async markCompleted(id: string, filePath: string, fileSize: number): Promise<void> {
    await this.db
      .update(exportLogs)
      .set({
        status: "completed",
        filePath,
        fileSize: String(fileSize),
        completedAt: new Date(),
      })
      .where(eq(exportLogs.id, id));

    logger.info("[export-log-repo] Export completed", {
      exportId: id,
      fileSize,
    });
  }

  /**
   * 标记导出失败
   */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db
      .update(exportLogs)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(exportLogs.id, id));

    logger.error("[export-log-repo] Export failed", {
      exportId: id,
      error: errorMessage,
    });
  }

  /**
   * 记录下载
   */
  async recordDownload(id: string): Promise<void> {
    await this.db
      .update(exportLogs)
      .set({
        downloadCount: sql`${exportLogs.downloadCount}::int + 1`,
        lastDownloadAt: new Date(),
      })
      .where(eq(exportLogs.id, id));
  }

  /**
   * 根据 ID 获取导出记录
   */
  async findById(id: string): Promise<ExportLog | null> {
    const [log] = await this.db.select().from(exportLogs).where(eq(exportLogs.id, id));
    return log ?? null;
  }

  /**
   * 获取用户的导出历史
   */
  async findByUserId(userId: string, limit: number = 20): Promise<ExportLog[]> {
    return this.db
      .select()
      .from(exportLogs)
      .where(eq(exportLogs.userId, userId))
      .orderBy(desc(exportLogs.requestedAt))
      .limit(limit);
  }

  /**
   * 清理过期导出
   */
  async cleanupExpired(): Promise<number> {
    // 标记为过期
    await this.db
      .update(exportLogs)
      .set({ status: "expired" })
      .where(
        and(
          sql`${exportLogs.expiresAt} < NOW()`,
          sql`${exportLogs.status} IN ('completed', 'processing', 'pending')`,
        ),
      );

    // 删除很老的记录
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 天
    const result = await this.db
      .delete(exportLogs)
      .where(sql`${exportLogs.requestedAt} < ${cutoff}`);

    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}

// 导出单例工厂函数
export function getAuditLogRepository(db?: Database): AuditLogRepository {
  return new AuditLogRepository(db);
}

export function getExportLogRepository(db?: Database): ExportLogRepository {
  return new ExportLogRepository(db);
}

// 便捷的审计日志写入函数
export async function audit(data: {
  userId?: string;
  deviceId?: string;
  category: AuditCategory;
  action: string;
  resourceType?: string;
  resourceId?: string;
  riskLevel?: AuditRiskLevel;
  ipAddress?: string;
  userAgent?: string;
  details?: AuditLogDetails;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  result: "success" | "failure" | "partial";
  errorMessage?: string;
}): Promise<void> {
  try {
    const repo = getAuditLogRepository();
    await repo.log(data);
  } catch (error) {
    // 审计日志失败不应影响主业务
    logger.error("[audit] Failed to write audit log", {
      error: error instanceof Error ? error.message : "Unknown error",
      data,
    });
  }
}
