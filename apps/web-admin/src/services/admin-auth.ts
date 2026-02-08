/**
 * 管理员认证服务
 *
 * 封装管理员认证相关的 Gateway RPC 调用
 */

import { gateway } from '../lib/gateway-client'

/**
 * 管理员信息
 */
export interface Admin {
  id: string
  username: string
  displayName: string
  email?: string
  phone?: string
  avatar?: string
  role: 'super_admin' | 'admin' | 'operator'
  permissions: string[]
  status: 'active' | 'suspended' | 'deleted'
  createdAt: string
  lastLoginAt?: string
}

/**
 * 管理员登录响应
 */
export interface AdminLoginResponse {
  success: boolean
  admin?: Admin
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  mfaRequired?: boolean
  mfaMethod?: string
  error?: string
  errorCode?: string
}

/**
 * 管理员认证服务
 */
export const adminAuthService = {
  /**
   * 管理员登录（用户名 + 密码）
   *
   * @param username - 用户名
   * @param password - 密码
   * @param mfaCode - MFA 验证码 (可选)
   */
  async login(username: string, password: string, mfaCode?: string): Promise<AdminLoginResponse> {
    console.log('[admin-auth] 管理员登录', { username })

    try {
      const result = await gateway.call<AdminLoginResponse>('admin.login', {
        username,
        password,
        mfaCode,
      })

      return result
    } catch (error) {
      console.error('[admin-auth] 登录失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      }
    }
  },

  /**
   * 刷新令牌
   *
   * @param refreshToken - 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AdminLoginResponse> {
    console.log('[admin-auth] 刷新令牌')

    try {
      const result = await gateway.call<AdminLoginResponse>('admin.refreshToken', {
        refreshToken,
      })

      return result
    } catch (error) {
      console.error('[admin-auth] 刷新令牌失败', error)
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
    console.log('[admin-auth] 登出')

    try {
      await gateway.call('admin.logout', { refreshToken })
      return { success: true }
    } catch (error) {
      console.error('[admin-auth] 登出失败', error)
      // 即使失败也返回成功，因为客户端会清除本地状态
      return { success: true }
    }
  },

  /**
   * 获取当前管理员信息
   *
   * @param accessToken - 访问令牌
   */
  async getProfile(accessToken: string): Promise<{ success: boolean; admin?: Admin; error?: string }> {
    console.log('[admin-auth] 获取管理员信息')

    try {
      const result = await gateway.call<{ success: boolean; admin: Admin }>('admin.profile', {
        authorization: `Bearer ${accessToken}`,
      })

      return result
    } catch (error) {
      console.error('[admin-auth] 获取管理员信息失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取管理员信息失败',
      }
    }
  },
}
