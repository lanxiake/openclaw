import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone,
  Monitor,
  Laptop,
  Plus,
  MoreVertical,
  Trash2,
  Settings,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import type { DeviceListItem, DevicePlatform } from '@/types'

/**
 * 获取平台图标
 */
function getPlatformIcon(platform: DevicePlatform) {
  switch (platform) {
    case 'windows':
    case 'linux':
      return Monitor
    case 'macos':
      return Laptop
    default:
      return Smartphone
  }
}

/**
 * 获取平台名称
 */
function getPlatformName(platform: DevicePlatform): string {
  const names: Record<DevicePlatform, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    android: 'Android',
    ios: 'iOS',
  }
  return names[platform] || platform
}

/**
 * 模拟设备数据
 */
const mockDevices: DeviceListItem[] = [
  {
    id: '1',
    displayName: '我的台式机',
    platform: 'windows',
    role: 'owner',
    scopes: ['operator.read', 'operator.write'],
    status: 'online',
    lastActiveAt: new Date().toISOString(),
    linkedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    displayName: '办公笔记本',
    platform: 'windows',
    role: 'member',
    scopes: ['operator.read'],
    status: 'online',
    lastActiveAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    linkedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    displayName: 'MacBook Pro',
    platform: 'macos',
    role: 'member',
    scopes: ['operator.read'],
    status: 'offline',
    lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    linkedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

/**
 * 设备卡片
 */
function DeviceCard({ device }: { device: DeviceListItem }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getPlatformIcon(device.platform)

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              device.status === 'online'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <Icon
              className={`w-5 h-5 ${
                device.status === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400'
              }`}
            />
          </div>
          <div>
            <CardTitle className="text-base">{device.displayName}</CardTitle>
            <CardDescription>{getPlatformName(device.platform)}</CardDescription>
          </div>
        </div>

        {/* 菜单按钮 */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-40 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/devices/${device.id}`)}
                >
                  <Settings className="w-4 h-4" />
                  设备设置
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                  <RefreshCw className="w-4 h-4" />
                  重新配对
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Trash2 className="w-4 h-4" />
                  解绑设备
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">状态</span>
            <span
              className={`flex items-center gap-1 ${
                device.status === 'online' ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              {device.status === 'online' ? '在线' : '离线'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">角色</span>
            <span>
              {device.role === 'owner' ? '所有者' : device.role === 'member' ? '成员' : '访客'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">最后活跃</span>
            <span>{formatRelativeTime(device.lastActiveAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 设备管理页面
 */
export default function DevicesPage() {
  const [devices] = useState(mockDevices)

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备管理</h1>
          <p className="text-muted-foreground">管理您已连接的设备</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          添加设备
        </Button>
      </div>

      {/* 设备列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* 空状态 */}
      {devices.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Smartphone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">还没有设备</h3>
            <p className="text-muted-foreground mb-4">
              添加您的第一台设备开始使用 AI 助理
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加设备
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
