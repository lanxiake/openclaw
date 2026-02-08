import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Filter,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { useAlerts, useAcknowledgeAlert, useResolveAlert } from '@/hooks/useMonitor'
import type { Alert, AlertSeverity } from '@/types/monitor'

/**
 * 获取告警级别配置
 */
function getAlertSeverityConfig(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-600/10', label: '严重' }
    case 'warning':
      return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: '警告' }
    case 'info':
      return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', label: '信息' }
    default:
      return { icon: Info, color: 'text-gray-500', bg: 'bg-gray-500/10', label: severity }
  }
}

/**
 * 告警页面
 */
export default function AlertsPage() {
  // 过滤状态
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('all')
  const [resolvedFilter, setResolvedFilter] = useState<string>('all')

  // 详情/操作弹窗状态
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [actionType, setActionType] = useState<'acknowledge' | 'resolve' | null>(null)

  // 构建查询参数
  const filters: { acknowledged?: boolean; resolved?: boolean } = {}
  if (acknowledgedFilter !== 'all') {
    filters.acknowledged = acknowledgedFilter === 'yes'
  }
  if (resolvedFilter !== 'all') {
    filters.resolved = resolvedFilter === 'yes'
  }

  // 获取告警列表
  const { data, isLoading, isFetching, refetch } = useAlerts(filters)

  // 确认/解决告警的 mutation
  const acknowledgeAlert = useAcknowledgeAlert()
  const resolveAlert = useResolveAlert()

  /**
   * 处理确认告警
   */
  const handleAcknowledge = useCallback(async () => {
    if (!selectedAlert) return
    try {
      await acknowledgeAlert.mutateAsync(selectedAlert.id)
      setSelectedAlert(null)
      setActionType(null)
    } catch (error) {
      console.error('确认告警失败:', error)
    }
  }, [selectedAlert, acknowledgeAlert])

  /**
   * 处理解决告警
   */
  const handleResolve = useCallback(async () => {
    if (!selectedAlert) return
    try {
      await resolveAlert.mutateAsync(selectedAlert.id)
      setSelectedAlert(null)
      setActionType(null)
    } catch (error) {
      console.error('解决告警失败:', error)
    }
  }, [selectedAlert, resolveAlert])

  /**
   * 打开操作确认弹窗
   */
  const openActionDialog = useCallback((alert: Alert, type: 'acknowledge' | 'resolve') => {
    setSelectedAlert(alert)
    setActionType(type)
  }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/monitor">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">告警管理</h1>
            <p className="text-muted-foreground">查看和处理系统告警</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Bell className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总告警数</p>
                  <p className="text-2xl font-bold">{data.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold">{data.unacknowledged}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">已解决</p>
                  <p className="text-2xl font-bold">
                    {data.alerts.filter((a) => a.resolved).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 过滤器 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">筛选：</span>
            </div>
            <div className="flex gap-2">
              <Select value={acknowledgedFilter} onValueChange={setAcknowledgedFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="确认状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="yes">已确认</SelectItem>
                  <SelectItem value="no">未确认</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="解决状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="yes">已解决</SelectItem>
                  <SelectItem value="no">未解决</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 告警列表 */}
      <Card>
        <CardHeader>
          <CardTitle>告警列表</CardTitle>
          <CardDescription>点击告警可进行确认或解决操作</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">暂无告警</p>
              <p className="text-sm text-muted-foreground">系统运行正常，没有需要处理的告警</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.alerts.map((alert) => {
                const config = getAlertSeverityConfig(alert.severity)
                const Icon = config.icon

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg border transition-colors',
                      alert.resolved
                        ? 'bg-muted/30 opacity-60'
                        : 'hover:bg-muted/50 cursor-pointer',
                      config.bg
                    )}
                    onClick={() => !alert.resolved && setSelectedAlert(alert)}
                  >
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn('text-xs', config.color)}>
                          {config.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {alert.type}
                        </Badge>
                        {alert.acknowledged && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            已确认
                          </Badge>
                        )}
                        {alert.resolved && (
                          <Badge variant="outline" className="text-xs text-blue-600">
                            已解决
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>发生时间：{formatRelativeTime(alert.timestamp)}</span>
                        {alert.source && <span>来源：{alert.source}</span>}
                      </div>
                    </div>
                    {!alert.resolved && (
                      <div className="flex gap-2 shrink-0">
                        {!alert.acknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openActionDialog(alert, 'acknowledge')
                            }}
                          >
                            确认
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openActionDialog(alert, 'resolve')
                          }}
                        >
                          解决
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 告警详情弹窗 */}
      <Dialog
        open={!!selectedAlert && !actionType}
        onOpenChange={() => setSelectedAlert(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>告警详情</DialogTitle>
            <DialogDescription>
              {selectedAlert && formatDateTime(selectedAlert.timestamp)}
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">级别</p>
                  <Badge
                    variant="outline"
                    className={cn('mt-1', getAlertSeverityConfig(selectedAlert.severity).color)}
                  >
                    {getAlertSeverityConfig(selectedAlert.severity).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">类型</p>
                  <p className="font-medium mt-1">{selectedAlert.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">来源</p>
                  <p className="font-medium mt-1">{selectedAlert.source || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">状态</p>
                  <div className="flex gap-2 mt-1">
                    {selectedAlert.acknowledged ? (
                      <Badge variant="outline" className="text-green-600">
                        已确认
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600">
                        未确认
                      </Badge>
                    )}
                    {selectedAlert.resolved ? (
                      <Badge variant="outline" className="text-blue-600">
                        已解决
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600">
                        未解决
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">标题</p>
                <p className="text-sm font-medium">{selectedAlert.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">详细信息</p>
                <p className="text-sm bg-muted p-3 rounded">{selectedAlert.message}</p>
              </div>
              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">元数据</p>
                  <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto">
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedAlert && !selectedAlert.acknowledged && (
              <Button
                variant="outline"
                onClick={() => setActionType('acknowledge')}
              >
                确认告警
              </Button>
            )}
            {selectedAlert && !selectedAlert.resolved && (
              <Button onClick={() => setActionType('resolve')}>
                解决告警
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 操作确认弹窗 */}
      <Dialog
        open={!!selectedAlert && !!actionType}
        onOpenChange={() => {
          setActionType(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'acknowledge' ? '确认告警' : '解决告警'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'acknowledge'
                ? '确认后表示您已知悉此告警，但问题尚未解决'
                : '解决后表示此告警对应的问题已被处理'}
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="py-4">
              <p className="text-sm">
                <span className="text-muted-foreground">告警标题：</span>
                <span className="font-medium">{selectedAlert.title}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              取消
            </Button>
            <Button
              onClick={actionType === 'acknowledge' ? handleAcknowledge : handleResolve}
              disabled={acknowledgeAlert.isPending || resolveAlert.isPending}
            >
              {(acknowledgeAlert.isPending || resolveAlert.isPending) && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
