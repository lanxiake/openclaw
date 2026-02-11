/**
 * Token 自动刷新 Hook
 *
 * 定期检查 Access Token 过期状态，在即将过期时自动刷新。
 * Token 已过期且刷新失败时，自动登出并跳转登录页。
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isTokenExpired, isTokenExpiringSoon, getTokenTimeLeft } from '@/lib/jwt'
import { STORAGE_KEYS, ROUTES } from '@/lib/constants'

/** 检查间隔: 60 秒 */
const CHECK_INTERVAL_MS = 60 * 1000

/** 刷新阈值: Token 剩余 5 分钟时触发刷新 */
const REFRESH_THRESHOLD_SECONDS = 5 * 60

/**
 * Token 自动刷新 Hook
 *
 * 在已认证状态下，每 60 秒检查 Access Token：
 * - 即将过期 (< 5分钟): 自动调用 refreshAccessToken
 * - 已过期: 尝试刷新，失败则 logout 并重定向到登录页
 */
export function useTokenRefresh(): void {
  const { isAuthenticated, refreshAccessToken, logout } = useAuthStore()
  const navigate = useNavigate()
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) return

    /**
     * 检查并刷新 Token
     */
    async function checkAndRefresh() {
      if (isRefreshingRef.current) return

      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      if (!token) {
        console.log('[useTokenRefresh] 无 Access Token，执行登出')
        await logout()
        navigate(ROUTES.LOGIN, { replace: true })
        return
      }

      const timeLeft = getTokenTimeLeft(token)
      console.log(`[useTokenRefresh] Token 剩余 ${timeLeft} 秒`)

      // Token 已过期
      if (isTokenExpired(token)) {
        console.log('[useTokenRefresh] Token 已过期，尝试刷新')
        isRefreshingRef.current = true
        try {
          await refreshAccessToken()
          console.log('[useTokenRefresh] Token 刷新成功')
        } catch (error) {
          console.error('[useTokenRefresh] Token 刷新失败，执行登出:', error)
          await logout()
          navigate(ROUTES.LOGIN, { replace: true })
        } finally {
          isRefreshingRef.current = false
        }
        return
      }

      // Token 即将过期
      if (isTokenExpiringSoon(token, REFRESH_THRESHOLD_SECONDS)) {
        console.log('[useTokenRefresh] Token 即将过期，提前刷新')
        isRefreshingRef.current = true
        try {
          await refreshAccessToken()
          console.log('[useTokenRefresh] Token 提前刷新成功')
        } catch (error) {
          console.warn('[useTokenRefresh] Token 提前刷新失败（将在过期后重试）:', error)
        } finally {
          isRefreshingRef.current = false
        }
      }
    }

    // 首次进入时立即检查一次
    checkAndRefresh()

    // 定期检查
    const intervalId = setInterval(checkAndRefresh, CHECK_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isAuthenticated, refreshAccessToken, logout, navigate])
}
