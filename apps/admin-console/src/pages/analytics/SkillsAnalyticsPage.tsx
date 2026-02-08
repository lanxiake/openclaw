import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatNumber } from '@/lib/utils'
import { useSkillUsageAnalytics } from '@/hooks/useAnalytics'
import type { AnalyticsPeriod } from '@/types/analytics'

/**
 * 饼图颜色
 */
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

/**
 * 技能分析页面
 */
export default function SkillsAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  // 获取数据
  const { data, isLoading, isFetching, refetch } = useSkillUsageAnalytics(period)

  /**
   * 格式化日期标签
   */
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  /**
   * 获取趋势图标
   */
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
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
            <h1 className="text-2xl font-bold">技能分析</h1>
            <p className="text-muted-foreground">技能使用排行与趋势分析</p>
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

      {/* 统计卡片 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">总调用次数</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalExecutions)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">独立用户数</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalUniqueUsers)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">人均调用次数</p>
              <p className="text-2xl font-bold">{data.summary.averageExecutionsPerUser.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">活跃技能数</p>
              <p className="text-2xl font-bold">{data.summary.activeSkillsCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 使用趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>使用趋势</CardTitle>
          <CardDescription>技能调用次数与独立用户变化</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.usageTrend}>
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
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="executions"
                    name="调用次数"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="uniqueUsers"
                    name="独立用户"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 热门技能排行 */}
        <Card>
          <CardHeader>
            <CardTitle>热门技能排行</CardTitle>
            <CardDescription>按调用次数排序的技能列表</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data ? (
              <div className="space-y-3">
                {data.topSkills.map((skill, index) => (
                  <div
                    key={skill.skillId}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{skill.skillName}</p>
                        <Badge variant="secondary" className="text-xs">
                          {skill.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{formatNumber(skill.totalExecutions)} 次调用</span>
                        <span>{formatNumber(skill.uniqueUsers)} 用户</span>
                        <span>成功率 {skill.successRate}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(skill.trend)}
                      <span
                        className={cn(
                          'text-sm',
                          skill.trend === 'up' && 'text-green-500',
                          skill.trend === 'down' && 'text-red-500'
                        )}
                      >
                        {skill.trendValue > 0 ? '+' : ''}{skill.trendValue}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 分类分布 */}
        <Card>
          <CardHeader>
            <CardTitle>分类分布</CardTitle>
            <CardDescription>按技能分类的调用分布</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data ? (
              <div className="h-80 flex items-center">
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.categoryDistribution}
                        dataKey="executions"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={100}
                      >
                        {data.categoryDistribution.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {data.categoryDistribution.map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{item.category}</span>
                        </div>
                        <span className="font-medium">{item.percentage}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">
                        {formatNumber(item.executions)} 次调用
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
