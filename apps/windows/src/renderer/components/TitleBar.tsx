/**
 * TitleBar Component - 自定义标题栏
 *
 * 无边框窗口的自定义标题栏，包含拖拽区域和窗口控制按钮
 */

import React from 'react'
import './TitleBar.css'

interface TitleBarProps {
  isConnected: boolean
  onToggleSidebar: () => void
}

/**
 * 标题栏组件
 */
export const TitleBar: React.FC<TitleBarProps> = ({ isConnected, onToggleSidebar }) => {
  /**
   * 最小化窗口
   */
  const handleMinimize = () => {
    window.electronAPI.window.minimize()
  }

  /**
   * 最大化/还原窗口
   */
  const handleMaximize = () => {
    window.electronAPI.window.maximize()
  }

  /**
   * 关闭窗口
   */
  const handleClose = () => {
    window.electronAPI.window.close()
  }

  return (
    <div className="title-bar">
      {/* 左侧区域 */}
      <div className="title-bar-left">
        <button
          className="title-bar-button menu-button"
          onClick={onToggleSidebar}
          title="切换侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1.5H2V3zm0 4.5h12V9H2V7.5zm0 4.5h12v1.5H2V12z" />
          </svg>
        </button>

        <div className="title-bar-title">
          <span className="app-name">OpenClaw Assistant</span>
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        </div>
      </div>

      {/* 可拖拽区域 */}
      <div className="title-bar-drag-region" />

      {/* 窗口控制按钮 */}
      <div className="title-bar-controls">
        <button
          className="title-bar-button"
          onClick={handleMinimize}
          title="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M0 5h10v1H0z" />
          </svg>
        </button>

        <button
          className="title-bar-button"
          onClick={handleMaximize}
          title="最大化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M0 0v10h10V0H0zm1 1h8v8H1V1z" />
          </svg>
        </button>

        <button
          className="title-bar-button close-button"
          onClick={handleClose}
          title="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1.41 0L5 3.59 8.59 0 10 1.41 6.41 5 10 8.59 8.59 10 5 6.41 1.41 10 0 8.59 3.59 5 0 1.41z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
