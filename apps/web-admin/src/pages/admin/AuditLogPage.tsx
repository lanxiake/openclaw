import { useState } from 'react'
import { Search, Filter, Download, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { useAuditLogs, useAuditStats, useExportAuditLogs } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import type { AuditAction } from '@/services'

/**
 * 操作类型配置
 */
const actionConfig: Record<string, { label: string; color: string }> = {
  login: { label: '用户登录', color: 'text-blue-600' },
  logout: { label: '用户登出', color: 'text-gray-600' },
  register: { label: '用户注册', color: 'text-green-600' },
  'token.refresh': { label: '令牌刷新', color: 'text-gray-500' },
  'skill.execute': { label: '技能执行', color: 'text-purple-600' },
  'skill.install': { label: '技能安装', color: 'text-green-600' },
  'skill.uninstall': { label: '技能卸载', color: 'text-red-600' },
  'skill.enable': { label: '技能启用', color: 'text-green-600' },
  'skill.disable': { label: '技能禁用', color: 'text-yellow-600' },
  'subscription.create': { label: '创建订阅', color: 'text-blue-600' },
  'subscription.update': { label: '更新订阅', color: 'text-yellow-600' },
  'subscription.cancel': { label: '取消订阅', color: 'text-red-600' },
  'device.pair': { label: '设备配对', color: 'text-green-600' },
  'device.unpair': { label: '设备解绑', color: 'text-red-600' },
  'config.update': { label: '配置更新', color: 'text-yellow-600' },
  'admin.user.update': { label: '管理员更新用户', color: 'text-blue-600' },
  'admin.user.delete': { label: '管理员删除用户', color: 'text-red-600' },
}

/**
 * 获取操作类型显示
 */
function getActionDisplay(action: string) {
  return actionConfig[action] || { label: action, color: 'text-gray-600' }
}

/**
 * 审计日志页面
 */
export default function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const { toast } = useToast()

  // 查询审计日志
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useAuditLogs({
    action: actionFilter !== 'all' ? actionFilter as AuditAction : undefined,
    offset: page * pageSize,
    limit: pageSize,
  })

  // 获取审计统计
  const { data: stats } = useAuditStats()

  // 导出日志
  const exportMutation = useExportAuditLogs()

  /**
   * 导出日志
   */
  const handleExport = async () => {
    try {
      const result = await exportMutation.mutateAsync({ format: 'csv' })
      if (result.success && result.downloadUrl) {
        window.open(result.downloadUrl, '_blank')
        toast({
          title: '导出成功',
          description: '日志文件已开始下载',
        })
      } else {
        toast({
          title: '导出失败',
          description: result.error || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '导出失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  // 过滤日志（客户端搜索）
  const logs = logsData?.logs || []
  const filteredLogs = search
    ? logs.filter(
        (log) =>
          log.userName?.toLowerCase().includes(search.toLowerCase()) ||
          log.resource?.toLowerCase().includes(search.toLowerCase()) ||
          log.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const totalLogs = logsData?.total || 0
  const hasMore = logsData?.hasMore || false

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审计日志</h1>
          <p className="text-muted-foreground">查看系统操作记录</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          导出
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总日志数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                今日日志
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayLogs.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                成功率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {(stats.successRate * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                操作类型数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(stats.byAction).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户、资源..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Button
            variant={actionFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter('all')}
          >
            全部
          </Button>
          <Button
            variant={actionFilter === 'login' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter('login')}
          >
            认证
          </Button>
          <Button
            variant={actionFilter.startsWith('skill') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter('skill.execute')}
          >
            技能
          </Button>
          <Button
            variant={actionFilter.startsWith('subscription') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter('subscription.create')}
          >
            订阅
          </Button>
          <Button
            variant={actionFilter.startsWith('device') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionFilter('device.pair')}
          >
            设备
          </Button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <p className="text-destructive mb-4">加载失败: {error.message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 日志列表 */}
      {!isLoading && !error && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredLogs.map((log) => {
                const config = getActionDisplay(log.action)
                return (
                  <div key={log.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 成功/失败标识 */}
                          {log.success ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-medium">
                            {log.userName || log.userId || '系统'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {log.resource && (
                            <span className="font-mono">{log.resource}</span>
                          )}
                          {log.resourceId && (
                            <span className="font-mono ml-1">#{log.resourceId}</span>
                          )}
                          {log.ipAddress && (
                            <span className="ml-2">· {log.ipAddress}</span>
                          )}
                        </div>
                        {log.errorMessage && (
                          <div className="mt-2 text-sm text-destructive">
                            错误: {log.errorMessage}
                          </div>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 text-sm bg-muted/50 p-2 rounded font-mono overflow-x-auto">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredLogs.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                没有找到匹配的日志
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 分页 */}
      {!isLoading && !error && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {totalLogs} 条记录，当前第 {page + 1} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
