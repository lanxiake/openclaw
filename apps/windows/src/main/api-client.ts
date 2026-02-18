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
