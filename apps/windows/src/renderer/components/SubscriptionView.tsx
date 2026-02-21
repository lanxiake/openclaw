/**
 * SubscriptionView Component - 订阅管理视图
 *
 * 显示订阅计划、当前订阅状态和使用量统计
 *
 * @author OpenClaw
 */

import React, { useState, useEffect } from 'react'
import { useSubscription, type SubscriptionPlan, type BillingPeriod } from '../hooks/useSubscription'
import './SubscriptionView.css'

interface SubscriptionViewProps {
  /** Gateway 连接状态（保留兼容但订阅页面不再依赖此状态） */
  isConnected?: boolean
}

/**
 * 订阅管理视图组件
 */
export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ isConnected }) => {
  const {
    plans,
    subscription,
    overview,
    isLoading,
    error,
    fetchPlans,
    createSubscription,
    cancelSubscription,
    formatPrice,
    canUpgradeTo,
    refresh,
  } = useSubscription()

  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('monthly')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  /**
   * 初始化加载（不依赖 Gateway 连接，通过 REST API 获取数据）
   */
  useEffect(() => {
    refresh()
  }, [refresh])

  /**
   * 处理订阅
   */
  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (plan.id === 'enterprise') {
      // 企业版联系销售
      window.open('mailto:sales@openclaw.ai?subject=企业版咨询', '_blank')
      return
    }

    try {
      await createSubscription(plan.id, selectedPeriod)
    } catch (err) {
      console.error('订阅失败:', err)
    }
  }

  /**
   * 处理取消订阅
   */
  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription(false, cancelReason)
      setShowCancelDialog(false)
      setCancelReason('')
    } catch (err) {
      console.error('取消订阅失败:', err)
    }
  }

  /**
   * 渲染计划卡片
   */
  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isCurrentPlan = subscription?.planId === plan.id || (!subscription && plan.id === 'free')
    const canUpgrade = canUpgradeTo(plan.id)
    const price = formatPrice(plan.id, selectedPeriod)

    return (
      <div
        key={plan.id}
        className={`plan-card ${plan.recommended ? 'recommended' : ''} ${isCurrentPlan ? 'current' : ''}`}
      >
        {plan.recommended && <div className="recommended-badge">推荐</div>}
        {isCurrentPlan && <div className="current-badge">当前计划</div>}

        <div className="plan-header">
          <h3 className="plan-name">{plan.name}</h3>
          <p className="plan-description">{plan.description}</p>
        </div>

        <div className="plan-price">
          <span className="price-amount">{price}</span>
          {plan.price.monthly > 0 && selectedPeriod === 'yearly' && (
            <span className="price-savings">省 2 个月</span>
          )}
        </div>

        <ul className="plan-features">
          {plan.features.map((feature) => (
            <li key={feature.id} className={feature.included ? 'included' : 'excluded'}>
              <span className="feature-icon">{feature.included ? '✓' : '×'}</span>
              <span className="feature-name">{feature.name}</span>
              {feature.limit && <span className="feature-limit">{feature.limit}</span>}
            </li>
          ))}
        </ul>

        <div className="plan-action">
          {isCurrentPlan ? (
            <button className="btn-current" disabled>
              当前计划
            </button>
          ) : canUpgrade ? (
            <button
              className="btn-upgrade"
              onClick={() => handleSubscribe(plan)}
              disabled={isLoading}
            >
              {plan.id === 'enterprise' ? '联系销售' : '升级'}
            </button>
          ) : (
            <button className="btn-downgrade" disabled>
              降级
            </button>
          )}
        </div>
      </div>
    )
  }

  /**
   * 获取使用量级别（用于颜色编码）
   */
  const getUsageLevel = (percent: number): string => {
    if (percent >= 80) return 'critical'
    if (percent >= 60) return 'warning'
    return 'normal'
  }

  /**
   * 渲染单个使用量条目
   */
  const renderUsageItem = (
    label: string,
    item: { used: number; limit: number; percent: number; unit?: string } | undefined | null,
    unit?: string
  ) => {
    if (!item) return null
    const level = getUsageLevel(item.percent)
    const displayUnit = unit || (item as { unit?: string }).unit || ''
    const limitText = item.limit === -1 ? '∞' : `${item.limit}${displayUnit}`
    const usedText = `${item.used}${displayUnit}`

    return (
      <div className="usage-item" key={label}>
        <div className="usage-header">
          <span className="usage-label">{label}</span>
          <span className="usage-text">
            {usedText} / {limitText}
          </span>
        </div>
        <div className="usage-bar">
          <div
            className={`usage-fill usage-${level}`}
            style={{ width: `${Math.min(item.percent, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  /**
   * 渲染使用量统计
   */
  const renderUsageStats = () => {
    if (!overview) return null

    const { usage } = overview

    return (
      <div className="usage-stats">
        <h3>使用量统计</h3>
        <div className="usage-items">
          {renderUsageItem('今日对话', usage.conversations)}
          {renderUsageItem('本月 AI 调用', usage.aiCalls)}
          {usage.devices && renderUsageItem('已连接设备', usage.devices)}
          {usage.skills && renderUsageItem('已安装技能', usage.skills)}
          {usage.storage && renderUsageItem('存储空间', usage.storage, 'MB')}
        </div>
      </div>
    )
  }

  /**
   * 渲染当前订阅信息
   */
  const renderCurrentSubscription = () => {
    if (!overview) return null

    const { subscription: sub, plan, features } = overview

    return (
      <div className="current-subscription">
        <div className="subscription-header">
          <h3>当前订阅</h3>
          {sub && !sub.cancelAtPeriodEnd && (
            <button
              className="btn-cancel"
              onClick={() => setShowCancelDialog(true)}
            >
              取消订阅
            </button>
          )}
        </div>

        <div className="subscription-info">
          <div className="info-row">
            <span className="info-label">计划</span>
            <span className="info-value">{plan.name}</span>
          </div>

          {sub && (
            <>
              <div className="info-row">
                <span className="info-label">状态</span>
                <span className={`info-value status-${sub.status}`}>
                  {sub.status === 'active' && '活跃'}
                  {sub.status === 'trialing' && '试用中'}
                  {sub.status === 'canceled' && '已取消'}
                  {sub.status === 'expired' && '已过期'}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">到期时间</span>
                <span className="info-value">
                  {new Date(sub.currentPeriodEnd).toLocaleDateString('zh-CN')}
                </span>
              </div>

              {sub.cancelAtPeriodEnd && (
                <div className="info-row warning">
                  <span className="info-label">注意</span>
                  <span className="info-value">订阅将在周期结束后取消</span>
                </div>
              )}
            </>
          )}
        </div>

        {features && (
          <div className="subscription-features">
            <h4>已启用功能</h4>
            <div className="feature-tags">
              {features.premiumSkills && <span className="feature-tag">高级技能</span>}
              {features.prioritySupport && <span className="feature-tag">优先支持</span>}
              {features.apiAccess && <span className="feature-tag">API 访问</span>}
              {!features.premiumSkills && !features.prioritySupport && !features.apiAccess && (
                <span className="feature-tag basic">基础功能</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /**
   * 渲染取消订阅对话框
   */
  const renderCancelDialog = () => {
    if (!showCancelDialog) return null

    return (
      <div className="dialog-overlay">
        <div className="dialog cancel-dialog">
          <h3>取消订阅</h3>
          <p>确定要取消订阅吗？订阅将在当前周期结束后失效。</p>

          <div className="form-group">
            <label>取消原因（可选）</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="请告诉我们您取消的原因，帮助我们改进服务..."
              rows={3}
            />
          </div>

          <div className="dialog-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowCancelDialog(false)}
            >
              保留订阅
            </button>
            <button
              className="btn-danger"
              onClick={handleCancelSubscription}
              disabled={isLoading}
            >
              确认取消
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="subscription-view">
      {/* 页面标题 */}
      <div className="view-header">
        <h2>订阅管理</h2>
        <button className="btn-refresh" onClick={refresh} disabled={isLoading}>
          {isLoading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* 当前订阅和使用量 */}
      <div className="subscription-overview">
        {renderCurrentSubscription()}
        {renderUsageStats()}
      </div>

      {/* 计费周期切换 */}
      <div className="billing-toggle">
        <button
          className={selectedPeriod === 'monthly' ? 'active' : ''}
          onClick={() => setSelectedPeriod('monthly')}
        >
          月付
        </button>
        <button
          className={selectedPeriod === 'yearly' ? 'active' : ''}
          onClick={() => setSelectedPeriod('yearly')}
        >
          年付 <span className="discount">省 17%</span>
        </button>
      </div>

      {/* 计划列表 */}
      <div className="plans-grid">
        {plans.map(renderPlanCard)}
      </div>

      {/* 取消订阅对话框 */}
      {renderCancelDialog()}
    </div>
  )
}
