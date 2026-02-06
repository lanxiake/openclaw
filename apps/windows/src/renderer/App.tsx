/**
 * App Component - 主应用组件
 *
 * OpenClaw Assistant 的根组件
 */

import React, { useState, useEffect } from 'react'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { useConnectionStatus } from './hooks/useConnectionStatus'

/**
 * 主应用组件
 */
const App: React.FC = () => {
  const { isConnected, connect, disconnect } = useConnectionStatus()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 应用启动时自动连接
  useEffect(() => {
    console.log('[App] 应用启动，准备连接 Gateway')
    // 可以从配置读取 Gateway URL
    // connect('ws://localhost:18789')
  }, [])

  /**
   * 切换侧边栏显示
   */
  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev)
  }

  return (
    <div className="app-container">
      {/* 自定义标题栏 */}
      <TitleBar
        isConnected={isConnected}
        onToggleSidebar={toggleSidebar}
      />

      {/* 主内容区域 */}
      <div className="main-content">
        {/* 侧边栏 */}
        {sidebarOpen && (
          <Sidebar
            isConnected={isConnected}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        )}

        {/* 聊天视图 */}
        <ChatView isConnected={isConnected} />
      </div>
    </div>
  )
}

export default App
