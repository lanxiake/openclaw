/**
 * AuthView - 用户认证视图
 *
 * 包含登录和注册表单的认证容器组件。
 * 使用服务端滑动验证码 + RSA 密码加密。
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useServerCaptcha } from '../hooks/useServerCaptcha'
import { useSettings } from '../hooks/useSettings'
import { SlidingCaptcha } from './SlidingCaptcha'
import { encryptPassword } from '../utils/rsa-encrypt'
import './AuthView.css'
import './SlidingCaptcha.css'

// localStorage keys
const STORAGE_KEYS = {
  REMEMBER_PASSWORD: 'mtbot_remember_password',
  SAVED_IDENTIFIER: 'mtbot_saved_identifier',
  SAVED_PASSWORD: 'mtbot_saved_password',
}

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

  // 服务端滑动验证码
  const captcha = useServerCaptcha()

  // 网关设置
  const { settings, updateGateway } = useSettings()

  // 表单状态
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [rememberIdentifier, setRememberIdentifier] = useState(false)
  const [showGatewayConfig, setShowGatewayConfig] = useState(false)
  const [gatewayUrl, setGatewayUrl] = useState(settings.gateway.url || 'ws://localhost:18789')
  const [gatewayTesting, setGatewayTesting] = useState(false)
  const [gatewayTestResult, setGatewayTestResult] = useState<'success' | 'error' | null>(null)

  // RSA 公钥
  const [publicKey, setPublicKey] = useState<string | null>(null)

  /**
   * 初始化：加载保存的账号、获取验证码和公钥
   */
  useEffect(() => {
    // 加载记住的账号
    const rememberEnabled = localStorage.getItem(STORAGE_KEYS.REMEMBER_IDENTIFIER) === 'true'
    if (rememberEnabled) {
      const savedIdentifier = localStorage.getItem(STORAGE_KEYS.SAVED_IDENTIFIER)
      if (savedIdentifier) {
        setIdentifier(savedIdentifier)
      }
      setRememberIdentifier(true)
    }

    // 获取验证码
    captcha.fetchChallenge()

    // 获取 RSA 公钥
    window.electronAPI.api.getPublicKey().then((res: unknown) => {
      const result = res as { success: boolean; data?: { publicKey: string } }
      if (result.success && result.data?.publicKey) {
        setPublicKey(result.data.publicKey)
      }
    }).catch(() => {
      // 公钥获取失败，降级为明文传输
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 判断输入是手机号还是邮箱
   */
  const getIdentifierType = useCallback((): 'phone' | 'email' | null => {
    const trimmed = identifier.trim()
    if (!trimmed) return null

    if (/^1[3-9]\d{9}$/.test(trimmed)) {
      return 'phone'
    }

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

    // 滑动验证码验证
    if (!captcha.captchaToken) {
      setFormError('请先完成滑动验证')
      return
    }

    // RSA 加密密码
    let encryptedPassword = password
    if (publicKey && password) {
      try {
        encryptedPassword = await encryptPassword(password, publicKey)
      } catch {
        // 加密失败，降级为明文
      }
    }

    if (mode === 'register') {
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

      const params = {
        [identifierType]: trimmedIdentifier,
        password: encryptedPassword,
        displayName: displayName.trim(),
        captchaToken: captcha.captchaToken,
      }

      const result = await register(params)
      if (result.success) {
        setFormError(null)
        alert('注册成功！正在登录...')
        onAuthSuccess?.()
      } else {
        setFormError(result.error || '注册失败，请重试')
        captcha.refresh()
      }
    } else {
      if (!password) {
        setFormError('请输入密码')
        return
      }

      const result = await login({
        identifier: trimmedIdentifier,
        password: encryptedPassword,
        captchaToken: captcha.captchaToken,
      })

      if (result.success) {
        setFormError(null)

        // 保存或清除记住的账号
        if (rememberIdentifier) {
          localStorage.setItem(STORAGE_KEYS.REMEMBER_IDENTIFIER, 'true')
          localStorage.setItem(STORAGE_KEYS.SAVED_IDENTIFIER, trimmedIdentifier)
        } else {
          localStorage.removeItem(STORAGE_KEYS.REMEMBER_IDENTIFIER)
          localStorage.removeItem(STORAGE_KEYS.SAVED_IDENTIFIER)
        }

        alert('登录成功！')
        onAuthSuccess?.()
      } else {
        setFormError(result.error || '登录失败，请检查用户名和密码')
        captcha.refresh()
      }
    }
  }, [identifier, password, displayName, mode, getIdentifierType, captcha, publicKey, register, login, clearError, onAuthSuccess, rememberIdentifier])

  /**
   * 切换模式（登录/注册）
   */
  const handleModeChange = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setFormError(null)
    clearError()
    setPassword('')
    setDisplayName('')
    captcha.refresh()
  }, [clearError, captcha])

  /**
   * 测试网关连通性
   */
  const testGatewayConnection = useCallback(async (url: string): Promise<boolean> => {
    const httpUrl = url.replace(/^ws(s?):\/\//, 'http$1://')

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(httpUrl, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
      })
      clearTimeout(timer)
      return true
    } catch {
      // HTTP 探测失败，尝试 WebSocket
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000)

      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          clearTimeout(timeout)
          ws.close()
          resolve(true)
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }

        ws.onclose = () => {
          clearTimeout(timeout)
        }
      } catch {
        clearTimeout(timeout)
        resolve(false)
      }
    })
  }, [])

  /**
   * 持久化网关地址
   */
  const persistGatewayUrl = useCallback((url: string) => {
    const STORAGE_KEY = 'mtbot-assistant-settings'
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const current = raw ? JSON.parse(raw) : {}
      const updated = {
        ...current,
        gateway: { ...(current.gateway || {}), url },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      updateGateway({ url })
    } catch {
      // ignore
    }
  }, [updateGateway])

  /**
   * 保存网关地址配置
   */
  const handleSaveGateway = useCallback(async () => {
    const trimmedUrl = gatewayUrl.trim()
    if (!trimmedUrl) {
      setFormError('请输入网关地址')
      return
    }

    if (!trimmedUrl.startsWith('ws://') && !trimmedUrl.startsWith('wss://')) {
      setFormError('网关地址必须以 ws:// 或 wss:// 开头')
      return
    }

    setGatewayTesting(true)
    setGatewayTestResult(null)
    setFormError(null)

    const isReachable = await testGatewayConnection(trimmedUrl)
    persistGatewayUrl(trimmedUrl)

    if (isReachable) {
      setGatewayTestResult('success')
    } else {
      setGatewayTestResult('error')
      setFormError('无法连接到网关，请检查地址是否正确或网关是否已启动')
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
          <h1 className="auth-title">MtBot</h1>
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

          {/* 记住账号（仅登录模式） */}
          {mode === 'login' && (
            <div className="form-group remember-password-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberIdentifier}
                  onChange={(e) => setRememberIdentifier(e.target.checked)}
                  disabled={authLoading}
                />
                <span>记住账号</span>
              </label>
            </div>
          )}

          {/* 滑动验证码 */}
          <div className="form-group">
            <label className="form-label">安全验证</label>
            <SlidingCaptcha
              backgroundImage={captcha.challenge?.backgroundImage ?? null}
              sliderImage={captcha.challenge?.sliderImage ?? null}
              sliderY={captcha.challenge?.sliderY ?? 0}
              isVerified={captcha.isVerified}
              isLoading={captcha.isLoading}
              error={captcha.error}
              onVerify={captcha.verify}
              onRefresh={captcha.refresh}
            />
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
            disabled={authLoading || !captcha.isVerified}
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
