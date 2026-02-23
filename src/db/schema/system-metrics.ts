/**
 * 系统指标表 Schema
 *
 * 存储系统资源监控的时序数据（CPU、内存、磁盘等），
 * 替代 monitor-service 中模拟生成的历史数据。
 * 通过 MetricsCollector 每 60 秒采集一次。
 */

import { pgTable, text, timestamp, integer, bigint, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * 指标类型
 */
export type MetricType = "system" | "process" | "api";

/**
 * 系统指标表
 *
 * 存储时序监控数据，建议保留 30 天，定期清理
 */
export const systemMetrics = pgTable(
  "system_metrics",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),

    /** 采样时间戳 */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

    /** 指标类型 (system: 系统资源, process: Node进程, api: API统计) */
    metricType: text("metric_type", {
      enum: ["system", "process", "api"],
    }).notNull(),

    /** CPU 使用率 (0-100) */
    cpuUsage: numeric("cpu_usage", { precision: 5, scale: 2 }),

    /** 内存使用率 (0-100) */
    memoryUsage: numeric("memory_usage", { precision: 5, scale: 2 }),

    /** 磁盘使用率 (0-100) */
    diskUsage: numeric("disk_usage", { precision: 5, scale: 2 }),

    /** 活跃 WebSocket 连接数 */
    activeConnections: integer("active_connections"),

    /** Node 进程堆内存使用量 (字节) */
    heapUsed: bigint("heap_used", { mode: "number" }),

    /** 时间窗口内请求计数 */
    requestCount: integer("request_count"),

    /** 时间窗口内错误计数 */
    errorCount: integer("error_count"),

    /** 平均响应时间 (毫秒) */
    avgResponseTime: integer("avg_response_time"),

    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /** 按时间和类型查询 (时间线 + 类型过滤) */
    index("system_metrics_timestamp_type_idx").on(table.timestamp, table.metricType),
    /** 按类型和时间查询 (特定类型的时序数据) */
    index("system_metrics_type_timestamp_idx").on(table.metricType, table.timestamp),
    /** 按时间查询 (获取最新数据和清理) */
    index("system_metrics_timestamp_idx").on(table.timestamp),
  ],
);

// ==================== Zod Schemas ====================

export const insertSystemMetricSchema = createInsertSchema(systemMetrics);
export const selectSystemMetricSchema = createSelectSchema(systemMetrics);

// ==================== TypeScript 类型 ====================

export type SystemMetric = typeof systemMetrics.$inferSelect;
export type NewSystemMetric = typeof systemMetrics.$inferInsert;
