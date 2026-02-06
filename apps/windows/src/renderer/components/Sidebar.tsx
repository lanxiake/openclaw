/**
 * Sidebar Component - 侧边栏
 *
 * 显示连接状态、功能菜单和设置入口
 */

import React, { useState } from 'react'
import './Sidebar.css'

interface SidebarProps {
  isConnected: boolean
  onConnect: (url: string) => void
  onDisconnect: () => void
}

/**
 * 侧边栏组件
 */
export const Sidebar: React.FC<SidebarProps> = ({ isConnected, onConnect, onDisconnect }) => {
  const [gatewayUrl, setGatewayUrl] = useState('ws://localhost:18789')

  /**
   * 处理连接/断开
   */
  const handleToggleConnection = () => {
    if (isConnected) {
      onDisconnect()
    } else {
      onConnect(gatewayUrl)
    }
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
          <button className="nav-item active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
              <path d="M8 4a1 1 0 011 1v3h2a1 1 0 110 2H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
            <span>对话</span>
          </button>

          <button className="nav-item" disabled={!isConnected}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1A1.5 1.5 0 000 2.5v11A1.5 1.5 0 001.5 15h6.086a1.5 1.5 0 001.06-.44l4.915-4.914A1.5 1.5 0 0014 8.586V2.5A1.5 1.5 0 0012.5 1h-11zM1 2.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5v6H9.5A1.5 1.5 0 008 10.5V14H1.5a.5.5 0 01-.5-.5v-11z" />
            </svg>
            <span>文件管理</span>
          </button>

          <button className="nav-item" disabled={!isConnected}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H4.5a.5.5 0 010-1h3V3.5A.5.5 0 018 3z" />
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
            </svg>
            <span>系统监控</span>
          </button>

          <button className="nav-item" disabled={!isConnected}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 1A1.5 1.5 0 005 2.5V3H1.5A1.5 1.5 0 000 4.5v8A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0014.5 3H11v-.5A1.5 1.5 0 009.5 1h-3zM6 2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V3H6v-.5z" />
            </svg>
            <span>技能商店</span>
          </button>
        </nav>
      </div>

      {/* 底部区域 */}
      <div className="sidebar-footer">
        <button className="settings-button">
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
