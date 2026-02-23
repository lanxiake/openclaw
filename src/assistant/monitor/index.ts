/**
 * 监控模块导出
 */

export {
  getSystemResources,
  getCpuUsage,
  getMemoryInfo,
  getProcessInfo,
  checkDatabaseHealth,
  getAllServicesHealth,
  getTodayApiStats,
  getMonitorStats,
  generateResourceHistory,
  getApiMonitorStats,
  registerActiveConnectionsProvider,
  formatBytes,
  formatUptime,
  type ServiceStatus,
  type SystemResources,
  type ServiceHealth,
  type MonitorStats,
  type ApiMonitorData,
} from "./monitor-service.js";

export { LogService, getLogService } from "./log-service.js";

export { AlertService, getAlertService } from "./alert-service.js";

export {
  MetricsCollector,
  createMetricsCollector,
  type MetricsCollectorOptions,
  type ResourceDataProvider,
} from "./metrics-collector.js";
