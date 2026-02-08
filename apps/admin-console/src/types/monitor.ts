/**
 * 系统监控类型定义
 */

/**
 * 服务状态
 */
export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/**
 * 服务信息
 */
export interface ServiceInfo {
  name: string
  status: ServiceStatus
  version?: string
  uptime?: number
  lastCheck: string
  responseTime?: number
  message?: string
  details?: Record<string, unknown>
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  overall: ServiceStatus
  services: ServiceInfo[]
  timestamp: string
}

/**
 * API 指标
 */
export interface ApiMetrics {
  totalRequests: number
  successRequests: number
  errorRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errorRate: number
}

/**
 * API 端点统计
 */
export interface ApiEndpointStats {
  method: string
  path: string
  count: number
  avgTime: number
  errorCount: number
  errorRate: number
}

/**
 * API 监控数据
 */
export interface ApiMonitorData {
  summary: ApiMetrics
  byEndpoint: ApiEndpointStats[]
  byStatusCode: Array<{
    code: number
    count: number
  }>
  timeline: Array<{
    timestamp: string
    requests: number
    errors: number
    avgTime: number
  }>
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  cpu: {
    usage: number
    cores: number
    model: string
  }
  memory: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  disk: {
    total: number
    used: number
    free: number
    usagePercent: number
    path: string
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  process: {
    pid: number
    uptime: number
    memoryUsage: number
    cpuUsage: number
  }
}

/**
 * 资源使用历史
 */
export interface ResourceHistory {
  timeline: Array<{
    timestamp: string
    cpu: number
    memory: number
    disk: number
  }>
  period: 'hour' | 'day' | 'week'
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * 日志条目
 */
export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  metadata?: Record<string, unknown>
}

/**
 * 日志查询参数
 */
export interface LogQuery {
  level?: LogLevel
  source?: string
  search?: string
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}

/**
 * 日志查询响应
 */
export interface LogQueryResponse {
  logs: LogEntry[]
  total: number
  hasMore: boolean
}

/**
 * 系统监控统计
 */
export interface MonitorStats {
  servicesHealthy: number
  servicesTotal: number
  apiRequestsToday: number
  apiErrorsToday: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeConnections: number
}

/**
 * 告警严重级别
 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/**
 * 告警
 */
export interface Alert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'api_error' | 'service_down' | 'custom'
  severity: AlertSeverity
  title: string
  message: string
  source: string
  timestamp: string
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolved: boolean
  resolvedAt?: string
  metadata?: Record<string, unknown>
}

/**
 * 告警列表响应
 */
export interface AlertListResponse {
  alerts: Alert[]
  total: number
  unacknowledged: number
}
