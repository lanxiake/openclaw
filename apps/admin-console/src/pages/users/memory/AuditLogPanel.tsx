/**
 * 记忆审计日志面板
 *
 * 展示用户记忆操作的审计日志时间线。
 */

import { useState } from 'react'
import { Clock, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import { useMemoryAuditLogs } from '@/hooks/useMemory'

/** 操作类型选项 */
const ACTION_OPTIONS = [
  { value: 'all', label: '全部操作' },
  { value: 'read_profile', label: '读取档案' },
  { value: 'read_facts', label: '读取事实' },
  { value: 'add_fact', label: '添加事实' },
  { value: 'update_fact', label: '更新事实' },
  { value: 'delete_fact', label: '删除事实' },
  { value: 'read_preferences', label: '读取偏好' },
  { value: 'update_preferences', label: '更新偏好' },
  { value: 'read_workspace_file', label: '读取文件' },
  { value: 'update_workspace_file', label: '更新文件' },
  { value: 'system_load', label: '系统加载' },
]

/** 来源类型选项 */
const SOURCE_OPTIONS = [
  { value: 'all', label: '全部来源' },
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: '管理员' },
  { value: 'api', label: 'API' },
  { value: 'system', label: '系统' },
]

/** 操作类型对应颜色 */
const ACTION_COLORS: Record<string, string> = {
  add_fact: 'bg-green-100 text-green-800',
  update_fact: 'bg-blue-100 text-blue-800',
  delete_fact: 'bg-red-100 text-red-800',
  update_preferences: 'bg-purple-100 text-purple-800',
  update_workspace_file: 'bg-orange-100 text-orange-800',
  read_profile: 'bg-gray-100 text-gray-800',
  read_facts: 'bg-gray-100 text-gray-800',
  read_preferences: 'bg-gray-100 text-gray-800',
  read_workspace_file: 'bg-gray-100 text-gray-800',
  system_load: 'bg-yellow-100 text-yellow-800',
}

interface AuditLogEntry {
  id: string
  userId: string
  action: string
  source: string
  targetId?: string
  sessionId?: string
  agentId?: string
  adminId?: string
  details?: Record<string, unknown>
  createdAt?: string
}

interface AuditLogPanelProps {
  userId: string
}

/**
 * 审计日志面板组件
 */
export default function AuditLogPanel({ userId }: AuditLogPanelProps) {
  const [action, setAction] = useState('all')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(0)
  const pageSize = 30

  const { data, isLoading } = useMemoryAuditLogs(userId, {
    action: action !== 'all' ? action : undefined,
    source: source !== 'all' ? source : undefined,
    limit: pageSize,
    offset: page * pageSize,
  })

  const logs: AuditLogEntry[] = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(0) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部操作" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(0) }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部来源" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">共 {total} 条</span>
      </div>

      {/* 日志列表 */}
      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          暂无审计日志
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const actionLabel =
              ACTION_OPTIONS.find((o) => o.value === log.action)?.label ?? log.action
            const sourceLabel =
              SOURCE_OPTIONS.find((o) => o.value === log.source)?.label ?? log.source
            const colorClass = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'

            return (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                {/* 时间线节点 */}
                <div className="w-2 h-2 mt-1.5 rounded-full bg-muted-foreground shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                      {actionLabel}
                    </span>
                    <Badge variant="outline" className="text-xs">{sourceLabel}</Badge>
                    {log.targetId && (
                      <span className="text-xs text-muted-foreground font-mono">
                        目标: {log.targetId.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* 详情 */}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="text-xs bg-muted/30 p-2 rounded mt-1.5 overflow-auto max-h-24">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {log.createdAt && <span>{formatDateTime(log.createdAt)}</span>}
                    {log.sessionId && <span>会话: {log.sessionId.slice(0, 8)}</span>}
                    {log.adminId && <span>管理员: {log.adminId.slice(0, 8)}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
