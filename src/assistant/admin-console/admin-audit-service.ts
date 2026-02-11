/**
 * 管理后台审计日志服务
 *
 * 提供审计日志查询、导出、统计等功能
 */

import { eq, and, or, gt, lt, desc, asc, like, sql, inArray } from "drizzle-orm";

import { getDatabase, type Database } from "../../db/connection.js";
import { adminAuditLogs, admins, type AdminAuditLog } from "../../db/schema/index.js";
import { getLogger } from "../../shared/logging/logger.js";

const logger = getLogger();

/**
 * 审计日志列表查询参数
 */
export interface AuditLogListParams {
  /** 搜索关键词 (管理员用户名/目标名称) */
  search?: string;
  /** 管理员 ID 过滤 */
  adminId?: string;
  /** 操作类型过滤 */
  action?: string;
  /** 目标类型过滤 */
  targetType?: "user" | "subscription" | "skill" | "admin" | "system" | "plan" | "order" | "all";
  /** 风险等级过滤 */
  riskLevel?: "low" | "medium" | "high" | "critical" | "all";
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
  /** 分页: 页码 */
  page?: number;
  /** 分页: 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  orderBy?: "createdAt" | "riskLevel";
  /** 排序方向 */
  orderDir?: "asc" | "desc";
}

/**
 * 审计日志列表项
 */
export interface AuditLogListItem {
  id: string;
  adminId: string | null;
  adminUsername: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  createdAt: Date;
}

/**
 * 审计日志列表查询结果
 */
export interface AuditLogListResult {
  logs: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 审计日志详情
 */
export interface AuditLogDetail extends AuditLogListItem {
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  /** 管理员信息 */
  admin: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  } | null;
}

/**
 * 审计日志统计
 */
export interface AuditLogStats {
  /** 总操作数 */
  totalActions: number;
  /** 今日操作数 */
  todayActions: number;
  /** 本周操作数 */
  weekActions: number;
  /** 高风险操作数 */
  highRiskActions: number;
  /** 按操作类型分布 */
  actionDistribution: Array<{ action: string; count: number }>;
  /** 按管理员分布 */
  adminDistribution: Array<{ adminUsername: string; count: number }>;
  /** 按风险等级分布 */
  riskDistribution: Array<{ riskLevel: string; count: number }>;
}

/**
 * 管理后台审计日志服务类
 */
export class AdminAuditService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 查询审计日志列表
   */
  async listAuditLogs(params: AuditLogListParams = {}): Promise<AuditLogListResult> {
    const {
      search,
      adminId,
      action,
      targetType = "all",
      riskLevel = "all",
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDir = "desc",
    } = params;

    // 构建查询条件
    const conditions = [];

    if (adminId) {
      conditions.push(eq(adminAuditLogs.adminId, adminId));
    }
    if (action) {
      conditions.push(eq(adminAuditLogs.action, action));
    }
    if (targetType !== "all") {
      conditions.push(eq(adminAuditLogs.targetType, targetType));
    }
    if (riskLevel !== "all") {
      conditions.push(eq(adminAuditLogs.riskLevel, riskLevel));
    }
    if (startDate) {
      conditions.push(gt(adminAuditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lt(adminAuditLogs.createdAt, endDate));
    }
    if (search) {
      conditions.push(
        or(
          like(adminAuditLogs.adminUsername, `%${search}%`),
          like(adminAuditLogs.targetName, `%${search}%`),
          like(adminAuditLogs.action, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(whereClause);

    // 排序
    const orderColumn =
      orderBy === "riskLevel" ? adminAuditLogs.riskLevel : adminAuditLogs.createdAt;
    const orderFn = orderDir === "asc" ? asc : desc;

    // 分页查询
    const offset = (page - 1) * pageSize;
    const logList = await this.db
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset(offset);

    const logs: AuditLogListItem[] = logList.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminUsername: log.adminUsername,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetName: log.targetName,
      details: log.details as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      riskLevel: log.riskLevel,
      createdAt: log.createdAt,
    }));

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取审计日志详情
   */
  async getAuditLogDetail(logId: string): Promise<AuditLogDetail | null> {
    const [log] = await this.db.select().from(adminAuditLogs).where(eq(adminAuditLogs.id, logId));

    if (!log) {
      return null;
    }

    // 获取管理员信息
    let admin: AuditLogDetail["admin"] = null;
    if (log.adminId) {
      const [adminRecord] = await this.db
        .select({
          id: admins.id,
          username: admins.username,
          displayName: admins.displayName,
          role: admins.role,
        })
        .from(admins)
        .where(eq(admins.id, log.adminId))
        .limit(1);

      if (adminRecord) {
        admin = adminRecord;
      }
    }

    return {
      id: log.id,
      adminId: log.adminId,
      adminUsername: log.adminUsername,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetName: log.targetName,
      details: log.details as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      riskLevel: log.riskLevel,
      createdAt: log.createdAt,
      beforeSnapshot: log.beforeSnapshot as Record<string, unknown> | null,
      afterSnapshot: log.afterSnapshot as Record<string, unknown> | null,
      admin,
    };
  }

  /**
   * 获取审计日志统计信息
   */
  async getAuditLogStats(): Promise<AuditLogStats> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay.getTime() - startOfDay.getDay() * 24 * 60 * 60 * 1000);

    // 总操作数
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(adminAuditLogs);

    // 今日操作数
    const [{ today }] = await this.db
      .select({ today: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(gt(adminAuditLogs.createdAt, startOfDay));

    // 本周操作数
    const [{ week }] = await this.db
      .select({ week: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(gt(adminAuditLogs.createdAt, startOfWeek));

    // 高风险操作数
    const [{ highRisk }] = await this.db
      .select({ highRisk: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(inArray(adminAuditLogs.riskLevel, ["high", "critical"]));

    // 按操作类型分布 (取前10)
    const actionDist = await this.db
      .select({
        action: adminAuditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // 按管理员分布 (取前10)
    const adminDist = await this.db
      .select({
        adminUsername: adminAuditLogs.adminUsername,
        count: sql<number>`count(*)::int`,
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.adminUsername)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // 按风险等级分布
    const riskDist = await this.db
      .select({
        riskLevel: adminAuditLogs.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.riskLevel)
      .orderBy(adminAuditLogs.riskLevel);

    return {
      totalActions: total,
      todayActions: today,
      weekActions: week,
      highRiskActions: highRisk,
      actionDistribution: actionDist,
      adminDistribution: adminDist,
      riskDistribution: riskDist,
    };
  }

  /**
   * 获取操作类型列表
   */
  async getActionTypes(): Promise<string[]> {
    const actions = await this.db
      .selectDistinct({ action: adminAuditLogs.action })
      .from(adminAuditLogs)
      .orderBy(adminAuditLogs.action);

    return actions.map((a) => a.action);
  }

  /**
   * 导出审计日志
   */
  async exportAuditLogs(
    params: AuditLogListParams = {},
    format: "json" | "csv" = "json",
  ): Promise<{ data: string; filename: string }> {
    // 获取所有符合条件的日志（不分页）
    const allLogs: AuditLogListItem[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const result = await this.listAuditLogs({ ...params, page, pageSize });
      allLogs.push(...result.logs);
      if (page >= result.totalPages) break;
      page++;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "csv") {
      // 生成 CSV
      const headers = [
        "ID",
        "管理员",
        "操作",
        "目标类型",
        "目标ID",
        "目标名称",
        "IP地址",
        "风险等级",
        "时间",
      ];
      const rows = allLogs.map((log) => [
        log.id,
        log.adminUsername,
        log.action,
        log.targetType || "",
        log.targetId || "",
        log.targetName || "",
        log.ipAddress || "",
        log.riskLevel,
        log.createdAt.toISOString(),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      return {
        data: csv,
        filename: `audit-logs-${timestamp}.csv`,
      };
    } else {
      // 生成 JSON
      return {
        data: JSON.stringify(allLogs, null, 2),
        filename: `audit-logs-${timestamp}.json`,
      };
    }
  }

  /**
   * 获取管理员列表（用于过滤）
   */
  async getAdminList(): Promise<Array<{ id: string; username: string; displayName: string }>> {
    const adminList = await this.db
      .select({
        id: admins.id,
        username: admins.username,
        displayName: admins.displayName,
      })
      .from(admins)
      .orderBy(admins.username);

    return adminList;
  }
}

// 单例
let adminAuditServiceInstance: AdminAuditService | null = null;

export function getAdminAuditService(db?: Database): AdminAuditService {
  if (!adminAuditServiceInstance || db) {
    adminAuditServiceInstance = new AdminAuditService(db);
  }
  return adminAuditServiceInstance;
}
