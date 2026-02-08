import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { adminAuthService } from '@/services'
import { STORAGE_KEYS } from '@/lib/constants'
import type { Admin } from '@/services/admin-auth'

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
  /** 登录 (用户名 + 密码) */
  login: (username: string, password: string) => Promise<void>
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
       */
      login: async (username: string, password: string) => {
        console.log('[authStore] 开始登录:', username)
        set({ isLoading: true })

        try {
          const response = await adminAuthService.login(username, password)

          if (!response.success || !response.admin || !response.accessToken || !response.refreshToken) {
            throw new Error(response.error || '登录失败')
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
            await adminAuthService.logout(token)
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

        const response = await adminAuthService.refreshToken(token)

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
        // super_admin 拥有所有权限
        if (admin.role === 'super_admin') return true
        return admin.permissions.includes(permission)
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
        // Hydration 完成后设置 isLoading 为 false
        if (state) {
          state.setLoading(false)
        }
      },
    }
  )
)
