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
 */
const SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    name: '基础版',
    description: '适合个人用户日常使用',
    monthlyPrice: 1900,
    yearlyPrice: 19000,
    features: ['50 次/日 AI 对话', '5 个技能', '1 台设备', '5GB 存储'],
  },
  {
    id: 'pro',
    name: '专业版',
    description: '适合高频使用和专业需求',
    monthlyPrice: 4900,
    yearlyPrice: 49000,
    features: ['无限 AI 对话', '20 个技能', '3 台设备', '50GB 存储', '优先支持'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: '企业版',
    description: '适合团队和企业使用',
    monthlyPrice: 19900,
    yearlyPrice: 199000,
    features: ['无限 AI 对话', '无限技能', '10 台设备', '500GB 存储', '专属支持', 'API 访问'],
  },
]

export const PaymentView: React.FC<PaymentViewProps> = ({ userId, initialPlanId, onClose }) => {
  // 状态
  const [activeTab, setActiveTab] = useState<'plans' | 'orders'>('plans')
  const [selectedPlan, setSelectedPlan] = useState(initialPlanId || 'pro')
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')
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
      {/* 计费周期切换 */}
      <div className="billing-period-toggle">
        <button
          className={billingPeriod === 'monthly' ? 'active' : ''}
          onClick={() => setBillingPeriod('monthly')}
        >
          月付
        </button>
        <button
          className={billingPeriod === 'yearly' ? 'active' : ''}
          onClick={() => setBillingPeriod('yearly')}
        >
          年付
          <span className="discount-badge">省 2 个月</span>
        </button>
      </div>

      {/* 计划卡片 */}
      <div className="plans-grid">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            {plan.popular && <div className="popular-badge">最受欢迎</div>}
            <h3>{plan.name}</h3>
            <p className="plan-description">{plan.description}</p>
            <div className="plan-price">
              <span className="price">
                {formatAmount(billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice)}
              </span>
              <span className="period">/{billingPeriod === 'yearly' ? '年' : '月'}</span>
            </div>
            {billingPeriod === 'yearly' && (
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
              onClick={() => setSelectedPlan(plan.id)}
            >
              {selectedPlan === plan.id ? '已选择' : '选择'}
            </button>
          </div>
        ))}
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
