import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  XCircle,
} from 'lucide-react'
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
import { cn, formatDateTime } from '@/lib/utils'
import { useLogs, useLogSources } from '@/hooks/useMonitor'
import type { LogLevel, LogEntry, LogQuery } from '@/types/monitor'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 获取日志级别配置
 */
function getLogLevelConfig(level: LogLevel) {
  switch (level) {
    case 'debug':
      return { icon: Bug, color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'DEBUG' }
    case 'info':
      return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'INFO' }
    case 'warn':
      return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'WARN' }
    case 'error':
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'ERROR' }
    case 'fatal':
      return { icon: XCircle, color: 'text-red-700', bg: 'bg-red-700/10', label: 'FATAL' }
    default:
      return { icon: Info, color: 'text-gray-500', bg: 'bg-gray-500/10', label: level }
  }
}

/**
 * 日志页面
 */
export default function LogsPage() {
  // 搜索和过滤状态
  const [searchInput, setSearchInput] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const limit = 50

  // 详情弹窗状态
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300)

  // 构建查询参数
  const query: LogQuery = {
    level: levelFilter !== 'all' ? (levelFilter as LogLevel) : undefined,
    source: sourceFilter !== 'all' ? sourceFilter : undefined,
    search: debouncedSearch || undefined,
    limit,
    offset,
  }

  // 获取日志列表
  const { data, isLoading, isFetching, refetch } = useLogs(query)

  // 获取来源列表
  const { data: sources } = useLogSources()

  /**
   * 导出日志
   */
  const handleExport = useCallback(() => {
    alert('导出功能开发中...')
  }, [])

  /**
   * 加载更多
   */
  const handleLoadMore = useCallback(() => {
    setOffset((o) => o + limit)
  }, [limit])

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
            <h1 className="text-2xl font-bold">系统日志</h1>
            <p className="text-muted-foreground">查看系统运行日志</p>
          </div>
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

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索日志内容..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={levelFilter}
                onValueChange={(value) => {
                  setLevelFilter(value)
                  setOffset(0)
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部级别</SelectItem>
                  <SelectItem value="debug">DEBUG</SelectItem>
                  <SelectItem value="info">INFO</SelectItem>
                  <SelectItem value="warn">WARN</SelectItem>
                  <SelectItem value="error">ERROR</SelectItem>
                  <SelectItem value="fatal">FATAL</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter}
                onValueChange={(value) => {
                  setSourceFilter(value)
                  setOffset(0)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  {sources?.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
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
            日志列表
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total})</span>}
          </CardTitle>
          <CardDescription>点击日志查看详细信息</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有找到匹配的日志</div>
          ) : (
            <div className="space-y-2">
              {data.logs.map((log) => {
                const config = getLogLevelConfig(log.level)
                const Icon = config.icon

                return (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
                      config.bg
                    )}
                    onClick={() => setSelectedLog(log)}
                  >
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {log.source}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm truncate">{log.message}</p>
                    </div>
                  </div>
                )
              })}

              {/* 加载更多 */}
              {data.hasMore && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={handleLoadMore} disabled={isFetching}>
                    {isFetching ? '加载中...' : '加载更多'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 日志详情对话框 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
            <DialogDescription>
              {selectedLog && formatDateTime(selectedLog.timestamp)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">级别</p>
                  <Badge
                    variant="outline"
                    className={cn('mt-1', getLogLevelConfig(selectedLog.level).color)}
                  >
                    {getLogLevelConfig(selectedLog.level).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">来源</p>
                  <p className="font-medium mt-1">{selectedLog.source}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">消息</p>
                <p className="text-sm bg-muted p-3 rounded">{selectedLog.message}</p>
              </div>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">元数据</p>
                  <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto">
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
