/**
 * 积分管理概览页
 *
 * 提供用户积分查询入口、模型定价预览和过期清理操作
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Coins, Search, ArrowRight, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/constants'
import { useModelPricingList, useCleanupExpiredCredits } from '@/hooks/useCredits'

/**
 * 积分管理概览页组件
 */
export default function CreditsPage() {
  const [userIdInput, setUserIdInput] = useState('')
  const navigate = useNavigate()

  const { data: pricings, isLoading: pricingsLoading } = useModelPricingList(true)
  const cleanupMutation = useCleanupExpiredCredits()

  /**
   * 跳转到用户积分详情页
   */
  const handleQueryUser = () => {
    const trimmed = userIdInput.trim()
    if (trimmed) {
      navigate(`/credits/users/${trimmed}`)
    }
  }

  /**
   * 触发过期批次清理
   */
  const handleCleanup = async () => {
    try {
      const result = await cleanupMutation.mutateAsync()
      alert(`清理完成：${result.batchesCleaned} 个批次过期，${result.creditsExpired} 积分回收`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '清理失败')
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">积分管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.CREDITS_PRICING}>
              管理定价
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {cleanupMutation.isPending ? '清理中...' : '清理过期批次'}
          </Button>
        </div>
      </div>

      {/* 用户积分查询 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">查询用户积分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="输入用户 ID"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQueryUser()
                }
              }}
              className="max-w-md"
            />
            <Button onClick={handleQueryUser} disabled={!userIdInput.trim()}>
              <Search className="mr-1 h-4 w-4" />
              查询
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            输入用户 ID 查看其积分余额和消费记录
          </p>
        </CardContent>
      </Card>

      {/* 模型定价预览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">模型定价一览</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.CREDITS_PRICING}>
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pricingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !pricings || pricings.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无模型定价配置</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">模型</th>
                    <th className="pb-2 pr-4 font-medium">输入价格</th>
                    <th className="pb-2 pr-4 font-medium">输出价格</th>
                    <th className="pb-2 pr-4 font-medium">倍率</th>
                    <th className="pb-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {pricings.slice(0, 5).map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div>
                          <span className="font-medium">{p.modelName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.modelId}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.inputPrice}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.outputPrice}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.multiplier}</td>
                      <td className="py-2">
                        <Badge variant={p.isActive ? 'default' : 'secondary'}>
                          {p.isActive ? '启用' : '停用'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pricings.length > 5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  还有 {pricings.length - 5} 条定价，
                  <Link to={ROUTES.CREDITS_PRICING} className="text-primary hover:underline">
                    查看全部
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
