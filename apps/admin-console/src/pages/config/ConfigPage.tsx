import { Link } from 'react-router-dom'
import {
  Settings,
  Globe,
  ToggleLeft,
  Shield,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAllConfig } from '@/hooks/useConfig'

/**
 * 配置项卡片
 */
interface ConfigCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  status?: 'normal' | 'warning' | 'danger'
  statusText?: string
}

function ConfigCard({ title, description, icon: Icon, href, status, statusText }: ConfigCardProps) {
  return (
    <Link to={href}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'p-3 rounded-lg',
                status === 'warning' && 'bg-yellow-500/10',
                status === 'danger' && 'bg-red-500/10',
                !status && 'bg-primary/10'
              )}
            >
              <Icon
                className={cn(
                  'h-6 w-6',
                  status === 'warning' && 'text-yellow-500',
                  status === 'danger' && 'text-red-500',
                  !status && 'text-primary'
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{title}</h3>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
              {statusText && (
                <Badge
                  variant="outline"
                  className={cn(
                    'mt-2',
                    status === 'warning' && 'text-yellow-600 border-yellow-300',
                    status === 'danger' && 'text-red-600 border-red-300'
                  )}
                >
                  {statusText}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * 系统配置主页
 */
export default function ConfigPage() {
  // 获取所有配置以检查状态
  const { data: config, isLoading } = useAllConfig()

  // 检查维护模式状态
  const maintenanceMode = config?.features?.maintenanceMode ?? false
  // 检查安全配置状态
  const weakPassword =
    config?.security?.passwordMinLength && config.security.passwordMinLength < 8

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">系统配置</h1>
        <p className="text-muted-foreground">管理系统各项配置参数</p>
      </div>

      {/* 配置项列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigCard
            title="站点配置"
            description="站点名称、Logo、联系方式等基础信息"
            icon={Globe}
            href="/config/site"
          />
          <ConfigCard
            title="功能开关"
            description="注册、支付、技能商店等功能的开启与关闭"
            icon={ToggleLeft}
            href="/config/features"
            status={maintenanceMode ? 'warning' : undefined}
            statusText={maintenanceMode ? '维护模式已开启' : undefined}
          />
          <ConfigCard
            title="安全配置"
            description="密码策略、登录策略、IP 白名单等安全相关设置"
            icon={Shield}
            href="/config/security"
            status={weakPassword ? 'warning' : undefined}
            statusText={weakPassword ? '密码策略较弱' : undefined}
          />
          <ConfigCard
            title="通知模板"
            description="邮件、短信、推送通知的消息模板管理"
            icon={Bell}
            href="/config/notifications"
          />
        </div>
      )}

      {/* 配置说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            配置说明
          </CardTitle>
          <CardDescription>关于系统配置的重要提示</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>修改配置后将立即生效，请谨慎操作</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>开启维护模式后，普通用户将无法访问系统</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>安全配置的修改会影响所有用户的登录体验</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>通知模板修改前建议先使用测试功能预览效果</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
