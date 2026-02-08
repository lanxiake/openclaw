/**
 * AuditLogView Component - 审计日志视图
 *
 * 显示审计日志列表，支持搜索、过滤、导出和清除功能
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  useAuditLog,
  type AuditLogEntry,
  type AuditSeverity,
  type AuditEventType,
  EVENT_TYPE_LABELS,
  SEVERITY_LABELS,
  SOURCE_TYPE_LABELS,
} from '../hooks/useAuditLog'
import './AuditLogView.css'

interface AuditLogViewProps {
  isConnected: boolean
}

/**
 * 获取事件类型图标
 */
function getEventTypeIcon(eventType: AuditEventType): string {
  if (eventType.startsWith('session.')) return '🔗'
  if (eventType.startsWith('chat.')) return '💬'
  if (eventType.startsWith('skill.')) return '⚡'
  if (eventType.startsWith('file.')) return '📁'
  if (eventType.startsWith('system.')) return '🖥️'
  if (eventType.startsWith('confirm.')) return '✋'
  if (eventType.startsWith('settings.')) return '⚙️'
  if (eventType.startsWith('auth.')) return '🔐'
  return '📋'
}

/**
 * 格式化时间
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (entryDate.getTime() === today.getTime()) {
    return `今天 ${timeStr}`
  }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (entryDate.getTime() === yesterday.getTime()) {
    return `昨天 ${timeStr}`
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 统计卡片组件
 */
function StatsCard({ stats }: { stats: ReturnType<typeof useAuditLog>['stats'] }) {
  if (!stats) {
    return null
  }

  return (
    <div className="stats-card">
      <div className="stat-item">
        <span className="stat-value">{stats.todayCount}</span>
        <span className="stat-label">今日</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-info">{stats.bySeverity.info || 0}</span>
        <span className="stat-label">信息</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-warn">{stats.bySeverity.warn || 0}</span>
        <span className="stat-label">警告</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-critical">{stats.bySeverity.critical || 0}</span>
        <span className="stat-label">严重</span>
      </div>
    </div>
  )
}

/**
 * 日志条目组件
 */
function AuditEntryCard({
  entry,
  isSelected,
  onSelect,
}: {
  entry: AuditLogEntry
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={`audit-entry ${isSelected ? 'selected' : ''} severity-${entry.severity}`}
      onClick={onSelect}
    >
      <div className="entry-icon">{getEventTypeIcon(entry.eventType)}</div>
      <div className="entry-content">
        <div className="entry-header">
          <h4 className="entry-title">{entry.title}</h4>
          <span className="entry-time">{formatTime(entry.timestamp)}</span>
        </div>
        <p className="entry-detail">{entry.detail}</p>
        <div className="entry-footer">
          <span className="entry-badge badge-event-type">
            {EVENT_TYPE_LABELS[entry.eventType] || entry.eventType}
          </span>
          <span className={`entry-badge badge-severity-${entry.severity}`}>
            {SEVERITY_LABELS[entry.severity]}
          </span>
          <span className={`entry-badge badge-result-${entry.result}`}>
            {entry.result === 'success' ? '成功' : entry.result === 'failure' ? '失败' : '等待中'}
          </span>
          <span className="entry-badge badge-source">
            {SOURCE_TYPE_LABELS[entry.source.type]}: {entry.source.name}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * 详情面板组件
 */
function DetailPanel({ entry }: { entry: AuditLogEntry | null }) {
  if (!entry) {
    return (
      <div className="audit-detail-panel empty">
        <div style={{ textAlign: 'center' }}>
          <span className="empty-icon">📋</span>
          <p>选择一条日志查看详情</p>
        </div>
      </div>
    )
  }

  return (
    <div className="audit-detail-panel">
      <div className="detail-header">
        <h3>{entry.title}</h3>
        <div className="detail-badges">
          <span className={`entry-badge badge-severity-${entry.severity}`}>
            {SEVERITY_LABELS[entry.severity]}
          </span>
          <span className={`entry-badge badge-result-${entry.result}`}>
            {entry.result === 'success' ? '成功' : entry.result === 'failure' ? '失败' : '等待中'}
          </span>
        </div>
      </div>
      <div className="detail-body">
        <div className="detail-section">
          <h4>详情</h4>
          <p>{entry.detail}</p>
        </div>

        <div className="detail-section">
          <h4>基本信息</h4>
          <dl className="detail-info">
            <div>
              <dt>事件类型</dt>
              <dd>{EVENT_TYPE_LABELS[entry.eventType] || entry.eventType}</dd>
            </div>
            <div>
              <dt>时间</dt>
              <dd>{new Date(entry.timestamp).toLocaleString('zh-CN')}</dd>
            </div>
            <div>
              <dt>来源类型</dt>
              <dd>{SOURCE_TYPE_LABELS[entry.source.type]}</dd>
            </div>
            <div>
              <dt>来源名称</dt>
              <dd>{entry.source.name}</dd>
            </div>
            {entry.source.ip && (
              <div>
                <dt>IP 地址</dt>
                <dd>{entry.source.ip}</dd>
              </div>
            )}
            {entry.sessionId && (
              <div>
                <dt>会话 ID</dt>
                <dd>{entry.sessionId}</dd>
              </div>
            )}
            {entry.userId && (
              <div>
                <dt>用户 ID</dt>
                <dd>{entry.userId}</dd>
              </div>
            )}
            {entry.deviceId && (
              <div>
                <dt>设备 ID</dt>
                <dd>{entry.deviceId}</dd>
              </div>
            )}
          </dl>
        </div>

        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <div className="detail-section">
            <h4>元数据</h4>
            <pre className="detail-metadata">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </div>
        )}

        <div className="detail-section">
          <h4>日志 ID</h4>
          <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entry.id}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * 导出对话框组件
 */
function ExportDialog({
  isOpen,
  onClose,
  onExport,
  isExporting,
}: {
  isOpen: boolean
  onClose: () => void
  onExport: (format: 'json' | 'csv') => void
  isExporting: boolean
}) {
  const [format, setFormat] = useState<'json' | 'csv'>('json')

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>导出审计日志</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label>导出格式</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            导出内容将包含当前筛选条件下的所有日志记录。
          </p>
        </div>
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>取消</button>
          <button
            className="confirm-button"
            onClick={() => onExport(format)}
            disabled={isExporting}
          >
            {isExporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 清除对话框组件
 */
function ClearDialog({
  isOpen,
  onClose,
  onClear,
  isClearing,
}: {
  isOpen: boolean
  onClose: () => void
  onClear: (beforeDate?: string) => void
  isClearing: boolean
}) {
  const [beforeDate, setBeforeDate] = useState('')
  const [clearAll, setClearAll] = useState(false)

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>清除审计日志</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={clearAll}
                onChange={(e) => setClearAll(e.target.checked)}
              />
              清除所有日志
            </label>
          </div>
          {!clearAll && (
            <div className="form-group">
              <label>清除此日期之前的日志</label>
              <input
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
              />
            </div>
          )}
          <p style={{ fontSize: '12px', color: 'var(--color-error)' }}>
            ⚠️ 此操作不可恢复，请谨慎操作。
          </p>
        </div>
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>取消</button>
          <button
            className="confirm-button danger"
            onClick={() => onClear(clearAll ? undefined : beforeDate || undefined)}
            disabled={isClearing || (!clearAll && !beforeDate)}
          >
            {isClearing ? '清除中...' : '确认清除'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 审计日志视图组件
 */
export function AuditLogView({ isConnected }: AuditLogViewProps) {
  const {
    entries,
    total,
    stats,
    isLoading,
    error,
    filters,
    queryLogs,
    getStats,
    exportLogs,
    clearLogs,
    setFilters,
    refresh,
    loadMore,
  } = useAuditLog()

  // 选中的日志条目
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('')

  // 过滤条件
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | ''>('')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')

  // 对话框状态
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (isConnected) {
      queryLogs()
      getStats()
    }
  }, [isConnected, queryLogs, getStats])

  /**
   * 搜索处理
   */
  const handleSearch = useCallback(() => {
    queryLogs({
      ...filters,
      search: searchQuery || undefined,
      severities: severityFilter ? [severityFilter] : undefined,
      eventTypes: eventTypeFilter ? [eventTypeFilter as AuditEventType] : undefined,
      offset: 0,
    })
  }, [filters, searchQuery, severityFilter, eventTypeFilter, queryLogs])

  /**
   * 搜索输入回车处理
   */
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  /**
   * 导出处理
   */
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    setIsExporting(true)
    try {
      const content = await exportLogs(format)
      // 创建下载
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      setShowExportDialog(false)
    } catch (err) {
      console.error('导出失败:', err)
    } finally {
      setIsExporting(false)
    }
  }, [exportLogs])

  /**
   * 清除处理
   */
  const handleClear = useCallback(async (beforeDate?: string) => {
    setIsClearing(true)
    try {
      const result = await clearLogs(beforeDate)
      console.log('清除完成，删除了', result.deletedCount, '条记录')
      setShowClearDialog(false)
      setSelectedEntry(null)
    } catch (err) {
      console.error('清除失败:', err)
    } finally {
      setIsClearing(false)
    }
  }, [clearLogs])

  // 未连接状态
  if (!isConnected) {
    return (
      <div className="audit-log-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接 Gateway 以查看审计日志</p>
        </div>
      </div>
    )
  }

  return (
    <div className="audit-log-view">
      {/* 工具栏 */}
      <div className="audit-toolbar">
        <div className="toolbar-left">
          <h2>审计日志</h2>
          <StatsCard stats={stats} />
        </div>
        <div className="toolbar-right">
          <input
            type="text"
            className="search-input"
            placeholder="搜索日志..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="toolbar-button" onClick={handleSearch} title="搜索">
            🔍
          </button>
          <button
            className="toolbar-button"
            onClick={() => setShowExportDialog(true)}
            title="导出"
          >
            📤
          </button>
          <button
            className="toolbar-button danger"
            onClick={() => setShowClearDialog(true)}
            title="清除"
          >
            🗑️
          </button>
          <button
            className="toolbar-button"
            onClick={refresh}
            disabled={isLoading}
            title="刷新"
          >
            {isLoading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">严重级别:</span>
          <select
            className="filter-select"
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as AuditSeverity | '')
              queryLogs({
                ...filters,
                severities: e.target.value ? [e.target.value as AuditSeverity] : undefined,
                offset: 0,
              })
            }}
          >
            <option value="">全部</option>
            <option value="info">信息</option>
            <option value="warn">警告</option>
            <option value="critical">严重</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">事件类型:</span>
          <select
            className="filter-select"
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value)
              queryLogs({
                ...filters,
                eventTypes: e.target.value ? [e.target.value as AuditEventType] : undefined,
                offset: 0,
              })
            }}
          >
            <option value="">全部</option>
            <optgroup label="会话">
              <option value="session.start">会话开始</option>
              <option value="session.end">会话结束</option>
              <option value="session.connect">连接建立</option>
              <option value="session.disconnect">连接断开</option>
            </optgroup>
            <optgroup label="聊天">
              <option value="chat.message.sent">发送消息</option>
              <option value="chat.message.received">接收消息</option>
              <option value="chat.abort">中止对话</option>
            </optgroup>
            <optgroup label="技能">
              <option value="skill.execute.start">技能执行开始</option>
              <option value="skill.execute.success">技能执行成功</option>
              <option value="skill.execute.error">技能执行失败</option>
              <option value="skill.install">安装技能</option>
              <option value="skill.uninstall">卸载技能</option>
            </optgroup>
            <optgroup label="文件">
              <option value="file.read">读取文件</option>
              <option value="file.write">写入文件</option>
              <option value="file.delete">删除文件</option>
              <option value="file.move">移动文件</option>
            </optgroup>
            <optgroup label="系统">
              <option value="system.process.kill">结束进程</option>
              <option value="system.app.launch">启动应用</option>
              <option value="system.command.execute">执行命令</option>
            </optgroup>
            <optgroup label="确认">
              <option value="confirm.request">请求确认</option>
              <option value="confirm.approve">批准操作</option>
              <option value="confirm.reject">拒绝操作</option>
            </optgroup>
          </select>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          共 {total} 条记录
        </span>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={refresh}>重试</button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="audit-content">
        {/* 日志列表 */}
        <div className="audit-list">
          {isLoading && entries.length === 0 ? (
            <div className="loading-state">
              <span className="spinner">⏳</span>
              <p>加载中...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <span className="icon">📋</span>
              <p>暂无审计日志</p>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <AuditEntryCard
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedEntry?.id === entry.id}
                  onSelect={() => setSelectedEntry(entry)}
                />
              ))}
              {entries.length < total && (
                <div className="load-more">
                  <button onClick={loadMore} disabled={isLoading}>
                    {isLoading ? '加载中...' : `加载更多 (${entries.length}/${total})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 详情面板 */}
        <DetailPanel entry={selectedEntry} />
      </div>

      {/* 导出对话框 */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* 清除对话框 */}
      <ClearDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onClear={handleClear}
        isClearing={isClearing}
      />
    </div>
  )
}
