/**
 * App Component - 主应用组件
 *
 * OpenClaw Assistant 的根组件
 * 集成用户认证流程
 */

import React, { useState, useEffect, useCallback } from 'react'
import { AuditLogView } from './components/AuditLogView'
import { AuthView } from './components/AuthView'
import { ChatView } from './components/ChatView'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FilesView } from './components/FilesView'
import { SettingsView } from './components/SettingsView'
import { Sidebar } from './components/Sidebar'
import { SkillsView } from './components/SkillsView'
import { SubscriptionView } from './components/SubscriptionView'
import { SystemView } from './components/SystemView'
import { TitleBar } from './components/TitleBar'
import { useAuth } from './hooks/useAuth'
import { useConfirmRequests } from './hooks/useConfirmRequests'
import { useConnectionStatus } from './hooks/useConnectionStatus'

/**
 * 视图类型
 */
type ViewType = 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'settings'

/**
 * 主应用组件
 */
const App: React.FC = () => {
  // 认证状态
  const { isAuthenticated, user, accessToken, logout } = useAuth()

  // 连接状态
  const { isConnected, connect, disconnect } = useConnectionStatus()
  const { currentRequest, handleResponse } = useConfirmRequests()

  // UI 状态
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeView, setActiveView] = useState<ViewType>('chat')

  /**
   * 认证成功后自动连接 Gateway
   */
  useEffect(() => {
    if (isAuthenticated && accessToken && !isConnected) {
      console.log('[App] 用户已认证，自动连接 Gateway')
      // 从配置读取 Gateway URL，这里使用默认值
      const gatewayUrl = 'ws://localhost:18789'
      connect(gatewayUrl, { token: accessToken }).catch(err => {
        console.error('[App] 自动连接 Gateway 失败:', err)
      })
    }
  }, [isAuthenticated, accessToken, isConnected, connect])

  /**
   * 用户登出时断开连接
   */
  const handleLogout = useCallback(async () => {
    console.log('[App] 用户登出')
    await disconnect()
    await logout()
  }, [disconnect, logout])

  /**
   * 认证成功回调
   */
  const handleAuthSuccess = useCallback(() => {
    console.log('[App] 认证成功')
    // 认证成功后会自动连接 Gateway (通过 useEffect)
  }, [])

  /**
   * 切换侧边栏显示
   */
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  /**
   * 渲染主视图
   */
  const renderMainView = () => {
    switch (activeView) {
      case 'files':
        return <FilesView isConnected={isConnected} />
      case 'system':
        return <SystemView isConnected={isConnected} />
      case 'skills':
        return <SkillsView isConnected={isConnected} />
      case 'audit':
        return <AuditLogView isConnected={isConnected} />
      case 'subscription':
        return <SubscriptionView isConnected={isConnected} />
      case 'settings':
        return <SettingsView isConnected={isConnected} />
      case 'chat':
      default:
        return <ChatView isConnected={isConnected} />
    }
  }

  // 未认证时显示登录/注册界面
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        {/* 自定义标题栏（简化版） */}
        <TitleBar
          isConnected={false}
          onToggleSidebar={() => {}}
        />

        {/* 认证视图 */}
        <div className="main-content auth-content">
          <AuthView onAuthSuccess={handleAuthSuccess} />
        </div>
      </div>
    )
  }

  // 已认证时显示主界面
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
            activeView={activeView}
            onViewChange={setActiveView}
            user={user}
            onLogout={handleLogout}
          />
        )}

        {/* 主视图 */}
        {renderMainView()}
      </div>

      {/* 敏感操作确认对话框 */}
      {currentRequest && (
        <ConfirmDialog request={currentRequest} onResponse={handleResponse} />
      )}
    </div>
  )
}

export default App
