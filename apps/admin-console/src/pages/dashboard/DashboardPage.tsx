import { useMemo, useState } from 'react'
import { Users, CreditCard, TrendingUp, Activity, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber, formatCurrency, formatPercent, formatRelativeTime } from '@/lib/utils'
import { useDashboardStats, useTrends, useSubscriptionDistribution, useActivities } from '@/hooks/useDashboard'
import type { ActivityType, TrendData } from '@/types/dashboard'

/**
 * 统计卡片属性
 */
interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ComponentType<{ className?: string }>
  isLoading?: boolean
}

/**
 * 统计卡片组件
 */
function StatCard({
  title,
  value,
  change,
  changeLabel = '较上周',
  icon: Icon,
  isLoading,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded mt-2" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {isPositive && <ArrowUpRight className="h-3 w-3 text-green-500" />}
            {isNegative && <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={cn(isPositive && 'text-green-500', isNegative && 'text-red-500')}>
              {isPositive && '+'}
              {formatPercent(change)}
            </span>
            <span>{changeLabel}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 趋势图表组件
 */
interface TrendChartProps {
  title: string
  data: TrendData | undefined
  isLoading: boolean
  color?: string
  formatValue?: (value: number) => string
}

function TrendChart({ title, data, isLoading, color = '#3b82f6', formatValue = formatNumber }: TrendChartProps) {
  // 将 TrendData 转换为图表数据格式
  const chartData = useMemo(() => {
    if (!data) return []
    return data.labels.map((label, index) => ({
      date: label.slice(5), // 只显示月-日
      value: data.values[index] || 0,
    }))
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={formatValue} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [formatValue(value), '数值']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 饼图颜色
 */
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

/**
 * 订阅分布图表
 */
function SubscriptionPieChart() {
  const { data, isLoading } = useSubscriptionDistribution()

  const chartData = useMemo(() => {
    if (!data) return []
    return data.map((item) => ({
      name: item.name,
      value: item.count,
      percentage: item.percentage,
    }))
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>订阅分布</CardTitle>
        <CardDescription>按计划类型的订阅数量分布</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percentage }) => `${name} (${percentage}%)`}
                labelLine={{ stroke: '#9ca3af' }}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [formatNumber(value), name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 活动类型标签
 */
const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  user_register: '新用户注册',
  subscription_created: '订阅开通',
  subscription_canceled: '订阅取消',
  payment_success: '支付成功',
  payment_refund: '退款',
}

/**
 * 活动类型徽章变体
 */
const ACTIVITY_TYPE_VARIANTS: Record<ActivityType, 'default' | 'success' | 'destructive' | 'secondary'> = {
  user_register: 'default',
  subscription_created: 'success',
  subscription_canceled: 'destructive',
  payment_success: 'success',
  payment_refund: 'secondary',
}

/**
 * 最近活动列表
 */
function RecentActivities() {
  const { data, isLoading, refetch, isFetching } = useActivities(10)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>实时平台活动动态</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            暂无活动
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={ACTIVITY_TYPE_VARIANTS[activity.type]}>
                      {ACTIVITY_TYPE_LABELS[activity.type]}
                    </Badge>
                    {activity.planName && (
                      <span className="text-sm text-muted-foreground">{activity.planName}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.userName}
                    {activity.amount !== undefined && activity.amount > 0 && (
                      <span className="ml-2 text-green-500">{formatCurrency(activity.amount)}</span>
                    )}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 仪表盘页面
 */
export default function DashboardPage() {
  const [trendPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useDashboardStats()

  // 获取趋势数据
  const { data: userTrends, isLoading: userTrendsLoading } = useTrends('users', trendPeriod)
  const { data: revenueTrends, isLoading: revenueTrendsLoading } = useTrends('revenue', trendPeriod)

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来，这里是系统运营概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总用户数"
          value={stats ? formatNumber(stats.totalUsers) : '-'}
          change={stats?.changes.users}
          icon={Users}
          isLoading={statsLoading}
        />
        <StatCard
          title="活跃用户 (7天)"
          value={stats ? formatNumber(stats.activeUsers7d) : '-'}
          icon={Activity}
          isLoading={statsLoading}
        />
        <StatCard
          title="付费用户"
          value={stats ? formatNumber(stats.paidUsers) : '-'}
          change={stats?.changes.subscriptions}
          icon={CreditCard}
          isLoading={statsLoading}
        />
        <StatCard
          title="本月收入"
          value={stats ? formatCurrency(stats.revenueThisMonth) : '-'}
          change={stats?.changes.revenue}
          icon={TrendingUp}
          isLoading={statsLoading}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 md:grid-cols-2">
        <TrendChart
          title="用户增长趋势"
          data={userTrends}
          isLoading={userTrendsLoading}
          color="#3b82f6"
        />
        <TrendChart
          title="收入趋势"
          data={revenueTrends}
          isLoading={revenueTrendsLoading}
          color="#10b981"
          formatValue={(v) => formatCurrency(v, true)}
        />
      </div>

      {/* 订阅分布和最近活动 */}
      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionPieChart />
        <RecentActivities />
      </div>
    </div>
  )
}
