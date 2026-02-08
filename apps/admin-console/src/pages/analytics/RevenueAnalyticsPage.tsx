import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, DollarSign, TrendingUp, CreditCard } from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatNumber, formatCurrency } from '@/lib/utils'
import {
  useRevenueTrend,
  useRevenueSources,
  useUserValueMetrics,
} from '@/hooks/useAnalytics'
import type { AnalyticsPeriod } from '@/types/analytics'

/**
 * 饼图颜色
 */
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

/**
 * 收入分析页面
 */
export default function RevenueAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  // 获取数据
  const { data: revenue, isLoading: revenueLoading, isFetching, refetch } = useRevenueTrend(period)
  const { data: sources, isLoading: sourcesLoading } = useRevenueSources()
  const { data: metrics, isLoading: metricsLoading } = useUserValueMetrics(period)

  /**
   * 格式化日期标签
   */
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/analytics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">收入分析</h1>
            <p className="text-muted-foreground">收入趋势、来源分布与用户价值分析</p>
          </div>
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
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 收入统计卡片 */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总收入</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.summary.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <CreditCard className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">订单数</p>
                  <p className="text-2xl font-bold">{formatNumber(revenue.summary.totalOrders)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">客单价</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.summary.averageOrderValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">增长率</p>
                  <p className="text-2xl font-bold text-green-500">+{revenue.summary.growthRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 收入趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>收入趋势</CardTitle>
          <CardDescription>每日收入与订单变化</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : revenue ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === '订单数') return [value, name]
                      return [formatCurrency(value * 100), name]
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="netRevenue"
                    name="净收入"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    name="订单数"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 收入来源分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 按计划分布 */}
        <Card>
          <CardHeader>
            <CardTitle>按订阅计划分布</CardTitle>
            <CardDescription>各计划收入贡献占比</CardDescription>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sources ? (
              <div className="h-64 flex items-center">
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={sources.byPlan}
                        dataKey="revenue"
                        nameKey="plan"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        label={({ percentage }) => `${percentage}%`}
                        labelLine={false}
                      >
                        {sources.byPlan.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {sources.byPlan.map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{item.plan}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.revenue * 100, true)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">
                        {item.orders} 笔订单
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 按支付方式分布 */}
        <Card>
          <CardHeader>
            <CardTitle>按支付方式分布</CardTitle>
            <CardDescription>各支付渠道收入占比</CardDescription>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sources ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sources.byPaymentMethod}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="method" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
                    <Bar dataKey="revenue" name="收入" fill="#3b82f6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* 用户价值指标 */}
      <Card>
        <CardHeader>
          <CardTitle>用户价值指标</CardTitle>
          <CardDescription>ARPU 和 LTV 分析</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              {/* 关键指标 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">ARPU（月）</p>
                  <p className="text-2xl font-bold">¥{metrics.arpu.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">LTV</p>
                  <p className="text-2xl font-bold">¥{metrics.ltv.toFixed(0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">付费用户占比</p>
                  <p className="text-2xl font-bold">{metrics.payingUserRate}%</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">付费用户 ARPU</p>
                  <p className="text-2xl font-bold">¥{metrics.payingArpu.toFixed(2)}</p>
                </div>
              </div>

              {/* 趋势图 */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => `¥${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="arpu"
                      name="ARPU"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ltv"
                      name="LTV"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
