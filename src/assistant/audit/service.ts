/**
 * Windows 助理审计日志服务
 *
 * 提供审计日志的记录、查询、统计和导出功能
 * 使用 JSON Lines 格式存储日志，支持按日滚动
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  type AuditEventType,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditLogQueryResult,
  type AuditLogStats,
  type AuditLogConfig,
  type AuditExportOptions,
  type CreateAuditLogInput,
  type AuditSeverity,
  DEFAULT_AUDIT_CONFIG,
  EVENT_SEVERITY_MAP,
} from "./types.js";

// 日志标签
const LOG_TAG = "assistant-audit";

// 创建子系统日志
const logger = createSubsystemLogger(LOG_TAG);

// 审计日志目录
const AUDIT_LOG_DIR =
  process.env.OPENCLAW_AUDIT_DIR ||
  path.join(process.env.HOME || process.env.USERPROFILE || "/tmp", ".openclaw", "audit");

// 日志文件前缀
const LOG_FILE_PREFIX = "assistant-audit";

// 日志文件后缀
const LOG_FILE_SUFFIX = ".jsonl";

// 内存中的日志缓存 (用于快速查询)
let auditLogCache: AuditLogEntry[] = [];

// 缓存最大条目数
const CACHE_MAX_ENTRIES = 1000;

// 当前配置
let currentConfig: AuditLogConfig = { ...DEFAULT_AUDIT_CONFIG };

// 是否已初始化
let initialized = false;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 获取当天的日志文件路径
 */
function getLogFilePath(date?: string): string {
  const dateStr = date || getTodayDateString();
  return path.join(AUDIT_LOG_DIR, `${LOG_FILE_PREFIX}-${dateStr}${LOG_FILE_SUFFIX}`);
}

/**
 * 确保审计日志目录存在
 */
function ensureLogDir(): void {
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    logger.info(`[${LOG_TAG}] 创建审计日志目录`, { dir: AUDIT_LOG_DIR });
  }
}

/**
 * 初始化审计日志系统
 */
export async function initAuditLog(config?: Partial<AuditLogConfig>): Promise<void> {
  if (initialized) {
    logger.debug(`[${LOG_TAG}] 审计日志系统已初始化`);
    return;
  }

  logger.info(`[${LOG_TAG}] 初始化审计日志系统`);

  // 合并配置
  if (config) {
    currentConfig = { ...DEFAULT_AUDIT_CONFIG, ...config };
  }

  // 确保目录存在
  ensureLogDir();

  // 加载今天的日志到缓存
  await loadTodayLogsToCache();

  // 清理过期日志
  await cleanupOldLogs();

  initialized = true;
  logger.info(`[${LOG_TAG}] 审计日志系统初始化完成`, {
    config: currentConfig,
    cacheSize: auditLogCache.length,
  });
}

/**
 * 加载今天的日志到缓存
 */
async function loadTodayLogsToCache(): Promise<void> {
  const logFile = getLogFilePath();

  if (!fs.existsSync(logFile)) {
    logger.debug(`[${LOG_TAG}] 今日日志文件不存在，跳过加载`);
    return;
  }

  try {
    const content = fs.readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as AuditLogEntry;
        auditLogCache.push(entry);
      } catch (parseErr) {
        logger.warn(`[${LOG_TAG}] 解析日志行失败`, { line, error: String(parseErr) });
      }
    }

    // 保持缓存在限制范围内
    if (auditLogCache.length > CACHE_MAX_ENTRIES) {
      auditLogCache = auditLogCache.slice(-CACHE_MAX_ENTRIES);
    }

    logger.debug(`[${LOG_TAG}] 加载今日日志到缓存`, { count: auditLogCache.length });
  } catch (err) {
    logger.error(`[${LOG_TAG}] 加载日志失败`, { file: logFile, error: String(err) });
  }
}

/**
 * 清理过期的日志文件
 */
async function cleanupOldLogs(): Promise<void> {
  if (!currentConfig.retentionDays || currentConfig.retentionDays <= 0) {
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - currentConfig.retentionDays);

  try {
    const files = fs.readdirSync(AUDIT_LOG_DIR);
    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith(LOG_FILE_PREFIX) || !file.endsWith(LOG_FILE_SUFFIX)) {
        continue;
      }

      // 解析日期 (assistant-audit-YYYY-MM-DD.jsonl)
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) {
        continue;
      }

      const fileDate = new Date(dateMatch[1]);
      if (fileDate < cutoffDate) {
        const filePath = path.join(AUDIT_LOG_DIR, file);
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.debug(`[${LOG_TAG}] 删除过期日志`, { file });
      }
    }

    if (deletedCount > 0) {
      logger.info(`[${LOG_TAG}] 清理过期日志`, {
        deletedCount,
        retentionDays: currentConfig.retentionDays,
      });
    }
  } catch (err) {
    logger.error(`[${LOG_TAG}] 清理过期日志失败`, { error: String(err) });
  }
}

/**
 * 写入审计日志条目
 */
export async function writeAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  // 检查是否启用
  if (!currentConfig.enabled) {
    logger.debug(`[${LOG_TAG}] 审计日志已禁用，跳过记录`);
    return createEntry(input);
  }

  // 检查事件类型过滤
  if (currentConfig.eventTypes.length > 0 && !currentConfig.eventTypes.includes(input.eventType)) {
    logger.debug(`[${LOG_TAG}] 事件类型被过滤`, { eventType: input.eventType });
    return createEntry(input);
  }

  // 检查严重级别过滤
  const severity = input.severity || EVENT_SEVERITY_MAP[input.eventType] || "info";
  const severityOrder: Record<AuditSeverity, number> = { info: 0, warn: 1, critical: 2 };
  if (severityOrder[severity] < severityOrder[currentConfig.minSeverity]) {
    logger.debug(`[${LOG_TAG}] 严重级别被过滤`, {
      severity,
      minSeverity: currentConfig.minSeverity,
    });
    return createEntry(input);
  }

  // 创建日志条目
  const entry = createEntry(input);

  // 处理隐私设置
  if (
    !currentConfig.logChatContent &&
    (input.eventType === "chat.message.sent" || input.eventType === "chat.message.received")
  ) {
    // 隐藏聊天内容
    if (entry.metadata?.content) {
      entry.metadata.content = "[内容已隐藏]";
    }
  }

  // 写入文件
  try {
    ensureLogDir();
    const logFile = getLogFilePath();
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(logFile, line, "utf-8");

    // 更新缓存
    auditLogCache.push(entry);
    if (auditLogCache.length > CACHE_MAX_ENTRIES) {
      auditLogCache = auditLogCache.slice(-CACHE_MAX_ENTRIES);
    }

    logger.debug(`[${LOG_TAG}] 写入审计日志`, { id: entry.id, eventType: entry.eventType });
  } catch (err) {
    logger.error(`[${LOG_TAG}] 写入审计日志失败`, { error: String(err) });
  }

  return entry;
}

/**
 * 创建日志条目
 */
function createEntry(input: CreateAuditLogInput): AuditLogEntry {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    severity: input.severity || EVENT_SEVERITY_MAP[input.eventType] || "info",
    title: input.title,
    detail: input.detail,
    source: input.source,
    result: input.result || "success",
    metadata: input.metadata,
    sessionId: input.sessionId,
    userId: input.userId,
    deviceId: input.deviceId,
  };
}

/**
 * 查询审计日志
 */
export async function queryAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogQueryResult> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  logger.debug(`[${LOG_TAG}] 查询审计日志`, { filters });

  // 收集所有符合时间范围的日志
  let allEntries: AuditLogEntry[] = [];

  // 如果有时间范围，加载对应日期的日志文件
  if (filters.startTime || filters.endTime) {
    const startDate = filters.startTime ? new Date(filters.startTime) : new Date(0);
    const endDate = filters.endTime ? new Date(filters.endTime) : new Date();

    // 获取日期范围内的所有日志文件
    const files = listLogFilesInRange(startDate, endDate);
    for (const file of files) {
      const entries = await loadLogFile(file);
      allEntries.push(...entries);
    }
  } else {
    // 使用缓存中的日志
    allEntries = [...auditLogCache];
  }

  // 应用过滤条件
  let filteredEntries = allEntries;

  // 时间范围过滤
  if (filters.startTime) {
    const startTime = new Date(filters.startTime).getTime();
    filteredEntries = filteredEntries.filter((e) => new Date(e.timestamp).getTime() >= startTime);
  }
  if (filters.endTime) {
    const endTime = new Date(filters.endTime).getTime();
    filteredEntries = filteredEntries.filter((e) => new Date(e.timestamp).getTime() <= endTime);
  }

  // 事件类型过滤
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    filteredEntries = filteredEntries.filter((e) => filters.eventTypes!.includes(e.eventType));
  }

  // 严重级别过滤
  if (filters.severities && filters.severities.length > 0) {
    filteredEntries = filteredEntries.filter((e) => filters.severities!.includes(e.severity));
  }

  // 结果过滤
  if (filters.results && filters.results.length > 0) {
    filteredEntries = filteredEntries.filter((e) => filters.results!.includes(e.result));
  }

  // 来源类型过滤
  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    filteredEntries = filteredEntries.filter((e) => filters.sourceTypes!.includes(e.source.type));
  }

  // 会话 ID 过滤
  if (filters.sessionId) {
    filteredEntries = filteredEntries.filter((e) => e.sessionId === filters.sessionId);
  }

  // 搜索关键词过滤
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredEntries = filteredEntries.filter(
      (e) =>
        e.title.toLowerCase().includes(searchLower) ||
        e.detail.toLowerCase().includes(searchLower) ||
        e.eventType.toLowerCase().includes(searchLower) ||
        e.source.name.toLowerCase().includes(searchLower),
    );
  }

  // 排序
  const sortOrder = filters.sortOrder || "desc";
  filteredEntries.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
  });

  // 分页
  const total = filteredEntries.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paginatedEntries = filteredEntries.slice(offset, offset + limit);

  logger.debug(`[${LOG_TAG}] 查询结果`, {
    total,
    offset,
    limit,
    returned: paginatedEntries.length,
  });

  return {
    entries: paginatedEntries,
    total,
    offset,
    limit,
  };
}

/**
 * 列出指定日期范围内的日志文件
 */
function listLogFilesInRange(startDate: Date, endDate: Date): string[] {
  const files: string[] = [];

  try {
    if (!fs.existsSync(AUDIT_LOG_DIR)) {
      return files;
    }

    const allFiles = fs.readdirSync(AUDIT_LOG_DIR);

    for (const file of allFiles) {
      if (!file.startsWith(LOG_FILE_PREFIX) || !file.endsWith(LOG_FILE_SUFFIX)) {
        continue;
      }

      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) {
        continue;
      }

      const fileDate = new Date(dateMatch[1]);
      if (fileDate >= startDate && fileDate <= endDate) {
        files.push(path.join(AUDIT_LOG_DIR, file));
      }
    }
  } catch (err) {
    logger.error(`[${LOG_TAG}] 列出日志文件失败`, { error: String(err) });
  }

  return files.sort();
}

/**
 * 加载日志文件
 */
async function loadLogFile(filePath: string): Promise<AuditLogEntry[]> {
  const entries: AuditLogEntry[] = [];

  try {
    if (!fs.existsSync(filePath)) {
      return entries;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as AuditLogEntry;
        entries.push(entry);
      } catch {
        // 跳过解析失败的行
      }
    }
  } catch (err) {
    logger.error(`[${LOG_TAG}] 加载日志文件失败`, { file: filePath, error: String(err) });
  }

  return entries;
}

/**
 * 获取审计日志统计信息
 */
export async function getAuditStats(): Promise<AuditLogStats> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  logger.debug(`[${LOG_TAG}] 获取审计日志统计`);

  // 加载所有日志文件
  const files = listLogFilesInRange(new Date(0), new Date());
  let allEntries: AuditLogEntry[] = [];

  for (const file of files) {
    const entries = await loadLogFile(file);
    allEntries.push(...entries);
  }

  // 统计
  const byEventType: Record<string, number> = {};
  const bySeverity: Record<AuditSeverity, number> = { info: 0, warn: 0, critical: 0 };
  const byResult: Record<string, number> = { success: 0, failure: 0, pending: 0 };
  const bySourceType: Record<string, number> = {};

  let earliest: string | null = null;
  let latest: string | null = null;

  const today = getTodayDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  let todayCount = 0;
  let weekCount = 0;

  for (const entry of allEntries) {
    // 按事件类型统计
    byEventType[entry.eventType] = (byEventType[entry.eventType] || 0) + 1;

    // 按严重级别统计
    bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;

    // 按结果统计
    byResult[entry.result] = (byResult[entry.result] || 0) + 1;

    // 按来源类型统计
    bySourceType[entry.source.type] = (bySourceType[entry.source.type] || 0) + 1;

    // 时间范围
    if (!earliest || entry.timestamp < earliest) {
      earliest = entry.timestamp;
    }
    if (!latest || entry.timestamp > latest) {
      latest = entry.timestamp;
    }

    // 今日和本周统计
    const entryDate = new Date(entry.timestamp);
    const entryDateStr = entry.timestamp.slice(0, 10);

    if (entryDateStr === today) {
      todayCount++;
    }
    if (entryDate >= weekAgo) {
      weekCount++;
    }
  }

  const stats: AuditLogStats = {
    totalEntries: allEntries.length,
    byEventType,
    bySeverity,
    byResult,
    bySourceType,
    timeRange: { earliest, latest },
    todayCount,
    weekCount,
  };

  logger.debug(`[${LOG_TAG}] 统计结果`, {
    totalEntries: stats.totalEntries,
    todayCount,
    weekCount,
  });

  return stats;
}

/**
 * 导出审计日志
 */
export async function exportAuditLogs(options: AuditExportOptions): Promise<string> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  logger.info(`[${LOG_TAG}] 导出审计日志`, { format: options.format });

  // 查询日志
  const result = await queryAuditLogs({
    ...options.filters,
    limit: currentConfig.maxEntries, // 导出所有匹配的日志
  });

  const entries = result.entries;

  if (options.format === "json") {
    return JSON.stringify(entries, null, 2);
  }

  // CSV 格式
  const fields =
    options.fields ||
    (["id", "timestamp", "eventType", "severity", "title", "detail", "result"] as Array<
      keyof AuditLogEntry
    >);

  const header = fields.join(",");
  const rows = entries.map((entry) => {
    return fields
      .map((field) => {
        const value = entry[field];
        if (value === undefined || value === null) {
          return "";
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * 清除审计日志
 */
export async function clearAuditLogs(options?: {
  beforeDate?: string;
}): Promise<{ deletedCount: number }> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  logger.warn(`[${LOG_TAG}] 清除审计日志`, { options });

  let deletedCount = 0;

  try {
    if (!fs.existsSync(AUDIT_LOG_DIR)) {
      return { deletedCount: 0 };
    }

    const files = fs.readdirSync(AUDIT_LOG_DIR);
    const beforeDate = options?.beforeDate ? new Date(options.beforeDate) : null;

    for (const file of files) {
      if (!file.startsWith(LOG_FILE_PREFIX) || !file.endsWith(LOG_FILE_SUFFIX)) {
        continue;
      }

      // 如果指定了日期，只删除该日期之前的文件
      if (beforeDate) {
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate >= beforeDate) {
            continue;
          }
        }
      }

      const filePath = path.join(AUDIT_LOG_DIR, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    }

    // 清空缓存 (如果删除了今天的日志)
    if (!beforeDate || beforeDate > new Date()) {
      auditLogCache = [];
    }
  } catch (err) {
    logger.error(`[${LOG_TAG}] 清除审计日志失败`, { error: String(err) });
  }

  logger.info(`[${LOG_TAG}] 清除审计日志完成`, { deletedCount });
  return { deletedCount };
}

/**
 * 获取当前审计日志配置
 */
export function getAuditConfig(): AuditLogConfig {
  return { ...currentConfig };
}

/**
 * 更新审计日志配置
 */
export async function updateAuditConfig(config: Partial<AuditLogConfig>): Promise<AuditLogConfig> {
  currentConfig = { ...currentConfig, ...config };
  logger.info(`[${LOG_TAG}] 更新审计日志配置`, { config: currentConfig });
  return { ...currentConfig };
}

/**
 * 获取最近的审计日志条目
 */
export async function getRecentAuditLogs(limit: number = 20): Promise<AuditLogEntry[]> {
  // 确保已初始化
  if (!initialized) {
    await initAuditLog();
  }

  // 从缓存中获取最近的条目
  const recentEntries = auditLogCache.slice(-limit).reverse();

  logger.debug(`[${LOG_TAG}] 获取最近审计日志`, { limit, returned: recentEntries.length });

  return recentEntries;
}

// 导出便捷方法
export {
  type AuditEventType,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditLogQueryResult,
  type AuditLogStats,
  type AuditLogConfig,
  type CreateAuditLogInput,
  type AuditSeverity,
  EVENT_TYPE_LABELS,
  EVENT_SEVERITY_MAP,
} from "./types.js";
