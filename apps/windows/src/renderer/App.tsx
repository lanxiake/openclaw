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
import { CreditsView } from './components/CreditsView'
import { DashboardView } from './components/DashboardView'
import { DeviceManagementView } from './components/DeviceManagementView'
import { FilesView } from './components/FilesView'
import { MemoriesView } from './components/MemoriesView'
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
type ViewType = 'dashboard' | 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'settings' | 'devices' | 'credits' | 'memories'

// localStorage keys for device binding
const DEVICE_TOKEN_KEY = 'device_token'
const DEVICE_ID_KEY = 'device_id'

/**
 * 读取本地存储的设备 token 和 deviceId
 */
function getStoredDeviceAuth(): { token: string; deviceId: string } | null {
  const token = localStorage.getItem(DEVICE_TOKEN_KEY)
  const deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (token && deviceId) {
    return { token, deviceId }
  }
  return null
}

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
  const { isConnected, isConnecting, error: connectionError, connect, disconnect, manuallyDisconnected } = useConnectionStatus()
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
   * 双层认证流程：
   * 1. 用户通过 API Server 登录成功，获得 accessToken (JWT)
   * 2. 检查本地是否有设备绑定（device_token + device_id）
   * 3. 优先使用 device token 连接 Gateway（无人值守长期连接）
   * 4. 备选使用 settings 中配置的 gateway token 连接
   * 5. 连接失败后，每 5 分钟重试一次
   */
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return
    }

    // 如果已连接，不需要重连
    if (isConnected) {
      return
    }

    // 手动断开后不自动重连
    if (manuallyDisconnected) {
      return
    }

    // 强制使用 IPv4 地址，避免 Windows 上 localhost 解析为 IPv6 导致连接失败
    const rawUrl = settings.gateway.url || 'ws://127.0.0.1:18789'
    const gatewayUrl = rawUrl.replace('://localhost:', '://127.0.0.1:')

    // 构建连接选项：优先使用设备 token，其次使用 settings 中的 gateway token
    const deviceAuth = getStoredDeviceAuth()
    const gatewayToken = settings.gateway.token
    const gatewayDeviceId = settings.gateway.deviceId

    let connectOptions: { token?: string; deviceId?: string; role?: string; scopes?: string[] } | undefined

    if (deviceAuth) {
      // 使用设备绑定的 device token 连接，role/scopes 需与绑定时一致
      connectOptions = {
        token: deviceAuth.token,
        deviceId: deviceAuth.deviceId,
        role: 'user',
        scopes: ['user.basic'],
      }
      console.log('[App] 使用设备 token 连接 Gateway:', {
        url: gatewayUrl,
        deviceId: deviceAuth.deviceId,
      })
    } else if (gatewayToken) {
      // 使用 settings 中配置的 gateway token 连接
      connectOptions = { token: gatewayToken, ...(gatewayDeviceId ? { deviceId: gatewayDeviceId } : {}) }
      console.log('[App] 使用配置 token 连接 Gateway:', {
        url: gatewayUrl,
        hasDeviceId: !!gatewayDeviceId,
      })
    } else {
      console.log('[App] 无设备 token 也无 gateway token，尝试无认证连接:', { url: gatewayUrl })
    }

    // 立即尝试连接
    connect(gatewayUrl, connectOptions).catch(err => {
      console.error('[App] 连接 Gateway 失败（聊天功能暂不可用）:', err)
    })

    // 设置定时重连（5 分钟）
    const reconnectInterval = setInterval(() => {
      if (!isConnected) {
        // 重新读取设备 token（可能在此期间完成了设备绑定）
        const latestDeviceAuth = getStoredDeviceAuth()
        const retryOptions = latestDeviceAuth
          ? { token: latestDeviceAuth.token, deviceId: latestDeviceAuth.deviceId, role: 'user', scopes: ['user.basic'] }
          : connectOptions

        console.log('[App] 定时重连 Gateway:', gatewayUrl)
        connect(gatewayUrl, retryOptions).catch(err => {
          console.error('[App] 重连 Gateway 失败:', err)
        })
      }
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(reconnectInterval)
    }
  }, [isAuthenticated, accessToken, connect, isConnected, manuallyDisconnected, settings.gateway.url, settings.gateway.token, settings.gateway.deviceId])

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
   *
   * 配对成功后使用新的 device token 和 deviceId 连接 Gateway
   */
  const handleDevicePaired = useCallback((deviceToken: string) => {
    console.log('[App] 设备配对成功，使用 device token 连接 Gateway')
    // 强制使用 IPv4 地址，避免 Windows 上 localhost 解析为 IPv6 导致连接失败
    const rawUrl = settings.gateway.url || 'ws://127.0.0.1:18789'
    const gatewayUrl = rawUrl.replace('://localhost:', '://127.0.0.1:')

    // 从 localStorage 读取配对时保存的 deviceId
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)

    // 使用设备 token 连接 Gateway，role/scopes 与设备绑定时一致
    const connectOptions: { token: string; deviceId?: string; role: string; scopes: string[] } = {
      token: deviceToken,
      role: 'user',
      scopes: ['user.basic'],
    }
    if (deviceId) {
      connectOptions.deviceId = deviceId
    }

    connect(gatewayUrl, connectOptions).catch(err => {
      console.error('[App] 连接 Gateway 失败:', err)
    })
  }, [connect, settings.gateway.url])

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
        return <DashboardView displayName={user?.displayName || undefined} isConnected={isConnected} onViewChange={(view) => setActiveView(view as ViewType)} />
      case 'files':
        return <FilesView />
      case 'system':
        return <SystemView isConnected={isConnected} />
      case 'skills':
        return <SkillsView isConnected={isConnected} />
      case 'audit':
        return <AuditLogView isConnected={isConnected} />
      case 'subscription':
        return <SubscriptionView isConnected={isConnected} onViewChange={setActiveView} />
      case 'credits':
        return <CreditsView />
      case 'memories':
        return <MemoriesView />
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
