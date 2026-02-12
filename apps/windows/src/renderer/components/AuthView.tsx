/**
 * AuthView - 用户认证视图
 *
 * 包含登录和注册表单的认证容器组件。
 * 使用前端 SVG 图形验证码替代手机/邮箱验证码。
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCaptcha } from '../hooks/useCaptcha'
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

  // 表单状态
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

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
      </div>
    </div>
  )
}
