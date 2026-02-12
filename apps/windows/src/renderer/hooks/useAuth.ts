/**
 * useAuth Hook - 用户认证状态管理
 *
 * 管理用户注册、登录、登出等认证操作
 */

import { useState, useCallback } from 'react'

/**
 * 用户信息
 */
export interface User {
  id: string
  phone?: string
  email?: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
}

/**
 * 认证状态
 */
export interface AuthState {
  /** 当前用户 */
  user: User | null
  /** 访问令牌 */
  accessToken: string | null
  /** 刷新令牌 */
  refreshToken: string | null
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
}

/**
 * 注册参数
 *
 * 手机号或邮箱至少填一个，昵称和密码必填
 */
export interface RegisterParams {
  phone?: string
  email?: string
  password: string
  displayName: string
}

/**
 * 登录参数
 *
 * identifier 为手机号或邮箱，password 必填
 */
export interface LoginParams {
  identifier: string  // 手机号或邮箱
  password: string
}

/**
 * 认证响应
 */
interface AuthResponse {
  success: boolean
  user?: User
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
  errorCode?: string
}

// localStorage keys
const STORAGE_KEYS = {
  USER: 'openclaw_user',
  ACCESS_TOKEN: 'openclaw_access_token',
  REFRESH_TOKEN: 'openclaw_refresh_token',
}

/**
 * 从 localStorage 加载认证状态
 */
function loadAuthState(): Partial<AuthState> {
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER)
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)

    return {
      user: userStr ? JSON.parse(userStr) : null,
      accessToken,
      refreshToken,
      isAuthenticated: !!(userStr && accessToken),
    }
  } catch (error) {
    console.error('[useAuth] 加载认证状态失败:', error)
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    }
  }
}

/**
 * 保存认证状态到 localStorage
 */
function saveAuthState(user: User | null, accessToken: string | null, refreshToken: string | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER)
    }

    if (accessToken) {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    }

    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    }
  } catch (error) {
    console.error('[useAuth] 保存认证状态失败:', error)
  }
}

/**
 * 清除认证状态
 */
function clearAuthState(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER)
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  } catch (error) {
    console.error('[useAuth] 清除认证状态失败:', error)
  }
}

/**
 * useAuth Hook
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const loaded = loadAuthState()
    return {
      user: loaded.user ?? null,
      accessToken: loaded.accessToken ?? null,
      refreshToken: loaded.refreshToken ?? null,
      isAuthenticated: loaded.isAuthenticated ?? false,
      isLoading: false,
      error: null,
    }
  })

  /**
   * 用户注册
   */
  const register = useCallback(async (params: RegisterParams): Promise<{ success: boolean; error?: string }> => {
    console.log('[useAuth] 用户注册:', { ...params, password: '***' })

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await window.electronAPI.gateway.call<AuthResponse>('auth.register', params)

      console.log('[useAuth] 注册响应:', { ...response, accessToken: response.accessToken ? '***' : undefined })

      if (response.success && response.user && response.accessToken) {
        // 保存认证状态
        saveAuthState(response.user, response.accessToken, response.refreshToken || null)

        setState({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        return { success: true }
      } else {
        const errorMessage = response.error || '注册失败'
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      console.error('[useAuth] 注册失败:', error)
      const errorMessage = error instanceof Error ? error.message : '注册失败'
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 用户登录
   */
  const login = useCallback(async (params: LoginParams): Promise<{ success: boolean; error?: string }> => {
    console.log('[useAuth] 用户登录:', { identifier: params.identifier })

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await window.electronAPI.gateway.call<AuthResponse>('auth.login', params)

      console.log('[useAuth] 登录响应:', { ...response, accessToken: response.accessToken ? '***' : undefined })

      if (response.success && response.user && response.accessToken) {
        // 保存认证状态
        saveAuthState(response.user, response.accessToken, response.refreshToken || null)

        setState({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        return { success: true }
      } else {
        const errorMessage = response.error || '登录失败'
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      console.error('[useAuth] 登录失败:', error)
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 用户登出
   */
  const logout = useCallback(async (): Promise<void> => {
    console.log('[useAuth] 用户登出')

    try {
      if (state.refreshToken) {
        await window.electronAPI.gateway.call('auth.logout', {
          refreshToken: state.refreshToken,
        })
      }
    } catch (error) {
      console.error('[useAuth] 登出请求失败:', error)
      // 即使请求失败也要清除本地状态
    }

    // 清除本地状态
    clearAuthState()

    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  }, [state.refreshToken])

  /**
   * 刷新访问令牌
   */
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    console.log('[useAuth] 刷新访问令牌')

    if (!state.refreshToken) {
      console.warn('[useAuth] 没有刷新令牌')
      return false
    }

    try {
      const response = await window.electronAPI.gateway.call<AuthResponse>('auth.refreshToken', {
        refreshToken: state.refreshToken,
      })

      if (response.success && response.accessToken) {
        // 更新令牌
        saveAuthState(state.user, response.accessToken, response.refreshToken || state.refreshToken)

        setState(prev => ({
          ...prev,
          accessToken: response.accessToken!,
          refreshToken: response.refreshToken || prev.refreshToken,
        }))

        return true
      } else {
        console.error('[useAuth] 刷新令牌失败:', response.error)
        // 刷新失败，需要重新登录
        await logout()
        return false
      }
    } catch (error) {
      console.error('[useAuth] 刷新令牌请求失败:', error)
      await logout()
      return false
    }
  }, [state.refreshToken, state.user, logout])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    register,
    login,
    logout,
    refreshAccessToken,
    clearError,
  }
}
