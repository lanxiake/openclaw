import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * 系统监控页面
 */
export default function SystemMonitorPage() {
  // 模拟系统数据
  const systemData = {
    cpu: 45,
    memory: 68,
    disk: 52,
    network: {
      in: '12.5 MB/s',
      out: '8.2 MB/s',
    },
    uptime: '15 天 8 小时',
    version: '1.0.0',
    nodeVersion: '22.0.0',
  }

  const services = [
    { name: 'Gateway 服务', status: 'running', port: 3000 },
    { name: 'WebSocket 服务', status: 'running', port: 3001 },
    { name: 'PostgreSQL', status: 'running', port: 5432 },
    { name: 'Redis', status: 'running', port: 6379 },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统监控</h1>
          <p className="text-muted-foreground">实时监控系统状态</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 系统概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemData.cpu}%</div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${systemData.cpu}%` }}
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
            <div className="text-2xl font-bold">{systemData.memory}%</div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${systemData.memory}%` }}
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
            <div className="text-2xl font-bold">{systemData.disk}%</div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${systemData.disk}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 网络 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">网络流量</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">入站</span>
                <span>{systemData.network.in}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">出站</span>
                <span>{systemData.network.out}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 服务状态 */}
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
                  <div
                    className={`w-3 h-3 rounded-full ${
                      service.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      端口 {service.port}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-sm ${
                    service.status === 'running' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {service.status === 'running' ? '运行中' : '已停止'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 系统信息 */}
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
              <div className="font-medium">{systemData.uptime}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">应用版本</div>
              <div className="font-medium">v{systemData.version}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Node.js 版本</div>
              <div className="font-medium">{systemData.nodeVersion}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
