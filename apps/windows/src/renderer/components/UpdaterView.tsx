/**
 * UpdaterView Component - 更新管理视图
 *
 * 显示应用更新状态、下载进度和更新设置
 */

import React, { useState } from 'react'
import { useUpdater, UpdateStatus } from '../hooks/useUpdater'
import './UpdaterView.css'

interface UpdaterViewProps {
  /** 是否作为独立页面显示 */
  standalone?: boolean
}

/**
 * 更新管理视图组件
 */
export const UpdaterView: React.FC<UpdaterViewProps> = ({ standalone = false }) => {
  const {
    state,
    config,
    isLoading,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    updateConfig,
    formatBytes,
    formatSpeed,
    formatTime,
  } = useUpdater()

  const [showReleaseNotes, setShowReleaseNotes] = useState(false)

  /**
   * 获取状态显示文本
   */
  const getStatusText = (status: UpdateStatus): string => {
    const statusMap: Record<UpdateStatus, string> = {
      idle: '就绪',
      checking: '正在检查更新...',
      available: '发现新版本',
      'not-available': '已是最新版本',
      downloading: '正在下载...',
      downloaded: '下载完成，等待安装',
      error: '更新出错',
    }
    return statusMap[status]
  }

  /**
   * 获取状态图标
   */
  const getStatusIcon = (status: UpdateStatus): React.ReactNode => {
    switch (status) {
      case 'checking':
      case 'downloading':
        return (
          <svg className="status-icon spinning" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966a.25.25 0 010 .384L8.41 4.658A.25.25 0 018 4.466z" />
          </svg>
        )
      case 'available':
        return (
          <svg className="status-icon available" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z" />
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
          </svg>
        )
      case 'downloaded':
        return (
          <svg className="status-icon success" viewBox="0 0 16 16" fill="currentColor">
            <path d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-3.97-3.03a.75.75 0 00-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 00-1.06 1.06L6.97 11.03a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 00-.01-1.05z" />
          </svg>
        )
      case 'error':
        return (
          <svg className="status-icon error" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z" />
            <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0L7.1 4.995z" />
          </svg>
        )
      case 'not-available':
        return (
          <svg className="status-icon success" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.736 3.97a.733.733 0 011.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 01-1.065.02L3.217 8.384a.757.757 0 010-1.06.733.733 0 011.047 0l3.052 3.093 5.4-6.425a.247.247 0 01.02-.022z" />
          </svg>
        )
      default:
        return (
          <svg className="status-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z" />
          </svg>
        )
    }
  }

  /**
   * 渲染下载进度
   */
  const renderDownloadProgress = () => {
    if (state.status !== 'downloading') return null

    const progress = state.downloadProgress ?? 0
    const downloaded = state.downloadedBytes ? formatBytes(state.downloadedBytes) : '0 B'
    const total = state.totalBytes ? formatBytes(state.totalBytes) : '未知'
    const speed = state.downloadSpeed ? formatSpeed(state.downloadSpeed) : '计算中...'

    return (
      <div className="download-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-percent">{progress.toFixed(1)}%</span>
          <span className="progress-size">{downloaded} / {total}</span>
          <span className="progress-speed">{speed}</span>
        </div>
      </div>
    )
  }

  /**
   * 渲染操作按钮
   */
  const renderActions = () => {
    switch (state.status) {
      case 'idle':
      case 'not-available':
      case 'error':
        return (
          <button
            className="updater-button primary"
            onClick={checkForUpdates}
            disabled={isLoading}
          >
            {isLoading ? '检查中...' : '检查更新'}
          </button>
        )
      case 'available':
        return (
          <div className="action-buttons">
            <button className="updater-button primary" onClick={downloadUpdate}>
              下载更新
            </button>
            {state.releaseNotes && (
              <button
                className="updater-button secondary"
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
              >
                {showReleaseNotes ? '隐藏说明' : '查看说明'}
              </button>
            )}
          </div>
        )
      case 'downloaded':
        return (
          <button className="updater-button success" onClick={installUpdate}>
            立即安装并重启
          </button>
        )
      default:
        return null
    }
  }

  /**
   * 渲染版本信息
   */
  const renderVersionInfo = () => (
    <div className="version-info">
      <div className="version-row">
        <span className="version-label">当前版本</span>
        <span className="version-value">{state.currentVersion || '未知'}</span>
      </div>
      {state.availableVersion && (
        <div className="version-row">
          <span className="version-label">最新版本</span>
          <span className="version-value highlight">{state.availableVersion}</span>
        </div>
      )}
      {state.lastCheckTime && (
        <div className="version-row">
          <span className="version-label">上次检查</span>
          <span className="version-value">{formatTime(state.lastCheckTime)}</span>
        </div>
      )}
    </div>
  )

  /**
   * 渲染更新设置
   */
  const renderSettings = () => {
    if (!config) return null

    return (
      <div className="updater-settings">
        <h4 className="settings-title">更新设置</h4>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={config.autoCheck}
            onChange={(e) => updateConfig({ autoCheck: e.target.checked })}
          />
          <span>自动检查更新</span>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={config.autoDownload}
            onChange={(e) => updateConfig({ autoDownload: e.target.checked })}
          />
          <span>自动下载更新</span>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={config.allowPrerelease}
            onChange={(e) => updateConfig({ allowPrerelease: e.target.checked })}
          />
          <span>接收预发布版本</span>
        </label>
      </div>
    )
  }

  return (
    <div className={`updater-view ${standalone ? 'standalone' : ''}`}>
      {standalone && <h2 className="updater-title">软件更新</h2>}

      {/* 状态卡片 */}
      <div className={`status-card ${state.status}`}>
        <div className="status-header">
          {getStatusIcon(state.status)}
          <span className="status-text">{getStatusText(state.status)}</span>
        </div>

        {/* 错误信息 */}
        {state.status === 'error' && state.error && (
          <div className="error-message">{state.error}</div>
        )}

        {/* 下载进度 */}
        {renderDownloadProgress()}

        {/* 版本信息 */}
        {renderVersionInfo()}

        {/* 发布说明 */}
        {showReleaseNotes && state.releaseNotes && (
          <div className="release-notes">
            <h4>更新说明</h4>
            <div className="release-notes-content">{state.releaseNotes}</div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="actions">{renderActions()}</div>
      </div>

      {/* 更新设置 */}
      {standalone && renderSettings()}
    </div>
  )
}
