import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout'
import { PrivateRoute } from './PrivateRoute'
import { ROUTES } from '@/lib/constants'

// 懒加载页面组件
import { lazy, Suspense } from 'react'

// 认证页面
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))

// 仪表盘
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))

// 用户管理
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'))

// 订阅管理
const SubscriptionsPage = lazy(() => import('@/pages/subscriptions/SubscriptionsPage'))
const PlansPage = lazy(() => import('@/pages/subscriptions/PlansPage'))
const OrdersPage = lazy(() => import('@/pages/subscriptions/OrdersPage'))

// 操作日志
const AuditLogsPage = lazy(() => import('@/pages/audit/AuditLogsPage'))

// 技能管理
const SkillsPage = lazy(() => import('@/pages/skills/SkillsPage'))
const CategoriesPage = lazy(() => import('@/pages/skills/CategoriesPage'))
const FeaturedPage = lazy(() => import('@/pages/skills/FeaturedPage'))

// 系统监控
const MonitorPage = lazy(() => import('@/pages/monitor/MonitorPage'))
const LogsPage = lazy(() => import('@/pages/monitor/LogsPage'))
const AlertsPage = lazy(() => import('@/pages/monitor/AlertsPage'))

// 系统配置
const ConfigPage = lazy(() => import('@/pages/config/ConfigPage'))
const SiteConfigPage = lazy(() => import('@/pages/config/SiteConfigPage'))
const FeaturesConfigPage = lazy(() => import('@/pages/config/FeaturesConfigPage'))
const SecurityConfigPage = lazy(() => import('@/pages/config/SecurityConfigPage'))
const NotificationsConfigPage = lazy(() => import('@/pages/config/NotificationsConfigPage'))

// 数据分析
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'))
const UsersAnalyticsPage = lazy(() => import('@/pages/analytics/UsersAnalyticsPage'))
const RevenueAnalyticsPage = lazy(() => import('@/pages/analytics/RevenueAnalyticsPage'))
const SkillsAnalyticsPage = lazy(() => import('@/pages/analytics/SkillsAnalyticsPage'))
const FunnelsAnalyticsPage = lazy(() => import('@/pages/analytics/FunnelsAnalyticsPage'))

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

  // ==================== 认证路由 ====================
  {
    path: '/',
    element: (
      <PrivateRoute>
        <AdminLayout />
      </PrivateRoute>
    ),
    children: [
      // 仪表盘
      {
        index: true,
        element: withSuspense(DashboardPage),
      },

      // 用户管理
      {
        path: 'users',
        children: [
          { index: true, element: withSuspense(UsersPage) },
          { path: ':userId', element: withSuspense(UserDetailPage) },
        ],
      },

      // 订阅管理
      {
        path: 'subscriptions',
        children: [
          { index: true, element: withSuspense(SubscriptionsPage) },
          { path: 'plans', element: withSuspense(PlansPage) },
          { path: 'orders', element: withSuspense(OrdersPage) },
        ],
      },

      // 操作日志
      {
        path: 'audit',
        element: withSuspense(AuditLogsPage),
      },

      // 技能管理
      {
        path: 'skills',
        children: [
          { index: true, element: withSuspense(SkillsPage) },
          { path: 'categories', element: withSuspense(CategoriesPage) },
          { path: 'featured', element: withSuspense(FeaturedPage) },
        ],
      },

      // 系统监控
      {
        path: 'monitor',
        children: [
          { index: true, element: withSuspense(MonitorPage) },
          { path: 'logs', element: withSuspense(LogsPage) },
          { path: 'alerts', element: withSuspense(AlertsPage) },
        ],
      },

      // 系统配置
      {
        path: 'config',
        children: [
          { index: true, element: withSuspense(ConfigPage) },
          { path: 'site', element: withSuspense(SiteConfigPage) },
          { path: 'features', element: withSuspense(FeaturesConfigPage) },
          { path: 'security', element: withSuspense(SecurityConfigPage) },
          { path: 'notifications', element: withSuspense(NotificationsConfigPage) },
        ],
      },

      // 数据分析
      {
        path: 'analytics',
        children: [
          { index: true, element: withSuspense(AnalyticsPage) },
          { path: 'users', element: withSuspense(UsersAnalyticsPage) },
          { path: 'revenue', element: withSuspense(RevenueAnalyticsPage) },
          { path: 'skills', element: withSuspense(SkillsAnalyticsPage) },
          { path: 'funnels', element: withSuspense(FunnelsAnalyticsPage) },
        ],
      },

      // 系统管理（占位）
      {
        path: 'system',
        element: (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            系统设置功能开发中...
          </div>
        ),
      },
    ],
  },

  // 404
  {
    path: '*',
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
])
