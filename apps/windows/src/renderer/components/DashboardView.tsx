/**
 * DashboardView Component - 仪表盘视图
 *
 * 显示用户概览信息：
 * - 已连接设备数和限额
 * - 已安装技能数和加载状态
 * - 今日调用量和限额
 * - 当前订阅计划和到期日
 * - 快捷操作入口
 */

import React from 'react'
import { useDashboard } from '../hooks/useDashboard'
import './DashboardView.css'

/**
 * 视图类型（用于快捷操作跳转）
 */
type ViewType = 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'settings' | 'devices' | 'dashboard'

interface DashboardViewProps {
  /** 用户显示名称 */
  displayName?: string
  /** 是否已连接 Gateway */
  isConnected: boolean
  /** 视图切换回调 */
  onViewChange?: (view: ViewType) => void
}

/**
 * 获取使用量百分比对应的样式等级
 */
function getUsageLevel(current: number, limit: number): string {
  if (limit <= 0) return 'low'
  const percent = (current / limit) * 100
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'medium'
  return 'low'
}

/**
 * 格式化使用量文本
 */
function formatUsage(current: number, limit: number): string {
  if (limit <= 0) return `${current} / 无限制`
  return `${current} / ${limit}`
}

/**
 * 仪表盘视图组件
 */
export const DashboardView: React.FC<DashboardViewProps> = ({
  displayName,
  isConnected,
  onViewChange,
}) => {
  const {
    subscription,
    planName,
    usage,
    deviceCount,
    skillStats,
    daysRemaining,
    isLoading,
    error,
    refresh,
  } = useDashboard()

  /**
   * 处理快捷操作点击
   */
  const handleQuickAction = (view: ViewType) => {
    console.log('[DashboardView] 快捷操作跳转:', view)
    onViewChange?.(view)
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="dashboard-view">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  // 获取使用量数据（有默认值）
  const deviceLimit = usage?.devices?.limit ?? 0
  const dailyCalls = usage?.conversations?.daily ?? 0
  const dailyCallLimit = usage?.conversations?.limit ?? 0

  return (
    <div className="dashboard-view">
      {/* 欢迎区域 + 刷新按钮 */}
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <h2>欢迎回来{displayName ? `，${displayName}` : ''}</h2>
          <p>
            {isConnected ? 'Gateway 已连接，所有功能可用' : 'Gateway 未连接，部分功能不可用'}
          </p>
        </div>
        <button
          className="btn-refresh"
          onClick={refresh}
          disabled={isLoading}
          title="刷新数据"
        >
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">&#9888;</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="stats-grid">
        {/* 设备卡片 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon devices">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 1a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V2a1 1 0 011-1h6zM5 0a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V2a2 2 0 00-2-2H5z"/>
                <path d="M8 14a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
            </div>
            <span className="stat-card-label">已连接设备</span>
          </div>
          <div className="stat-card-value">{deviceCount}</div>
          <div className="stat-card-sub">{formatUsage(deviceCount, deviceLimit)}</div>
          {deviceLimit > 0 && (
            <div className="usage-bar-container">
              <div className="usage-bar">
                <div
                  className={`usage-bar-fill ${getUsageLevel(deviceCount, deviceLimit)}`}
                  style={{ width: `${Math.min(100, (deviceCount / deviceLimit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 技能卡片 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon skills">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 1A1.5 1.5 0 005 2.5V3H1.5A1.5 1.5 0 000 4.5v8A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0014.5 3H11v-.5A1.5 1.5 0 009.5 1h-3zM6 2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V3H6v-.5z" />
              </svg>
            </div>
            <span className="stat-card-label">已安装技能</span>
          </div>
          <div className="stat-card-value">{skillStats.loaded}</div>
          <div className="stat-card-sub">
            共 {skillStats.total} 个技能
            {skillStats.errors > 0 && (
              <span className="error-count">({skillStats.errors} 个错误)</span>
            )}
          </div>
        </div>

        {/* 今日调用 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon calls">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H4.5a.5.5 0 010-1h3V3.5A.5.5 0 018 3z" />
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
              </svg>
            </div>
            <span className="stat-card-label">今日调用</span>
          </div>
          <div className="stat-card-value">{dailyCalls}</div>
          <div className="stat-card-sub">{formatUsage(dailyCalls, dailyCallLimit)}</div>
          {dailyCallLimit > 0 && (
            <div className="usage-bar-container">
              <div className="usage-bar">
                <div
                  className={`usage-bar-fill ${getUsageLevel(dailyCalls, dailyCallLimit)}`}
                  style={{ width: `${Math.min(100, (dailyCalls / dailyCallLimit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 当前订阅 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon plan">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9H5.5z"/>
                <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
              </svg>
            </div>
            <span className="stat-card-label">当前订阅</span>
          </div>
          <div className="stat-card-value">{planName}</div>
          <div className="stat-card-sub">
            {subscription
              ? `${daysRemaining > 0 ? `剩余 ${daysRemaining} 天` : '已到期'}`
              : '未订阅'}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="quick-actions">
        <h3>快捷操作</h3>
        <div className="quick-actions-grid">
          <button
            className="quick-action-card"
            onClick={() => handleQuickAction('devices')}
          >
            <div className="quick-action-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 1a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V2a1 1 0 011-1h6zM5 0a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V2a2 2 0 00-2-2H5z"/>
                <path d="M8 14a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
            </div>
            <div className="quick-action-title">管理设备</div>
            <div className="quick-action-desc">查看和配对你的设备</div>
          </button>

          <button
            className="quick-action-card"
            onClick={() => handleQuickAction('skills')}
          >
            <div className="quick-action-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 1A1.5 1.5 0 005 2.5V3H1.5A1.5 1.5 0 000 4.5v8A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0014.5 3H11v-.5A1.5 1.5 0 009.5 1h-3zM6 2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V3H6v-.5z" />
              </svg>
            </div>
            <div className="quick-action-title">浏览技能商店</div>
            <div className="quick-action-desc">发现和安装新技能</div>
          </button>

          <button
            className="quick-action-card"
            onClick={() => handleQuickAction('subscription')}
          >
            <div className="quick-action-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9H5.5z"/>
                <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
              </svg>
            </div>
            <div className="quick-action-title">管理订阅</div>
            <div className="quick-action-desc">查看和升级你的计划</div>
          </button>
        </div>
      </div>
    </div>
  )
}
