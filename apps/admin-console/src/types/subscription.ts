/**
 * 订阅计划
 */
export interface SubscriptionPlan {
  id: string
  name: string
  code: string
  description?: string
  price: number // 分
  billingCycle: 'monthly' | 'yearly' | 'lifetime'
  features: PlanFeature[]
  quotas: PlanQuota
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * 计划功能
 */
export interface PlanFeature {
  name: string
  description?: string
  enabled: boolean
}

/**
 * 计划配额
 */
export interface PlanQuota {
  maxDevices: number
  maxMessagesPerMonth: number
  maxTokensPerMonth: number
  maxSkills: number
}

/**
 * 订阅记录
 */
export interface Subscription {
  id: string
  userId: string
  userName: string
  userPhone?: string
  planId: string
  planName: string
  status: 'active' | 'canceled' | 'expired' | 'trial'
  startDate: string
  endDate: string
  autoRenew: boolean
  canceledAt?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

/**
 * 订单记录
 */
export interface Order {
  id: string
  orderNo: string
  userId: string
  userName: string
  planId: string
  planName: string
  amount: number // 分
  discount?: number // 分
  finalAmount: number // 分
  paymentMethod?: string
  paymentTime?: string
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'
  refundAmount?: number
  refundReason?: string
  refundTime?: string
  createdAt: string
  updatedAt: string
}

/**
 * 订阅列表查询参数
 */
export interface SubscriptionListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  planId?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 订阅列表响应
 */
export interface SubscriptionListResponse {
  subscriptions: Subscription[]
  total: number
  page: number
  pageSize: number
}

/**
 * 订单列表查询参数
 */
export interface OrderListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 订单列表响应
 */
export interface OrderListResponse {
  orders: Order[]
  total: number
  page: number
  pageSize: number
}
