/**
 * AuthView - 用户认证视图
 *
 * 包含登录和注册表单的认证容器组件
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useVerificationCode } from '../hooks/useVerificationCode'
import './AuthView.css'

/**
 * 认证模式
 */
type AuthMode = 'login' | 'register'

/**
 * 登录方式
 */
type LoginMethod = 'password' | 'code'

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
    sendCode: sendAuthCode,
    register,
    login,
    clearError,
  } = useAuth()

  // 表单状态
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('code')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // 验证码倒计时
  const {
    isSending,
    countdown,
    canSend,
    error: codeError,
    sendCode: triggerSendCode,
  } = useVerificationCode(sendAuthCode)

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
   * 发送验证码
   */
  const handleSendCode = useCallback(async () => {
    setFormError(null)

    const identifierType = getIdentifierType()
    if (!identifierType) {
      setFormError('请输入有效的手机号或邮箱')
      return
    }

    const purpose = mode === 'register' ? 'register' : 'login'
    await triggerSendCode(identifier.trim(), identifierType, purpose)
  }, [identifier, mode, getIdentifierType, triggerSendCode])

  /**
   * 提交表单
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    const trimmedIdentifier = identifier.trim()

    // 表单验证
    if (!trimmedIdentifier) {
      setFormError('请输入手机号或邮箱')
      return
    }

    if (mode === 'register') {
      // 注册验证
      if (!code.trim()) {
        setFormError('请输入验证码')
        return
      }

      const identifierType = getIdentifierType()
      if (!identifierType) {
        setFormError('请输入有效的手机号或邮箱')
        return
      }

      const params = {
        [identifierType]: trimmedIdentifier,
        code: code.trim(),
        password: password || undefined,
        displayName: displayName.trim() || undefined,
      }

      const result = await register(params)
      if (result.success) {
        onAuthSuccess?.()
      }
    } else {
      // 登录验证
      if (loginMethod === 'code' && !code.trim()) {
        setFormError('请输入验证码')
        return
      }

      if (loginMethod === 'password' && !password) {
        setFormError('请输入密码')
        return
      }

      const params = {
        identifier: trimmedIdentifier,
        password: loginMethod === 'password' ? password : undefined,
        code: loginMethod === 'code' ? code.trim() : undefined,
      }

      const result = await login(params)
      if (result.success) {
        onAuthSuccess?.()
      }
    }
  }, [identifier, code, password, displayName, mode, loginMethod, getIdentifierType, register, login, clearError, onAuthSuccess])

  /**
   * 切换模式
   */
  const handleModeChange = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setFormError(null)
    clearError()
    setCode('')
    setPassword('')
    setDisplayName('')
  }, [clearError])

  /**
   * 切换登录方式
   */
  const handleLoginMethodChange = useCallback((method: LoginMethod) => {
    setLoginMethod(method)
    setFormError(null)
    clearError()
    setCode('')
    setPassword('')
  }, [clearError])

  // 错误信息
  const errorMessage = formError || authError || codeError

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

          {/* 登录方式切换（仅登录模式） */}
          {mode === 'login' && (
            <div className="login-method-switch">
              <button
                type="button"
                className={`method-btn ${loginMethod === 'code' ? 'active' : ''}`}
                onClick={() => handleLoginMethodChange('code')}
              >
                验证码登录
              </button>
              <button
                type="button"
                className={`method-btn ${loginMethod === 'password' ? 'active' : ''}`}
                onClick={() => handleLoginMethodChange('password')}
              >
                密码登录
              </button>
            </div>
          )}

          {/* 验证码输入（注册或验证码登录） */}
          {(mode === 'register' || loginMethod === 'code') && (
            <div className="form-group">
              <label className="form-label">验证码</label>
              <div className="code-input-group">
                <input
                  type="text"
                  className="form-input code-input"
                  placeholder="请输入验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={authLoading}
                />
                <button
                  type="button"
                  className="send-code-btn"
                  onClick={handleSendCode}
                  disabled={!canSend || authLoading || !identifier.trim()}
                >
                  {isSending ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                </button>
              </div>
            </div>
          )}

          {/* 密码输入 */}
          {(mode === 'register' || loginMethod === 'password') && (
            <div className="form-group">
              <label className="form-label">
                密码
                {mode === 'register' && <span className="optional-label">（可选）</span>}
              </label>
              <input
                type="password"
                className="form-input"
                placeholder={mode === 'register' ? '设置密码（可选）' : '请输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={authLoading}
              />
            </div>
          )}

          {/* 昵称输入（仅注册模式） */}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">
                昵称
                <span className="optional-label">（可选）</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="设置昵称（可选）"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={authLoading}
              />
            </div>
          )}

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
