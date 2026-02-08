/**
 * API 基础路径
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * WebSocket 地址
 */
export const WS_URL = import.meta.env.VITE_WS_URL || ''

/**
 * 分页默认配置
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
}

/**
 * 路由路径
 */
export const ROUTES = {
  // 公开路由
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  // 用户路由
  DASHBOARD: '/',
  DEVICES: '/devices',
  DEVICE_DETAIL: '/devices/:deviceId',
  SKILLS: '/skills',
  MY_SKILLS: '/skills/my',
  SKILL_STORE: '/skills/store',
  SKILL_DETAIL: '/skills/:skillId',
  SUBSCRIPTION: '/subscription',
  BILLING: '/subscription/billing',
  SETTINGS: '/settings',
  SECURITY: '/settings/security',
  PREFERENCES: '/settings/preferences',

  // 管理员路由
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_DETAIL: '/admin/users/:userId',
  ADMIN_AUDIT: '/admin/audit',
  ADMIN_SYSTEM: '/admin/system',
  ADMIN_CONFIG: '/admin/config',
}

/**
 * 用户权限
 */
export const SCOPES = {
  OPERATOR_READ: 'operator.read',
  OPERATOR_WRITE: 'operator.write',
  ADMIN: 'admin',
}

/**
 * 设备状态
 */
export const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const

/**
 * 订阅状态
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const

/**
 * 用户状态
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
} as const

/**
 * 订单状态
 */
export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
} as const
