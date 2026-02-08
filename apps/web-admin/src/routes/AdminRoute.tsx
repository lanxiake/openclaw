import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES, SCOPES } from '@/lib/constants'

/**
 * 管理员路由守卫
 *
 * 检查用户是否有管理员权限
 */
export function AdminRoute() {
  const { hasScope } = useAuthStore()

  // 检查是否有管理员权限
  if (!hasScope(SCOPES.OPERATOR_READ)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return <Outlet />
}
