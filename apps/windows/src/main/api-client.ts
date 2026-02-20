/**
 * API Server HTTP 客户端
 *
 * 用于调用 API Server 的 REST 接口，支持：
 * - 用户认证（登录、注册、Token 刷新、登出）
 * - 设备配对（发起配对、查询状态）
 * - 用户自服务（获取/更新用户信息、设备列表）
 *
 * 设计原则：
 * - 使用 Node.js 原生 fetch API
 * - 自动添加 Authorization header
 * - 统一错误处理和响应格式转换
 * - 支持请求超时
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  /** API Server 基础 URL，默认 http://localhost:3000 */
  baseUrl: string
  /** 请求超时时间（毫秒），默认 30000 */
  timeout: number
}

/**
 * 用户信息
 */
export interface User {
  id: string
  username?: string
  phone?: string
  email?: string
  displayName?: string
  avatarUrl?: string
  status?: string
  createdAt: string
  updatedAt?: string
}

/**
 * 认证响应
 */
export interface AuthResponse {
  success: boolean
  data?: {
    user: User
    accessToken: string
    refreshToken?: string
    expiresIn?: number
  }
  error?: string
  code?: string
}

/**
 * 登录参数
 */
export interface LoginParams {
  /** 用户名、手机号或邮箱 */
  identifier: string
  /** 密码 */
  password: string
}

/**
 * 注册参数
 */
export interface RegisterParams {
  /** 用户名 */
  username?: string
  /** 手机号 */
  phone?: string
  /** 邮箱 */
  email?: string
  /** 密码 */
  password: string
  /** 显示名称 */
  displayName?: string
  /** 验证码 */
  verificationCode?: string
}

/**
 * 发送验证码参数
 */
export interface SendCodeParams {
  /** 手机号 */
  phone?: string
  /** 邮箱 */
  email?: string
  /** 验证码类型 */
  type?: 'register' | 'login' | 'reset'
}

/**
 * 发送验证码响应
 */
export interface SendCodeResponse {
  success: boolean
  data?: {
    message: string
  }
  error?: string
  code?: string
}

/**
 * 设备配对请求参数
 */
export interface PairRequestParams {
  /** 设备 ID */
  deviceId: string
  /** 设备公钥 */
  publicKey: string
  /** 显示名称 */
  displayName?: string
  /** 平台 */
  platform?: string
  /** 客户端 ID */
  clientId?: string
  /** 客户端模式 */
  clientMode?: string
  /** 角色 */
  role?: string
  /** 权限范围 */
  scopes?: string[]
}

/**
 * 设备配对请求响应
 */
export interface PairRequestResponse {
  success: boolean
  data?: {
    requestId: string
    status: 'pending' | 'approved' | 'rejected'
    expiresAt: string
  }
  error?: string
  code?: string
}

/**
 * 配对状态响应
 */
export interface PairingStatusResponse {
  success: boolean
  data?: {
    status: 'pending' | 'approved' | 'rejected' | 'expired'
    device?: {
      deviceId: string
      userId: string
      displayName?: string
      platform?: string
      role?: string
      scopes?: string[]
    }
    deviceToken?: string
  }
  error?: string
  code?: string
}

/**
 * 用户响应
 */
export interface UserResponse {
  success: boolean
  data?: User
  error?: string
  code?: string
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  deviceId: string
  userId: string
  alias?: string
  isPrimary: boolean
  linkedAt: string
  lastActiveAt?: string
  displayName?: string
  platform?: string
  role?: string
  scopes?: string[]
}

/**
 * 设备列表响应
 */
export interface DevicesResponse {
  success: boolean
  data?: DeviceInfo[]
  meta?: {
    total: number
    quota: number
  }
  error?: string
  code?: string
}

/**
 * 更新用户参数
 */
export interface UpdateUserParams {
  displayName?: string
  avatar?: string
}

/**
 * 修改密码参数
 */
export interface ChangePasswordParams {
  /** 当前密码 */
  currentPassword: string
  /** 新密码 */
  newPassword: string
}

// ============================================================================
// 订阅相关类型
// ============================================================================

/** 订阅计划 ID */
export type SubscriptionPlanId = 'free' | 'pro' | 'team' | 'enterprise'

/** 计费周期 */
export type BillingPeriod = 'monthly' | 'yearly'

/** 订阅计划（API 返回格式） */
export interface SubscriptionPlan {
  id: SubscriptionPlanId
  name: string
  description: string
  price: { monthly: number; yearly: number }
  features: Array<{ id: string; name: string; description?: string; included: boolean; limit?: string }>
  quotas: Record<string, unknown>
  recommended?: boolean
  sortOrder?: number
}

/** 订阅概览响应 */
export interface SubscriptionOverviewResponse {
  success: boolean
  data?: {
    subscription: unknown
    plan: unknown
    usage: { daily: unknown; monthly: unknown }
  }
  error?: string
  code?: string
}

/** 创建订阅参数 */
export interface CreateSubscriptionParams {
  planId: SubscriptionPlanId
  billingPeriod: BillingPeriod
  paymentMethodId?: string
  startTrial?: boolean
}

/** 取消订阅参数 */
export interface CancelSubscriptionParams {
  immediately?: boolean
  reason?: string
  feedback?: string
}

/** 更新订阅参数 */
export interface UpdateSubscriptionParams {
  planId?: SubscriptionPlanId
  billingPeriod?: BillingPeriod
  cancelAtPeriodEnd?: boolean
}

/** 配额检查类型 */
export type QuotaType = 'conversations' | 'aiCalls' | 'skills' | 'devices' | 'storage'

// ============================================================================
// 支付相关类型
// ============================================================================

/** 支付提供商 */
export type PaymentProvider = 'alipay' | 'wechat' | 'stripe' | 'mock'

/** 订单状态 */
export type OrderStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded'

/** 订单类型 */
export type OrderType = 'subscription' | 'skill' | 'addon' | 'topup'

/** 退款原因 */
export type RefundReason = string

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

/** 创建订单参数 */
export interface CreateOrderParams {
  type: OrderType
  planId: string
  billingPeriod?: BillingPeriod
  provider: PaymentProvider
  couponCode?: string
}

/** 发起支付参数 */
export interface InitiatePaymentParams {
  provider: PaymentProvider
  returnUrl?: string
}

/** 计算价格参数 */
export interface CalculatePriceParams {
  type: OrderType
  itemId: string
  billingPeriod?: BillingPeriod
  couponCode?: string
}

/** 模拟支付参数 */
export interface MockPaymentParams {
  orderId: string
  success?: boolean
}

/** 创建退款参数 */
export interface CreateRefundParams {
  orderId: string
  amount?: number
  reason: RefundReason
  description?: string
}

// ============================================================================
// 日志工具
// ============================================================================

const log = {
  info: (...args: unknown[]) => console.log('[ApiClient]', ...args),
  error: (...args: unknown[]) => console.error('[ApiClient]', ...args),
  warn: (...args: unknown[]) => console.warn('[ApiClient]', ...args),
  debug: (...args: unknown[]) => console.log('[ApiClient:debug]', ...args),
}

// ============================================================================
// API 客户端实现
// ============================================================================

/**
 * API Server HTTP 客户端
 */
export class ApiClient {
  private config: ApiClientConfig
  private accessToken: string | null = null

  /**
   * 创建 API 客户端实例
   *
   * @param config - 客户端配置
   */
  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://127.0.0.1:3000',  // 使用 IPv4 地址而不是 localhost
      timeout: config.timeout || 30000,
    }
    log.info('API 客户端初始化完成', { baseUrl: this.config.baseUrl })
  }

  // ==========================================================================
  // 配置方法
  // ==========================================================================

  /**
   * 设置访问令牌
   *
   * @param token - JWT 访问令牌，传 null 清除
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token
    log.debug('访问令牌已更新', { hasToken: !!token })
  }

  /**
   * 获取当前访问令牌
   */
  getAccessToken(): string | null {
    return this.accessToken
  }

  /**
   * 设置 API Server 基础 URL
   *
   * @param url - 基础 URL
   */
  setBaseUrl(url: string): void {
    this.config.baseUrl = url
    log.info('API Server URL 已更新', { baseUrl: url })
  }

  /**
   * 获取当前 API Server 基础 URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl
  }

  // ==========================================================================
  // 认证接口
  // ==========================================================================

  /**
   * 用户登录
   *
   * @param params - 登录参数
   * @returns 认证响应
   */
  async login(params: LoginParams): Promise<AuthResponse> {
    log.info('用户登录', { identifier: params.identifier })

    // API Server 使用 username/email 字段，需要转换
    const body: Record<string, string> = {
      password: params.password,
    }

    // 判断 identifier 类型
    const identifier = params.identifier.trim()
    if (identifier.includes('@')) {
      body.email = identifier
    } else if (/^1[3-9]\d{9}$/.test(identifier)) {
      // 手机号格式，API Server 可能用 username 或 phone
      body.username = identifier
    } else {
      body.username = identifier
    }

    return this.request<AuthResponse>('POST', '/api/auth/login', body)
  }

  /**
   * 用户注册
   *
   * @param params - 注册参数
   * @returns 认证响应
   */
  async register(params: RegisterParams): Promise<AuthResponse> {
    log.info('用户注册', {
      hasPhone: !!params.phone,
      hasEmail: !!params.email,
      hasUsername: !!params.username,
      passwordLength: params.password?.length,
      passwordFirst3: params.password?.substring(0, 3),
    })

    return this.request<AuthResponse>('POST', '/api/auth/register', params)
  }

  /**
   * 刷新访问令牌
   *
   * @param refreshToken - 刷新令牌
   * @returns 认证响应
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    log.info('刷新访问令牌')

    return this.request<AuthResponse>('POST', '/api/auth/refresh', {
      refreshToken,
    })
  }

  /**
   * 用户登出
   *
   * @param refreshToken - 刷新令牌
   */
  async logout(refreshToken: string): Promise<void> {
    log.info('用户登出')

    await this.request<{ success: boolean }>('POST', '/api/auth/logout', {
      refreshToken,
    })
  }

  /**
   * 发送验证码
   *
   * @param params - 发送验证码参数
   * @returns 发送结果
   */
  async sendVerificationCode(params: SendCodeParams): Promise<SendCodeResponse> {
    log.info('发送验证码', {
      hasPhone: !!params.phone,
      hasEmail: !!params.email,
      type: params.type,
    })

    return this.request<SendCodeResponse>('POST', '/api/auth/send-code', params)
  }

  // ==========================================================================
  // 设备配对接口
  // ==========================================================================

  /**
   * 发起设备配对请求
   *
   * @param params - 配对请求参数
   * @returns 配对请求响应
   */
  async requestDevicePairing(params: PairRequestParams): Promise<PairRequestResponse> {
    log.info('发起设备配对请求', {
      deviceId: params.deviceId,
      platform: params.platform,
    })

    return this.request<PairRequestResponse>('POST', '/api/devices/pair-request', params)
  }

  /**
   * 查询配对请求状态
   *
   * 注意：此接口可能需要在 API Server 端新增
   *
   * @param requestId - 配对请求 ID
   * @returns 配对状态响应
   */
  async checkPairingStatus(requestId: string): Promise<PairingStatusResponse> {
    log.info('查询配对状态', { requestId })

    return this.request<PairingStatusResponse>('GET', `/api/devices/pair-status/${requestId}`)
  }

  // ==========================================================================
  // 用户自服务接口
  // ==========================================================================

  /**
   * 获取当前用户信息
   *
   * @returns 用户信息响应
   */
  async getCurrentUser(): Promise<UserResponse> {
    log.info('获取当前用户信息')

    return this.request<UserResponse>('GET', '/api/users/me')
  }

  /**
   * 获取用户设备列表
   *
   * @returns 设备列表响应
   */
  async getUserDevices(): Promise<DevicesResponse> {
    log.info('获取用户设备列表')

    return this.request<DevicesResponse>('GET', '/api/users/me/devices')
  }

  /**
   * 更新用户信息
   *
   * @param params - 更新参数
   * @returns 用户信息响应
   */
  async updateUser(params: UpdateUserParams): Promise<UserResponse> {
    log.info('更新用户信息', { fields: Object.keys(params) })

    return this.request<UserResponse>('PUT', '/api/users/me', params)
  }

  /**
   * 修改密码
   *
   * @param params - 修改密码参数（当前密码 + 新密码）
   * @returns 通用响应
   */
  async changePassword(params: ChangePasswordParams): Promise<{ success: boolean; error?: string }> {
    log.info('修改密码')

    return this.request<{ success: boolean; error?: string }>('POST', '/api/users/me/change-password', params)
  }

  // ==========================================================================
  // 订阅接口
  // ==========================================================================

  /**
   * 获取所有订阅计划列表（公开接口，无需认证）
   *
   * @returns 计划列表响应
   */
  async getPlans(): Promise<ApiResponse<{ plans: SubscriptionPlan[] }>> {
    log.info('获取订阅计划列表')

    return this.request<ApiResponse<{ plans: SubscriptionPlan[] }>>('GET', '/api/plans')
  }

  /**
   * 获取指定计划详情（公开接口，无需认证）
   *
   * @param planId - 计划 ID
   * @returns 计划详情响应
   */
  async getPlan(planId: string): Promise<ApiResponse<{ plan: SubscriptionPlan }>> {
    log.info('获取计划详情', { planId })

    return this.request<ApiResponse<{ plan: SubscriptionPlan }>>('GET', `/api/plans/${planId}`)
  }

  /**
   * 获取当前用户订阅信息
   *
   * @returns 订阅信息响应
   */
  async getSubscription(): Promise<ApiResponse<{ subscription: unknown }>> {
    log.info('获取用户订阅信息')

    return this.request<ApiResponse<{ subscription: unknown }>>('GET', '/api/users/me/subscription')
  }

  /**
   * 获取当前用户使用量
   *
   * @returns 使用量响应
   */
  async getUsage(): Promise<ApiResponse<{ usage: unknown }>> {
    log.info('获取用户使用量')

    return this.request<ApiResponse<{ usage: unknown }>>('GET', '/api/users/me/usage')
  }

  /**
   * 获取订阅概览（订阅 + 计划 + 使用量）
   *
   * @returns 订阅概览响应
   */
  async getSubscriptionOverview(): Promise<SubscriptionOverviewResponse> {
    log.info('获取订阅概览')

    return this.request<SubscriptionOverviewResponse>('GET', '/api/subscriptions/overview')
  }

  /**
   * 创建订阅
   *
   * @param params - 创建订阅参数
   * @returns 订阅响应
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<ApiResponse<{ subscription: unknown }>> {
    log.info('创建订阅', { planId: params.planId, billingPeriod: params.billingPeriod })

    return this.request<ApiResponse<{ subscription: unknown }>>('POST', '/api/subscriptions', params)
  }

  /**
   * 取消订阅
   *
   * @param subscriptionId - 订阅 ID
   * @param params - 取消参数
   * @returns 订阅响应
   */
  async cancelSubscription(subscriptionId: string, params: CancelSubscriptionParams = {}): Promise<ApiResponse<{ subscription: unknown }>> {
    log.info('取消订阅', { subscriptionId, immediately: params.immediately })

    return this.request<ApiResponse<{ subscription: unknown }>>('POST', `/api/subscriptions/${subscriptionId}/cancel`, params)
  }

  /**
   * 更新订阅
   *
   * @param subscriptionId - 订阅 ID
   * @param params - 更新参数
   * @returns 订阅响应
   */
  async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<ApiResponse<{ subscription: unknown }>> {
    log.info('更新订阅', { subscriptionId, changes: Object.keys(params) })

    return this.request<ApiResponse<{ subscription: unknown }>>('PUT', `/api/subscriptions/${subscriptionId}`, params)
  }

  /**
   * 检查配额
   *
   * @param quotaType - 配额类型
   * @returns 配额检查结果
   */
  async checkQuota(quotaType: QuotaType): Promise<ApiResponse<unknown>> {
    log.info('检查配额', { quotaType })

    return this.request<ApiResponse<unknown>>('POST', '/api/subscriptions/quota-check', { quotaType })
  }

  // ==========================================================================
  // 支付接口
  // ==========================================================================

  /**
   * 获取可用支付方式
   *
   * @returns 支付方式列表
   */
  async getPaymentProviders(): Promise<ApiResponse<{ providers: unknown[] }>> {
    log.info('获取可用支付方式')

    return this.request<ApiResponse<{ providers: unknown[] }>>('GET', '/api/payments/providers')
  }

  /**
   * 获取用户订单列表
   *
   * @param options - 查询选项
   * @returns 订单列表
   */
  async getUserOrders(options?: {
    status?: OrderStatus | OrderStatus[]
    page?: number
    limit?: number
  }): Promise<ApiResponse<unknown>> {
    log.info('获取用户订单列表', { status: options?.status, page: options?.page })

    const params = new URLSearchParams()
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      for (const s of statuses) {
        params.append('status', s)
      }
    }
    if (options?.page) params.set('page', String(options.page))
    if (options?.limit) params.set('limit', String(options.limit))

    const query = params.toString()
    const path = query ? `/api/payments/orders?${query}` : '/api/payments/orders'

    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取订单详情
   *
   * @param orderId - 订单 ID
   * @returns 订单详情
   */
  async getOrder(orderId: string): Promise<ApiResponse<{ order: unknown }>> {
    log.info('获取订单详情', { orderId })

    return this.request<ApiResponse<{ order: unknown }>>('GET', `/api/payments/orders/${orderId}`)
  }

  /**
   * 计算价格
   *
   * @param params - 计算价格参数
   * @returns 价格信息
   */
  async calculatePrice(params: CalculatePriceParams): Promise<ApiResponse<{ price: unknown }>> {
    log.info('计算价格', { type: params.type, itemId: params.itemId })

    return this.request<ApiResponse<{ price: unknown }>>('POST', '/api/payments/calculate-price', params)
  }

  /**
   * 创建订单并发起支付（购买订阅）
   *
   * @param params - 创建订单参数
   * @returns 订单、价格和支付信息
   */
  async purchaseSubscription(params: CreateOrderParams): Promise<ApiResponse<{
    order: unknown
    price: unknown
    payment: unknown
  }>> {
    log.info('购买订阅', { type: params.type, planId: params.planId, provider: params.provider })

    return this.request<ApiResponse<{ order: unknown; price: unknown; payment: unknown }>>('POST', '/api/payments/orders', params)
  }

  /**
   * 取消订单
   *
   * @param orderId - 订单 ID
   * @returns 订单信息
   */
  async cancelOrder(orderId: string): Promise<ApiResponse<{ order: unknown }>> {
    log.info('取消订单', { orderId })

    return this.request<ApiResponse<{ order: unknown }>>('POST', `/api/payments/orders/${orderId}/cancel`)
  }

  /**
   * 发起支付（对已有订单）
   *
   * @param orderId - 订单 ID
   * @param params - 支付参数
   * @returns 支付信息
   */
  async initiatePayment(orderId: string, params: InitiatePaymentParams): Promise<ApiResponse<unknown>> {
    log.info('发起支付', { orderId, provider: params.provider })

    return this.request<ApiResponse<unknown>>('POST', `/api/payments/orders/${orderId}/pay`, params)
  }

  /**
   * 查询支付状态
   *
   * @param orderId - 订单 ID
   * @returns 支付状态
   */
  async queryPaymentStatus(orderId: string): Promise<ApiResponse<unknown>> {
    log.info('查询支付状态', { orderId })

    return this.request<ApiResponse<unknown>>('GET', `/api/payments/orders/${orderId}/status`)
  }

  /**
   * 模拟支付完成（仅测试环境）
   *
   * @param params - 模拟支付参数
   * @returns 订单信息
   */
  async mockPaymentComplete(params: MockPaymentParams): Promise<ApiResponse<{ order: unknown }>> {
    log.info('模拟支付完成', { orderId: params.orderId, success: params.success })

    return this.request<ApiResponse<{ order: unknown }>>('POST', '/api/payments/mock-complete', params)
  }

  /**
   * 创建退款
   *
   * @param params - 退款参数
   * @returns 退款信息
   */
  async createRefund(params: CreateRefundParams): Promise<ApiResponse<{ refund: unknown }>> {
    log.info('创建退款', { orderId: params.orderId, reason: params.reason })

    return this.request<ApiResponse<{ refund: unknown }>>('POST', '/api/payments/refunds', params)
  }

  // ==========================================================================
  // 技能商店接口
  // ==========================================================================

  /**
   * 获取商店技能列表
   */
  async getStoreSkills(filters?: {
    category?: string
    tags?: string[]
    subscription?: string
    sortBy?: string
    search?: string
    offset?: number
    limit?: number
  }): Promise<ApiResponse<unknown>> {
    log.info('获取商店技能列表', { filters })

    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    if (filters?.tags?.length) params.set('tags', filters.tags.join(','))
    if (filters?.subscription) params.set('subscription', filters.subscription)
    if (filters?.sortBy) params.set('sortBy', filters.sortBy)
    if (filters?.search) params.set('search', filters.search)
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset))
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit))

    const query = params.toString()
    const path = query ? `/api/store/skills?${query}` : '/api/store/skills'

    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取推荐技能
   */
  async getStoreFeatured(limit?: number): Promise<ApiResponse<unknown>> {
    log.info('获取推荐技能', { limit })

    const path = limit ? `/api/store/skills/featured?limit=${limit}` : '/api/store/skills/featured'
    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取热门技能
   */
  async getStorePopular(limit?: number): Promise<ApiResponse<unknown>> {
    log.info('获取热门技能', { limit })

    const path = limit ? `/api/store/skills/popular?limit=${limit}` : '/api/store/skills/popular'
    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取最新技能
   */
  async getStoreRecent(limit?: number): Promise<ApiResponse<unknown>> {
    log.info('获取最新技能', { limit })

    const path = limit ? `/api/store/skills/recent?limit=${limit}` : '/api/store/skills/recent'
    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取商店统计信息
   */
  async getStoreStats(): Promise<ApiResponse<unknown>> {
    log.info('获取商店统计')

    return this.request<ApiResponse<unknown>>('GET', '/api/store/stats')
  }

  /**
   * 获取商店分类列表
   */
  async getStoreCategories(): Promise<ApiResponse<unknown>> {
    log.info('获取商店分类列表')

    return this.request<ApiResponse<unknown>>('GET', '/api/store/categories')
  }

  /**
   * 获取商店技能详情
   */
  async getStoreSkillDetail(skillId: string): Promise<ApiResponse<unknown>> {
    log.info('获取商店技能详情', { skillId })

    return this.request<ApiResponse<unknown>>('GET', `/api/store/skills/${skillId}`)
  }

  /**
   * 安装商店技能
   */
  async installStoreSkill(skillId: string): Promise<ApiResponse<unknown>> {
    log.info('安装商店技能', { skillId })

    return this.request<ApiResponse<unknown>>('POST', `/api/store/skills/${skillId}/install`)
  }

  /**
   * 创建用户自建技能
   */
  async createUserSkill(data: {
    name: string
    description?: string
    version?: string
    code?: string
    manifest?: Record<string, unknown>
    status?: string
    metadata?: Record<string, unknown>
  }): Promise<ApiResponse<unknown>> {
    log.info('创建用户自建技能', { name: data.name })

    return this.request<ApiResponse<unknown>>('POST', '/api/skills', data)
  }

  /**
   * 检查已安装技能的更新
   */
  async checkStoreUpdates(): Promise<ApiResponse<unknown>> {
    log.info('检查技能更新')

    return this.request<ApiResponse<unknown>>('GET', '/api/store/skills/updates')
  }

  /**
   * 刷新商店缓存
   */
  async refreshStore(): Promise<ApiResponse<unknown>> {
    log.info('刷新商店缓存')

    return this.request<ApiResponse<unknown>>('POST', '/api/store/refresh')
  }

  // ==========================================================================
  // 审计日志接口
  // ==========================================================================

  /**
   * 查询审计日志
   */
  async queryAuditLogs(filters?: {
    startTime?: string
    endTime?: string
    eventTypes?: string[]
    severities?: string[]
    results?: string[]
    sourceTypes?: string[]
    search?: string
    sessionId?: string
    offset?: number
    limit?: number
    sortOrder?: string
  }): Promise<ApiResponse<unknown>> {
    log.info('查询审计日志', { filters })

    const params = new URLSearchParams()
    if (filters?.startTime) params.set('startTime', filters.startTime)
    if (filters?.endTime) params.set('endTime', filters.endTime)
    if (filters?.eventTypes?.length) params.set('eventTypes', filters.eventTypes.join(','))
    if (filters?.severities?.length) params.set('severities', filters.severities.join(','))
    if (filters?.results?.length) params.set('results', filters.results.join(','))
    if (filters?.sourceTypes?.length) params.set('sourceTypes', filters.sourceTypes.join(','))
    if (filters?.search) params.set('search', filters.search)
    if (filters?.sessionId) params.set('sessionId', filters.sessionId)
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset))
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit))
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder)

    const query = params.toString()
    const path = query ? `/api/audit/logs?${query}` : '/api/audit/logs'

    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取最近的审计日志
   */
  async getRecentAuditLogs(limit?: number): Promise<ApiResponse<unknown>> {
    log.info('获取最近审计日志', { limit })

    const path = limit ? `/api/audit/logs/recent?limit=${limit}` : '/api/audit/logs/recent'
    return this.request<ApiResponse<unknown>>('GET', path)
  }

  /**
   * 获取审计日志统计
   */
  async getAuditStats(): Promise<ApiResponse<unknown>> {
    log.info('获取审计日志统计')

    return this.request<ApiResponse<unknown>>('GET', '/api/audit/logs/stats')
  }

  /**
   * 获取审计配置
   */
  async getAuditConfig(): Promise<ApiResponse<unknown>> {
    log.info('获取审计配置')

    return this.request<ApiResponse<unknown>>('GET', '/api/audit/config')
  }

  /**
   * 更新审计配置
   */
  async updateAuditConfig(config: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    log.info('更新审计配置', { fields: Object.keys(config) })

    return this.request<ApiResponse<unknown>>('PUT', '/api/audit/config', config)
  }

  /**
   * 导出审计日志
   */
  async exportAuditLogs(params: {
    format: string
    filters?: Record<string, unknown>
  }): Promise<ApiResponse<unknown>> {
    log.info('导出审计日志', { format: params.format })

    const urlParams = new URLSearchParams()
    urlParams.set('format', params.format)
    if (params.filters) {
      const f = params.filters
      if (f.startTime) urlParams.set('startTime', String(f.startTime))
      if (f.endTime) urlParams.set('endTime', String(f.endTime))
      if (f.search) urlParams.set('search', String(f.search))
      if (Array.isArray(f.eventTypes) && f.eventTypes.length) urlParams.set('eventTypes', f.eventTypes.join(','))
      if (Array.isArray(f.severities) && f.severities.length) urlParams.set('severities', f.severities.join(','))
    }

    return this.request<ApiResponse<unknown>>('GET', `/api/audit/logs/export?${urlParams.toString()}`)
  }

  /**
   * 清除审计日志
   */
  async clearAuditLogs(beforeDate?: string): Promise<ApiResponse<unknown>> {
    log.info('清除审计日志', { beforeDate })

    const path = beforeDate ? `/api/audit/logs?beforeDate=${encodeURIComponent(beforeDate)}` : '/api/audit/logs'
    return this.request<ApiResponse<unknown>>('DELETE', path)
  }

  // ==========================================================================
  // 技能文件上传
  // ==========================================================================

  /**
   * 上传技能文件（Base64 编码）
   *
   * @param skillId - 技能 ID
   * @param fileType - 文件类型 (package/icon/manifest)
   * @param originalName - 原始文件名
   * @param contentType - MIME 类型
   * @param data - Base64 编码的文件数据
   * @returns 上传结果
   */
  async uploadSkillFile(params: {
    skillId: string
    fileType: string
    originalName: string
    contentType: string
    data: string
  }): Promise<ApiResponse<unknown>> {
    log.info('上传技能文件', {
      skillId: params.skillId,
      fileType: params.fileType,
      originalName: params.originalName,
      dataLength: params.data.length,
    })

    return this.request<ApiResponse<unknown>>(
      'POST',
      `/api/skills/${encodeURIComponent(params.skillId)}/upload`,
      {
        fileType: params.fileType,
        originalName: params.originalName,
        contentType: params.contentType,
        data: params.data,
      }
    )
  }

  // ==========================================================================
  // 通用请求方法
  // ==========================================================================

  /**
   * 发送 HTTP 请求
   *
   * @param method - HTTP 方法
   * @param path - 请求路径
   * @param body - 请求体（可选）
   * @returns 响应数据
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`

    log.debug('发送请求', { method, path, hasBody: !!body })

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // 添加认证头
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 解析响应
      const data = await response.json()

      log.debug('收到响应', {
        status: response.status,
        success: data.success,
      })

      // 处理 HTTP 错误状态码
      if (!response.ok) {
        log.warn('请求失败', {
          status: response.status,
          error: data.error,
          code: data.code,
        })

        // 检测 401 未授权错误（token 过期）
        // 但排除 logout 接口，避免循环调用
        if (response.status === 401 && !path.includes('/logout')) {
          log.warn('检测到 401 错误，token 可能已过期')
          // 通过 IPC 通知渲染进程 token 过期
          const { BrowserWindow } = require('electron')
          const mainWindow = BrowserWindow.getAllWindows()[0]
          if (mainWindow) {
            mainWindow.webContents.send('auth:token-expired')
          }
        }

        // 返回错误响应格式
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          code: data.code || 'HTTP_ERROR',
        } as T
      }

      return data as T
    } catch (error) {
      clearTimeout(timeoutId)

      // 处理超时错误
      if (error instanceof Error && error.name === 'AbortError') {
        log.error('请求超时', { method, path })
        return {
          success: false,
          error: '请求超时，请检查网络连接',
          code: 'TIMEOUT',
        } as T
      }

      // 处理网络错误
      log.error('请求异常', { method, path, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络请求失败',
        code: 'NETWORK_ERROR',
      } as T
    }
  }
}
