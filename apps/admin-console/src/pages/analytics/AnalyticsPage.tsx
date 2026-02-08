import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  DollarSign,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatNumber, formatCurrency } from '@/lib/utils'
import {
  useAnalyticsOverview,
  useUserGrowthTrend,
  useRevenueTrend,
} from '@/hooks/useAnalytics'
import type { AnalyticsPeriod } from '@/types/analytics'

/**
 * 分析模块卡片
 */
interface AnalyticsCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  metrics?: Array<{ label: string; value: string | number; trend?: number }>
}

function AnalyticsCard({ title, description, icon: Icon, href, metrics }: AnalyticsCardProps) {
  return (
    <Link to={href}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mt-3">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {metrics && metrics.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-semibold">{metric.value}</span>
                    {metric.trend !== undefined && (
                      <span
                        className={cn(
                          'text-xs flex items-center',
                          metric.trend >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {metric.trend >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                        )}
                        {Math.abs(metric.trend)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

/**
 * 数据分析主页
 */
export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  // 获取数据
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useAnalyticsOverview()
  const { data: userGrowth, isLoading: userGrowthLoading } = useUserGrowthTrend(period)
  const { data: revenue, isLoading: revenueLoading } = useRevenueTrend(period)

  const isLoading = overviewLoading || userGrowthLoading || revenueLoading

  /**
   * 格式化图表日期标签
   */
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">数据分析</h1>
          <p className="text-muted-foreground">深入了解用户行为、收入趋势和业务表现</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value: AnalyticsPeriod) => setPeriod(value)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">近 7 天</SelectItem>
              <SelectItem value="month">近 30 天</SelectItem>
              <SelectItem value="quarter">近 90 天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => refetchOverview()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 概览指标 */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总用户</p>
                  <p className="text-2xl font-bold">{formatNumber(overview.users.total)}</p>
                  <p className="text-xs text-green-500">+{overview.users.new} 新增</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总收入</p>
                  <p className="text-2xl font-bold">{formatCurrency(overview.revenue.total, true)}</p>
                  <p className="text-xs text-muted-foreground">今日 {formatCurrency(overview.revenue.today)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">技能调用</p>
                  <p className="text-2xl font-bold">{formatNumber(overview.skills.executions)}</p>
                  <p className="text-xs text-muted-foreground">{overview.skills.active} 个活跃技能</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Activity className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">日活用户</p>
                  <p className="text-2xl font-bold">{formatNumber(overview.engagement.dau)}</p>
                  <p className="text-xs text-muted-foreground">
                    MAU: {formatNumber(overview.engagement.mau)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 趋势图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 用户增长趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>用户增长趋势</CardTitle>
            <CardDescription>新增用户和活跃用户变化</CardDescription>
          </CardHeader>
          <CardContent>
            {userGrowthLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userGrowth ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowth.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(label) => `日期: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="newUsers"
                      name="新增用户"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeUsers"
                      name="活跃用户"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 收入趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>收入趋势</CardTitle>
            <CardDescription>每日收入和订单变化</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : revenue ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenue.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(label) => `日期: ${label}`}
                      formatter={(value: number) => formatCurrency(value * 100)}
                    />
                    <Line
                      type="monotone"
                      dataKey="netRevenue"
                      name="净收入"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* 分析模块入口 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">详细分析</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="用户分析"
            description="用户增长、留存、画像分析"
            icon={Users}
            href="/analytics/users"
            metrics={
              overview
                ? [
                    { label: '总用户', value: formatNumber(overview.users.total) },
                    { label: '活跃率', value: `${((overview.users.active / overview.users.total) * 100).toFixed(1)}%` },
                  ]
                : undefined
            }
          />
          <AnalyticsCard
            title="收入分析"
            description="收入趋势、ARPU、LTV 分析"
            icon={DollarSign}
            href="/analytics/revenue"
            metrics={
              overview
                ? [
                    { label: '月收入', value: formatCurrency(overview.revenue.mtd, true) },
                    { label: '年收入', value: formatCurrency(overview.revenue.ytd, true) },
                  ]
                : undefined
            }
          />
          <AnalyticsCard
            title="技能分析"
            description="技能使用排行、趋势分析"
            icon={Zap}
            href="/analytics/skills"
            metrics={
              overview
                ? [
                    { label: '调用次数', value: formatNumber(overview.skills.executions) },
                    { label: '平均评分', value: overview.skills.averageRating.toFixed(1) },
                  ]
                : undefined
            }
          />
          <AnalyticsCard
            title="漏斗分析"
            description="转化漏斗、用户行为路径"
            icon={Activity}
            href="/analytics/funnels"
          />
        </div>
      </div>
    </div>
  )
}
