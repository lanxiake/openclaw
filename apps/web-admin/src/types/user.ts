/**
 * 用户类型
 */
export interface User {
  id: string
  phone?: string
  email?: string
  displayName: string
  avatarUrl?: string
  status: 'active' | 'suspended' | 'deleted'
  isPhoneVerified: boolean
  isEmailVerified: boolean
  timezone: string
  locale: string
  scopes: string[]
  createdAt: string
  lastLoginAt?: string
}

/**
 * 用户列表项
 */
export interface UserListItem {
  id: string
  phone?: string
  email?: string
  displayName: string
  status: 'active' | 'suspended' | 'deleted'
  deviceCount: number
  createdAt: string
  lastLoginAt?: string
}

/**
 * 用户详情
 */
export interface UserDetail extends User {
  devices: import('./device').DeviceListItem[]
  subscriptions: import('./subscription').SubscriptionListItem[]
}
