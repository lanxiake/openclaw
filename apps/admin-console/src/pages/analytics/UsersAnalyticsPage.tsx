import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Users, UserPlus, Activity, TrendingUp } from 'lucide-react'
import {
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
import { cn, formatNumber } from '@/lib/utils'
import {
  useUserGrowthTrend,
  useUserRetention,
  useUserDemographics,
} from '@/hooks/useAnalytics'
import type { AnalyticsPeriod } from '@/types/analytics'

/**
 * 饼图颜色
 */
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

/**
 * 用户分析页面
 */
export default function UsersAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  // 获取数据
  const { data: growth, isLoading: growthLoading, isFetching, refetch } = useUserGrowthTrend(period)
  const { data: retention, isLoading: retentionLoading } = useUserRetention(period)
  const { data: demographics, isLoading: demographicsLoading } = useUserDemographics()

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
            <h1 className="text-2xl font-bold">用户分析</h1>
            <p className="text-muted-foreground">用户增长、留存与画像分析</p>
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

      {/* 用户增长统计 */}
      {growth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(growth.data[growth.data.length - 1]?.totalUsers || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <UserPlus className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">新增用户</p>
                  <p className="text-2xl font-bold">{formatNumber(growth.summary.totalNewUsers)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Activity className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">日均活跃</p>
                  <p className="text-2xl font-bold">{formatNumber(growth.summary.averageDailyActive)}</p>
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
                  <p className="text-2xl font-bold">{growth.summary.growthRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 用户增长趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>用户增长趋势</CardTitle>
          <CardDescription>新增用户与累计用户变化</CardDescription>
        </CardHeader>
        <CardContent>
          {growthLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : growth ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth.data}>
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
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalUsers"
                    name="累计用户"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="newUsers"
                    name="新增用户"
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

      {/* 留存分析 */}
      <Card>
        <CardHeader>
          <CardTitle>用户留存分析</CardTitle>
          <CardDescription>按周队列统计用户留存率</CardDescription>
        </CardHeader>
        <CardContent>
          {retentionLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : retention ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 text-left font-medium">队列日期</th>
                    <th className="py-2 px-4 text-center font-medium">次日留存</th>
                    <th className="py-2 px-4 text-center font-medium">3日留存</th>
                    <th className="py-2 px-4 text-center font-medium">7日留存</th>
                    <th className="py-2 px-4 text-center font-medium">14日留存</th>
                    <th className="py-2 px-4 text-center font-medium">30日留存</th>
                  </tr>
                </thead>
                <tbody>
                  {retention.cohorts.map((cohort, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2 px-4">{cohort.cohort}</td>
                      <td className="py-2 px-4 text-center">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            cohort.day1 >= 70 ? 'bg-green-100 text-green-700' :
                            cohort.day1 >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          )}
                        >
                          {cohort.day1}%
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-muted-foreground">{cohort.day3}%</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-muted-foreground">{cohort.day7}%</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-muted-foreground">{cohort.day14}%</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-muted-foreground">{cohort.day30}%</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-medium">
                    <td className="py-2 px-4">平均</td>
                    <td className="py-2 px-4 text-center">{retention.averageRetention.day1}%</td>
                    <td className="py-2 px-4 text-center">{retention.averageRetention.day3}%</td>
                    <td className="py-2 px-4 text-center">{retention.averageRetention.day7}%</td>
                    <td className="py-2 px-4 text-center">{retention.averageRetention.day14}%</td>
                    <td className="py-2 px-4 text-center">{retention.averageRetention.day30}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 用户画像 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 订阅计划分布 */}
        <Card>
          <CardHeader>
            <CardTitle>订阅计划分布</CardTitle>
            <CardDescription>用户按订阅计划的分布情况</CardDescription>
          </CardHeader>
          <CardContent>
            {demographicsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : demographics ? (
              <div className="h-64 flex items-center">
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={demographics.byPlan}
                        dataKey="count"
                        nameKey="plan"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                      >
                        {demographics.byPlan.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {demographics.byPlan.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.plan}</span>
                      </div>
                      <span className="text-muted-foreground">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 设备分布 */}
        <Card>
          <CardHeader>
            <CardTitle>设备类型分布</CardTitle>
            <CardDescription>用户使用的设备类型统计</CardDescription>
          </CardHeader>
          <CardContent>
            {demographicsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : demographics ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demographics.byDevice} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="device" className="text-xs" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" name="用户数" fill="#3b82f6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* 活跃时段分布 */}
      <Card>
        <CardHeader>
          <CardTitle>活跃时段分布</CardTitle>
          <CardDescription>用户 24 小时活跃情况</CardDescription>
        </CardHeader>
        <CardContent>
          {demographicsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : demographics ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographics.byActiveHour}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" tickFormatter={(h) => `${h}:00`} />
                  <YAxis className="text-xs" />
                  <Tooltip labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                  <Bar dataKey="count" name="活跃用户" fill="#8b5cf6" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
