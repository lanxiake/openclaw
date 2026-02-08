import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores'
import { cn } from '@/lib/utils'

/**
 * 管理后台主布局组件
 */
export function AdminLayout() {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区域 */}
      <div
        className={cn(
          'flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {/* 顶部导航栏 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
