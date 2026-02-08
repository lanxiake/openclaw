import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

/**
 * 主布局组件
 *
 * 包含侧边栏、顶部导航和内容区域
 */
export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
