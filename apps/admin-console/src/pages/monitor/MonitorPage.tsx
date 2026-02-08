import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw,
  Activity,
  Server,
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Network,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatBytes, formatDuration } from '@/lib/utils'
import {
  useMonitorStats,
  useSystemHealth,
  useApiMonitor,
  useResourceUsage,
  useResourceHistory,
  useAlerts,
} from '@/hooks/useMonitor'
import type { ServiceStatus } from '@/types/monitor'

/**
 * 获取服务状态图标和颜色
 */
function getServiceStatusConfig(status: ServiceStatus) {
  switch (status) {
    case 'healthy':
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' }
    case 'degraded':
      return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
    case 'unhealthy':
      return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' }
    default:
      return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10' }
  }
}

/**
 * 状态码颜色
 */
const STATUS_CODE_COLORS: Record<number, string> = {
  200: '#22c55e',
  201: '#16a34a',
  400: '#eab308',
  401: '#f97316',
  404: '#f59e0b',
  500: '#ef4444',
}

/**
 * 系统监控页面
 */
export default function MonitorPage() {
  // 时间周期选择
  const [apiPeriod, setApiPeriod] = useState<'hour' | 'day' | 'week'>('day')
  const [resourcePeriod, setResourcePeriod] = useState<'hour' | 'day' | 'week'>('hour')

  // 获取数据
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useMonitorStats()
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth()
  const { data: apiData, isLoading: apiLoading } = useApiMonitor(apiPeriod)
  const { data: resources, isLoading: resourcesLoading } = useResourceUsage()
  const { data: resourceHistory } = useResourceHistory(resourcePeriod)
  const { data: alertsData } = useAlerts({ resolved: false })

  const isFetching = statsLoading || healthLoading

  /**
   * 刷新所有数据
   */
  const handleRefresh = () => {
    refetchStats()
    refetchHealth()
  }

  /**
   * 格式化时间轴标签
   */
  const formatTimeLabel = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统监控</h1>
          <p className="text-muted-foreground">实时监控系统状态和性能</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/monitor/logs">查看日志</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/monitor/alerts">
              告警中心
              {alertsData && alertsData.unacknowledged > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {alertsData.unacknowledged}
                </Badge>
              )}
            </Link>
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              {statsLoading ? (
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.servicesHealthy}/{stats?.servicesTotal}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">服务正常</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              {statsLoading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.apiRequestsToday?.toLocaleString()}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">今日 API 请求</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              {statsLoading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">{stats?.cpuUsage?.toFixed(1)}%</div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">CPU 使用率</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              {statsLoading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">{stats?.memoryUsage?.toFixed(1)}%</div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">内存使用率</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 服务状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              服务状态
            </CardTitle>
            <CardDescription>
              系统整体状态：
              {health && (
                <Badge
                  variant={
                    health.overall === 'healthy'
                      ? 'success'
                      : health.overall === 'degraded'
                        ? 'default'
                        : 'destructive'
                  }
                  className="ml-2"
                >
                  {health.overall === 'healthy' ? '正常' : health.overall === 'degraded' ? '降级' : '异常'}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {health?.services.map((service) => {
                  const config = getServiceStatusConfig(service.status)
                  const Icon = config.icon

                  return (
                    <div
                      key={service.name}
                      className={cn('flex items-center gap-4 p-3 rounded-lg', config.bg)}
                    >
                      <Icon className={cn('h-5 w-5', config.color)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{service.name}</span>
                          {service.version && (
                            <span className="text-xs text-muted-foreground">v{service.version}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{service.message}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{service.responseTime}ms</p>
                        {service.uptime && (
                          <p className="text-muted-foreground">{formatDuration(service.uptime)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 资源使用 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  资源使用
                </CardTitle>
                <CardDescription>服务器资源使用情况</CardDescription>
              </div>
              <Select value={resourcePeriod} onValueChange={(v) => setResourcePeriod(v as 'hour' | 'day' | 'week')}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">小时</SelectItem>
                  <SelectItem value="day">天</SelectItem>
                  <SelectItem value="week">周</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {resourcesLoading ? (
              <div className="h-48 bg-muted animate-pulse rounded" />
            ) : resources ? (
              <div className="space-y-4">
                {/* CPU */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">CPU</span>
                    <span className="text-sm text-muted-foreground">{resources.cpu.usage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${resources.cpu.usage}%` }}
                    />
                  </div>
                </div>

                {/* 内存 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">内存</span>
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(resources.memory.used)} / {formatBytes(resources.memory.total)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${resources.memory.usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* 磁盘 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">磁盘</span>
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(resources.disk.used)} / {formatBytes(resources.disk.total)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${resources.disk.usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* 资源历史图表 */}
                {resourceHistory && (
                  <div className="h-32 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={resourceHistory.timeline}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={formatTimeLabel}
                          className="text-xs"
                          tick={{ fill: 'currentColor' }}
                        />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                          labelFormatter={formatTimeLabel}
                        />
                        <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="CPU" />
                        <Area type="monotone" dataKey="memory" stackId="2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="内存" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* API 监控 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                API 监控
              </CardTitle>
              <CardDescription>API 请求统计和性能指标</CardDescription>
            </div>
            <Select value={apiPeriod} onValueChange={(v) => setApiPeriod(v as 'hour' | 'day' | 'week')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">小时</SelectItem>
                <SelectItem value="day">天</SelectItem>
                <SelectItem value="week">周</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {apiLoading ? (
            <div className="h-80 bg-muted animate-pulse rounded" />
          ) : apiData ? (
            <div className="space-y-6">
              {/* API 指标卡片 */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">总请求数</p>
                  <p className="text-2xl font-bold">{apiData.summary.totalRequests.toLocaleString()}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">错误率</p>
                  <p className="text-2xl font-bold">{apiData.summary.errorRate.toFixed(2)}%</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">平均响应时间</p>
                  <p className="text-2xl font-bold">{apiData.summary.avgResponseTime}ms</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">P95 响应时间</p>
                  <p className="text-2xl font-bold">{apiData.summary.p95ResponseTime}ms</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* 请求趋势图 */}
                <div>
                  <h4 className="text-sm font-medium mb-4">请求趋势</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={apiData.timeline}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={formatTimeLabel}
                          className="text-xs"
                          tick={{ fill: 'currentColor' }}
                        />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                          labelFormatter={formatTimeLabel}
                        />
                        <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={false} name="请求数" />
                        <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} name="错误数" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 状态码分布 */}
                <div>
                  <h4 className="text-sm font-medium mb-4">状态码分布</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={apiData.byStatusCode}
                          dataKey="count"
                          nameKey="code"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {apiData.byStatusCode.map((entry) => (
                            <Cell
                              key={entry.code}
                              fill={STATUS_CODE_COLORS[entry.code] || '#6b7280'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-2">
                    {apiData.byStatusCode.map((entry) => (
                      <div key={entry.code} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: STATUS_CODE_COLORS[entry.code] || '#6b7280' }}
                        />
                        <span>{entry.code}: {entry.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 热门端点 */}
              <div>
                <h4 className="text-sm font-medium mb-4">热门端点</h4>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>方法</th>
                        <th>路径</th>
                        <th className="text-right">请求数</th>
                        <th className="text-right">平均响应</th>
                        <th className="text-right">错误率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiData.byEndpoint.map((endpoint) => (
                        <tr key={`${endpoint.method}-${endpoint.path}`}>
                          <td>
                            <Badge variant="outline">{endpoint.method}</Badge>
                          </td>
                          <td className="font-mono text-sm">{endpoint.path}</td>
                          <td className="text-right">{endpoint.count.toLocaleString()}</td>
                          <td className="text-right">{endpoint.avgTime}ms</td>
                          <td className="text-right">
                            <span className={cn(endpoint.errorRate > 1 ? 'text-red-500' : 'text-muted-foreground')}>
                              {endpoint.errorRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
