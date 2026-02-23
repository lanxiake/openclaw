/**
 * API 基础路径
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/admin/v1'

/**
 * Gateway WebSocket 地址
 */
export const GATEWAY_WS_URL = import.meta.env.VITE_GATEWAY_WS_URL || 'ws://localhost:18789'

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
  ACCESS_TOKEN: 'admin_access_token',
  REFRESH_TOKEN: 'admin_refresh_token',
  ADMIN_INFO: 'admin_info',
  THEME: 'admin_theme',
  SIDEBAR_COLLAPSED: 'admin_sidebar_collapsed',
}

/**
 * 路由路径
 */
export const ROUTES = {
  // 公开路由
  LOGIN: '/login',

  // 管理后台路由
  DASHBOARD: '/',
  USERS: '/users',
  USER_DETAIL: '/users/:userId',
  SUBSCRIPTIONS: '/subscriptions',
  SUBSCRIPTION_PLANS: '/subscriptions/plans',
  SUBSCRIPTION_ORDERS: '/subscriptions/orders',
  AUDIT_LOGS: '/audit',
  SKILLS: '/skills',
  SKILL_CATEGORIES: '/skills/categories',
  SKILL_FEATURED: '/skills/featured',

  // 积分管理
  CREDITS: '/credits',
  CREDITS_PRICING: '/credits/pricing',

  // 系统监控
  MONITOR: '/monitor',
  MONITOR_LOGS: '/monitor/logs',
  MONITOR_ALERTS: '/monitor/alerts',
  MONITOR_LLM_LOGS: '/monitor/llm-logs',

  // 系统配置
  CONFIG: '/config',
  CONFIG_SITE: '/config/site',
  CONFIG_FEATURES: '/config/features',
  CONFIG_SECURITY: '/config/security',
  CONFIG_NOTIFICATIONS: '/config/notifications',
  CONFIG_MODEL_PROVIDERS: '/config/model-providers',
  CONFIG_AUTH_PROFILES: '/config/auth-profiles',
  CONFIG_AGENT: '/config/agent',
  CONFIG_GATEWAY: '/config/gateway',

  // 数据分析
  ANALYTICS: '/analytics',
  ANALYTICS_USERS: '/analytics/users',
  ANALYTICS_REVENUE: '/analytics/revenue',
  ANALYTICS_SKILLS: '/analytics/skills',
  ANALYTICS_FUNNELS: '/analytics/funnels',

  // 系统管理（P1）
  SYSTEM: '/system',
  SYSTEM_MONITOR: '/system/monitor',
  SYSTEM_CONFIG: '/system/config',

  // 管理员管理
  ADMINS: '/admins',

  // Agent 管理
  AGENTS: '/agents',
}

/**
 * 管理员角色
 */
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
} as const

/**
 * 管理员角色显示名称
 */
export const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  operator: '运营人员',
}

/**
 * 管理员状态
 */
export const ADMIN_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  LOCKED: 'locked',
} as const

/**
 * 管理员状态显示名称
 */
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  suspended: '已禁用',
  locked: '已锁定',
}

/**
 * 用户状态
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
} as const

/**
 * 用户状态显示名称
 */
export const USER_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  suspended: '已禁用',
  deleted: '已删除',
}

/**
 * 订阅状态
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  TRIAL: 'trial',
} as const

/**
 * 订阅状态显示名称
 */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  canceled: '已取消',
  expired: '已过期',
  trial: '试用中',
}

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

/**
 * 订单状态显示名称
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  canceled: '已取消',
  refunded: '已退款',
}

/**
 * 操作日志类型
 */
export const AUDIT_ACTIONS = {
  LOGIN: 'admin.login',
  LOGOUT: 'admin.logout',
  USER_VIEW: 'user.view',
  USER_UPDATE: 'user.update',
  USER_SUSPEND: 'user.suspend',
  USER_ACTIVATE: 'user.activate',
  USER_RESET_PASSWORD: 'user.reset_password',
  SUBSCRIPTION_UPDATE: 'subscription.update',
  SUBSCRIPTION_CANCEL: 'subscription.cancel',
  ORDER_REFUND: 'order.refund',
  PLAN_CREATE: 'plan.create',
  PLAN_UPDATE: 'plan.update',
  CONFIG_UPDATE: 'config.update',
} as const

/**
 * 操作日志类型显示名称
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin.login': '管理员登录',
  'admin.logout': '管理员登出',
  'user.view': '查看用户',
  'user.update': '更新用户',
  'user.suspend': '禁用用户',
  'user.activate': '启用用户',
  'user.reset_password': '重置密码',
  'subscription.update': '更新订阅',
  'subscription.cancel': '取消订阅',
  'order.refund': '订单退款',
  'plan.create': '创建计划',
  'plan.update': '更新计划',
  'config.update': '更新配置',
  'skill.review': '审核技能',
  'skill.publish': '发布技能',
  'skill.unpublish': '下架技能',
  'skill.featured': '设置推荐',
  'category.create': '创建分类',
  'category.update': '更新分类',
  'category.delete': '删除分类',
}

/**
 * 技能状态
 */
export const SKILL_STATUS = {
  PUBLISHED: 'published',
  PENDING: 'pending',
  UNPUBLISHED: 'unpublished',
  REJECTED: 'rejected',
} as const

/**
 * 技能状态显示名称
 */
export const SKILL_STATUS_LABELS: Record<string, string> = {
  published: '已上架',
  pending: '待审核',
  unpublished: '已下架',
  rejected: '已拒绝',
}

/**
 * 技能订阅级别
 */
export const SKILL_SUBSCRIPTION = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
} as const

/**
 * 技能订阅级别显示名称
 */
export const SKILL_SUBSCRIPTION_LABELS: Record<string, string> = {
  free: '免费',
  pro: '专业版',
  team: '团队版',
  enterprise: '企业版',
}

/**
 * 积分流水类型标签
 */
export const CREDIT_TYPE_LABELS: Record<string, string> = {
  earn: '获得',
  consume: '消费',
  expire: '过期',
  refund: '退款',
  admin_adjust: '管理员调整',
}

/**
 * 积分来源标签
 */
export const CREDIT_SOURCE_LABELS: Record<string, string> = {
  register: '注册赠送',
  invite: '邀请奖励',
  subscription: '包月发放',
  purchase: '加油包',
  model_call: '模型调用',
  admin_grant: '管理员发放',
  expiry_cleanup: '过期清理',
  refund: '退款',
}

/**
 * LLM 调用状态标签
 */
export const LLM_STATUS_LABELS: Record<string, string> = {
  success: '成功',
  error: '错误',
  timeout: '超时',
  rate_limited: '限流',
  auth_error: '认证失败',
}

/**
 * Agent 沙箱模式标签
 */
export const AGENT_SANDBOX_MODE_LABELS: Record<string, string> = {
  off: '关闭',
  'non-main': '非主 Agent',
  all: '全部',
}

/**
 * Agent 工作空间访问权限标签
 */
export const AGENT_WORKSPACE_ACCESS_LABELS: Record<string, string> = {
  none: '无访问',
  ro: '只读',
  rw: '读写',
}

/**
 * Agent 主题色选项
 */
export const AGENT_THEME_OPTIONS = [
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'purple', label: '紫色' },
  { value: 'orange', label: '橙色' },
  { value: 'red', label: '红色' },
  { value: 'pink', label: '粉色' },
  { value: 'cyan', label: '青色' },
  { value: 'yellow', label: '黄色' },
] as const
