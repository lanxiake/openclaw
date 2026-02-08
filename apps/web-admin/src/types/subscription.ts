/**
 * 订阅状态
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'expired'

/**
 * 计划周期
 */
export type PlanPeriod = 'month' | 'year'

/**
 * 计划
 */
export interface Plan {
  id: string
  name: string
  slug: string
  price: number
  period: PlanPeriod
  features: string[]
}

/**
 * 订阅
 */
export interface Subscription {
  id: string
  plan: Plan
  skill?: import('./skill').Skill
  status: SubscriptionStatus
  startedAt: string
  expiresAt: string
  autoRenew: boolean
}

/**
 * 订阅列表项
 */
export interface SubscriptionListItem {
  id: string
  plan: { name: string }
  status: SubscriptionStatus
  expiresAt: string
}

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'

/**
 * 订单
 */
export interface Order {
  id: string
  type: 'subscription' | 'skill'
  amount: number
  status: OrderStatus
  paymentMethod?: string
  createdAt: string
  paidAt?: string
}
