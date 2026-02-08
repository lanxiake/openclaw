/**
 * SystemView Component - 系统监控视图
 *
 * 显示系统信息、CPU/内存使用、磁盘状态、进程列表
 */

import React, { useState, useCallback } from 'react'
import {
  useSystemMonitor,
  formatBytes,
  formatUptime,
  type ProcessInfo,
  type ProcessSortBy,
} from '../hooks/useSystemMonitor'
import './SystemView.css'

interface SystemViewProps {
  isConnected: boolean
}

/**
 * 刷新间隔选项
 */
const REFRESH_INTERVALS = [
  { value: 1000, label: '1 秒' },
  { value: 3000, label: '3 秒' },
  { value: 5000, label: '5 秒' },
  { value: 10000, label: '10 秒' },
  { value: 0, label: '手动' },
]

/**
 * 进度条组件
 */
const ProgressBar: React.FC<{
  value: number
  label?: string
  colorClass?: string
}> = ({ value, label, colorClass = '' }) => {
  const clampedValue = Math.min(100, Math.max(0, value))
  const barClass = clampedValue > 90 ? 'critical' : clampedValue > 70 ? 'warning' : 'normal'

  return (
    <div className="progress-bar-container">
      <div className="progress-bar">
        <div
          className={`progress-fill ${colorClass || barClass}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {label && <span className="progress-label">{label}</span>}
    </div>
  )
}

/**
 * 系统信息卡片
 */
const SystemInfoCard: React.FC<{
  systemInfo: ReturnType<typeof useSystemMonitor>['systemInfo']
}> = ({ systemInfo }) => {
  if (!systemInfo) {
    return (
      <div className="info-card">
        <h3 className="card-title">📊 系统概览</h3>
        <div className="card-loading">加载中...</div>
      </div>
    )
  }

  // CPU 使用率从 systemInfo 获取（如果 main 进程提供）
  const cpuPercent = systemInfo.cpuUsage || 0

  return (
    <div className="info-card">
      <h3 className="card-title">📊 系统概览</h3>
      <div className="card-content">
        <div className="info-row">
          <span className="info-label">主机名</span>
          <span className="info-value">{systemInfo.hostname}</span>
        </div>
        <div className="info-row">
          <span className="info-label">操作系统</span>
          <span className="info-value">
            {systemInfo.platform} {systemInfo.release}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">架构</span>
          <span className="info-value">{systemInfo.arch}</span>
        </div>
        <div className="info-row">
          <span className="info-label">运行时间</span>
          <span className="info-value">{formatUptime(systemInfo.uptime)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">CPU</span>
          <span className="info-value">
            {systemInfo.cpuModel} ({systemInfo.cpuCores} 核心)
          </span>
        </div>

        <div className="usage-section">
          {cpuPercent > 0 && (
            <div className="usage-item">
              <div className="usage-header">
                <span>CPU 使用率</span>
                <span>{cpuPercent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={cpuPercent} />
            </div>
          )}

          <div className="usage-item">
            <div className="usage-header">
              <span>内存使用</span>
              <span>
                {formatBytes(systemInfo.usedMemory)} / {formatBytes(systemInfo.totalMemory)}
              </span>
            </div>
            <ProgressBar value={systemInfo.memoryUsagePercent} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 磁盘信息卡片
 */
const DiskInfoCard: React.FC<{
  disks: ReturnType<typeof useSystemMonitor>['disks']
}> = ({ disks }) => {
  if (disks.length === 0) {
    return (
      <div className="info-card">
        <h3 className="card-title">💾 磁盘存储</h3>
        <div className="card-loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="info-card">
      <h3 className="card-title">💾 磁盘存储</h3>
      <div className="card-content">
        {disks.map((disk, index) => (
          <div key={index} className="disk-item">
            <div className="disk-header">
              <span className="disk-name">
                {disk.name || disk.mount} ({disk.type})
              </span>
              <span className="disk-usage">
                {formatBytes(disk.used)} / {formatBytes(disk.total)}
              </span>
            </div>
            <ProgressBar
              value={disk.usagePercent}
              label={`${disk.usagePercent.toFixed(1)}%`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 进程列表头部
 */
const ProcessListHeader: React.FC<{
  sortBy: ProcessSortBy
  sortOrder: 'asc' | 'desc'
  onSort: (by: ProcessSortBy) => void
}> = ({ sortBy, sortOrder, onSort }) => {
  const getSortIndicator = (by: ProcessSortBy) => {
    if (sortBy !== by) return ''
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="process-header">
      <button className="process-col col-pid" onClick={() => onSort('pid')}>
        PID{getSortIndicator('pid')}
      </button>
      <button className="process-col col-name" onClick={() => onSort('name')}>
        进程名{getSortIndicator('name')}
      </button>
      <button className="process-col col-cpu" onClick={() => onSort('cpu')}>
        CPU{getSortIndicator('cpu')}
      </button>
      <button className="process-col col-memory" onClick={() => onSort('memory')}>
        内存{getSortIndicator('memory')}
      </button>
      <div className="process-col col-action">操作</div>
    </div>
  )
}

/**
 * 进程列表项
 */
const ProcessListItem: React.FC<{
  process: ProcessInfo
  onKill: (pid: number) => void
}> = ({ process, onKill }) => {
  const [isKilling, setIsKilling] = useState(false)

  const handleKill = async () => {
    if (!window.confirm(`确定要结束进程 "${process.name}" (PID: ${process.pid}) 吗？`)) {
      return
    }

    setIsKilling(true)
    await onKill(process.pid)
    setIsKilling(false)
  }

  return (
    <div className="process-row">
      <div className="process-col col-pid">{process.pid}</div>
      <div className="process-col col-name" title={process.name}>
        {process.name}
      </div>
      <div className="process-col col-cpu">
        <ProgressBar value={process.cpu} label={`${process.cpu.toFixed(1)}%`} />
      </div>
      <div className="process-col col-memory">
        <span>{formatBytes(process.memoryBytes)}</span>
      </div>
      <div className="process-col col-action">
        <button
          className="kill-btn"
          onClick={handleKill}
          disabled={isKilling}
          title="结束进程"
        >
          {isKilling ? '...' : '✕'}
        </button>
      </div>
    </div>
  )
}

/**
 * 系统监控视图
 */
export const SystemView: React.FC<SystemViewProps> = ({ isConnected }) => {
  const {
    systemInfo,
    disks,
    processes,
    isLoading,
    error,
    refreshInterval,
    processSortBy,
    processSortOrder,
    processFilter,
    refresh,
    setRefreshInterval,
    setProcessSorting,
    setProcessFilter,
    killProcess,
  } = useSystemMonitor()

  const [activeTab, setActiveTab] = useState<'overview' | 'processes'>('overview')

  /**
   * 处理进程结束
   */
  const handleKillProcess = useCallback(
    async (pid: number) => {
      const success = await killProcess(pid)
      if (!success) {
        alert('结束进程失败，可能没有足够的权限')
      }
    },
    [killProcess]
  )

  if (!isConnected) {
    return (
      <div className="system-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接 Gateway 以使用系统监控</p>
        </div>
      </div>
    )
  }

  return (
    <div className="system-view">
      {/* 工具栏 */}
      <div className="system-toolbar">
        <div className="toolbar-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 概览
          </button>
          <button
            className={`tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => setActiveTab('processes')}
          >
            📋 进程 ({processes.length})
          </button>
        </div>

        <div className="toolbar-controls">
          <select
            className="refresh-select"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
          >
            {REFRESH_INTERVALS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                刷新: {opt.label}
              </option>
            ))}
          </select>

          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={isLoading}
            title="刷新"
          >
            {isLoading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={refresh}>重试</button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="system-content">
        {activeTab === 'overview' ? (
          <div className="overview-grid">
            <SystemInfoCard systemInfo={systemInfo} />
            <DiskInfoCard disks={disks} />
          </div>
        ) : (
          <div className="processes-container">
            {/* 进程搜索 */}
            <div className="process-search">
              <input
                type="text"
                placeholder="搜索进程..."
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
              />
              {processFilter && (
                <button className="clear-btn" onClick={() => setProcessFilter('')}>
                  ✕
                </button>
              )}
            </div>

            {/* 进程列表 */}
            <div className="process-list">
              <ProcessListHeader
                sortBy={processSortBy}
                sortOrder={processSortOrder}
                onSort={setProcessSorting}
              />
              <div className="process-body">
                {processes.length === 0 ? (
                  <div className="empty-state">
                    {isLoading ? '加载中...' : '没有找到进程'}
                  </div>
                ) : (
                  processes.map((process) => (
                    <ProcessListItem
                      key={process.pid}
                      process={process}
                      onKill={handleKillProcess}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 进程统计 */}
            <div className="process-stats">
              <span>共 {processes.length} 个进程</span>
              {processFilter && (
                <span>（已过滤，原始: {processes.length} 个）</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
