import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES, STORAGE_KEYS } from '@/lib/constants'
import { isTokenExpired } from '@/lib/jwt'
import { useTokenRefresh } from '@/hooks/useTokenRefresh'

interface PrivateRouteProps {
  children: React.ReactNode
}

/**
 * 私有路由守卫
 *
 * 检查用户是否已登录且 Token 有效，未登录或 Token 过期则跳转到登录页。
 * 同时启动 Token 自动刷新定时器。
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  // 启动 Token 自动刷新
  useTokenRefresh()

  // 加载中显示加载状态
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  // 未登录跳转到登录页
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  // 检查 Access Token 有效性
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  if (!token || isTokenExpired(token)) {
    console.log('[PrivateRoute] Token 无效或已过期，跳转到登录页')
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <>{children}</>
}
