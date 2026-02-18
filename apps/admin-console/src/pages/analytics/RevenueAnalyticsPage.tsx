import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, DollarSign, TrendingUp, CreditCard } from 'lucide-react'
import {
  AreaChart,
  Area,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总收入</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.total)}</p>
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
                  <p className="text-sm text-muted-foreground">数据点数</p>
                  <p className="text-2xl font-bold">{formatNumber(revenue.data.length)}</p>
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
                  <p className="text-2xl font-bold text-green-500">+{revenue.growth}%</p>
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
                {/* 将 labels + data 合并为图表数据点 */}
                <AreaChart
                  data={revenue.labels.map((label, i) => ({
                    date: label,
                    revenue: revenue.data[i] ?? 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '收入']}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="收入"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 收入来源分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 按来源分布 */}
        <Card>
          <CardHeader>
            <CardTitle>收入来源分布</CardTitle>
            <CardDescription>各来源收入贡献占比</CardDescription>
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
                        data={sources.sources}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        label={({ percentage }) => `${percentage}%`}
                        labelLine={false}
                      >
                        {sources.sources.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {sources.sources.map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.revenue, true)}</span>
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

        {/* 收入汇总 */}
        <Card>
          <CardHeader>
            <CardTitle>收入汇总</CardTitle>
            <CardDescription>总收入与来源数量</CardDescription>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sources ? (
              <div className="h-64 flex flex-col justify-center space-y-6">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">总收入</p>
                  <p className="text-3xl font-bold">{formatCurrency(sources.total)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">收入来源数</p>
                  <p className="text-3xl font-bold">{sources.sources.length}</p>
                </div>
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
                  <p className="text-2xl font-bold">¥{metrics.arppu.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
