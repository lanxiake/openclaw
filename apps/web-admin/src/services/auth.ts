/**
 * 认证服务
 *
 * 封装用户认证相关的 Gateway RPC 调用
 */

import { gateway } from '../lib/gateway-client'

/**
 * 用户信息
 */
export interface User {
  id: string
  phone?: string
  email?: string
  displayName?: string
  avatar?: string
  role: 'user' | 'operator' | 'admin'
  scopes: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  success: boolean
  user?: User
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  mfaRequired?: boolean
  mfaMethod?: string
  error?: string
  errorCode?: string
}

/**
 * 发送验证码响应
 */
export interface SendCodeResponse {
  success: boolean
  nextSendAt?: number
  error?: string
  errorCode?: string
}

/**
 * 认证服务
 */
export const authService = {
  /**
   * 发送验证码
   *
   * @param target - 手机号或邮箱
   * @param targetType - 类型：phone | email
   * @param purpose - 用途：login | register | reset_password | bind | verify
   */
  async sendCode(
    target: string,
    targetType: 'phone' | 'email',
    purpose: 'login' | 'register' | 'reset_password' | 'bind' | 'verify' = 'login'
  ): Promise<SendCodeResponse> {
    console.log('[auth] 发送验证码', { target, targetType, purpose })

    try {
      const result = await gateway.call<SendCodeResponse>('auth.sendCode', {
        target,
        targetType,
        purpose,
      })

      return result
    } catch (error) {
      console.error('[auth] 发送验证码失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
    }
  },

  /**
   * 验证码登录
   *
   * @param identifier - 手机号或邮箱
   * @param code - 验证码
   */
  async loginWithCode(identifier: string, code: string): Promise<LoginResponse> {
    console.log('[auth] 验证码登录', { identifier })

    try {
      const result = await gateway.call<LoginResponse>('auth.login', {
        identifier,
        code,
      })

      return result
    } catch (error) {
      console.error('[auth] 登录失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      }
    }
  },

  /**
   * 密码登录
   *
   * @param identifier - 手机号或邮箱
   * @param password - 密码
   */
  async loginWithPassword(identifier: string, password: string): Promise<LoginResponse> {
    console.log('[auth] 密码登录', { identifier })

    try {
      const result = await gateway.call<LoginResponse>('auth.login', {
        identifier,
        password,
      })

      return result
    } catch (error) {
      console.error('[auth] 登录失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      }
    }
  },

  /**
   * 注册
   *
   * @param params - 注册参数
   */
  async register(params: {
    phone?: string
    email?: string
    code: string
    password?: string
    displayName?: string
  }): Promise<LoginResponse> {
    console.log('[auth] 注册', { phone: params.phone, email: params.email })

    try {
      const result = await gateway.call<LoginResponse>('auth.register', params)
      return result
    } catch (error) {
      console.error('[auth] 注册失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '注册失败',
      }
    }
  },

  /**
   * 刷新令牌
   *
   * @param refreshToken - 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    console.log('[auth] 刷新令牌')

    try {
      const result = await gateway.call<LoginResponse>('auth.refreshToken', {
        refreshToken,
      })

      return result
    } catch (error) {
      console.error('[auth] 刷新令牌失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '刷新令牌失败',
      }
    }
  },

  /**
   * 登出
   *
   * @param refreshToken - 刷新令牌
   */
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    console.log('[auth] 登出')

    try {
      await gateway.call('auth.logout', { refreshToken })
      return { success: true }
    } catch (error) {
      console.error('[auth] 登出失败', error)
      // 即使失败也返回成功，因为客户端会清除本地状态
      return { success: true }
    }
  },

  /**
   * 登出所有设备
   *
   * @param userId - 用户 ID
   */
  async logoutAll(userId: string): Promise<{ success: boolean }> {
    console.log('[auth] 登出所有设备')

    try {
      const result = await gateway.call<{ success: boolean }>('auth.logoutAll', { userId })
      return result
    } catch (error) {
      console.error('[auth] 登出所有设备失败', error)
      return { success: false }
    }
  },
}
