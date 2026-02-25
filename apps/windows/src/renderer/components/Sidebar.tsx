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
type ViewType = 'dashboard' | 'chat' | 'files' | 'system' | 'skills' | 'audit' | 'subscription' | 'credits' | 'settings' | 'devices' | 'memories'

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
  /**
   * 处理视图切换
   */
  const handleViewChange = (view: ViewType) => {
    console.log('[Sidebar] 切换视图:', view)
    onViewChange?.(view)
  }

  return (
    <div className="sidebar">
      {/* 功能菜单 */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">功能</h3>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleViewChange('dashboard')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6A.5.5 0 002 7.5V14a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1V7.5a.5.5 0 00.354-.854l-6-6zM13 7.207V14h-2.5v-3a1 1 0 00-1-1h-3a1 1 0 00-1 1v3H3V7.207l5-5 5 5z"/>
            </svg>
            <span>概览</span>
          </button>

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
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9H5.5zm2.177-2.166c-.59-.137-.91-.416-.91-.836 0-.47.345-.822.915-.925v1.76h-.005zm.692 1.193c.717.166 1.048.435 1.048.91 0 .542-.412.914-1.135.982V8.518l.087.02z"/>
              <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
            </svg>
            <span>订阅管理</span>
          </button>

          <button
            className={`nav-item ${activeView === 'credits' ? 'active' : ''}`}
            onClick={() => handleViewChange('credits')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 3a1 1 0 011-1h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3zm1 0v10h12V3H2z"/>
              <path d="M2 5.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z"/>
            </svg>
            <span>积分管理</span>
          </button>

          <button
            className={`nav-item ${activeView === 'memories' ? 'active' : ''}`}
            onClick={() => handleViewChange('memories')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a2.5 2.5 0 012.5 2.5V4h-5v-.5A2.5 2.5 0 018 1zm3.5 3v-.5a3.5 3.5 0 10-7 0V4H1v10a2 2 0 002 2h10a2 2 0 002-2V4h-3.5zM2 5h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V5z"/>
            </svg>
            <span>记忆管理</span>
          </button>

          <button
            className={`nav-item ${activeView === 'devices' ? 'active' : ''}`}
            onClick={() => handleViewChange('devices')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V2a1 1 0 011-1h6zM5 0a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V2a2 2 0 00-2-2H5z"/>
              <path d="M8 14a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            <span>设备管理</span>
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
