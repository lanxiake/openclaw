import { useNavigate } from 'react-router-dom'
import {
  Smartphone,
  Puzzle,
  CreditCard,
  TrendingUp,
  Users,
  Activity,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { SCOPES, ROUTES } from '@/lib/constants'
import {
  useSubscriptionOverview,
  useSkillStats,
  useRecentAuditLogs,
  useAuditStats,
} from '@/hooks'

/**
 * 统计卡片
 */
interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    isUp: boolean
  }
  isLoading?: boolean
}

/**
 * 统计卡片组件
 */
function StatCard({ title, value, description, icon: Icon, trend, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div
                className={`flex items-center text-xs mt-1 ${
                  trend.isUp ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <TrendingUp
                  className={`h-3 w-3 mr-1 ${!trend.isUp && 'rotate-180'}`}
                />
                {trend.isUp ? '+' : '-'}
                {Math.abs(trend.value)}% 较上周
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 格式化限额显示
 *
 * @param value - 当前值或 'unlimited'
 */
function formatLimit(value: number | 'unlimited'): string {
  if (value === 'unlimited') {
    return '无限'
  }
  return value.toLocaleString()
}

/**
 * 仪表盘页面
 */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { admin, hasScope } = useAuthStore()
  const isAdmin = hasScope(SCOPES.OPERATOR_READ)

  // 获取订阅概览
  const { data: overview, isLoading: overviewLoading } = useSubscriptionOverview()

  // 获取技能统计
  const { data: skillStats, isLoading: skillsLoading } = useSkillStats()

  // 管理员：获取审计统计
  const { data: auditStats, isLoading: auditLoading } = useAuditStats()

  // 管理员：获取最近审计日志
  const { data: recentLogs } = useRecentAuditLogs(5)

  // 计算用量统计
  const deviceUsed = overview?.usage?.devices?.used ?? 0
  const deviceLimit = overview?.usage?.devices?.limit ?? 0
  const skillsUsed = overview?.usage?.skills?.used ?? 0
  const skillsLimit = overview?.usage?.skills?.limit ?? 0
  const dailyCallsUsed = overview?.usage?.dailyCalls?.used ?? 0
  const dailyCallsLimit = overview?.usage?.dailyCalls?.limit ?? 0

  // 计算订阅状态
  const subscription = overview?.subscription
  const planName = subscription?.plan?.name ?? '免费版'
  const endDate = subscription?.endAt
    ? new Date(subscription.endAt).toLocaleDateString('zh-CN')
    : null

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div>
        <h1 className="text-2xl font-bold">
          欢迎回来，{admin?.displayName || '用户'}
        </h1>
        <p className="text-muted-foreground">
          这是您的控制面板，可以查看和管理所有功能
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="已连接设备"
          value={deviceUsed}
          description={`限额 ${deviceLimit} 台`}
          icon={Smartphone}
          isLoading={overviewLoading}
        />
        <StatCard
          title="已安装技能"
          value={skillStats?.loaded ?? skillsUsed}
          description={
            skillStats?.errors && skillStats.errors > 0
              ? `${skillStats.errors} 个加载失败`
              : `限额 ${formatLimit(skillsLimit)}`
          }
          icon={Puzzle}
          isLoading={skillsLoading}
        />
        <StatCard
          title="今日调用"
          value={dailyCallsUsed.toLocaleString()}
          description={`限额 ${formatLimit(dailyCallsLimit)}`}
          icon={Activity}
          isLoading={overviewLoading}
        />
        <StatCard
          title="当前订阅"
          value={planName}
          description={endDate ? `${endDate} 到期` : undefined}
          icon={CreditCard}
          isLoading={overviewLoading}
        />
      </div>

      {/* 管理员统计 */}
      {isAdmin && (
        <>
          <h2 className="text-lg font-semibold mt-8">系统概览</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="总日志数"
              value={auditStats?.totalLogs?.toLocaleString() ?? '0'}
              icon={Users}
              isLoading={auditLoading}
            />
            <StatCard
              title="今日操作"
              value={auditStats?.todayLogs?.toLocaleString() ?? '0'}
              description="最近 24 小时"
              icon={Activity}
              isLoading={auditLoading}
            />
            <StatCard
              title="成功率"
              value={
                auditStats?.successRate !== undefined
                  ? `${(auditStats.successRate * 100).toFixed(1)}%`
                  : '0%'
              }
              icon={TrendingUp}
              isLoading={auditLoading}
            />
            <StatCard
              title="操作类型"
              value={auditStats?.byAction ? Object.keys(auditStats.byAction).length : 0}
              description="已记录的类型数"
              icon={Puzzle}
              isLoading={auditLoading}
            />
          </div>

          {/* 最近活动 */}
          {recentLogs && recentLogs.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">最近活动</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            log.success ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {log.userName || log.userId || '系统'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.action}
                            {log.resource && ` · ${log.resource}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 快捷操作 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate(ROUTES.DEVICES)}
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              添加新设备
            </CardTitle>
            <CardDescription>配对一台新的 Windows 设备</CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate(ROUTES.SKILL_STORE)}
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Puzzle className="w-5 h-5" />
              浏览技能商店
            </CardTitle>
            <CardDescription>发现新的技能来增强您的助理</CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate(ROUTES.SUBSCRIPTION)}
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              管理订阅
            </CardTitle>
            <CardDescription>查看订阅详情和账单历史</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
