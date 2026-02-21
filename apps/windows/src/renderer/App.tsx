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
import { DashboardView } from './components/DashboardView'
import { DeviceManagementView } from './components/DeviceManagementView'
import { FilesView } from './components/FilesView'
import { SettingsView } from './components/SettingsView'
import { Sidebar } from './components/Sidebar'
import { SkillsView } from './components/SkillsView'
import { SubscriptionView } from './components/SubscriptionView'
import { SystemView } from './components/SystemView'
import { TitleBar } from './components/TitleBar'
import { useAuth } from './contexts/AuthContext'
import { useConfirmRequests } from './hooks/useConfirmRequests'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import { useSettings } from './hooks/useSettings'

/**
 * 视图类型
 */
type ViewType = 'dashboard' | 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'settings' | 'devices'

/**
 * 主应用组件
 */
const App: React.FC = () => {
  // 渲染计数器(用于调试)
  const renderCountRef = React.useRef(0)
  renderCountRef.current++
  console.log('[App] 组件渲染 #', renderCountRef.current)

  // 认证状态
  const { isAuthenticated, user, accessToken, logout } = useAuth()
  console.log('[App] useAuth 返回:', { isAuthenticated, hasUser: !!user, hasAccessToken: !!accessToken })

  // 连接状态
  const { isConnected, isConnecting, error: connectionError, connect, disconnect } = useConnectionStatus()
  const { currentRequest, handleResponse } = useConfirmRequests()

  // 用户设置
  const { settings } = useSettings()

  // UI 状态
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeView, setActiveView] = useState<ViewType>('dashboard')

  /**
   * 监控认证状态变化
   */
  useEffect(() => {
    console.log('[App] 认证状态变化:', {
      isAuthenticated,
      hasUser: !!user,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0
    })
  }, [isAuthenticated, user, accessToken])

  /**
   * 用户登出时断开连接
   */
  const handleLogout = useCallback(async () => {
    console.log('[App] 用户登出')
    await disconnect()
    await logout()
  }, [disconnect, logout])

  /**
   * 监听 token 过期事件
   */
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('[App] 收到 token 过期通知，自动登出')
      handleLogout()
    }

    // 监听来自主进程的 token 过期事件
    window.electronAPI.on('auth:token-expired', handleTokenExpired)

    return () => {
      window.electronAPI.off('auth:token-expired', handleTokenExpired)
    }
  }, [handleLogout])

  /**
   * 认证成功后自动连接 Gateway
   *
   * 多租户认证流程：
   * 1. 用户通过 API Server 登录成功,获得 accessToken (JWT)
   * 2. 使用 accessToken 连接 Gateway (支持多租户身份识别)
   * 3. Gateway 从 JWT 中提取 userId,实现租户隔离
   * 4. 如果 Gateway 不可用,聊天功能不可用但不影响已登录状态
   * 5. 连接失败后,每 5 分钟重试一次
   *
   * 认证层次：
   * - 连接层: Gateway token (可选,开发环境通常为 none)
   * - 业务层: JWT accessToken (必需,用于用户身份识别和权限控制)
   */
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return
    }

    // 如果已连接，不需要重连
    if (isConnected) {
      return
    }

    const gatewayUrl = settings.gateway.url || 'ws://localhost:18789'
    const gatewayToken = settings.gateway.token
    const gatewayDeviceId = settings.gateway.deviceId

    console.log('[App] 用户已认证,尝试连接 Gateway:', {
      url: gatewayUrl,
      hasGatewayToken: !!gatewayToken,
      hasDeviceId: !!gatewayDeviceId,
      hasAccessToken: !!accessToken
    })

    // 连接选项:
    // - 如果配置了 gateway.token,使用它作为连接层认证
    // - 如果有 deviceId, 传递给 Gateway 用于 device token 验证
    // - accessToken 会在 RPC 调用时自动添加到请求参数中
    const connectOptions: { token?: string; deviceId?: string } | undefined =
      gatewayToken ? { token: gatewayToken, ...(gatewayDeviceId ? { deviceId: gatewayDeviceId } : {}) } : undefined

    // 立即尝试连接
    connect(gatewayUrl, connectOptions).catch(err => {
      console.error('[App] 连接 Gateway 失败（聊天功能暂不可用）:', err)
    })

    // 设置定时重连（5 分钟）
    const reconnectInterval = setInterval(() => {
      if (!isConnected) {
        console.log('[App] 定时重连 Gateway:', gatewayUrl)
        connect(gatewayUrl, connectOptions).catch(err => {
          console.error('[App] 重连 Gateway 失败:', err)
        })
      }
    }, 5 * 60 * 1000) // 5 分钟

    return () => {
      clearInterval(reconnectInterval)
    }
  }, [isAuthenticated, accessToken, connect, settings.gateway.url, settings.gateway.token]) // 添加 gateway.token 依赖

  /**
   * 认证成功回调
   */
  const handleAuthSuccess = useCallback(() => {
    console.log('[App] 认证成功回调触发')
    // 注意: 此时的 isAuthenticated/accessToken 可能还是旧值(React状态更新是异步的)
    // 使用 setTimeout 确保在下一个事件循环中检查状态
    setTimeout(() => {
      console.log('[App] 延迟检查认证状态:', { isAuthenticated, hasAccessToken: !!accessToken })
    }, 100)
  }, [isAuthenticated, accessToken])

  /**
   * 设备配对成功回调
   */
  const handleDevicePaired = useCallback((deviceToken: string) => {
    console.log('[App] 设备配对成功,尝试连接 Gateway')
    const gatewayUrl = settings.gateway.url || 'ws://localhost:18789'
    const gatewayToken = settings.gateway.token

    // 使用 gateway token (如果配置了) 连接
    const connectOptions = gatewayToken ? { token: gatewayToken } : undefined
    connect(gatewayUrl, connectOptions).catch(err => {
      console.error('[App] 连接 Gateway 失败:', err)
    })
  }, [connect, settings.gateway.url, settings.gateway.token])

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
      case 'dashboard':
        return <DashboardView displayName={user?.displayName || undefined} isConnected={isConnected} onViewChange={setActiveView} />
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
        return <SettingsView isConnected={isConnected} isConnecting={isConnecting} connectionError={connectionError} onConnect={connect} onDisconnect={disconnect} />
      case 'devices':
        return <DeviceManagementView accessToken={accessToken} onDevicePaired={handleDevicePaired} />
      case 'chat':
      default:
        return <ChatView isConnected={isConnected} />
    }
  }

  // 未认证时显示登录/注册界面
  if (!isAuthenticated) {
    console.log('[App] 渲染登录界面, isAuthenticated:', isAuthenticated, 'accessToken:', accessToken ? '存在' : '不存在')
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
  console.log('[App] 渲染主界面, isAuthenticated:', isAuthenticated, 'accessToken:', accessToken ? '存在' : '不存在')
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
