import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'
import { isTokenExpired } from '@/lib/jwt'
import { gateway } from '@/lib/gateway-client'
import type { Admin } from '@/types'

/**
 * 开发模式标识
 * 设置为 true 可以启用模拟登录，用于 UI 测试
 */
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_MOCK_AUTH === 'true'

/**
 * 模拟管理员数据 (开发模式)
 */
const mockAdmin: Admin = {
  id: 'mock-admin-001',
  username: 'admin',
  displayName: '测试管理员',
  email: 'admin@openclaw.ai',
  role: 'super_admin',
  status: 'active',
  mfaEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

/**
 * 认证状态
 */
interface AuthState {
  /** 管理员信息 */
  admin: Admin | null
  /** 访问 Token */
  accessToken: string | null
  /** 刷新 Token */
  refreshToken: string | null
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 是否加载中 */
  isLoading: boolean
  /** 登录 */
  login: (username: string, password: string, mfaCode?: string) => Promise<void>
  /** 登出 */
  logout: () => Promise<void>
  /** 刷新 Token */
  refreshAccessToken: () => Promise<void>
  /** 检查权限 */
  hasPermission: (permission: string) => boolean
  /** 设置管理员 */
  setAdmin: (admin: Admin | null) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
}

/**
 * 认证状态管理
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      /**
       * 管理员登录
       *
       * @param username - 用户名
       * @param password - 密码
       * @param mfaCode - MFA 验证码（可选）
       */
      login: async (username: string, password: string, mfaCode?: string) => {
        console.log('[authStore] 开始登录:', username)
        set({ isLoading: true })

        try {
          // 开发模式：使用模拟登录
          if (DEV_MODE) {
            console.log('[authStore] 开发模式：使用模拟登录')
            // 模拟延迟
            await new Promise((resolve) => setTimeout(resolve, 500))

            // 验证用户名密码 (开发模式: admin/admin)
            if (username !== 'admin' || password !== 'admin') {
              throw new Error('用户名或密码错误')
            }

            const mockAccessToken = 'mock-access-token-' + Date.now()
            const mockRefreshToken = 'mock-refresh-token-' + Date.now()

            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, mockAccessToken)
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, mockRefreshToken)

            set({
              admin: mockAdmin,
              accessToken: mockAccessToken,
              refreshToken: mockRefreshToken,
              isAuthenticated: true,
              isLoading: false,
            })

            console.log('[authStore] 模拟登录成功:', mockAdmin.displayName)
            return
          }

          // 调用 Gateway RPC
          const response = await gateway.call<{
            success: boolean
            admin?: Admin
            accessToken?: string
            refreshToken?: string
            mfaRequired?: boolean
            error?: string
          }>('admin.login', {
            username,
            password,
            mfaCode,
          })

          if (!response.success) {
            if (response.mfaRequired) {
              throw new Error('REQUIRE_MFA')
            }
            throw new Error(response.error || '登录失败')
          }

          if (!response.admin || !response.accessToken || !response.refreshToken) {
            throw new Error('登录响应数据不完整')
          }

          const { admin, accessToken, refreshToken } = response

          console.log('[authStore] 登录成功:', admin.displayName)

          // 存储 Token
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)

          set({
            admin,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      /**
       * 管理员登出
       */
      logout: async () => {
        console.log('[authStore] 登出')

        const { refreshToken: token } = get()
        if (token) {
          try {
            await gateway.call('admin.logout', { refreshToken: token })
          } catch {
            // 忽略登出请求失败
          }
        }

        // 清除存储
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)

        set({
          admin: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      /**
       * 刷新访问 Token
       */
      refreshAccessToken: async () => {
        const { refreshToken: token } = get()
        if (!token) {
          throw new Error('No refresh token')
        }

        console.log('[authStore] 刷新 Token')

        const response = await gateway.call<{
          success: boolean
          accessToken?: string
          refreshToken?: string
          error?: string
        }>('admin.refreshToken', { refreshToken: token })

        if (!response.success || !response.accessToken || !response.refreshToken) {
          throw new Error(response.error || '刷新 Token 失败')
        }

        const { accessToken, refreshToken: newRefreshToken } = response

        // 存储新 Token
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)

        set({
          accessToken,
          refreshToken: newRefreshToken,
        })
      },

      /**
       * 检查管理员是否具有指定权限
       */
      hasPermission: (permission: string) => {
        const { admin } = get()
        if (!admin) return false

        // 超级管理员拥有所有权限
        if (admin.role === 'super_admin') return true

        // 管理员权限
        if (admin.role === 'admin') {
          // 管理员可以做大部分事情，除了管理其他管理员
          if (permission.startsWith('admin.')) return false
          return true
        }

        // 运营人员权限
        if (admin.role === 'operator') {
          // 只能查看和部分操作
          const allowedPrefixes = ['user.view', 'subscription.view', 'audit.view', 'dashboard.view']
          return allowedPrefixes.some((prefix) => permission.startsWith(prefix))
        }

        return false
      },

      /**
       * 设置管理员
       */
      setAdmin: (admin: Admin | null) => {
        set({ admin, isAuthenticated: !!admin })
      },

      /**
       * 设置加载状态
       */
      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 检查 localStorage 中的 Token 是否已过期
          const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)

          if (state.isAuthenticated && (!token || isTokenExpired(token))) {
            console.log('[authStore] Hydration: Token 已过期或不存在，清除认证状态')
            state.setAdmin(null)
            localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
          }

          state.setLoading(false)
        }
      },
    }
  )
)
