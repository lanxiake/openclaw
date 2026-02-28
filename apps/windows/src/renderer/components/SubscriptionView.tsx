/**
 * SubscriptionView Component - 订阅管理视图
 *
 * 布局：
 * 1. 账户状态区 — 显示当前身份（免费用户 / 月费会员 / 年费会员）
 * 2. 积分概览卡片 — 可用积分、累计获得、累计消费、已过期
 * 3. 计费周期切换 — 月付 / 年付 toggle
 * 4. 计划选择区 — 根据周期显示对应 pro 计划
 * 5. 积分包购买区域 — 预设积分包选项
 * 6. 快速入口 — "查看积分明细" 按钮跳转到 CreditsView
 */

import React, { useState } from 'react'
import { useSubscription, type SubscriptionPlan, type BillingPeriod } from '../hooks/useSubscription'
import './SubscriptionView.css'

/** 积分包选项定义 */
interface CreditPackage {
  /** 积分数量 */
  credits: number
  /** 价格（分） */
  priceCents: number
  /** 描述 */
  label: string
  /** 是否推荐 */
  recommended?: boolean
}

/** 预设积分包列表 */
const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 600, priceCents: 1000, label: '600 积分' },
  { credits: 1200, priceCents: 2000, label: '1200 积分', recommended: true },
  { credits: 3200, priceCents: 5000, label: '3200 积分' },
]

/** 本地计划展示配置（当服务端未返回详细计划时使用） */
interface LocalPlanDisplay {
  /** 计划标识 */
  id: string
  /** 计划名称 */
  name: string
  /** 价格描述 */
  priceLabel: string
  /** 计费周期 */
  billingCycle: BillingPeriod
  /** 积分额度 */
  creditsLabel: string
  /** 额外描述 */
  badge?: string
  /** 功能列表 */
  features: string[]
}

/** 月付和年付计划的展示配置 */
const LOCAL_PLANS: Record<BillingPeriod, LocalPlanDisplay[]> = {
  monthly: [
    {
      id: 'pro-monthly',
      name: 'Pro 月付',
      priceLabel: '¥30/月',
      billingCycle: 'monthly',
      creditsLabel: '每月 2,000 积分',
      badge: '首月 ¥5',
      features: [
        '每月 2,000 AI 积分',
        '支持 GPT-4、Claude 等主流模型',
        '多设备同时在线',
        '历史记录云同步',
        '优先客服支持',
      ],
    },
  ],
  yearly: [
    {
      id: 'pro-yearly',
      name: 'Pro 年付',
      priceLabel: '¥300/年',
      billingCycle: 'yearly',
      creditsLabel: '每月 2,000 积分',
      badge: '省 ¥60',
      features: [
        '每月 2,000 AI 积分（年度总计 24,000）',
        '支持 GPT-4、Claude 等主流模型',
        '多设备同时在线',
        '历史记录云同步',
        '优先客服支持',
        '年付专属折扣',
      ],
    },
  ],
}

interface SubscriptionViewProps {
  /** Gateway 连接状态（保留接口兼容） */
  isConnected?: boolean
  /** 视图切换回调，用于跳转到积分明细页 */
  onViewChange?: (view: string) => void
}

/**
 * 订阅管理视图组件
 */
export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ onViewChange }) => {
  const {
    plans,
    subscription,
    creditBalance,
    isLoading,
    error,
    selectedPeriod,
    createSubscription,
    formatPrice,
    refresh,
    setSelectedPeriod,
  } = useSubscription()

  const [purchasingPackage, setPurchasingPackage] = useState<number | null>(null)

  /**
   * 获取付费计划（过滤掉 free 和 enterprise），按当前选中周期过滤
   */
  const filteredPlans = plans.filter(
    (p) => p.price > 0 && p.price !== -1 && p.billingCycle === selectedPeriod
  )

  /**
   * 获取账户状态文字
   */
  const getAccountStatusLabel = (): string => {
    if (!subscription || subscription.status === 'expired' || subscription.status === 'canceled') {
      return '免费用户'
    }
    const matchedPlan = plans.find((p) => p.id === subscription.planId)
    if (matchedPlan?.billingCycle === 'yearly') return '年费会员'
    if (matchedPlan?.billingCycle === 'monthly') return '月费会员'
    return '付费会员'
  }

  /**
   * 判断当前计划是否为该 plan
   */
  const isCurrentPlan = (plan: SubscriptionPlan): boolean => {
    return subscription?.planId === plan.id && subscription?.status === 'active'
  }

  /**
   * 处理订阅
   */
  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      await createSubscription(plan.id, plan.billingCycle as BillingPeriod)
    } catch (err) {
      // 错误已在 hook 中处理
    }
  }

  /**
   * 处理积分包购买
   */
  const handlePurchaseCredits = async (pkg: CreditPackage) => {
    setPurchasingPackage(pkg.credits)
    try {
      await window.electronAPI.api.purchaseSubscription({
        type: 'topup',
        planId: `credits-${pkg.credits}`,
        provider: 'mock',
      })
      // 购买成功后刷新数据
      await refresh()
    } catch (err) {
      // 错误处理：静默
    } finally {
      setPurchasingPackage(null)
    }
  }

  /**
   * 渲染账户状态区
   */
  const renderAccountStatus = () => {
    const statusLabel = getAccountStatusLabel()
    const isActive = subscription?.status === 'active'

    return (
      <div className="account-status-card">
        <div className="account-status-header">
          <h3>账户状态</h3>
        </div>
        <div className="account-status-body">
          <span className={`status-badge ${isActive ? 'active' : 'free'}`}>
            {statusLabel}
          </span>
          {subscription?.currentPeriodEnd && isActive && (
            <span className="period-info">
              到期: {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
            </span>
          )}
          {subscription?.cancelAtPeriodEnd && (
            <span className="cancel-warning">
              订阅将在周期结束后取消
            </span>
          )}
        </div>
      </div>
    )
  }

  /**
   * 渲染积分概览卡片
   */
  const renderCreditOverview = () => {
    const balance = creditBalance ?? {
      totalBalance: 0,
      totalEarned: 0,
      totalConsumed: 0,
      totalExpired: 0,
    }

    return (
      <div className="credit-overview-section">
        <div className="section-header">
          <h3>积分概览</h3>
          {onViewChange && (
            <button
              className="btn-link"
              onClick={() => onViewChange('credits')}
            >
              查看积分明细
            </button>
          )}
        </div>
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
      </div>
    )
  }

  /**
   * 渲染计费周期切换
   */
  const renderPeriodToggle = () => {
    return (
      <div className="period-toggle-wrapper">
        <div className="period-toggle">
          <button
            className={`period-btn ${selectedPeriod === 'monthly' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('monthly')}
          >
            月付
          </button>
          <button
            className={`period-btn ${selectedPeriod === 'yearly' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('yearly')}
          >
            年付
            <span className="save-tag">省 2 个月</span>
          </button>
        </div>
      </div>
    )
  }

  /**
   * 渲染计划卡片（服务端数据）
   */
  const renderPlanCard = (plan: SubscriptionPlan) => {
    const current = isCurrentPlan(plan)
    const price = formatPrice(plan)
    const periodLabel = plan.billingCycle === 'yearly' ? '年付' : '月付'

    return (
      <div
        key={plan.id}
        className={`plan-card ${current ? 'current' : ''}`}
      >
        {current && <div className="current-badge">当前计划</div>}

        <div className="plan-header">
          <h3 className="plan-name">{plan.displayName || plan.name}</h3>
          {plan.description && (
            <p className="plan-description">{plan.description}</p>
          )}
        </div>

        <div className="plan-price">
          <span className="price-amount">{price}</span>
          <span className="price-period">{periodLabel}</span>
        </div>

        <div className="plan-action">
          {current ? (
            <button className="btn-current" disabled>
              当前计划
            </button>
          ) : (
            <button
              className="btn-upgrade"
              onClick={() => handleSubscribe(plan)}
              disabled={isLoading}
            >
              {isLoading ? '处理中...' : '订阅'}
            </button>
          )}
        </div>
      </div>
    )
  }

  /**
   * 渲染本地计划卡片（无服务端数据时使用）
   */
  const renderLocalPlanCard = (plan: LocalPlanDisplay) => {
    const isActive = subscription?.status === 'active'
    const isCurrent = subscription?.planId === plan.id && isActive

    return (
      <div
        key={plan.id}
        className={`plan-card local-plan ${isCurrent ? 'current' : ''}`}
      >
        {isCurrent && <div className="current-badge">当前计划</div>}
        {plan.badge && !isCurrent && <div className="promo-badge">{plan.badge}</div>}

        <div className="plan-header">
          <h3 className="plan-name">{plan.name}</h3>
          <p className="plan-credits-label">{plan.creditsLabel}</p>
        </div>

        <div className="plan-price">
          <span className="price-amount">{plan.priceLabel}</span>
        </div>

        <ul className="plan-features">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="plan-feature-item">{feature}</li>
          ))}
        </ul>

        <div className="plan-action">
          {isCurrent ? (
            <button className="btn-current" disabled>
              当前计划
            </button>
          ) : (
            <button
              className="btn-upgrade"
              onClick={() => handleSubscribe({ id: plan.id, billingCycle: plan.billingCycle } as SubscriptionPlan)}
              disabled={isLoading}
            >
              {isLoading ? '处理中...' : '立即订阅'}
            </button>
          )}
        </div>
      </div>
    )
  }

  /**
   * 渲染积分包购买区域
   */
  const renderCreditPackages = () => {
    return (
      <div className="credit-packages-section">
        <h3>购买积分包</h3>
        <p className="section-desc">积分可用于 AI 模型调用，购买后立即到账</p>
        <div className="credit-packages-grid">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.credits}
              className={`credit-package-card ${pkg.recommended ? 'recommended' : ''}`}
            >
              {pkg.recommended && <div className="recommended-badge">推荐</div>}
              <div className="package-credits">{pkg.credits.toLocaleString()}</div>
              <div className="package-label">积分</div>
              <div className="package-price">
                ¥{(pkg.priceCents / 100).toFixed(0)}
              </div>
              <div className="package-unit-price">
                ¥{(pkg.priceCents / pkg.credits / 100).toFixed(2)}/积分
              </div>
              <button
                className="btn-buy-package"
                onClick={() => handlePurchaseCredits(pkg)}
                disabled={purchasingPackage !== null}
              >
                {purchasingPackage === pkg.credits ? '购买中...' : '购买'}
              </button>
            </div>
          ))}
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
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* 账户状态 */}
      {renderAccountStatus()}

      {/* 积分概览 */}
      {renderCreditOverview()}

      {/* 计费周期切换 */}
      {renderPeriodToggle()}

      {/* 计划选择区 */}
      <div className="plans-section">
        <h3>升级计划</h3>
        <div className="plans-grid">
          {filteredPlans.length > 0
            ? filteredPlans.map(renderPlanCard)
            : LOCAL_PLANS[selectedPeriod].map(renderLocalPlanCard)
          }
        </div>
      </div>

      {/* 积分包购买 */}
      {renderCreditPackages()}
    </div>
  )
}
