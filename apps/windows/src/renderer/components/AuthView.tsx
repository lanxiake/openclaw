/**
 * AuthView - 用户认证视图
 *
 * 包含登录和注册表单的认证容器组件。
 * 使用前端 SVG 图形验证码替代手机/邮箱验证码。
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCaptcha } from '../hooks/useCaptcha'
import { useSettings } from '../hooks/useSettings'
import './AuthView.css'

/**
 * 认证模式
 */
type AuthMode = 'login' | 'register'

/**
 * AuthView 组件属性
 */
interface AuthViewProps {
  /** 认证成功回调 */
  onAuthSuccess?: () => void
}

/**
 * AuthView 组件
 */
export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  // 认证状态
  const {
    isLoading: authLoading,
    error: authError,
    register,
    login,
    clearError,
  } = useAuth()

  // 图形验证码
  const { svgHtml, validate: validateCaptcha, refresh: refreshCaptcha } = useCaptcha()

  // 网关设置
  const { settings, updateGateway } = useSettings()

  // 表单状态
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [showGatewayConfig, setShowGatewayConfig] = useState(false)
  const [gatewayUrl, setGatewayUrl] = useState(settings.gateway.url || 'ws://localhost:18789')
  const [gatewayTesting, setGatewayTesting] = useState(false)
  const [gatewayTestResult, setGatewayTestResult] = useState<'success' | 'error' | null>(null)

  /**
   * 判断输入是手机号还是邮箱
   */
  const getIdentifierType = useCallback((): 'phone' | 'email' | null => {
    const trimmed = identifier.trim()
    if (!trimmed) return null

    // 简单的手机号判断 (11 位数字)
    if (/^1[3-9]\d{9}$/.test(trimmed)) {
      return 'phone'
    }

    // 简单的邮箱判断
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'email'
    }

    return null
  }, [identifier])

  /**
   * 提交表单
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    const trimmedIdentifier = identifier.trim()

    // 基础验证
    if (!trimmedIdentifier) {
      setFormError('请输入手机号或邮箱')
      return
    }

    const identifierType = getIdentifierType()
    if (!identifierType) {
      setFormError('请输入有效的手机号或邮箱')
      return
    }

    // 图形验证码验证
    if (!captchaInput.trim()) {
      setFormError('请输入图形验证码')
      return
    }

    if (!validateCaptcha(captchaInput.trim())) {
      setFormError('图形验证码错误，请重新输入')
      setCaptchaInput('')
      return
    }

    if (mode === 'register') {
      // 注册验证
      if (!displayName.trim()) {
        setFormError('请输入昵称')
        return
      }

      if (!password) {
        setFormError('请设置密码')
        return
      }

      if (password.length < 6) {
        setFormError('密码长度至少 6 位')
        return
      }

      console.log('[AuthView] 提交注册:', { identifier: trimmedIdentifier, identifierType })

      const params = {
        [identifierType]: trimmedIdentifier,
        password,
        displayName: displayName.trim(),
      }

      const result = await register(params)
      if (result.success) {
        console.log('[AuthView] 注册成功')
        onAuthSuccess?.()
      } else {
        console.log('[AuthView] 注册失败:', result.error)
      }
    } else {
      // 登录验证
      if (!password) {
        setFormError('请输入密码')
        return
      }

      console.log('[AuthView] 提交登录:', { identifier: trimmedIdentifier })

      const result = await login({
        identifier: trimmedIdentifier,
        password,
      })

      if (result.success) {
        console.log('[AuthView] 登录成功')
        onAuthSuccess?.()
      } else {
        console.log('[AuthView] 登录失败:', result.error)
      }
    }
  }, [identifier, password, displayName, captchaInput, mode, getIdentifierType, validateCaptcha, register, login, clearError, onAuthSuccess])

  /**
   * 切换模式（登录/注册）
   */
  const handleModeChange = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setFormError(null)
    clearError()
    setPassword('')
    setDisplayName('')
    setCaptchaInput('')
    refreshCaptcha()
  }, [clearError, refreshCaptcha])

  /**
   * 测试网关连通性
   *
   * 先尝试 HTTP 请求（ws:// → http://），再尝试 WebSocket 连接。
   * Gateway 在同一端口同时处理 HTTP 和 WebSocket。
   */
  const testGatewayConnection = useCallback(async (url: string): Promise<boolean> => {
    console.log('[AuthView] 测试网关连通性:', url)

    // 将 ws:// 转换为 http:// 进行 HTTP 探测
    const httpUrl = url.replace(/^ws(s?):\/\//, 'http$1://')

    // 方式1: HTTP fetch 探测（更快更可靠）
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(httpUrl, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
      })
      clearTimeout(timer)
      // no-cors 模式下 response.type 为 'opaque'，status 为 0，但不会抛异常说明端口可达
      console.log('[AuthView] HTTP 探测成功, status:', response.status, 'type:', response.type)
      return true
    } catch (httpError) {
      console.log('[AuthView] HTTP 探测失败，尝试 WebSocket:', httpError)
    }

    // 方式2: 降级为 WebSocket 探测
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[AuthView] 网关连接超时')
        resolve(false)
      }, 5000)

      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          console.log('[AuthView] WebSocket 连接成功')
          clearTimeout(timeout)
          ws.close()
          resolve(true)
        }

        ws.onerror = () => {
          console.log('[AuthView] WebSocket 连接失败')
          clearTimeout(timeout)
          resolve(false)
        }

        ws.onclose = () => {
          clearTimeout(timeout)
        }
      } catch (error) {
        console.error('[AuthView] WebSocket 连接异常:', error)
        clearTimeout(timeout)
        resolve(false)
      }
    })
  }, [])

  /**
   * 直接将网关地址持久化到 localStorage 并同步 React state
   *
   * 绕过 useSettings 的 saveSettings，因为 updateGateway (setSettings) 是异步的，
   * 紧接着调用 saveSettings 会因为闭包捕获旧 settings 而保存过期数据。
   */
  const persistGatewayUrl = useCallback((url: string) => {
    const STORAGE_KEY = 'openclaw-assistant-settings'
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const current = raw ? JSON.parse(raw) : {}
      const updated = {
        ...current,
        gateway: { ...(current.gateway || {}), url },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      console.log('[AuthView] 网关地址已直接写入 localStorage:', url)

      // 同步 React state，让其他组件也能读到最新值
      updateGateway({ url })
    } catch (error) {
      console.error('[AuthView] 保存网关地址失败:', error)
    }
  }, [updateGateway])

  /**
   * 保存网关地址配置（带连通性测试）
   */
  const handleSaveGateway = useCallback(async () => {
    const trimmedUrl = gatewayUrl.trim()
    if (!trimmedUrl) {
      setFormError('请输入网关地址')
      return
    }

    // 验证 URL 格式
    if (!trimmedUrl.startsWith('ws://') && !trimmedUrl.startsWith('wss://')) {
      setFormError('网关地址必须以 ws:// 或 wss:// 开头')
      return
    }

    console.log('[AuthView] 测试并保存网关地址:', trimmedUrl)
    setGatewayTesting(true)
    setGatewayTestResult(null)
    setFormError(null)

    // 测试连通性
    const isReachable = await testGatewayConnection(trimmedUrl)

    // 无论连通与否都持久化，用户可能稍后启动网关
    persistGatewayUrl(trimmedUrl)

    if (isReachable) {
      setGatewayTestResult('success')
      console.log('[AuthView] 网关地址已保存，连接正常')
    } else {
      setGatewayTestResult('error')
      setFormError('无法连接到网关，请检查地址是否正确或网关是否已启动')
      console.log('[AuthView] 网关地址已保存（但连接失败）')
    }

    setGatewayTesting(false)
  }, [gatewayUrl, testGatewayConnection, persistGatewayUrl])

  // 错误信息
  const errorMessage = formError || authError

  return (
    <div className="auth-view">
      <div className="auth-container">
        {/* Logo 和标题 */}
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#3B82F6"/>
              <path d="M24 12C17.373 12 12 17.373 12 24C12 30.627 17.373 36 24 36C30.627 36 36 30.627 36 24C36 17.373 30.627 12 24 12ZM24 32C19.589 32 16 28.411 16 24C16 19.589 19.589 16 24 16C28.411 16 32 19.589 32 24C32 28.411 28.411 32 24 32Z" fill="white"/>
              <circle cx="24" cy="24" r="6" fill="white"/>
            </svg>
          </div>
          <h1 className="auth-title">OpenClaw</h1>
          <p className="auth-subtitle">智能助理客户端</p>
        </div>

        {/* 模式切换 Tab */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => handleModeChange('login')}
          >
            登录
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => handleModeChange('register')}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* 手机号/邮箱输入 */}
          <div className="form-group">
            <label className="form-label">手机号/邮箱</label>
            <input
              type="text"
              className="form-input"
              placeholder="请输入手机号或邮箱"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={authLoading}
            />
          </div>

          {/* 昵称输入（仅注册模式） */}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">昵称</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入昵称"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={authLoading}
              />
            </div>
          )}

          {/* 密码输入 */}
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              placeholder={mode === 'register' ? '请设置密码（至少 6 位）' : '请输入密码'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={authLoading}
            />
          </div>

          {/* 图形验证码 */}
          <div className="form-group">
            <label className="form-label">图形验证码</label>
            <div className="captcha-group">
              <input
                type="text"
                className="form-input captcha-input"
                placeholder="请输入验证码"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                maxLength={6}
                disabled={authLoading}
              />
              <button
                type="button"
                className="captcha-image"
                onClick={refreshCaptcha}
                title="点击刷新验证码"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            </div>
          </div>

          {/* 错误提示 */}
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            className="submit-btn"
            disabled={authLoading}
          >
            {authLoading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {/* 底部提示 */}
        <div className="auth-footer">
          {mode === 'login' ? (
            <p>
              还没有账号？
              <button
                type="button"
                className="link-btn"
                onClick={() => handleModeChange('register')}
              >
                立即注册
              </button>
            </p>
          ) : (
            <p>
              已有账号？
              <button
                type="button"
                className="link-btn"
                onClick={() => handleModeChange('login')}
              >
                立即登录
              </button>
            </p>
          )}
        </div>

        {/* 网关配置入口 */}
        <div className="gateway-config-section">
          <button
            type="button"
            className="gateway-toggle-btn"
            onClick={() => setShowGatewayConfig(!showGatewayConfig)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            网关配置
          </button>

          {showGatewayConfig && (
            <div className="gateway-config-panel">
              <label className="form-label">
                Gateway 地址
                <span className="optional-label">（登录前需配置正确地址）</span>
              </label>
              <div className="gateway-input-row">
                <input
                  type="text"
                  className="form-input gateway-url-input"
                  placeholder="如 ws://192.168.1.100:18789 或 wss://gw.example.com"
                  value={gatewayUrl}
                  onChange={(e) => {
                    setGatewayUrl(e.target.value)
                    setGatewayTestResult(null)
                  }}
                  disabled={gatewayTesting}
                />
                <button
                  type="button"
                  className={`gateway-save-btn ${gatewayTestResult === 'success' ? 'success' : gatewayTestResult === 'error' ? 'warning' : ''}`}
                  onClick={handleSaveGateway}
                  disabled={gatewayTesting}
                >
                  {gatewayTesting ? '测试中...' : gatewayTestResult === 'success' ? '已保存' : '测试并保存'}
                </button>
              </div>
              <span className={`gateway-hint ${gatewayTestResult === 'success' ? 'success' : gatewayTestResult === 'error' ? 'warning' : ''}`}>
                {gatewayTestResult === 'success'
                  ? '连接成功，配置已保存'
                  : gatewayTestResult === 'error'
                    ? '连接失败，配置已保存（请确保网关已启动）'
                    : `当前: ${settings.gateway.url || '未配置 (默认 ws://localhost:18789)'}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
