/**
 * LLM 调用日志页
 *
 * 搜索过滤、统计概览、Recharts 图表、日志列表和详情弹窗
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dialog'
import { ROUTES, LLM_STATUS_LABELS } from '@/lib/constants'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useLlmLogs, useLlmLogStats } from '@/hooks/useLlmLogs'
import type { LlmCallLog, LlmCallStatus, LlmLogQuery } from '@/types/llm-logs'

/**
 * 图表颜色
 */
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

/**
 * 状态对应的 Badge variant
 */
const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  error: 'destructive',
  timeout: 'secondary',
  rate_limited: 'outline',
  auth_error: 'destructive',
}

/**
 * LLM 调用日志页组件
 */
export default function LlmLogsPage() {
  /** 搜索和过滤状态 */
  const [userIdInput, setUserIdInput] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  /** 详情弹窗 */
  const [selectedLog, setSelectedLog] = useState<LlmCallLog | null>(null)

  /** 防抖搜索 */
  const debouncedUserId = useDebounce(userIdInput, 300)

  /** 构建查询参数 */
  const query: LlmLogQuery = {
    userId: debouncedUserId || undefined,
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    status: statusFilter !== 'all' ? (statusFilter as LlmCallStatus) : undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    limit,
    offset,
  }

  /** 时间范围参数（用于统计查询） */
  const timeParams = {
    startTime: startTime || undefined,
    endTime: endTime || undefined,
  }

  /** 获取数据 */
  const { data, isLoading, isFetching, refetch } = useLlmLogs(query)
  const { data: stats } = useLlmLogStats(timeParams)

  /** Provider 分布图数据 */
  const providerChartData = stats?.byProvider
    ? Object.entries(stats.byProvider).map(([name, value]) => ({ name, value }))
    : []

  /** Model 调用排名数据 */
  const modelChartData = stats?.byModel
    ? Object.entries(stats.byModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, value }))
    : []

  /** 重置过滤器并回到第一页 */
  const handleResetFilters = () => {
    setUserIdInput('')
    setProviderFilter('all')
    setStatusFilter('all')
    setStartTime('')
    setEndTime('')
    setOffset(0)
  }

  /** 分页 */
  const handlePrevPage = () => setOffset(Math.max(0, offset - limit))
  const handleNextPage = () => {
    if (data?.hasMore) {
      setOffset(offset + limit)
    }
  }

  /** 错误率 */
  const errorRate = stats && stats.totalCalls > 0
    ? Math.round((stats.errorCalls / stats.totalCalls) * 10000) / 100
    : 0

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={ROUTES.MONITOR}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">LLM 调用日志</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 搜索过滤卡片 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">用户 ID</label>
              <Input
                placeholder="输入用户 ID 搜索"
                value={userIdInput}
                onChange={(e) => {
                  setUserIdInput(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Provider</label>
              <Select
                value={providerFilter}
                onValueChange={(v) => {
                  setProviderFilter(v)
                  setOffset(0)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">状态</label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setOffset(0)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                  <SelectItem value="timeout">超时</SelectItem>
                  <SelectItem value="rate_limited">限流</SelectItem>
                  <SelectItem value="auth_error">认证失败</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                重置过滤
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">开始时间</label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">结束时间</label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计概览卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">总调用数</p>
            <p className="text-2xl font-bold">{stats ? formatNumber(stats.totalCalls) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">成功调用</p>
            <p className="text-2xl font-bold text-green-600">{stats ? formatNumber(stats.successCalls) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">错误率</p>
            <p className="text-2xl font-bold text-red-600">{stats ? `${errorRate}%` : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">平均耗时</p>
            <p className="text-2xl font-bold">
              {stats ? `${Math.round(stats.avgDurationMs)}ms` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      {(providerChartData.length > 0 || modelChartData.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Provider 分布饼图 */}
          {providerChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Provider 调用分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providerChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {providerChartData.map((_entry, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Model 调用排名 */}
          {modelChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">模型调用 Top 8</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelChartData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            调用记录
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">共 {formatNumber(data.total)} 条</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">暂无调用记录</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                      <th className="p-3 font-medium">时间</th>
                      <th className="p-3 font-medium">Provider</th>
                      <th className="p-3 font-medium">模型</th>
                      <th className="p-3 font-medium">状态</th>
                      <th className="p-3 font-medium">用户</th>
                      <th className="p-3 font-medium">输入</th>
                      <th className="p-3 font-medium">输出</th>
                      <th className="p-3 font-medium">耗时</th>
                      <th className="p-3 font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.calledAt)}
                        </td>
                        <td className="p-3 text-xs font-medium">{log.provider}</td>
                        <td className="p-3 text-xs font-mono max-w-[180px] truncate" title={log.model}>
                          {log.model}
                        </td>
                        <td className="p-3">
                          <Badge variant={STATUS_BADGE_VARIANT[log.status] ?? 'secondary'}>
                            {LLM_STATUS_LABELS[log.status] ?? log.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs font-mono max-w-[100px] truncate" title={log.userId}>
                          {log.userId ? log.userId.slice(0, 8) + '...' : '-'}
                        </td>
                        <td className="p-3 font-mono text-xs">{log.inputTokens ?? '-'}</td>
                        <td className="p-3 font-mono text-xs">{log.outputTokens ?? '-'}</td>
                        <td className="p-3 font-mono text-xs">
                          {log.durationMs ? `${log.durationMs}ms` : '-'}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  第 {offset + 1}-{offset + data.logs.length} 条，共 {formatNumber(data.total)} 条
                  {isFetching && '（加载中...）'}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={offset === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!data.hasMore}>
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 详情 Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>调用详情</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span className="font-mono text-xs">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">时间: </span>
                  <span>{formatDateTime(selectedLog.calledAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Provider: </span>
                  <span className="font-medium">{selectedLog.provider}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">模型: </span>
                  <span className="font-mono text-xs">{selectedLog.model}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">状态: </span>
                  <Badge variant={STATUS_BADGE_VARIANT[selectedLog.status] ?? 'secondary'}>
                    {LLM_STATUS_LABELS[selectedLog.status] ?? selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">耗时: </span>
                  <span className="font-mono">{selectedLog.durationMs ? `${selectedLog.durationMs}ms` : '-'}</span>
                </div>
              </div>

              {/* Token 信息 */}
              <div className="rounded bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-2">Token 统计</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>输入: <span className="font-mono">{selectedLog.inputTokens ?? '-'}</span></div>
                  <div>输出: <span className="font-mono">{selectedLog.outputTokens ?? '-'}</span></div>
                  <div>缓存读取: <span className="font-mono">{selectedLog.cacheReadTokens ?? '-'}</span></div>
                  <div>缓存写入: <span className="font-mono">{selectedLog.cacheWriteTokens ?? '-'}</span></div>
                  <div>合计: <span className="font-mono font-medium">{selectedLog.totalTokens ?? '-'}</span></div>
                </div>
              </div>

              {/* 上下文信息 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">用户: </span>
                  <span className="font-mono text-xs">{selectedLog.userId ?? '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">会话: </span>
                  <span className="font-mono text-xs">{selectedLog.sessionId ? selectedLog.sessionId.slice(0, 12) + '...' : '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Channel: </span>
                  <span>{selectedLog.channel ?? '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Run ID: </span>
                  <span className="font-mono text-xs">{selectedLog.runId ? selectedLog.runId.slice(0, 12) + '...' : '-'}</span>
                </div>
              </div>

              {/* 错误信息 */}
              {selectedLog.errorMessage && (
                <div>
                  <p className="text-muted-foreground mb-1">错误信息:</p>
                  <pre className="rounded bg-destructive/10 p-3 text-xs text-destructive overflow-auto max-h-20">
                    {selectedLog.errorMessage}
                  </pre>
                </div>
              )}

              {/* 元数据 */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">元数据:</p>
                  <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
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
