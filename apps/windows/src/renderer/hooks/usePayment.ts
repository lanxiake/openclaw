/**
 * usePayment - 支付管理 Hook
 *
 * 提供支付相关功能：
 * - 创建订单
 * - 发起支付
 * - 查询订单
 * - 退款处理
 */

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 支付提供商
 */
export type PaymentProvider = 'alipay' | 'wechat' | 'stripe' | 'mock'

/**
 * 订单状态
 */
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded'

/**
 * 订单类型
 */
export type OrderType = 'subscription' | 'skill' | 'addon' | 'topup'

/**
 * 支付订单
 */
export interface PaymentOrder {
  id: string
  userId: string
  type: OrderType
  status: OrderStatus
  amount: number
  currency: 'CNY' | 'USD'
  description: string
  referenceId?: string
  referenceType?: string
  provider?: PaymentProvider
  externalOrderId?: string
  paidAt?: string
  expiresAt?: string
  refundedAmount?: number
  createdAt: string
  updatedAt: string
}

/**
 * 价格信息
 */
export interface PriceInfo {
  originalPrice: number
  discountAmount: number
  finalPrice: number
  currency: 'CNY' | 'USD'
  couponCode?: string
  discountDescription?: string
}

/**
 * 支付结果
 */
export interface PaymentResult {
  success: boolean
  payUrl?: string
  qrCode?: string
  payParams?: Record<string, unknown>
  error?: string
}

/**
 * 退款记录
 */
export interface Refund {
  id: string
  orderId: string
  userId: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  amount: number
  currency: 'CNY' | 'USD'
  reason: string
  createdAt: string
}

/**
 * Hook 状态
 */
interface PaymentState {
  /** 当前订单 */
  currentOrder: PaymentOrder | null
  /** 订单列表 */
  orders: PaymentOrder[]
  /** 总订单数 */
  totalOrders: number
  /** 价格信息 */
  priceInfo: PriceInfo | null
  /** 支付结果 */
  paymentResult: PaymentResult | null
  /** 可用的支付方式 */
  providers: PaymentProvider[]
  /** 加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 支付管理 Hook
 */
export function usePayment(userId: string) {
  const [state, setState] = useState<PaymentState>({
    currentOrder: null,
    orders: [],
    totalOrders: 0,
    priceInfo: null,
    paymentResult: null,
    providers: [],
    isLoading: false,
    error: null,
  })

  /**
   * Gateway RPC 调用
   */
  const callGateway = useCallback(async <T>(method: string, params?: unknown): Promise<T> => {
    return window.electronAPI.gateway.call<T>(method, params)
  }, [])

  /**
   * 加载可用的支付方式
   */
  const loadProviders = useCallback(async () => {
    try {
      const result = await callGateway<{ success: boolean; providers: PaymentProvider[] }>(
        'payment.getProviders'
      )
      if (result.success) {
        setState((prev) => ({ ...prev, providers: result.providers }))
      }
    } catch (error) {
      console.error('加载支付方式失败:', error)
    }
  }, [callGateway])

  /**
   * 加载用户订单列表
   */
  const loadOrders = useCallback(
    async (params: { status?: OrderStatus | OrderStatus[]; page?: number; limit?: number } = {}) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await callGateway<{
          success: boolean
          orders: PaymentOrder[]
          total: number
          error?: string
        }>('payment.getUserOrders', { userId, ...params })

        if (result.success) {
          setState((prev) => ({
            ...prev,
            orders: result.orders,
            totalOrders: result.total,
            isLoading: false,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || '加载订单失败',
          }))
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '加载订单失败',
        }))
      }
    },
    [userId, callGateway]
  )

  /**
   * 获取订单详情
   */
  const getOrder = useCallback(
    async (orderId: string): Promise<PaymentOrder | null> => {
      try {
        const result = await callGateway<{
          success: boolean
          order?: PaymentOrder
          error?: string
        }>('payment.getOrder', { orderId })

        if (result.success && result.order) {
          setState((prev) => ({ ...prev, currentOrder: result.order! }))
          return result.order
        }
        return null
      } catch (error) {
        console.error('获取订单失败:', error)
        return null
      }
    },
    [callGateway]
  )

  /**
   * 计算价格
   */
  const calculatePrice = useCallback(
    async (params: {
      type: OrderType
      itemId: string
      billingPeriod?: 'monthly' | 'yearly'
      couponCode?: string
    }): Promise<PriceInfo | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await callGateway<{
          success: boolean
          price?: PriceInfo
          error?: string
        }>('payment.calculatePrice', params)

        if (result.success && result.price) {
          setState((prev) => ({
            ...prev,
            priceInfo: result.price!,
            isLoading: false,
          }))
          return result.price
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || '计算价格失败',
          }))
          return null
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '计算价格失败',
        }))
        return null
      }
    },
    [callGateway]
  )

  /**
   * 购买订阅
   */
  const purchaseSubscription = useCallback(
    async (params: {
      planId: string
      billingPeriod: 'monthly' | 'yearly'
      provider: PaymentProvider
      couponCode?: string
    }): Promise<{ order: PaymentOrder; payment: PaymentResult } | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await callGateway<{
          success: boolean
          order?: PaymentOrder
          price?: PriceInfo
          payment?: PaymentResult
          error?: string
        }>('payment.purchaseSubscription', { userId, ...params })

        if (result.success && result.order && result.payment) {
          setState((prev) => ({
            ...prev,
            currentOrder: result.order!,
            priceInfo: result.price || null,
            paymentResult: result.payment!,
            isLoading: false,
          }))
          return { order: result.order, payment: result.payment }
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || '购买失败',
          }))
          return null
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '购买失败',
        }))
        return null
      }
    },
    [userId, callGateway]
  )

  /**
   * 查询支付状态
   */
  const queryPaymentStatus = useCallback(
    async (orderId: string): Promise<{ status: OrderStatus; paid: boolean } | null> => {
      try {
        const result = await callGateway<{
          success: boolean
          status?: OrderStatus
          paid?: boolean
          paidAt?: string
          error?: string
        }>('payment.queryStatus', { orderId })

        if (result.success) {
          // 更新当前订单状态
          if (state.currentOrder?.id === orderId) {
            setState((prev) => ({
              ...prev,
              currentOrder: prev.currentOrder
                ? { ...prev.currentOrder, status: result.status!, paidAt: result.paidAt }
                : null,
            }))
          }
          return { status: result.status!, paid: result.paid! }
        }
        return null
      } catch (error) {
        console.error('查询支付状态失败:', error)
        return null
      }
    },
    [callGateway, state.currentOrder?.id]
  )

  /**
   * 模拟支付完成 (仅测试用)
   */
  const mockPaymentComplete = useCallback(
    async (orderId: string, success: boolean = true): Promise<PaymentOrder | null> => {
      try {
        const result = await callGateway<{
          success: boolean
          order?: PaymentOrder
          error?: string
        }>('payment.mockComplete', { orderId, success })

        if (result.success && result.order) {
          setState((prev) => ({ ...prev, currentOrder: result.order! }))
          return result.order
        }
        return null
      } catch (error) {
        console.error('模拟支付失败:', error)
        return null
      }
    },
    [callGateway]
  )

  /**
   * 取消订单
   */
  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await callGateway<{
          success: boolean
          order?: PaymentOrder
          error?: string
        }>('payment.cancelOrder', { orderId })

        if (result.success) {
          // 刷新订单列表
          await loadOrders()
          setState((prev) => ({ ...prev, isLoading: false }))
          return true
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || '取消订单失败',
          }))
          return false
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '取消订单失败',
        }))
        return false
      }
    },
    [callGateway, loadOrders]
  )

  /**
   * 申请退款
   */
  const createRefund = useCallback(
    async (params: {
      orderId: string
      amount?: number
      reason: string
      description?: string
    }): Promise<Refund | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await callGateway<{
          success: boolean
          refund?: Refund
          error?: string
        }>('payment.createRefund', params)

        if (result.success && result.refund) {
          // 刷新订单列表
          await loadOrders()
          setState((prev) => ({ ...prev, isLoading: false }))
          return result.refund
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || '申请退款失败',
          }))
          return null
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '申请退款失败',
        }))
        return null
      }
    },
    [callGateway, loadOrders]
  )

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  /**
   * 清除支付结果
   */
  const clearPaymentResult = useCallback(() => {
    setState((prev) => ({ ...prev, paymentResult: null }))
  }, [])

  // 初始化加载
  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  return {
    // 状态
    ...state,

    // 方法
    loadProviders,
    loadOrders,
    getOrder,
    calculatePrice,
    purchaseSubscription,
    queryPaymentStatus,
    mockPaymentComplete,
    cancelOrder,
    createRefund,
    clearError,
    clearPaymentResult,
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化金额 (分 -> 元)
 */
export function formatAmount(amountInCents: number, currency: 'CNY' | 'USD' = 'CNY'): string {
  const amount = amountInCents / 100
  if (currency === 'CNY') {
    return `¥${amount.toFixed(2)}`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * 获取订单状态显示名称
 */
export function getOrderStatusText(status: OrderStatus): string {
  const texts: Record<OrderStatus, string> = {
    pending: '待支付',
    processing: '处理中',
    paid: '已支付',
    failed: '支付失败',
    canceled: '已取消',
    refunded: '已退款',
    partially_refunded: '部分退款',
  }
  return texts[status] || status
}

/**
 * 获取支付方式显示名称
 */
export function getProviderText(provider: PaymentProvider): string {
  const texts: Record<PaymentProvider, string> = {
    alipay: '支付宝',
    wechat: '微信支付',
    stripe: 'Stripe',
    mock: '模拟支付',
  }
  return texts[provider] || provider
}

/**
 * 获取订单状态颜色
 */
export function getOrderStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending: '#faad14', // 黄色
    processing: '#1890ff', // 蓝色
    paid: '#52c41a', // 绿色
    failed: '#ff4d4f', // 红色
    canceled: '#d9d9d9', // 灰色
    refunded: '#722ed1', // 紫色
    partially_refunded: '#722ed1',
  }
  return colors[status] || '#d9d9d9'
}
