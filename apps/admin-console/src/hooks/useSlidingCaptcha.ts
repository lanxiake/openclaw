/**
 * 滑动验证码 Hook
 *
 * 封装验证码的获取、验证、刷新和 token 管理
 */

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CaptchaChallenge } from '@openclaw/api-client'

interface UseSlidingCaptchaReturn {
  /** 验证码挑战数据 */
  challenge: CaptchaChallenge | null
  /** 验证成功后的 token */
  captchaToken: string | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否已验证成功 */
  isVerified: boolean
  /** 错误信息 */
  error: string | null
  /** 获取新的验证码 */
  fetchChallenge: () => Promise<void>
  /** 提交验证 */
  verify: (sliderX: number) => Promise<boolean>
  /** 刷新验证码 */
  refresh: () => Promise<void>
  /** 重置状态 */
  reset: () => void
}

export function useSlidingCaptcha(): UseSlidingCaptchaReturn {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChallenge = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsVerified(false)
    setCaptchaToken(null)

    try {
      const data = await apiClient.instance.getCaptchaChallenge()
      setChallenge(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取验证码失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verify = useCallback(
    async (sliderX: number): Promise<boolean> => {
      if (!challenge) return false

      setIsLoading(true)
      setError(null)

      try {
        const result = await apiClient.instance.verifyCaptcha({
          captchaId: challenge.captchaId,
          sliderX,
        })

        if (result.token) {
          setCaptchaToken(result.token)
          setIsVerified(true)
          return true
        }

        setError('验证失败，请重试')
        // 验证失败，自动刷新
        await fetchChallenge()
        return false
      } catch (err) {
        setError(err instanceof Error ? err.message : '验证请求失败')
        await fetchChallenge()
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [challenge, fetchChallenge],
  )

  const refresh = useCallback(async () => {
    setIsVerified(false)
    setCaptchaToken(null)
    await fetchChallenge()
  }, [fetchChallenge])

  const reset = useCallback(() => {
    setChallenge(null)
    setCaptchaToken(null)
    setIsLoading(false)
    setIsVerified(false)
    setError(null)
  }, [])

  return {
    challenge,
    captchaToken,
    isLoading,
    isVerified,
    error,
    fetchChallenge,
    verify,
    refresh,
    reset,
  }
}
