/**
 * 系统配置类型定义
 */

/**
 * 基础配置
 */
export interface SiteConfig {
  /** 站点名称 */
  siteName: string
  /** 站点描述 */
  siteDescription: string
  /** Logo URL */
  logoUrl: string
  /** Favicon URL */
  faviconUrl: string
  /** 联系邮箱 */
  contactEmail: string
  /** 联系电话 */
  contactPhone: string
  /** 备案号 */
  icpNumber: string
  /** 版权信息 */
  copyright: string
}

/**
 * 功能开关
 */
export interface FeatureFlags {
  /** 是否允许新用户注册 */
  registrationEnabled: boolean
  /** 是否需要邮箱验证 */
  emailVerificationRequired: boolean
  /** 是否需要手机验证 */
  phoneVerificationRequired: boolean
  /** 是否启用支付功能 */
  paymentEnabled: boolean
  /** 是否启用微信支付 */
  wechatPayEnabled: boolean
  /** 是否启用支付宝 */
  alipayEnabled: boolean
  /** 是否启用技能商店 */
  skillStoreEnabled: boolean
  /** 是否允许技能上传 */
  skillUploadEnabled: boolean
  /** 是否启用实时聊天 */
  liveChatEnabled: boolean
  /** 是否启用维护模式 */
  maintenanceMode: boolean
  /** 维护模式提示信息 */
  maintenanceMessage: string
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  /** 密码最小长度 */
  passwordMinLength: number
  /** 是否需要大写字母 */
  passwordRequireUppercase: boolean
  /** 是否需要小写字母 */
  passwordRequireLowercase: boolean
  /** 是否需要数字 */
  passwordRequireNumber: boolean
  /** 是否需要特殊字符 */
  passwordRequireSpecial: boolean
  /** 登录失败锁定次数 */
  loginLockoutAttempts: number
  /** 登录锁定时间（分钟） */
  loginLockoutDuration: number
  /** 会话超时时间（分钟） */
  sessionTimeout: number
  /** 是否启用双因素认证 */
  twoFactorEnabled: boolean
  /** 是否强制双因素认证 */
  twoFactorRequired: boolean
  /** 允许的登录 IP 白名单 */
  ipWhitelist: string[]
  /** 禁止的 IP 黑名单 */
  ipBlacklist: string[]
}

/**
 * 通知模板类型
 */
export type NotificationChannel = 'email' | 'sms' | 'push'

/**
 * 通知模板
 */
export interface NotificationTemplate {
  id: string
  /** 模板名称 */
  name: string
  /** 模板代码 */
  code: string
  /** 模板通道 */
  channel: NotificationChannel
  /** 模板主题（邮件） */
  subject?: string
  /** 模板内容 */
  content: string
  /** 可用变量 */
  variables: string[]
  /** 是否启用 */
  enabled: boolean
  /** 更新时间 */
  updatedAt: string
}

/**
 * 通知模板列表
 */
export interface NotificationTemplateList {
  templates: NotificationTemplate[]
  total: number
}

/**
 * 配置更新请求
 */
export interface ConfigUpdateRequest<T> {
  config: Partial<T>
}

/**
 * 配置响应
 */
export interface ConfigResponse<T> {
  success: boolean
  config?: T
  error?: string
}

/**
 * 模板更新请求
 */
export interface TemplateUpdateRequest {
  templateId: string
  subject?: string
  content: string
  enabled?: boolean
}

/**
 * 所有系统配置
 */
export interface SystemConfig {
  site: SiteConfig
  features: FeatureFlags
  security: SecurityConfig
}

/**
 * 配置分组
 */
export type ConfigGroup = 'site' | 'features' | 'security' | 'notifications'

/**
 * 配置变更历史
 */
export interface ConfigChangeLog {
  id: string
  group: ConfigGroup
  key: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
}
