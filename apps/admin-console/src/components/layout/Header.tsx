import { Bell, LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore, useUIStore } from '@/stores'
import { ROUTES } from '@/lib/constants'

/**
 * 顶部导航栏组件
 */
export function Header() {
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const { theme, setTheme } = useUIStore()

  /**
   * 处理登出
   */
  const handleLogout = async () => {
    console.log('[Header] 执行登出操作')
    await logout()
    navigate(ROUTES.LOGIN)
  }

  /**
   * 切换主题
   */
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* 左侧：页面标题区域（可由页面组件填充） */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">OpenClaw Admin Console</h1>
      </div>

      {/* 右侧：操作区域 */}
      <div className="flex items-center gap-4">
        {/* 主题切换 */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* 通知 */}
        <Button variant="ghost" size="icon" title="通知">
          <Bell className="h-5 w-5" />
        </Button>

        {/* 用户菜单 */}
        <div className="flex items-center gap-3 border-l pl-4">
          <Avatar className="h-8 w-8">
            <AvatarImage src={admin?.avatar} alt={admin?.displayName} />
            <AvatarFallback>
              {admin?.displayName?.charAt(0).toUpperCase() || 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium">{admin?.displayName || '管理员'}</p>
            <p className="text-xs text-muted-foreground">{admin?.role || 'admin'}</p>
          </div>
        </div>

        {/* 登出按钮 */}
        <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
