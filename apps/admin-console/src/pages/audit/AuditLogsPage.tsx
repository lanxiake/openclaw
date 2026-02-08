import { useState, useCallback } from 'react'
import { Search, RefreshCw, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from '@/components/ui/dialog'
import { formatDateTime, cn } from '@/lib/utils'
import { AUDIT_ACTION_LABELS } from '@/lib/constants'
import { useAuditLogStats, useAuditLogList } from '@/hooks/useAuditLogs'
import type { AuditLog, AuditLogQuery } from '@/types/audit'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 获取操作类型徽章变体
 */
function getActionVariant(action: string) {
  if (action.includes('login') || action.includes('logout')) return 'secondary'
  if (action.includes('view')) return 'default'
  if (action.includes('create') || action.includes('update')) return 'success'
  if (action.includes('suspend') || action.includes('delete') || action.includes('refund'))
    return 'destructive'
  return 'secondary'
}

/**
 * 获取风险等级徽章变体
 */
function getRiskVariant(riskLevel?: string) {
  switch (riskLevel) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'destructive'
    case 'medium':
      return 'secondary'
    case 'low':
    default:
      return 'default'
  }
}

/**
 * 风险等级标签
 */
const RISK_LEVEL_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
}

/**
 * 操作日志页面
 */
export default function AuditLogsPage() {
  // 搜索和过滤状态
  const [searchInput, setSearchInput] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 详情弹窗状态
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300)

  // 构建查询参数
  const query: AuditLogQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    riskLevel: riskFilter !== 'all' ? riskFilter : undefined,
  }

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useAuditLogStats()

  // 获取日志列表
  const { data, isLoading, isFetching, refetch } = useAuditLogList(query)

  // 计算分页信息
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  /**
   * 导出日志（暂未实现）
   */
  const handleExport = useCallback(() => {
    alert('导出功能开发中...')
  }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">操作日志</h1>
          <p className="text-muted-foreground">查看管理员操作记录</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalActions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">总操作数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{stats?.todayActions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">今日操作</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{stats?.weekActions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">本周操作</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-red-500">{stats?.highRiskActions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">高风险操作</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索管理员、操作类型..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={riskFilter}
                onValueChange={(value: string) => {
                  setRiskFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="风险等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等级</SelectItem>
                  <SelectItem value="critical">严重</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            操作记录
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total})</span>}
          </CardTitle>
          <CardDescription>管理员操作的详细记录</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有找到匹配的操作日志</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>管理员</th>
                      <th>操作类型</th>
                      <th>操作对象</th>
                      <th>风险等级</th>
                      <th>IP 地址</th>
                      <th className="text-right">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-sm">{log.createdAt ? formatDateTime(log.createdAt) : '-'}</td>
                        <td className="font-medium">{log.adminName}</td>
                        <td>
                          <Badge
                            variant={
                              getActionVariant(log.action) as
                                | 'secondary'
                                | 'default'
                                | 'success'
                                | 'destructive'
                            }
                          >
                            {AUDIT_ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </td>
                        <td>
                          {log.targetName ? (
                            <div>
                              <p>{log.targetName}</p>
                              <p className="text-xs text-muted-foreground">{log.targetType}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td>
                          {log.riskLevel && (
                            <Badge
                              variant={
                                getRiskVariant(log.riskLevel) as
                                  | 'destructive'
                                  | 'secondary'
                                  | 'default'
                              }
                            >
                              {RISK_LEVEL_LABELS[log.riskLevel] || log.riskLevel}
                            </Badge>
                          )}
                        </td>
                        <td className="font-mono text-sm">{log.ip || '-'}</td>
                        <td className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    共 {data.total} 条，第 {page}/{totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>操作详情</DialogTitle>
            <DialogDescription>
              {selectedLog && selectedLog.createdAt && formatDateTime(selectedLog.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">管理员</p>
                  <p className="font-medium">{selectedLog.adminName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">操作类型</p>
                  <p className="font-medium">
                    {AUDIT_ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">操作对象</p>
                  <p className="font-medium">{selectedLog.targetName || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP 地址</p>
                  <p className="font-mono">{selectedLog.ip || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">风险等级</p>
                  {selectedLog.riskLevel ? (
                    <Badge variant={getRiskVariant(selectedLog.riskLevel) as 'destructive' | 'secondary' | 'default'}>
                      {RISK_LEVEL_LABELS[selectedLog.riskLevel] || selectedLog.riskLevel}
                    </Badge>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
              {selectedLog.userAgent && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">User Agent</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">详细信息</p>
                  <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
