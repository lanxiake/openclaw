import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  Puzzle,
  CreditCard,
  Settings,
  Users,
  FileText,
  Activity,
  Cog,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { ROUTES, SCOPES } from '@/lib/constants'
import { Button } from '@/components/ui/button'

/**
 * 菜单项类型
 */
interface MenuItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
  scope?: string
}

/**
 * 菜单分组
 */
interface MenuSection {
  title: string
  items: MenuItem[]
}

/**
 * 侧边栏导航
 */
export function Sidebar() {
  const location = useLocation()
  const { hasScope } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  // 导航菜单配置
  const menuSections: MenuSection[] = [
    {
      title: '概览',
      items: [{ icon: LayoutDashboard, label: '仪表盘', path: ROUTES.DASHBOARD }],
    },
    {
      title: '管理',
      items: [
        { icon: Smartphone, label: '设备管理', path: ROUTES.DEVICES },
        { icon: Puzzle, label: '技能商店', path: ROUTES.SKILLS },
        { icon: CreditCard, label: '订阅管理', path: ROUTES.SUBSCRIPTION },
      ],
    },
    {
      title: '设置',
      items: [{ icon: Settings, label: '个人设置', path: ROUTES.SETTINGS }],
    },
  ]

  // 管理员菜单
  const adminSection: MenuSection = {
    title: '系统管理',
    items: [
      {
        icon: Users,
        label: '用户管理',
        path: ROUTES.ADMIN_USERS,
        scope: SCOPES.OPERATOR_READ,
      },
      {
        icon: FileText,
        label: '审计日志',
        path: ROUTES.ADMIN_AUDIT,
        scope: SCOPES.OPERATOR_READ,
      },
      {
        icon: Activity,
        label: '系统监控',
        path: ROUTES.ADMIN_SYSTEM,
        scope: SCOPES.OPERATOR_READ,
      },
      {
        icon: Cog,
        label: '系统配置',
        path: ROUTES.ADMIN_CONFIG,
        scope: SCOPES.ADMIN,
      },
    ],
  }

  // 过滤管理员菜单项
  const filteredAdminItems = adminSection.items.filter(
    (item) => !item.scope || hasScope(item.scope)
  )

  // 所有菜单
  const allSections = [
    ...menuSections,
    ...(filteredAdminItems.length > 0 ? [{ ...adminSection, items: filteredAdminItems }] : []),
  ]

  /**
   * 检查路径是否激活
   */
  const isActive = (path: string) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <div className={cn('flex items-center gap-2', sidebarCollapsed && 'justify-center')}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-lg">OpenClaw</span>
          )}
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {allSections.map((section) => (
          <div key={section.title}>
            {!sidebarCollapsed && (
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      'hover:bg-gray-100 dark:hover:bg-gray-800',
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-gray-700 dark:text-gray-300',
                      sidebarCollapsed && 'justify-center'
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* 折叠按钮 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full', sidebarCollapsed && 'px-0')}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>收起</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
