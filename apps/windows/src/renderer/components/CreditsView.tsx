/**
 * CreditsView Component - 积分管理视图
 *
 * 显示用户的积分余额、有效批次（含过期时间）和流水记录
 */

import React, { useState } from 'react'
import { useCredits, type CreditTransaction, type CreditBatch } from '../hooks/useCredits'
import './CreditsView.css'

/**
 * 流水类型的中文映射
 */
function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    earn: '获得',
    consume: '消费',
    expire: '过期',
    refund: '退款',
    admin_adjust: '管理员调整',
  }
  return labels[type] ?? type
}

/**
 * 流水来源的中文映射
 */
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    register: '注册赠送',
    invite: '邀请奖励',
    subscription: '订阅发放',
    purchase: '购买',
    model_call: '模型调用',
    admin_grant: '管理员发放',
    expiry_cleanup: '过期清理',
    refund: '退款',
  }
  return labels[source] ?? source
}

/**
 * 批次来源的中文映射
 */
function getBatchSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    register: '注册赠送',
    invite: '邀请奖励',
    subscription: '订阅发放',
    purchase: '购买',
    admin_grant: '管理员发放',
  }
  return labels[source] ?? source
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 计算距过期还剩多少天
 */
function getDaysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * 获取过期时间的样式类名
 */
function getExpiryClassName(expiresAt: string): string {
  const days = getDaysUntilExpiry(expiresAt)
  if (days <= 0) return 'expired'
  if (days <= 7) return 'expiring-soon'
  if (days <= 30) return 'expiring-warning'
  return 'expiring-normal'
}

/**
 * 积分管理视图组件
 */
export const CreditsView: React.FC = () => {
  const {
    balance,
    transactions,
    batches,
    inviteStats,
    isLoading,
    error,
    refresh,
    loadMoreTransactions,
    hasMoreTransactions,
  } = useCredits()

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  /**
   * 渲染余额统计卡片
   */
  const renderBalanceCards = () => {
    if (!balance) {
      return (
        <div className="credits-empty">
          <p>暂无积分信息</p>
        </div>
      )
    }

    return (
      <div className="balance-cards">
        <div className="balance-card primary">
          <div className="balance-label">可用积分</div>
          <div className="balance-value">{balance.totalBalance.toLocaleString()}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">累计获得</div>
          <div className="balance-value earned">{balance.totalEarned.toLocaleString()}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">累计消费</div>
          <div className="balance-value consumed">{balance.totalConsumed.toLocaleString()}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">已过期</div>
          <div className="balance-value expired">{balance.totalExpired.toLocaleString()}</div>
        </div>
      </div>
    )
  }

  /**
   * 复制邀请信息到剪贴板
   */
  const handleCopyInvite = async () => {
    const userId = balance?.userId || '你的用户 ID'
    const inviteText = `我正在使用 OpenClaw AI 助手，推荐你也试试！注册时填写我的邀请码 ${userId}，我们都能获得积分奖励。`

    try {
      await window.electronAPI.clipboard.writeText(inviteText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('[CreditsView] 复制邀请信息失败:', err)
    }
  }

  /**
   * 渲染邀请统计区域
   */
  const renderInviteSection = () => {
    const stats = inviteStats ?? { count: 0, totalCredits: 0, maxCredits: 2000 }
    const progressPercent = stats.maxCredits > 0
      ? Math.min(100, (stats.totalCredits / stats.maxCredits) * 100)
      : 0

    return (
      <div className="credits-section invite-section">
        <div className="invite-header">
          <h3>邀请好友</h3>
          <button
            className="btn-invite"
            onClick={() => setShowInviteDialog(true)}
          >
            邀请好友
          </button>
        </div>

        <div className="invite-stats-row">
          <div className="invite-stat">
            <span className="invite-stat-value">{stats.count}</span>
            <span className="invite-stat-label">已邀请</span>
          </div>
          <div className="invite-stat">
            <span className="invite-stat-value">{stats.totalCredits.toLocaleString()}</span>
            <span className="invite-stat-label">已获积分</span>
          </div>
          <div className="invite-stat">
            <span className="invite-stat-value">{stats.maxCredits.toLocaleString()}</span>
            <span className="invite-stat-label">积分上限</span>
          </div>
        </div>

        <div className="invite-progress">
          <div className="invite-progress-bar">
            <div
              className="invite-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="invite-progress-text">
            {stats.totalCredits.toLocaleString()} / {stats.maxCredits.toLocaleString()} 积分
          </div>
        </div>
      </div>
    )
  }

  /**
   * 渲染邀请对话框
   */
  const renderInviteDialog = () => {
    if (!showInviteDialog) return null

    const userId = balance?.userId || ''

    return (
      <div className="dialog-overlay" onClick={() => setShowInviteDialog(false)}>
        <div className="dialog invite-dialog" onClick={(e) => e.stopPropagation()}>
          <h3>邀请好友获积分</h3>
          <p>分享以下信息给好友，好友注册成功后你们都能获得积分奖励。</p>

          {userId && (
            <div className="invite-code-box">
              <label>你的邀请码</label>
              <div className="invite-code">{userId}</div>
            </div>
          )}

          <div className="dialog-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowInviteDialog(false)}
            >
              关闭
            </button>
            <button
              className="btn-primary"
              onClick={handleCopyInvite}
            >
              {copySuccess ? '已复制' : '复制邀请信息'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 渲染有效批次（积分有效期）
   */
  const renderBatches = () => {
    // 只显示还有余额的批次
    const activeBatches = batches.filter(b => b.remainingAmount > 0)

    if (activeBatches.length === 0) {
      return null
    }

    return (
      <div className="credits-section">
        <h3>积分有效期</h3>
        <div className="batches-list">
          {activeBatches.map((batch: CreditBatch) => {
            const daysLeft = getDaysUntilExpiry(batch.expiresAt)
            const expiryClass = getExpiryClassName(batch.expiresAt)

            return (
              <div key={batch.id} className={`batch-item ${expiryClass}`}>
                <div className="batch-info">
                  <span className="batch-source">{getBatchSourceLabel(batch.source)}</span>
                  <span className="batch-amount">{batch.remainingAmount.toLocaleString()} 积分</span>
                </div>
                <div className="batch-expiry">
                  {daysLeft <= 0 ? (
                    <span className="expiry-text expired">已过期</span>
                  ) : (
                    <span className={`expiry-text ${expiryClass}`}>
                      {formatDate(batch.expiresAt)} 到期（剩 {daysLeft} 天）
                    </span>
                  )}
                </div>
                {batch.description && (
                  <div className="batch-desc">{batch.description}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /**
   * 渲染流水记录
   */
  const renderTransactions = () => {
    if (!transactions || transactions.length === 0) {
      return (
        <div className="credits-section">
          <h3>积分流水</h3>
          <div className="credits-empty">
            <p>暂无流水记录</p>
          </div>
        </div>
      )
    }

    return (
      <div className="credits-section">
        <h3>积分流水</h3>
        <div className="transactions-list">
          <div className="transaction-header">
            <span className="col-time">时间</span>
            <span className="col-type">类型</span>
            <span className="col-source">来源</span>
            <span className="col-amount">变动</span>
            <span className="col-balance">余额</span>
            <span className="col-desc">描述</span>
          </div>
          {transactions.map((tx: CreditTransaction) => (
            <div key={tx.id} className="transaction-row">
              <span className="col-time">{formatDateTime(tx.createdAt)}</span>
              <span className={`col-type type-${tx.type}`}>
                {getTransactionTypeLabel(tx.type)}
              </span>
              <span className="col-source">{getSourceLabel(tx.source)}</span>
              <span className={`col-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
              </span>
              <span className="col-balance">{tx.balanceAfter.toLocaleString()}</span>
              <span className="col-desc" title={tx.description || ''}>
                {tx.description || '-'}
              </span>
            </div>
          ))}
        </div>

        {hasMoreTransactions && (
          <div className="load-more">
            <button className="btn-load-more" onClick={loadMoreTransactions}>
              加载更多
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="credits-view">
      {/* 页面标题 */}
      <div className="view-header">
        <h2>积分管理</h2>
        <button className="btn-refresh" onClick={refresh} disabled={isLoading}>
          {isLoading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* 余额统计 */}
      {renderBalanceCards()}

      {/* 邀请好友 */}
      {renderInviteSection()}

      {/* 积分有效期 */}
      {renderBatches()}

      {/* 流水记录 */}
      {renderTransactions()}

      {/* 邀请对话框 */}
      {renderInviteDialog()}
    </div>
  )
}
