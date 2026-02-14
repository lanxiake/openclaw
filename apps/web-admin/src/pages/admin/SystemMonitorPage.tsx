import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { gateway } from '@/lib/gateway-client'
import { useToast } from '@/hooks/useToast'

/**
 * 系统资源数据类型
 */
interface SystemResources {
  cpu: {
    usagePercent: number
    cores: number
    model?: string
  }
  memory: {
    totalMb: number
    usedMb: number
    usagePercent: number
  }
  disk: {
    totalGb: number
    usedGb: number
    usagePercent: number
  }
  network?: {
    bytesIn: number
    bytesOut: number
  }
  process: {
    uptimeSeconds: number
    memoryMb: number
    pid: number
  }
  platform: string
  nodeVersion: string
  appVersion?: string
}

/**
 * 服务健康状态类型
 */
interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  responseTimeMs?: number
  details?: string
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${minutes} 分钟`
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/**
 * 获取服务状态颜色
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600'
    case 'degraded':
      return 'text-yellow-600'
    case 'unhealthy':
      return 'text-red-600'
    default:
      return 'text-gray-500'
  }
}

/**
 * 获取服务状态指示点颜色
 */
function getStatusDotColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-500'
    case 'degraded':
      return 'bg-yellow-500'
    case 'unhealthy':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

/**
 * 获取服务状态中文名
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '运行中'
    case 'degraded':
      return '降级'
    case 'unhealthy':
      return '异常'
    default:
      return '未知'
  }
}

/**
 * 系统监控页面
 *
 * 使用 admin.monitor.resources 和 admin.monitor.health 真实接口
 */
export default function SystemMonitorPage() {
  const { toast } = useToast()
  const [resources, setResources] = useState<SystemResources | null>(null)
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 加载监控数据
   */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      console.log('[SystemMonitorPage] 加载监控数据')

      // 并行请求系统资源和服务健康状态
      const [resourcesRes, healthRes] = await Promise.allSettled([
        gateway.call<{ success: boolean; data?: SystemResources }>('admin.monitor.resources', {}),
        gateway.call<{ success: boolean; data?: ServiceHealth[] }>('admin.monitor.health', {}),
      ])

      // 处理系统资源
      if (resourcesRes.status === 'fulfilled' && resourcesRes.value.success && resourcesRes.value.data) {
        console.log('[SystemMonitorPage] 系统资源数据已获取')
        setResources(resourcesRes.value.data)
      } else {
        console.warn('[SystemMonitorPage] 获取系统资源失败')
        setResources(null)
      }

      // 处理服务健康状态
      if (healthRes.status === 'fulfilled' && healthRes.value.success && healthRes.value.data) {
        console.log('[SystemMonitorPage] 服务健康数据已获取:', healthRes.value.data.length)
        setServices(healthRes.value.data)
      } else {
        console.warn('[SystemMonitorPage] 获取服务健康状态失败')
        setServices([])
      }
    } catch (error) {
      console.error('[SystemMonitorPage] 加载监控数据失败:', error)
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法获取监控数据',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统监控</h1>
          <p className="text-muted-foreground">实时监控系统状态</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 系统概览 */}
      {!loading && resources && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* CPU */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(resources.cpu?.usagePercent ?? 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">{resources.cpu?.cores ?? 0} 核</p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (resources.cpu?.usagePercent ?? 0) > 80 ? 'bg-red-500' :
                    (resources.cpu?.usagePercent ?? 0) > 60 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${resources.cpu?.usagePercent ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* 内存 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(resources.memory?.usagePercent ?? 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((resources.memory?.usedMb ?? 0) / 1024).toFixed(1)} / {((resources.memory?.totalMb ?? 0) / 1024).toFixed(1)} GB
              </p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (resources.memory?.usagePercent ?? 0) > 80 ? 'bg-red-500' :
                    (resources.memory?.usagePercent ?? 0) > 60 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${resources.memory?.usagePercent ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* 磁盘 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">磁盘使用率</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(resources.disk?.usagePercent ?? 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {(resources.disk?.usedGb ?? 0).toFixed(1)} / {(resources.disk?.totalGb ?? 0).toFixed(1)} GB
              </p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (resources.disk?.usagePercent ?? 0) > 80 ? 'bg-red-500' :
                    (resources.disk?.usagePercent ?? 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${resources.disk?.usagePercent ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* 网络 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">进程内存</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(resources.process?.memoryMb ?? 0).toFixed(0)} MB</div>
              <p className="text-xs text-muted-foreground mt-1">PID: {resources.process?.pid ?? '-'}</p>
              {resources.network && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">入站</span>
                    <span>{formatBytes(resources.network.bytesIn)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">出站</span>
                    <span>{formatBytes(resources.network.bytesOut)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 无数据提示 */}
      {!loading && !resources && (
        <Card className="py-8">
          <CardContent className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">无法获取系统资源数据</p>
          </CardContent>
        </Card>
      )}

      {/* 服务状态 */}
      {!loading && services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              服务状态
            </CardTitle>
            <CardDescription>各服务运行状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusDotColor(service.status)}`} />
                    <div>
                      <div className="font-medium">{service.name}</div>
                      {service.details && (
                        <div className="text-sm text-muted-foreground">{service.details}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {service.responseTimeMs !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {service.responseTimeMs}ms
                      </span>
                    )}
                    <span className={`text-sm ${getStatusColor(service.status)}`}>
                      {getStatusLabel(service.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 系统信息 */}
      {!loading && resources && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              系统信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">运行时间</div>
                <div className="font-medium">{formatUptime(resources.process?.uptimeSeconds ?? 0)}</div>
              </div>
              {resources.appVersion && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">应用版本</div>
                  <div className="font-medium">v{resources.appVersion}</div>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Node.js 版本</div>
                <div className="font-medium">{resources.nodeVersion}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">操作系统</div>
                <div className="font-medium">{resources.platform}</div>
              </div>
              {resources.cpu.model && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">CPU 型号</div>
                  <div className="font-medium text-sm">{resources.cpu.model}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
