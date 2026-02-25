/**
 * PaymentView - 支付页面组件
 *
 * 提供订阅购买和订单管理功能
 */

import React, { useState, useEffect } from 'react'
import {
  usePayment,
  formatAmount,
  getOrderStatusText,
  getProviderText,
  getOrderStatusColor,
  type PaymentProvider,
  type OrderStatus,
  type PaymentOrder,
} from '../hooks/usePayment'
import './PaymentView.css'

interface PaymentViewProps {
  userId: string
  /** 初始显示的计划 ID */
  initialPlanId?: string
  /** 关闭回调 */
  onClose?: () => void
}

/**
 * 订阅计划定义
 *
 * 积分制体系：免费版/月付版/年付版
 * 所有用户共享统一资源限制（5设备、100技能、50MB文件）
 */
const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: '月付版',
    description: '每月2000积分，首月仅3元',
    monthlyPrice: 3000,
    yearlyPrice: 0,
    features: ['每月 2000 积分', '首月仅 3 元', '5 台设备', '100 个技能', '积分包购买'],
    popular: true,
    firstMonthPrice: 300,
  },
  {
    id: 'yearly',
    name: '年付版',
    description: '每月2000积分，年付更划算',
    monthlyPrice: 0,
    yearlyPrice: 30000,
    features: ['每月 2000 积分', '等效 25 元/月', '5 台设备', '100 个技能', '积分包购买', '优先支持'],
  },
]

export const PaymentView: React.FC<PaymentViewProps> = ({ userId, initialPlanId, onClose }) => {
  // 状态
  const [activeTab, setActiveTab] = useState<'plans' | 'orders'>('plans')
  const [selectedPlan, setSelectedPlan] = useState(initialPlanId || 'monthly')
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('mock')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Hook
  const {
    orders,
    totalOrders,
    priceInfo,
    paymentResult,
    providers,
    isLoading,
    error,
    loadOrders,
    calculatePrice,
    purchaseSubscription,
    queryPaymentStatus,
    mockPaymentComplete,
    cancelOrder,
    clearError,
    clearPaymentResult,
  } = usePayment(userId)

  // 加载订单列表
  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders()
    }
  }, [activeTab, loadOrders])

  // 计算价格
  useEffect(() => {
    calculatePrice({
      type: 'subscription',
      itemId: selectedPlan,
      billingPeriod,
    })
  }, [selectedPlan, billingPeriod, calculatePrice])

  // 设置默认支付方式
  useEffect(() => {
    if (providers.length > 0 && !providers.includes(selectedProvider)) {
      setSelectedProvider(providers[0])
    }
  }, [providers, selectedProvider])

  /**
   * 处理购买
   */
  const handlePurchase = async () => {
    const result = await purchaseSubscription({
      planId: selectedPlan,
      billingPeriod,
      provider: selectedProvider,
    })

    if (result) {
      setShowPaymentModal(true)
    }
  }

  /**
   * 处理模拟支付完成
   */
  const handleMockPayComplete = async () => {
    if (paymentResult?.payParams?.orderId) {
      const orderId = paymentResult.payParams.orderId as string
      await mockPaymentComplete(orderId, true)
      setShowPaymentModal(false)
      clearPaymentResult()
      // 切换到订单标签
      setActiveTab('orders')
      loadOrders()
    }
  }

  /**
   * 渲染计划选择
   */
  const renderPlans = () => (
    <div className="payment-plans">
      {/* 计划卡片 */}
      <div className="plans-grid">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const displayPrice = plan.id === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
          const periodLabel = plan.id === 'monthly' ? '月' : '年'
          const isFirstMonth = plan.id === 'monthly' && plan.firstMonthPrice
          return (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
              onClick={() => {
                setSelectedPlan(plan.id)
                setBillingPeriod(plan.id === 'yearly' ? 'yearly' : 'monthly')
              }}
            >
              {plan.popular && <div className="popular-badge">推荐</div>}
              <h3>{plan.name}</h3>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">
                <span className="price">{formatAmount(displayPrice)}</span>
                <span className="period">/{periodLabel}</span>
              </div>
              {isFirstMonth && (
                <div className="monthly-equivalent">
                  首月仅 {formatAmount(plan.firstMonthPrice!)}
                </div>
              )}
              {plan.id === 'yearly' && (
                <div className="monthly-equivalent">
                  相当于 {formatAmount(Math.round(plan.yearlyPrice / 12))}/月
                </div>
              )}
              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index}>
                    <span className="check-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`select-plan-btn ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedPlan(plan.id)
                  setBillingPeriod(plan.id === 'yearly' ? 'yearly' : 'monthly')
                }}
              >
                {selectedPlan === plan.id ? '已选择' : '选择'}
              </button>
            </div>
          )
        })}
      </div>

      {/* 支付方式选择 */}
      <div className="payment-method-section">
        <h4>选择支付方式</h4>
        <div className="payment-methods">
          {providers.map((provider) => (
            <button
              key={provider}
              className={`payment-method ${selectedProvider === provider ? 'selected' : ''}`}
              onClick={() => setSelectedProvider(provider)}
            >
              <span className="provider-icon">{getProviderIcon(provider)}</span>
              <span>{getProviderText(provider)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 价格汇总 */}
      {priceInfo && (
        <div className="price-summary">
          <div className="price-row">
            <span>原价</span>
            <span>{formatAmount(priceInfo.originalPrice)}</span>
          </div>
          {priceInfo.discountAmount > 0 && (
            <div className="price-row discount">
              <span>{priceInfo.discountDescription || '优惠'}</span>
              <span>-{formatAmount(priceInfo.discountAmount)}</span>
            </div>
          )}
          <div className="price-row total">
            <span>应付金额</span>
            <span className="final-price">{formatAmount(priceInfo.finalPrice)}</span>
          </div>
        </div>
      )}

      {/* 购买按钮 */}
      <button className="purchase-btn" onClick={handlePurchase} disabled={isLoading}>
        {isLoading ? '处理中...' : `立即购买 ${priceInfo ? formatAmount(priceInfo.finalPrice) : ''}`}
      </button>
    </div>
  )

  /**
   * 渲染订单列表
   */
  const renderOrders = () => (
    <div className="payment-orders">
      {orders.length === 0 ? (
        <div className="empty-orders">
          <p>暂无订单记录</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">订单号: {order.id}</span>
                <span
                  className="order-status"
                  style={{ backgroundColor: getOrderStatusColor(order.status) }}
                >
                  {getOrderStatusText(order.status)}
                </span>
              </div>
              <div className="order-body">
                <div className="order-info">
                  <p className="order-description">{order.description}</p>
                  <p className="order-time">
                    创建时间: {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {order.paidAt && (
                    <p className="order-time">支付时间: {new Date(order.paidAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="order-amount">{formatAmount(order.amount, order.currency)}</div>
              </div>
              {order.status === 'pending' && (
                <div className="order-actions">
                  <button className="pay-btn" onClick={() => handleContinuePayment(order)}>
                    继续支付
                  </button>
                  <button className="cancel-btn" onClick={() => handleCancelOrder(order.id)}>
                    取消订单
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalOrders > orders.length && (
        <button className="load-more-btn" onClick={() => loadOrders({ page: 2 })}>
          加载更多
        </button>
      )}
    </div>
  )

  /**
   * 继续支付
   */
  const handleContinuePayment = async (order: PaymentOrder) => {
    // TODO: 重新发起支付
    console.log('继续支付订单:', order.id)
  }

  /**
   * 取消订单
   */
  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm('确定要取消此订单吗？')) {
      await cancelOrder(orderId)
    }
  }

  /**
   * 渲染支付模态框
   */
  const renderPaymentModal = () => {
    if (!showPaymentModal || !paymentResult) return null

    return (
      <div className="payment-modal-overlay" onClick={() => setShowPaymentModal(false)}>
        <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-modal" onClick={() => setShowPaymentModal(false)}>
            ×
          </button>

          <h3>完成支付</h3>

          {paymentResult.qrCode && (
            <div className="qr-code-section">
              <p>请使用 {getProviderText(selectedProvider)} 扫描二维码支付</p>
              <div className="qr-code-placeholder">
                <div className="mock-qr">模拟二维码</div>
                <p className="qr-hint">{paymentResult.qrCode}</p>
              </div>
            </div>
          )}

          {selectedProvider === 'mock' && (
            <div className="mock-payment-section">
              <p>这是模拟支付，点击下方按钮完成支付</p>
              <button className="complete-payment-btn" onClick={handleMockPayComplete}>
                模拟支付成功
              </button>
            </div>
          )}

          <div className="payment-tips">
            <p>支付完成后，系统将自动更新您的订阅状态</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-view">
      {/* 头部 */}
      <div className="payment-header">
        <h2>订阅管理</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* 标签切换 */}
      <div className="payment-tabs">
        <button className={activeTab === 'plans' ? 'active' : ''} onClick={() => setActiveTab('plans')}>
          选择计划
        </button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
          订单记录
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="payment-content">
        {activeTab === 'plans' ? renderPlans() : renderOrders()}
      </div>

      {/* 支付模态框 */}
      {renderPaymentModal()}
    </div>
  )
}

/**
 * 获取支付方式图标
 */
function getProviderIcon(provider: PaymentProvider): string {
  const icons: Record<PaymentProvider, string> = {
    alipay: '💳',
    wechat: '💬',
    stripe: '💳',
    mock: '🧪',
  }
  return icons[provider] || '💳'
}

export default PaymentView
