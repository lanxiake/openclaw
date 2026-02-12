import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

/**
 * 顶部导航栏
 */
export function Header() {
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const { darkMode, toggleDarkMode } = useUIStore()

  /**
   * 处理登出
   */
  const handleLogout = async () => {
    await logout()
    navigate(ROUTES.LOGIN)
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* 左侧 - 面包屑或搜索 */}
      <div className="flex items-center gap-4">
        {/* 可以添加面包屑或搜索框 */}
      </div>

      {/* 右侧 - 操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 通知 */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* 主题切换 */}
        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* 用户菜单 */}
        <div className="relative group">
          <Button variant="ghost" className="flex items-center gap-2 px-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              {admin?.avatar ? (
                <img
                  src={admin.avatar}
                  alt={admin.displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User className="w-4 h-4 text-primary" />
              )}
            </div>
            <span className="max-w-[100px] truncate">{admin?.displayName || '用户'}</span>
            <ChevronDown className="w-4 h-4" />
          </Button>

          {/* 下拉菜单 */}
          <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="font-medium truncate">{admin?.displayName}</p>
              <p className="text-sm text-gray-500 truncate">{admin?.phone || admin?.email}</p>
            </div>
            <div className="py-1">
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => navigate(ROUTES.SETTINGS)}
              >
                <Settings className="w-4 h-4" />
                个人设置
              </button>
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
