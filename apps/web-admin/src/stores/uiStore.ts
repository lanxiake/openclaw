import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'

/**
 * UI 状态
 */
interface UIState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean
  /** 暗色模式 */
  darkMode: boolean
  /** 移动端菜单是否打开 */
  mobileMenuOpen: boolean
  /** 切换侧边栏 */
  toggleSidebar: () => void
  /** 切换暗色模式 */
  toggleDarkMode: () => void
  /** 设置暗色模式 */
  setDarkMode: (dark: boolean) => void
  /** 切换移动端菜单 */
  toggleMobileMenu: () => void
  /** 关闭移动端菜单 */
  closeMobileMenu: () => void
}

/**
 * UI 状态管理
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      darkMode: false,
      mobileMenuOpen: false,

      /**
       * 切换侧边栏
       */
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      /**
       * 切换暗色模式
       */
      toggleDarkMode: () => {
        set((state) => {
          const newDarkMode = !state.darkMode
          // 更新 DOM
          document.documentElement.classList.toggle('dark', newDarkMode)
          return { darkMode: newDarkMode }
        })
      },

      /**
       * 设置暗色模式
       */
      setDarkMode: (dark: boolean) => {
        document.documentElement.classList.toggle('dark', dark)
        set({ darkMode: dark })
      },

      /**
       * 切换移动端菜单
       */
      toggleMobileMenu: () => {
        set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen }))
      },

      /**
       * 关闭移动端菜单
       */
      closeMobileMenu: () => {
        set({ mobileMenuOpen: false })
      },
    }),
    {
      name: STORAGE_KEYS.SIDEBAR_COLLAPSED,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        darkMode: state.darkMode,
      }),
      onRehydrateStorage: () => (state) => {
        // 恢复暗色模式
        if (state?.darkMode) {
          document.documentElement.classList.add('dark')
        }
      },
    }
  )
)
