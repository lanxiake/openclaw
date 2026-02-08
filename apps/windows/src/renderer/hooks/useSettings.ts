/**
 * useSettings Hook - 设置管理
 *
 * 管理应用设置的自定义 Hook
 * 支持本地存储和跨组件同步
 */

import { useState, useEffect, useCallback } from 'react'

// 设置更新事件名
const SETTINGS_UPDATE_EVENT = 'openclaw-settings-update'

/**
 * Gateway 连接配置
 */
export interface GatewayConfig {
  /** Gateway URL */
  url: string
  /** 认证 Token */
  token?: string
  /** 是否自动连接 */
  autoConnect: boolean
  /** 重连间隔 (毫秒) */
  reconnectInterval: number
  /** 最大重连次数 */
  maxReconnectAttempts: number
}

/**
 * 外观主题配置
 */
export interface ThemeConfig {
  /** 主题模式 */
  mode: 'light' | 'dark' | 'system'
  /** 主色调 */
  primaryColor: string
  /** 字体大小 */
  fontSize: 'small' | 'medium' | 'large'
  /** 是否启用动画 */
  enableAnimations: boolean
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 是否启用通知 */
  enabled: boolean
  /** 是否启用声音 */
  soundEnabled: boolean
  /** 是否显示消息预览 */
  showPreview: boolean
  /** 桌面通知 */
  desktopNotification: boolean
}

/**
 * 隐私配置
 */
export interface PrivacyConfig {
  /** 是否发送使用统计 */
  sendUsageStats: boolean
  /** 是否保存聊天历史 */
  saveChatHistory: boolean
  /** 历史记录保留天数 */
  historyRetentionDays: number
}

/**
 * 快捷键配置
 */
export interface ShortcutConfig {
  /** 发送消息 */
  sendMessage: string
  /** 新建对话 */
  newChat: string
  /** 切换侧边栏 */
  toggleSidebar: string
  /** 打开设置 */
  openSettings: string
}

/**
 * 应用设置
 */
export interface AppSettings {
  /** Gateway 配置 */
  gateway: GatewayConfig
  /** 主题配置 */
  theme: ThemeConfig
  /** 通知配置 */
  notification: NotificationConfig
  /** 隐私配置 */
  privacy: PrivacyConfig
  /** 快捷键配置 */
  shortcuts: ShortcutConfig
  /** 语言 */
  language: 'zh-CN' | 'en-US'
  /** 启动时检查更新 */
  checkUpdateOnStartup: boolean
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: AppSettings = {
  gateway: {
    url: 'ws://localhost:18789',
    autoConnect: false,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  },
  theme: {
    mode: 'dark',
    primaryColor: '#6366f1',
    fontSize: 'medium',
    enableAnimations: true,
  },
  notification: {
    enabled: true,
    soundEnabled: true,
    showPreview: true,
    desktopNotification: true,
  },
  privacy: {
    sendUsageStats: false,
    saveChatHistory: true,
    historyRetentionDays: 30,
  },
  shortcuts: {
    sendMessage: 'Enter',
    newChat: 'Ctrl+N',
    toggleSidebar: 'Ctrl+B',
    openSettings: 'Ctrl+,',
  },
  language: 'zh-CN',
  checkUpdateOnStartup: true,
}

/**
 * 存储键
 */
const STORAGE_KEY = 'openclaw-assistant-settings'

interface UseSettingsReturn {
  /** 当前设置 */
  settings: AppSettings
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否有未保存的更改 */
  hasChanges: boolean
  /** 更新设置 */
  updateSettings: (partial: Partial<AppSettings>) => void
  /** 更新 Gateway 配置 */
  updateGateway: (config: Partial<GatewayConfig>) => void
  /** 更新主题配置 */
  updateTheme: (config: Partial<ThemeConfig>) => void
  /** 更新通知配置 */
  updateNotification: (config: Partial<NotificationConfig>) => void
  /** 更新隐私配置 */
  updatePrivacy: (config: Partial<PrivacyConfig>) => void
  /** 更新快捷键配置 */
  updateShortcuts: (config: Partial<ShortcutConfig>) => void
  /** 保存设置 */
  saveSettings: () => Promise<void>
  /** 重置为默认设置 */
  resetSettings: () => void
  /** 导出设置 */
  exportSettings: () => string
  /** 导入设置 */
  importSettings: (json: string) => boolean
}

/**
 * 设置管理 Hook
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 从 localStorage 加载设置
   */
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>
        // 深度合并设置，确保新增的配置项有默认值
        const merged = deepMerge(DEFAULT_SETTINGS, parsed)
        return merged
      }
    } catch (error) {
      console.error('[useSettings] 解析设置失败:', error)
    }
    return DEFAULT_SETTINGS
  }, [])

  /**
   * 初始加载设置
   */
  useEffect(() => {
    console.log('[useSettings] 加载设置')
    const loaded = loadFromStorage()
    setSettings(loaded)
    setSavedSettings(loaded)
    setIsLoading(false)
    console.log('[useSettings] 设置已加载')
  }, [loadFromStorage])

  /**
   * 监听其他组件的设置更新事件
   */
  useEffect(() => {
    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<AppSettings>
      console.log('[useSettings] 收到设置更新事件')
      setSettings(customEvent.detail)
      setSavedSettings(customEvent.detail)
    }

    window.addEventListener(SETTINGS_UPDATE_EVENT, handleSettingsUpdate)
    return () => {
      window.removeEventListener(SETTINGS_UPDATE_EVENT, handleSettingsUpdate)
    }
  }, [])

  /**
   * 检查是否有未保存的更改
   */
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  /**
   * 更新设置
   */
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  /**
   * 更新 Gateway 配置
   */
  const updateGateway = useCallback((config: Partial<GatewayConfig>) => {
    setSettings((prev) => ({
      ...prev,
      gateway: { ...prev.gateway, ...config },
    }))
  }, [])

  /**
   * 更新主题配置
   */
  const updateTheme = useCallback((config: Partial<ThemeConfig>) => {
    setSettings((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...config },
    }))
  }, [])

  /**
   * 更新通知配置
   */
  const updateNotification = useCallback((config: Partial<NotificationConfig>) => {
    setSettings((prev) => ({
      ...prev,
      notification: { ...prev.notification, ...config },
    }))
  }, [])

  /**
   * 更新隐私配置
   */
  const updatePrivacy = useCallback((config: Partial<PrivacyConfig>) => {
    setSettings((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, ...config },
    }))
  }, [])

  /**
   * 更新快捷键配置
   */
  const updateShortcuts = useCallback((config: Partial<ShortcutConfig>) => {
    setSettings((prev) => ({
      ...prev,
      shortcuts: { ...prev.shortcuts, ...config },
    }))
  }, [])

  /**
   * 保存设置
   */
  const saveSettings = useCallback(async () => {
    console.log('[useSettings] 保存设置')
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setSavedSettings(settings)

      // 触发设置更新事件，通知其他组件
      const event = new CustomEvent(SETTINGS_UPDATE_EVENT, { detail: settings })
      window.dispatchEvent(event)

      console.log('[useSettings] 设置已保存并广播')
    } catch (error) {
      console.error('[useSettings] 保存设置失败:', error)
      throw error
    }
  }, [settings])

  /**
   * 重置为默认设置
   */
  const resetSettings = useCallback(() => {
    console.log('[useSettings] 重置设置')
    setSettings(DEFAULT_SETTINGS)
  }, [])

  /**
   * 导出设置
   */
  const exportSettings = useCallback(() => {
    return JSON.stringify(settings, null, 2)
  }, [settings])

  /**
   * 导入设置
   */
  const importSettings = useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json) as Partial<AppSettings>
      const merged = deepMerge(DEFAULT_SETTINGS, imported)
      setSettings(merged)
      console.log('[useSettings] 设置已导入')
      return true
    } catch (error) {
      console.error('[useSettings] 导入设置失败:', error)
      return false
    }
  }, [])

  return {
    settings,
    isLoading,
    hasChanges,
    updateSettings,
    updateGateway,
    updateTheme,
    updateNotification,
    updatePrivacy,
    updateShortcuts,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
  }
}

/**
 * 深度合并对象
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as T

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = target[key as keyof T]
      const sourceValue = source[key as keyof T]

      if (
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue) &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as Partial<typeof targetValue>
        )
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue
      }
    }
  }

  return result
}
