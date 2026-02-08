import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { ROUTES } from '@/lib/constants'

interface PrivateRouteProps {
  children: React.ReactNode
}

/**
 * 私有路由守卫
 *
 * 检查管理员是否已登录，未登录则跳转到登录页
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

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
    console.log('[PrivateRoute] 未认证，重定向到登录页')
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <>{children}</>
}
