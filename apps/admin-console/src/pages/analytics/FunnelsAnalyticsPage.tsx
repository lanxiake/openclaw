import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ArrowDown } from 'lucide-react'
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
import { useFunnelList, useFunnelAnalysis } from '@/hooks/useAnalytics'
import type { AnalyticsPeriod } from '@/types/analytics'

/**
 * 漏斗步骤颜色
 */
const STEP_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

/**
 * 漏斗分析页面
 */
export default function FunnelsAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [selectedFunnel, setSelectedFunnel] = useState('registration')

  // 获取漏斗列表
  const { data: funnels, isLoading: funnelsLoading } = useFunnelList()

  // 获取漏斗分析数据
  const { data: funnel, isLoading: funnelLoading, isFetching, refetch } = useFunnelAnalysis(
    selectedFunnel,
    period
  )

  const isLoading = funnelsLoading || funnelLoading

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
            <h1 className="text-2xl font-bold">漏斗分析</h1>
            <p className="text-muted-foreground">用户转化路径分析</p>
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

      {/* 漏斗选择 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">选择漏斗：</span>
            <div className="flex gap-2">
              {funnelsLoading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : funnels ? (
                funnels.map((f) => (
                  <Button
                    key={f.id}
                    variant={selectedFunnel === f.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFunnel(f.id)}
                  >
                    {f.name}
                  </Button>
                ))
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 漏斗可视化 */}
      <Card>
        <CardHeader>
          <CardTitle>{funnel?.name || '加载中...'}</CardTitle>
          <CardDescription>
            {funnels?.find((f) => f.id === selectedFunnel)?.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : funnel ? (
            <div className="space-y-8">
              {/* 总转化率 */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">整体转化率</p>
                <p className="text-4xl font-bold text-primary">
                  {funnel.overallConversionRate}%
                </p>
              </div>

              {/* 漏斗步骤 */}
              <div className="flex flex-col items-center gap-4">
                {funnel.steps.map((step, index) => {
                  const widthPercent = Math.max(step.percentage, 20)
                  const isLast = index === funnel.steps.length - 1

                  return (
                    <div key={index} className="w-full max-w-2xl">
                      {/* 步骤块 */}
                      <div
                        className="relative mx-auto rounded-lg p-4 text-center transition-all"
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: `${STEP_COLORS[index % STEP_COLORS.length]}20`,
                          borderLeft: `4px solid ${STEP_COLORS[index % STEP_COLORS.length]}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <p className="font-medium">{step.name}</p>
                            <p className="text-2xl font-bold">{formatNumber(step.count)}</p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant="secondary"
                              className="text-lg font-bold"
                              style={{ color: STEP_COLORS[index % STEP_COLORS.length] }}
                            >
                              {step.percentage}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* 流失指示器 */}
                      {!isLast && (
                        <div className="flex items-center justify-center my-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ArrowDown className="h-4 w-4" />
                            <span>流失 {step.dropoffRate.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 步骤详情表格 */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">步骤详情</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-4 text-left font-medium">步骤</th>
                        <th className="py-2 px-4 text-right font-medium">用户数</th>
                        <th className="py-2 px-4 text-right font-medium">占比</th>
                        <th className="py-2 px-4 text-right font-medium">流失率</th>
                        <th className="py-2 px-4 text-right font-medium">转化率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnel.steps.map((step, index) => {
                        const prevStep = index > 0 ? funnel.steps[index - 1] : null
                        const conversionFromPrev = prevStep
                          ? ((step.count / prevStep.count) * 100).toFixed(1)
                          : '100'

                        return (
                          <tr key={index} className="border-b last:border-0">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: STEP_COLORS[index % STEP_COLORS.length] }}
                                />
                                {step.name}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatNumber(step.count)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {step.percentage}%
                            </td>
                            <td className="py-3 px-4 text-right">
                              {step.dropoffRate > 0 ? (
                                <span className="text-red-500">-{step.dropoffRate.toFixed(1)}%</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {index > 0 ? (
                                <span className="text-green-500">{conversionFromPrev}%</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
