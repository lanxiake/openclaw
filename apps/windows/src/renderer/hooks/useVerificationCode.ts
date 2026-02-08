/**
 * useVerificationCode Hook - 验证码发送和倒计时管理
 *
 * 管理验证码发送、倒计时、重发逻辑
 */

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * 验证码 Hook 返回值
 */
export interface UseVerificationCodeReturn {
  /** 是否正在发送 */
  isSending: boolean
  /** 剩余倒计时秒数 (0 表示可以重发) */
  countdown: number
  /** 是否可以发送 */
  canSend: boolean
  /** 错误信息 */
  error: string | null
  /** 发送验证码 */
  sendCode: (target: string, targetType: 'phone' | 'email', purpose: 'register' | 'login' | 'reset_password') => Promise<boolean>
  /** 重置状态 */
  reset: () => void
}

/**
 * 默认倒计时秒数
 */
const DEFAULT_COUNTDOWN = 60

/**
 * useVerificationCode Hook
 *
 * @param onSend - 发送验证码的回调函数，返回 Promise<{ success: boolean; error?: string }>
 * @param countdownSeconds - 倒计时秒数，默认 60
 */
export function useVerificationCode(
  onSend: (target: string, targetType: 'phone' | 'email', purpose: 'register' | 'login' | 'reset_password') => Promise<{ success: boolean; error?: string }>,
  countdownSeconds = DEFAULT_COUNTDOWN
): UseVerificationCodeReturn {
  const [isSending, setIsSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 清除定时器
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /**
   * 开始倒计时
   */
  const startCountdown = useCallback(() => {
    setCountdown(countdownSeconds)

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [countdownSeconds, clearTimer])

  /**
   * 发送验证码
   */
  const sendCode = useCallback(async (
    target: string,
    targetType: 'phone' | 'email',
    purpose: 'register' | 'login' | 'reset_password'
  ): Promise<boolean> => {
    // 检查是否可以发送
    if (countdown > 0 || isSending) {
      return false
    }

    setIsSending(true)
    setError(null)

    try {
      const result = await onSend(target, targetType, purpose)

      if (result.success) {
        // 开始倒计时
        startCountdown()
        setIsSending(false)
        return true
      } else {
        setError(result.error || '发送失败')
        setIsSending(false)
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送失败'
      setError(errorMessage)
      setIsSending(false)
      return false
    }
  }, [countdown, isSending, onSend, startCountdown])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    clearTimer()
    setIsSending(false)
    setCountdown(0)
    setError(null)
  }, [clearTimer])

  /**
   * 组件卸载时清除定时器
   */
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    isSending,
    countdown,
    canSend: countdown === 0 && !isSending,
    error,
    sendCode,
    reset,
  }
}
