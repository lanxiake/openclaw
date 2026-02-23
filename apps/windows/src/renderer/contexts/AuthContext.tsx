/**
 * AuthContext - 认证状态上下文
 *
 * 提供全局的认证状态管理
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

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
 */
export interface RegisterParams {
  phone?: string
  email?: string
  password: string
  displayName: string
}

/**
 * 登录参数
 */
export interface LoginParams {
  identifier: string  // 手机号或邮箱
  password: string
}

/**
 * 认证响应（来自 API Server HTTP 接口）
 */
interface AuthResponse {
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
 * 认证上下文类型
 */
interface AuthContextType extends AuthState {
  register: (params: RegisterParams) => Promise<{ success: boolean; error?: string }>
  login: (params: LoginParams) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  clearError: () => void
  updateUserProfile: (params: { displayName?: string }) => Promise<{ success: boolean; error?: string }>
  changePassword: (params: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean; error?: string }>
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
    console.error('[AuthContext] 加载认证状态失败:', error)
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
    console.error('[AuthContext] 保存认证状态失败:', error)
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
    console.error('[AuthContext] 清除认证状态失败:', error)
  }
}

// 创建上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider Props
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider - 认证状态提供者
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    const loaded = loadAuthState()
    const hasStoredAuth = !!(loaded.user && loaded.accessToken)
    console.log('[AuthContext] 初始化认证状态:', { hasStoredAuth })
    return {
      user: loaded.user ?? null,
      accessToken: loaded.accessToken ?? null,
      refreshToken: loaded.refreshToken ?? null,
      // 启动时暂不认为已认证，等 token 验证通过后再设为 true
      isAuthenticated: false,
      // 如果有存储的 token，标记为 loading 状态（等待验证）
      isLoading: hasStoredAuth,
      error: null,
    }
  })

  // 添加登出标志，防止重复调用
  const isLoggingOutRef = useRef(false)
  // 标记是否已完成启动验证，防止重复执行
  const hasValidatedRef = useRef(false)

  /**
   * 启动时验证 token 有效性
   *
   * 从 localStorage 恢复 token 后，主动调用 API 验证 token 是否仍然有效。
   * - 有效：设置 isAuthenticated=true
   * - 无效（401）：尝试 refreshToken 刷新
   *   - 刷新成功：更新 token，设置 isAuthenticated=true
   *   - 刷新失败：清除认证状态，显示登录页
   */
  useEffect(() => {
    if (hasValidatedRef.current) {
      return
    }

    const storedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    const storedUserStr = localStorage.getItem(STORAGE_KEYS.USER)

    // 没有存储的 token，无需验证
    if (!storedAccessToken || !storedUserStr) {
      console.log('[AuthContext] 没有存储的 token，跳过验证')
      hasValidatedRef.current = true
      return
    }

    hasValidatedRef.current = true
    console.log('[AuthContext] 启动时验证 token 有效性...')

    const validateStartupToken = async () => {
      try {
        // 先同步 token 到主进程
        await window.electronAPI.api.setAccessToken(storedAccessToken)

        // 调用 getCurrentUser 验证 token
        const response = await window.electronAPI.api.getCurrentUser() as {
          success: boolean
          data?: User
          error?: string
          code?: string
        }

        if (response.success && response.data) {
          console.log('[AuthContext] token 验证通过，恢复登录状态')
          const user = response.data
          // 更新本地存储中的用户信息（可能有变更）
          saveAuthState(user, storedAccessToken, storedRefreshToken)
          setState({
            user,
            accessToken: storedAccessToken,
            refreshToken: storedRefreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return
        }

        // token 无效，尝试 refresh
        console.log('[AuthContext] accessToken 验证失败，尝试刷新:', response.error)

        if (!storedRefreshToken) {
          console.log('[AuthContext] 没有 refreshToken，清除认证状态')
          clearAuthState()
          await window.electronAPI.api.setAccessToken(null)
          setState({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
          return
        }

        // 尝试刷新 token
        const refreshResponse = await window.electronAPI.api.refreshToken(storedRefreshToken) as AuthResponse

        if (refreshResponse.success && refreshResponse.data?.accessToken) {
          console.log('[AuthContext] token 刷新成功，恢复登录状态')
          const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: refreshedUser } = refreshResponse.data
          const finalRefreshToken = newRefreshToken || storedRefreshToken
          const user = refreshedUser || JSON.parse(storedUserStr) as User

          saveAuthState(user, newAccessToken, finalRefreshToken)
          await window.electronAPI.api.setAccessToken(newAccessToken)

          setState({
            user,
            accessToken: newAccessToken,
            refreshToken: finalRefreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return
        }

        // 刷新也失败，清除认证状态
        console.log('[AuthContext] token 刷新失败，重定向到登录页:', refreshResponse.error)
        clearAuthState()
        await window.electronAPI.api.setAccessToken(null)
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        console.error('[AuthContext] 启动验证异常:', error)
        clearAuthState()
        try {
          await window.electronAPI.api.setAccessToken(null)
        } catch {
          // 忽略清除失败
        }
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      }
    }

    validateStartupToken()
  }, [])

  /**
   * 用户注册
   */
  const register = useCallback(async (params: RegisterParams): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] 用户注册:', { ...params, password: '***' })

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await window.electronAPI.api.register(params) as AuthResponse

      console.log('[AuthContext] 注册响应:', { success: response.success, hasToken: !!response.data?.accessToken })

      if (response.success && response.data?.user && response.data?.accessToken) {
        const { user, accessToken, refreshToken } = response.data

        // 保存认证状态
        saveAuthState(user, accessToken, refreshToken || null)

        // 同步访问令牌到主进程的 API 客户端
        await window.electronAPI.api.setAccessToken(accessToken)

        setState({
          user,
          accessToken,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        console.log('[AuthContext] 认证状态已更新:', { isAuthenticated: true, hasUser: !!user, hasToken: !!accessToken })

        return { success: true }
      } else {
        const errorMessage = response.error || '注册失败'
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      console.error('[AuthContext] 注册失败:', error)
      const errorMessage = error instanceof Error ? error.message : '注册失败'
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 用户登录
   */
  const login = useCallback(async (params: LoginParams): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] 用户登录:', { identifier: params.identifier })

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await window.electronAPI.api.login(params) as AuthResponse

      console.log('[AuthContext] 登录响应:', { success: response.success, hasToken: !!response.data?.accessToken })

      if (response.success && response.data?.user && response.data?.accessToken) {
        const { user, accessToken, refreshToken } = response.data

        // 保存认证状态
        saveAuthState(user, accessToken, refreshToken || null)

        // 同步访问令牌到主进程的 API 客户端
        await window.electronAPI.api.setAccessToken(accessToken)

        // 使用函数式更新确保状态正确更新
        setState(prev => {
          console.log('[AuthContext] setState 调用前:', { prevAuth: prev.isAuthenticated })
          const newState = {
            user,
            accessToken,
            refreshToken: refreshToken || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }
          console.log('[AuthContext] setState 调用后:', { newAuth: newState.isAuthenticated })
          return newState
        })

        console.log('[AuthContext] 认证状态已更新:', { isAuthenticated: true, hasUser: !!user, hasToken: !!accessToken })

        return { success: true }
      } else {
        const errorMessage = response.error || '登录失败'
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      console.error('[AuthContext] 登录失败:', error)
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 用户登出
   */
  const logout = useCallback(async (): Promise<void> => {
    // 防止重复调用
    if (isLoggingOutRef.current) {
      console.log('[AuthContext] 登出已在进行中，跳过重复调用')
      return
    }

    isLoggingOutRef.current = true
    console.log('[AuthContext] 用户登出')

    try {
      if (state.refreshToken) {
        await window.electronAPI.api.logout(state.refreshToken)
      }
    } catch (error) {
      console.error('[AuthContext] 登出请求失败:', error)
    }

    try {
      await window.electronAPI.api.setAccessToken(null)
    } catch (error) {
      console.error('[AuthContext] 清除主进程令牌失败:', error)
    }

    clearAuthState()

    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })

    // 重置标志
    isLoggingOutRef.current = false
  }, [state.refreshToken])

  /**
   * 刷新访问令牌
   */
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    console.log('[AuthContext] 刷新访问令牌')

    if (!state.refreshToken) {
      console.warn('[AuthContext] 没有刷新令牌')
      return false
    }

    try {
      const response = await window.electronAPI.api.refreshToken(state.refreshToken) as AuthResponse

      if (response.success && response.data?.accessToken) {
        const newAccessToken = response.data.accessToken
        const newRefreshToken = response.data.refreshToken || state.refreshToken

        saveAuthState(state.user, newAccessToken, newRefreshToken)

        await window.electronAPI.api.setAccessToken(newAccessToken)

        setState(prev => ({
          ...prev,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        }))

        return true
      } else {
        console.error('[AuthContext] 刷新令牌失败:', response.error)
        await logout()
        return false
      }
    } catch (error) {
      console.error('[AuthContext] 刷新令牌请求失败:', error)
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

  /**
   * 更新用户个人资料（显示名称）
   */
  const updateUserProfile = useCallback(async (
    params: { displayName?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] 更新用户资料:', params)

    try {
      const response = await window.electronAPI.api.updateUser(params) as {
        success: boolean
        data?: User
        error?: string
      }

      if (response.success && response.data) {
        const updatedUser = { ...state.user, ...response.data } as User
        saveAuthState(updatedUser, state.accessToken, state.refreshToken)
        setState(prev => ({ ...prev, user: updatedUser }))
        console.log('[AuthContext] 用户资料更新成功')
        return { success: true }
      } else {
        const errMsg = response.error || '更新失败'
        console.error('[AuthContext] 用户资料更新失败:', errMsg)
        return { success: false, error: errMsg }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '更新失败'
      console.error('[AuthContext] 更新用户资料异常:', error)
      return { success: false, error: errMsg }
    }
  }, [state.user, state.accessToken, state.refreshToken])

  /**
   * 修改密码
   */
  const changePassword = useCallback(async (
    params: { currentPassword: string; newPassword: string }
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] 修改密码')

    try {
      const response = await window.electronAPI.api.changePassword(params) as {
        success: boolean
        error?: string
      }

      if (response.success) {
        console.log('[AuthContext] 密码修改成功')
        return { success: true }
      } else {
        const errMsg = response.error || '修改密码失败'
        console.error('[AuthContext] 修改密码失败:', errMsg)
        return { success: false, error: errMsg }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '修改密码失败'
      console.error('[AuthContext] 修改密码异常:', error)
      return { success: false, error: errMsg }
    }
  }, [])

  const value: AuthContextType = {
    ...state,
    register,
    login,
    logout,
    refreshAccessToken,
    clearError,
    updateUserProfile,
    changePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth Hook - 使用认证上下文
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
