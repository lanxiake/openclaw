import { useState, useEffect, useCallback } from 'react'
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
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { gateway } from '@/lib/gateway-client'
import { useToast } from '@/hooks/useToast'

/**
 * 节点数据类型（node.list 返回格式）
 */
interface NodeInfo {
  nodeId: string
  displayName?: string
  platform?: string
  version?: string
  connected: boolean
  paired: boolean
  remoteIp?: string
  connectedAtMs?: number
}

/**
 * 获取平台图标
 */
function getPlatformIcon(platform?: string) {
  switch (platform) {
    case 'windows':
    case 'linux':
      return Monitor
    case 'macos':
    case 'darwin':
      return Laptop
    default:
      return Smartphone
  }
}

/**
 * 获取平台名称
 */
function getPlatformName(platform?: string): string {
  const names: Record<string, string> = {
    windows: 'Windows',
    macos: 'macOS',
    darwin: 'macOS',
    linux: 'Linux',
    android: 'Android',
    ios: 'iOS',
  }
  return (platform && names[platform]) || platform || '未知'
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

/**
 * 设备卡片
 */
function DeviceCard({ node }: { node: NodeInfo }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getPlatformIcon(node.platform)

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              node.connected
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <Icon
              className={`w-5 h-5 ${
                node.connected
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400'
              }`}
            />
          </div>
          <div>
            <CardTitle className="text-base">{node.displayName || node.nodeId}</CardTitle>
            <CardDescription>{getPlatformName(node.platform)}</CardDescription>
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
                  onClick={() => navigate(`/devices/${node.nodeId}`)}
                >
                  <Settings className="w-4 h-4" />
                  设备详情
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
                node.connected ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  node.connected ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              {node.connected ? '在线' : '离线'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">配对状态</span>
            <span>{node.paired ? '已配对' : '未配对'}</span>
          </div>
          {node.version && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">版本</span>
              <span>{node.version}</span>
            </div>
          )}
          {node.connectedAtMs && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">连接时间</span>
              <span>{formatRelativeTime(node.connectedAtMs)}</span>
            </div>
          )}
          {node.remoteIp && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP 地址</span>
              <span>{node.remoteIp}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 设备管理页面
 *
 * 使用 node.list 真实接口获取已连接和已配对的节点
 */
export default function DevicesPage() {
  const { toast } = useToast()
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 加载节点列表
   */
  const loadNodes = useCallback(async () => {
    setLoading(true)
    try {
      console.log('[DevicesPage] 加载节点列表')
      const response = await gateway.call<{
        nodes?: NodeInfo[]
      }>('node.list', {})

      if (response.nodes) {
        console.log('[DevicesPage] 获取到节点:', response.nodes.length)
        setNodes(response.nodes)
      } else {
        setNodes([])
      }
    } catch (error) {
      console.error('[DevicesPage] 加载节点列表失败:', error)
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法获取设备列表',
        variant: 'destructive',
      })
      setNodes([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadNodes()
  }, [loadNodes])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备管理</h1>
          <p className="text-muted-foreground">管理您已连接的设备和节点</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadNodes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            添加设备
          </Button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 设备列表 */}
      {!loading && nodes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => (
            <DeviceCard key={node.nodeId} node={node} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && nodes.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无设备</h3>
            <p className="text-muted-foreground mb-4">
              还没有设备连接到 Gateway，请添加您的第一台设备
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
