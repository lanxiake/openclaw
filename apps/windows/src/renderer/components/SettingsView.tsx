/**
 * SettingsView Component - 设置视图
 *
 * 应用设置页面，包含 Gateway 配置、主题、通知、隐私等设置
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSettings, type AppSettings } from '../hooks/useSettings'
import { UpdaterView } from './UpdaterView'
import './SettingsView.css'

interface SettingsViewProps {
  isConnected: boolean
  isConnecting?: boolean
  connectionError?: string | null
  onConnect?: (url: string, options?: { token?: string }) => void
  onDisconnect?: () => void
  onClose?: () => void
}

/**
 * 设置分类
 */
type SettingsCategory = 'gateway' | 'theme' | 'notification' | 'privacy' | 'shortcuts' | 'update' | 'about'

/**
 * 分类配置
 */
const CATEGORIES: Array<{ id: SettingsCategory; label: string; icon: string }> = [
  { id: 'gateway', label: 'Gateway 连接', icon: '🔗' },
  { id: 'theme', label: '外观主题', icon: '🎨' },
  { id: 'notification', label: '通知设置', icon: '🔔' },
  { id: 'privacy', label: '隐私安全', icon: '🔒' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { id: 'update', label: '软件更新', icon: '🔄' },
  { id: 'about', label: '关于', icon: 'ℹ️' },
]

/**
 * 主题颜色选项
 */
const PRIMARY_COLORS = [
  { value: '#6366f1', label: '靛蓝' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#ec4899', label: '粉色' },
  { value: '#ef4444', label: '红色' },
  { value: '#f97316', label: '橙色' },
  { value: '#eab308', label: '黄色' },
  { value: '#22c55e', label: '绿色' },
  { value: '#14b8a6', label: '青色' },
  { value: '#0ea5e9', label: '蓝色' },
]

/**
 * 设置视图组件
 */
export const SettingsView: React.FC<SettingsViewProps> = ({ isConnected, isConnecting, connectionError, onConnect, onDisconnect, onClose }) => {
  const {
    settings,
    isLoading,
    hasChanges,
    updateGateway,
    updateTheme,
    updateNotification,
    updatePrivacy,
    updateShortcuts,
    updateSettings,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
  } = useSettings()

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('gateway')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [appVersion, setAppVersion] = useState<string>('0.1.0')

  /** 测试连接状态 */
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle')
  const [testLatency, setTestLatency] = useState<number | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  /** 设备 Token 加载状态 */
  const [deviceTokenLoading, setDeviceTokenLoading] = useState(false)

  /**
   * 获取应用版本
   */
  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion)
  }, [])

  /**
   * 保存设置
   */
  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await saveSettings()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  /**
   * 重置设置
   */
  const handleReset = () => {
    if (window.confirm('确定要重置所有设置为默认值吗？')) {
      resetSettings()
    }
  }

  /**
   * 导出设置
   */
  const handleExport = async () => {
    const json = exportSettings()
    try {
      await window.electronAPI.clipboard.writeText(json)
      alert('设置已复制到剪贴板')
    } catch {
      alert('导出失败')
    }
  }

  /**
   * 导入设置
   */
  const handleImport = async () => {
    try {
      const json = await window.electronAPI.clipboard.readText()
      if (importSettings(json)) {
        alert('设置已导入')
      } else {
        alert('导入失败：无效的设置数据')
      }
    } catch {
      alert('导入失败')
    }
  }

  /**
   * 处理连接/断开 Gateway
   */
  const handleToggleConnection = () => {
    if (isConnected) {
      onDisconnect?.()
    } else {
      const token = settings.gateway.token || undefined
      onConnect?.(settings.gateway.url, token ? { token } : undefined)
    }
  }

  /**
   * 测试 Gateway 连接（通过临时 WebSocket ping 测量延迟）
   */
  const handleTestConnection = useCallback(async () => {
    console.log('[SettingsView] 开始测试 Gateway 连接:', settings.gateway.url)
    setTestStatus('testing')
    setTestLatency(null)
    setTestError(null)

    const start = Date.now()
    try {
      // 利用主进程 gateway.connect 测试连通性（如已连接则直接视为成功）
      if (isConnected) {
        setTestLatency(0)
        setTestStatus('success')
        console.log('[SettingsView] 当前已连接，测试成功')
        return
      }

      const token = settings.gateway.token || undefined
      await onConnect?.(settings.gateway.url, token ? { token } : undefined)

      const latency = Date.now() - start
      setTestLatency(latency)
      setTestStatus('success')
      console.log('[SettingsView] 连接测试成功，延迟:', latency, 'ms')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '连接失败'
      setTestError(errMsg)
      setTestStatus('fail')
      console.error('[SettingsView] 连接测试失败:', errMsg)
    }
  }, [isConnected, settings.gateway.url, settings.gateway.token, onConnect])

  /**
   * 使用设备专属 Token 填充 Gateway Token
   */
  const handleUseDeviceToken = useCallback(async () => {
    console.log('[SettingsView] 获取设备 Token')
    setDeviceTokenLoading(true)
    try {
      const pairingState = await window.electronAPI.pairing.getStatus()
      if (pairingState?.token) {
        updateGateway({ token: pairingState.token })
        console.log('[SettingsView] 已填入设备 Token')
      } else {
        alert('设备尚未配对或无可用 Token，请先完成设备配对')
        console.warn('[SettingsView] 设备未配对，无法获取 Token')
      }
    } catch (err) {
      console.error('[SettingsView] 获取设备 Token 失败:', err)
      alert('获取设备 Token 失败')
    } finally {
      setDeviceTokenLoading(false)
    }
  }, [updateGateway])

  /**
   * 渲染 Gateway 设置
   */
  const renderGatewaySettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">Gateway 连接配置</h3>

      {/* 连接状态卡片 */}
      <div className="connection-status-card">
        <div className="status-info">
          <span className={`status-indicator ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`} />
          <div className="status-details">
            <span className="status-text">
              {isConnected ? '已连接到 Gateway' : isConnecting ? '连接中...' : '未连接'}
            </span>
            {connectionError && !isConnected && (
              <span className="status-error">{connectionError}</span>
            )}
          </div>
        </div>
        <div className="connection-actions">
          <button
            className="connection-test-btn"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || isConnecting}
            title="测试当前配置的连接是否可达"
          >
            {testStatus === 'testing' ? '测试中...' : '测试连接'}
          </button>
          <button
            className={`connection-toggle-btn ${isConnected ? 'disconnect' : 'connect'}`}
            onClick={handleToggleConnection}
            disabled={isConnecting}
          >
            {isConnecting ? '连接中...' : isConnected ? '断开连接' : '连接'}
          </button>
        </div>
      </div>

      {/* 测试结果 */}
      {testStatus !== 'idle' && (
        <div className={`test-result ${testStatus}`}>
          {testStatus === 'testing' && <span>⏳ 正在测试连接...</span>}
          {testStatus === 'success' && (
            <span>
              ✅ 连接成功
              {testLatency !== null && testLatency > 0 && `，延迟 ${testLatency}ms`}
              {testLatency === 0 && '（当前已连接）'}
            </span>
          )}
          {testStatus === 'fail' && (
            <span>❌ 连接失败：{testError}</span>
          )}
        </div>
      )}

      <div className="settings-group">
        <div className="setting-item">
          <label className="setting-label">Gateway 地址</label>
          <input
            type="text"
            className="setting-input"
            value={settings.gateway.url}
            onChange={(e) => updateGateway({ url: e.target.value })}
            placeholder="ws://192.168.1.100:18789"
          />
          <span className="setting-hint">IP 直连需带端口，如 ws://192.168.1.100:18789；域名无需端口，如 wss://gw.example.com</span>
        </div>

        <div className="setting-item">
          <label className="setting-label">认证 Token (可选)</label>
          <div className="token-input-row">
            <input
              type="password"
              className="setting-input"
              value={settings.gateway.token || ''}
              onChange={(e) => updateGateway({ token: e.target.value || undefined })}
              placeholder="留空则不使用认证"
            />
            <button
              className="device-token-btn"
              onClick={handleUseDeviceToken}
              disabled={deviceTokenLoading}
              title="从已配对设备中自动填入专属 Token"
            >
              {deviceTokenLoading ? '获取中...' : '使用设备 Token'}
            </button>
          </div>
          <span className="setting-hint">
            用于 Gateway 认证的 Token，可点击「使用设备 Token」自动填入已配对设备的专属 Token
          </span>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.gateway.autoConnect}
              onChange={(e) => updateGateway({ autoConnect: e.target.checked })}
            />
            <span>启动时自动连接</span>
          </label>
        </div>
      </div>

      <h4 className="settings-subsection-title">重连设置</h4>

      <div className="settings-group">
        <div className="setting-item">
          <label className="setting-label">重连间隔</label>
          <div className="setting-input-with-unit">
            <input
              type="number"
              className="setting-input"
              value={settings.gateway.reconnectInterval / 1000}
              onChange={(e) =>
                updateGateway({ reconnectInterval: Number(e.target.value) * 1000 })
              }
              min={1}
              max={60}
            />
            <span className="setting-unit">秒</span>
          </div>
        </div>

        <div className="setting-item">
          <label className="setting-label">最大重连次数</label>
          <input
            type="number"
            className="setting-input"
            value={settings.gateway.maxReconnectAttempts}
            onChange={(e) =>
              updateGateway({ maxReconnectAttempts: Number(e.target.value) })
            }
            min={1}
            max={100}
          />
        </div>
      </div>
    </div>
  )

  /**
   * 渲染主题设置
   */
  const renderThemeSettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">外观主题</h3>

      <div className="settings-group">
        <div className="setting-item">
          <label className="setting-label">主题模式</label>
          <select
            className="setting-select"
            value={settings.theme.mode}
            onChange={(e) =>
              updateTheme({ mode: e.target.value as 'light' | 'dark' | 'system' })
            }
          >
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div className="setting-item">
          <label className="setting-label">主色调</label>
          <div className="color-picker">
            {PRIMARY_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-option ${settings.theme.primaryColor === color.value ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => updateTheme({ primaryColor: color.value })}
                title={color.label}
              />
            ))}
          </div>
        </div>

        <div className="setting-item">
          <label className="setting-label">字体大小</label>
          <select
            className="setting-select"
            value={settings.theme.fontSize}
            onChange={(e) =>
              updateTheme({ fontSize: e.target.value as 'small' | 'medium' | 'large' })
            }
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.theme.enableAnimations}
              onChange={(e) => updateTheme({ enableAnimations: e.target.checked })}
            />
            <span>启用动画效果</span>
          </label>
        </div>
      </div>
    </div>
  )

  /**
   * 渲染通知设置
   */
  const renderNotificationSettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">通知设置</h3>

      <div className="settings-group">
        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.notification.enabled}
              onChange={(e) => updateNotification({ enabled: e.target.checked })}
            />
            <span>启用通知</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.notification.soundEnabled}
              onChange={(e) => updateNotification({ soundEnabled: e.target.checked })}
              disabled={!settings.notification.enabled}
            />
            <span>启用通知声音</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.notification.showPreview}
              onChange={(e) => updateNotification({ showPreview: e.target.checked })}
              disabled={!settings.notification.enabled}
            />
            <span>显示消息预览</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.notification.desktopNotification}
              onChange={(e) => updateNotification({ desktopNotification: e.target.checked })}
              disabled={!settings.notification.enabled}
            />
            <span>桌面通知</span>
          </label>
        </div>
      </div>
    </div>
  )

  /**
   * 渲染隐私设置
   */
  const renderPrivacySettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">隐私与安全</h3>

      <div className="settings-group">
        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.privacy.saveChatHistory}
              onChange={(e) => updatePrivacy({ saveChatHistory: e.target.checked })}
            />
            <span>保存聊天历史</span>
          </label>
          <span className="setting-hint">关闭后将不会在本地保存聊天记录</span>
        </div>

        {settings.privacy.saveChatHistory && (
          <div className="setting-item">
            <label className="setting-label">历史记录保留天数</label>
            <div className="setting-input-with-unit">
              <input
                type="number"
                className="setting-input"
                value={settings.privacy.historyRetentionDays}
                onChange={(e) =>
                  updatePrivacy({ historyRetentionDays: Number(e.target.value) })
                }
                min={1}
                max={365}
              />
              <span className="setting-unit">天</span>
            </div>
          </div>
        )}

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.privacy.sendUsageStats}
              onChange={(e) => updatePrivacy({ sendUsageStats: e.target.checked })}
            />
            <span>发送匿名使用统计</span>
          </label>
          <span className="setting-hint">帮助我们改进产品体验</span>
        </div>
      </div>

      <h4 className="settings-subsection-title">数据管理</h4>

      <div className="settings-group">
        <div className="setting-actions">
          <button className="setting-action-btn" onClick={handleExport}>
            📤 导出设置
          </button>
          <button className="setting-action-btn" onClick={handleImport}>
            📥 导入设置
          </button>
          <button className="setting-action-btn danger" onClick={handleReset}>
            🗑️ 重置设置
          </button>
        </div>
      </div>
    </div>
  )

  /**
   * 渲染快捷键设置
   */
  const renderShortcutsSettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">快捷键</h3>

      <div className="settings-group">
        <div className="shortcut-item">
          <span className="shortcut-label">发送消息</span>
          <kbd className="shortcut-key">{settings.shortcuts.sendMessage}</kbd>
        </div>

        <div className="shortcut-item">
          <span className="shortcut-label">新建对话</span>
          <kbd className="shortcut-key">{settings.shortcuts.newChat}</kbd>
        </div>

        <div className="shortcut-item">
          <span className="shortcut-label">切换侧边栏</span>
          <kbd className="shortcut-key">{settings.shortcuts.toggleSidebar}</kbd>
        </div>

        <div className="shortcut-item">
          <span className="shortcut-label">打开设置</span>
          <kbd className="shortcut-key">{settings.shortcuts.openSettings}</kbd>
        </div>
      </div>

      <p className="settings-note">
        快捷键自定义功能将在后续版本中提供
      </p>
    </div>
  )

  /**
   * 渲染更新设置
   */
  const renderUpdateSettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">软件更新</h3>
      <UpdaterView standalone />
    </div>
  )

  /**
   * 渲染关于页面
   */
  const renderAboutSettings = () => (
    <div className="settings-section">
      <h3 className="settings-section-title">关于 OpenClaw Assistant</h3>

      <div className="about-content">
        <div className="about-logo">🦞</div>
        <h2 className="about-name">OpenClaw Assistant</h2>
        <p className="about-version">版本 {appVersion}</p>

        <div className="about-info">
          <div className="about-item">
            <span className="about-label">官方网站</span>
            <button
              className="about-link"
              onClick={() => window.electronAPI.app.openExternal('https://openclaw.ai')}
            >
              openclaw.ai
            </button>
          </div>

          <div className="about-item">
            <span className="about-label">GitHub</span>
            <button
              className="about-link"
              onClick={() =>
                window.electronAPI.app.openExternal('https://github.com/openclaw/openclaw')
              }
            >
              github.com/openclaw/openclaw
            </button>
          </div>

          <div className="about-item">
            <span className="about-label">问题反馈</span>
            <button
              className="about-link"
              onClick={() =>
                window.electronAPI.app.openExternal('https://github.com/openclaw/openclaw/issues')
              }
            >
              提交 Issue
            </button>
          </div>
        </div>

        <div className="about-description">
          <p>
            OpenClaw 是一个开源的 AI 个人助理平台，让你能够在自己的设备上运行智能助理，
            管理文件、执行任务、连接各种服务。
          </p>
        </div>

        <div className="about-footer">
          <p>© 2024-2026 OpenClaw Team</p>
          <p>基于 MIT 许可证开源</p>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.checkUpdateOnStartup}
              onChange={(e) => updateSettings({ checkUpdateOnStartup: e.target.checked })}
            />
            <span>启动时检查更新</span>
          </label>
        </div>
      </div>
    </div>
  )

  /**
   * 渲染当前分类内容
   */
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'gateway':
        return renderGatewaySettings()
      case 'theme':
        return renderThemeSettings()
      case 'notification':
        return renderNotificationSettings()
      case 'privacy':
        return renderPrivacySettings()
      case 'shortcuts':
        return renderShortcutsSettings()
      case 'update':
        return renderUpdateSettings()
      case 'about':
        return renderAboutSettings()
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="settings-view loading">
        <span className="spinner">⏳</span>
        <p>加载设置中...</p>
      </div>
    )
  }

  return (
    <div className="settings-view">
      {/* 设置头部 */}
      <div className="settings-header">
        <h2>设置</h2>
        {onClose && (
          <button className="settings-close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* 主体内容 */}
      <div className="settings-body">
        {/* 分类导航 */}
        <nav className="settings-nav">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`settings-nav-item ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="nav-icon">{category.icon}</span>
              <span className="nav-label">{category.label}</span>
            </button>
          ))}
        </nav>

        {/* 设置内容 */}
        <div className="settings-content">{renderCategoryContent()}</div>
      </div>

      {/* 底部操作栏 */}
      <div className="settings-footer">
        {hasChanges && <span className="unsaved-hint">有未保存的更改</span>}
        <div className="footer-actions">
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={!hasChanges || saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? '保存中...'
              : saveStatus === 'saved'
                ? '✓ 已保存'
                : saveStatus === 'error'
                  ? '保存失败'
                  : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}
