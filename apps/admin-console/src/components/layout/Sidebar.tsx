import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Package,
  Activity,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, useAuthStore } from '@/stores'
import { ROUTES } from '@/lib/constants'
import { Button } from '@/components/ui/button'

/**
 * 导航项配置
 */
interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
}

/**
 * 导航分组
 */
interface NavGroup {
  title: string
  items: NavItem[]
}

/**
 * 导航配置
 */
const navGroups: NavGroup[] = [
  {
    title: '概览',
    items: [
      {
        title: '仪表盘',
        href: ROUTES.DASHBOARD,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: '业务管理',
    items: [
      {
        title: '用户管理',
        href: ROUTES.USERS,
        icon: Users,
        permission: 'user.view',
      },
      {
        title: '订阅管理',
        href: ROUTES.SUBSCRIPTIONS,
        icon: CreditCard,
        permission: 'subscription.view',
      },
      {
        title: '技能商店',
        href: ROUTES.SKILLS,
        icon: Package,
        permission: 'skill.view',
      },
    ],
  },
  {
    title: '监控运维',
    items: [
      {
        title: '系统监控',
        href: ROUTES.MONITOR,
        icon: Activity,
        permission: 'monitor.view',
      },
      {
        title: '系统配置',
        href: ROUTES.CONFIG,
        icon: Settings,
        permission: 'config.view',
      },
      {
        title: '数据分析',
        href: ROUTES.ANALYTICS,
        icon: BarChart3,
        permission: 'analytics.view',
      },
    ],
  },
  {
    title: '系统',
    items: [
      {
        title: '操作日志',
        href: ROUTES.AUDIT_LOGS,
        icon: FileText,
        permission: 'audit.view',
      },
    ],
  },
]

/**
 * 侧边栏组件
 */
export function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { hasPermission, admin } = useAuthStore()

  /**
   * 检查导航项是否激活
   */
  const isActive = (href: string) => {
    if (href === ROUTES.DASHBOARD) {
      return location.pathname === href
    }
    return location.pathname.startsWith(href)
  }

  /**
   * 过滤有权限的导航项
   */
  const filterByPermission = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.permission) return true
      return hasPermission(item.permission)
    })
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-background transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!sidebarCollapsed && (
          <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Admin Console</span>
          </Link>
        )}
        {sidebarCollapsed && (
          <Link to={ROUTES.DASHBOARD} className="mx-auto">
            <Shield className="h-6 w-6 text-primary" />
          </Link>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navGroups.map((group) => {
          const filteredItems = filterByPermission(group.items)
          if (filteredItems.length === 0) return null

          return (
            <div key={group.title}>
              {!sidebarCollapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h3>
              )}
              <ul className="space-y-1">
                {filteredItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)

                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          sidebarCollapsed && 'justify-center px-2'
                        )}
                        title={sidebarCollapsed ? item.title : undefined}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {!sidebarCollapsed && <span>{item.title}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* 管理员信息 */}
      {!sidebarCollapsed && admin && (
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {admin.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{admin.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{admin.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* 收起/展开按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background shadow-sm"
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </aside>
  )
}
