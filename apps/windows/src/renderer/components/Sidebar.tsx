/**
 * Sidebar Component - 侧边栏
 *
 * 显示用户信息、连接状态、功能菜单和设置入口
 */

import React, { useState, useEffect } from 'react'
import type { User } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import './Sidebar.css'

/**
 * 视图类型
 */
type ViewType = 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'settings'

/**
 * 连接选项
 */
interface ConnectOptions {
  /** 认证 Token */
  token?: string
}

interface SidebarProps {
  isConnected: boolean
  onConnect: (url: string, options?: ConnectOptions) => void
  onDisconnect: () => void
  activeView?: ViewType
  onViewChange?: (view: ViewType) => void
  /** 当前用户信息 */
  user?: User | null
  /** 登出回调 */
  onLogout?: () => void
}

/**
 * 侧边栏组件
 */
export const Sidebar: React.FC<SidebarProps> = ({
  isConnected,
  onConnect,
  onDisconnect,
  activeView = 'chat',
  onViewChange,
  user,
  onLogout,
}) => {
  const { settings, isLoading } = useSettings()
  // 本地状态用于输入框编辑
  const [gatewayUrl, setGatewayUrl] = useState('')
  const [gatewayToken, setGatewayToken] = useState('')
  // 标记是否已经从设置初始化
  const [initialized, setInitialized] = useState(false)

  /**
   * 当设置加载完成后初始化，或设置变化时同步
   */
  useEffect(() => {
    if (!isLoading) {
      console.log('[Sidebar] 设置同步:', settings.gateway.url)
      setGatewayUrl(settings.gateway.url)
      setGatewayToken(settings.gateway.token || '')
      setInitialized(true)
    }
  }, [isLoading, settings.gateway.url, settings.gateway.token])

  /**
   * 处理连接/断开
   */
  const handleToggleConnection = () => {
    if (isConnected) {
      onDisconnect()
    } else {
      console.log('[Sidebar] 连接 Gateway:', gatewayUrl, gatewayToken ? '(带 Token)' : '(无 Token)')
      onConnect(gatewayUrl, gatewayToken ? { token: gatewayToken } : undefined)
    }
  }

  /**
   * 处理视图切换
   */
  const handleViewChange = (view: ViewType) => {
    console.log('[Sidebar] 切换视图:', view)
    onViewChange?.(view)
  }

  return (
    <div className="sidebar">
      {/* 连接状态区域 */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Gateway 连接</h3>

        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">{isConnected ? '已连接' : '未连接'}</span>
        </div>

        <input
          type="text"
          className="gateway-url-input"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="Gateway URL"
          disabled={isConnected}
        />

        <button
          className={`connection-button ${isConnected ? 'disconnect' : 'connect'}`}
          onClick={handleToggleConnection}
        >
          {isConnected ? '断开连接' : '连接'}
        </button>
      </div>

      {/* 功能菜单 */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">功能</h3>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => handleViewChange('chat')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 01-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 00.244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.52.263-1.639.742-3.468 1.105z" />
            </svg>
            <span>对话</span>
          </button>

          <button
            className={`nav-item ${activeView === 'files' ? 'active' : ''}`}
            onClick={() => handleViewChange('files')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1A1.5 1.5 0 000 2.5v11A1.5 1.5 0 001.5 15h6.086a1.5 1.5 0 001.06-.44l4.915-4.914A1.5 1.5 0 0014 8.586V2.5A1.5 1.5 0 0012.5 1h-11zM1 2.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5v6H9.5A1.5 1.5 0 008 10.5V14H1.5a.5.5 0 01-.5-.5v-11z" />
            </svg>
            <span>文件管理</span>
          </button>

          <button
            className={`nav-item ${activeView === 'system' ? 'active' : ''}`}
            onClick={() => handleViewChange('system')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H4.5a.5.5 0 010-1h3V3.5A.5.5 0 018 3z" />
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
            </svg>
            <span>系统监控</span>
          </button>

          <button
            className={`nav-item ${activeView === 'skills' ? 'active' : ''}`}
            onClick={() => handleViewChange('skills')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 1A1.5 1.5 0 005 2.5V3H1.5A1.5 1.5 0 000 4.5v8A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0014.5 3H11v-.5A1.5 1.5 0 009.5 1h-3zM6 2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V3H6v-.5z" />
            </svg>
            <span>技能管理</span>
          </button>

          <button
            className={`nav-item ${activeView === 'audit' ? 'active' : ''}`}
            onClick={() => handleViewChange('audit')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14.5 3a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h13zm-13-1A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0014.5 2h-13z"/>
              <path d="M3 5.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zM3 8a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9A.5.5 0 013 8zm0 2.5a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5z"/>
            </svg>
            <span>审计日志</span>
          </button>

          <button
            className={`nav-item ${activeView === 'subscription' ? 'active' : ''}`}
            onClick={() => handleViewChange('subscription')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9H5.5zm2.177-2.166c-.59-.137-.91-.416-.91-.836 0-.47.345-.822.915-.925v1.76h-.005zm.692 1.193c.717.166 1.048.435 1.048.91 0 .542-.412.914-1.135.982V8.518l.087.02z"/>
              <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
            </svg>
            <span>订阅管理</span>
          </button>
        </nav>
      </div>

      {/* 底部区域 */}
      <div className="sidebar-footer">
        {/* 用户信息 */}
        {user && (
          <div className="user-info">
            <div className="user-avatar">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName || '用户'} />
              ) : (
                <span className="avatar-placeholder">
                  {(user.displayName || user.phone || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="user-details">
              <span className="user-name">{user.displayName || user.phone || user.email || '用户'}</span>
              <span className="user-id">{user.phone || user.email}</span>
            </div>
            <button
              className="logout-button"
              onClick={onLogout}
              title="登出"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M10 12.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h8a.5.5 0 01.5.5v2a.5.5 0 001 0v-2A1.5 1.5 0 009.5 2h-8A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h8a1.5 1.5 0 001.5-1.5v-2a.5.5 0 00-1 0v2z"/>
                <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 000-.708l-3-3a.5.5 0 00-.708.708L14.293 7.5H5.5a.5.5 0 000 1h8.793l-2.147 2.146a.5.5 0 00.708.708l3-3z"/>
              </svg>
            </button>
          </div>
        )}

        <button
          className={`settings-button ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => handleViewChange('settings')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z" />
          </svg>
          <span>设置</span>
        </button>

        <div className="app-version">
          v0.1.0
        </div>
      </div>
    </div>
  )
}
