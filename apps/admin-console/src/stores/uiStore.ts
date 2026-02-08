import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'

/**
 * UI 状态
 */
interface UIState {
  /** 侧边栏是否收起 */
  sidebarCollapsed: boolean
  /** 主题 */
  theme: 'light' | 'dark' | 'system'
  /** 切换侧边栏 */
  toggleSidebar: () => void
  /** 设置侧边栏状态 */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** 设置主题 */
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

/**
 * UI 状态管理
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      setTheme: (theme: 'light' | 'dark' | 'system') => {
        set({ theme })
        // 应用主题到 document
        const root = document.documentElement
        root.classList.remove('light', 'dark')

        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          root.classList.add(systemTheme)
        } else {
          root.classList.add(theme)
        }
      },
    }),
    {
      name: STORAGE_KEYS.SIDEBAR_COLLAPSED,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
)
