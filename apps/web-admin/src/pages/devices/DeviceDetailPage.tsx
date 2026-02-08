import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Monitor, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

/**
 * 设备详情页面
 */
export default function DeviceDetailPage() {
  const { deviceId } = useParams()
  const navigate = useNavigate()

  // 模拟设备数据
  const device = {
    id: deviceId,
    displayName: '我的台式机',
    platform: 'windows' as const,
    platformVersion: 'Windows 11 Pro',
    appVersion: '1.0.0',
    role: 'owner' as const,
    scopes: ['operator.read', 'operator.write'],
    status: 'online' as const,
    lastActiveAt: new Date().toISOString(),
    linkedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Button variant="ghost" onClick={() => navigate('/devices')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回设备列表
      </Button>

      {/* 设备信息 */}
      <div className="flex items-start gap-6">
        <div className="w-16 h-16 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Monitor className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{device.displayName}</h1>
          <p className="text-muted-foreground">{device.platformVersion}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                device.status === 'online'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              {device.status === 'online' ? '在线' : '离线'}
            </span>
            <span className="text-sm text-muted-foreground">
              v{device.appVersion}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            重新配对
          </Button>
          <Button variant="destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            解绑设备
          </Button>
        </div>
      </div>

      {/* 设备详情 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">设备 ID</span>
              <span className="font-mono text-sm">{device.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">平台</span>
              <span>{device.platformVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">应用版本</span>
              <span>{device.appVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">配对时间</span>
              <span>{formatDate(device.linkedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">最后活跃</span>
              <span>{formatDate(device.lastActiveAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>权限设置</CardTitle>
            <CardDescription>设备在此账号下的权限</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">角色</span>
              <span>
                {device.role === 'owner'
                  ? '所有者'
                  : device.role === 'member'
                    ? '成员'
                    : '访客'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-2">权限范围</span>
              <div className="flex flex-wrap gap-2">
                {device.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
