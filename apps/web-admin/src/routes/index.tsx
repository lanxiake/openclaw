import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { PrivateRoute } from './PrivateRoute'
import { AdminRoute } from './AdminRoute'
import { ROUTES } from '@/lib/constants'

// 懒加载页面组件
import { lazy, Suspense } from 'react'

// 认证页面
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))

// 仪表盘
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))

// 设备管理
const DevicesPage = lazy(() => import('@/pages/devices/DevicesPage'))
const DeviceDetailPage = lazy(() => import('@/pages/devices/DeviceDetailPage'))

// 技能商店
const SkillStorePage = lazy(() => import('@/pages/skills/SkillStorePage'))
const MySkillsPage = lazy(() => import('@/pages/skills/MySkillsPage'))

// 订阅管理
const SubscriptionPage = lazy(() => import('@/pages/subscription/SubscriptionPage'))

// 设置
const ProfilePage = lazy(() => import('@/pages/settings/ProfilePage'))
const SecurityPage = lazy(() => import('@/pages/settings/SecurityPage'))

// 管理员页面
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'))
const SystemMonitorPage = lazy(() => import('@/pages/admin/SystemMonitorPage'))

/**
 * 页面加载组件
 */
function PageLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">加载中...</p>
      </div>
    </div>
  )
}

/**
 * 带 Suspense 的懒加载包装
 */
function withSuspense(Component: React.LazyExoticComponent<() => JSX.Element>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Component />
    </Suspense>
  )
}

/**
 * 路由配置
 */
export const router = createBrowserRouter([
  // ==================== 公开路由 ====================
  {
    path: ROUTES.LOGIN,
    element: withSuspense(LoginPage),
  },
  {
    path: ROUTES.REGISTER,
    element: <Navigate to={ROUTES.LOGIN} replace />,
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    element: <Navigate to={ROUTES.LOGIN} replace />,
  },

  // ==================== 认证路由 ====================
  {
    path: '/',
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      // 仪表盘
      {
        index: true,
        element: withSuspense(DashboardPage),
      },

      // 设备管理
      {
        path: 'devices',
        children: [
          { index: true, element: withSuspense(DevicesPage) },
          { path: ':deviceId', element: withSuspense(DeviceDetailPage) },
        ],
      },

      // 技能商店
      {
        path: 'skills',
        children: [
          { index: true, element: withSuspense(SkillStorePage) },
          { path: 'my', element: withSuspense(MySkillsPage) },
        ],
      },

      // 订阅管理
      {
        path: 'subscription',
        children: [{ index: true, element: withSuspense(SubscriptionPage) }],
      },

      // 设置
      {
        path: 'settings',
        children: [
          { index: true, element: withSuspense(ProfilePage) },
          { path: 'security', element: withSuspense(SecurityPage) },
        ],
      },

      // ==================== 管理员路由 ====================
      {
        path: 'admin',
        element: <AdminRoute />,
        children: [
          { index: true, element: <Navigate to="users" replace /> },
          { path: 'users', element: withSuspense(UsersPage) },
          { path: 'audit', element: withSuspense(AuditLogPage) },
          { path: 'system', element: withSuspense(SystemMonitorPage) },
        ],
      },
    ],
  },

  // 404
  {
    path: '*',
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
])
