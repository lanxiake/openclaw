import { CreditCard, Check, Clock, Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatAmount, formatDate } from '@/lib/utils'
import {
  usePlans,
  useCurrentSubscription,
  useSubscriptionOverview,
  useUpdateSubscription,
  useCancelSubscription,
} from '@/hooks'
import { useToast } from '@/hooks/useToast'
import type { Plan } from '@/services'

/**
 * 计划卡片
 */
function PlanCard({
  plan,
  currentPlanId,
  onUpgrade,
  isUpgrading,
}: {
  plan: Plan
  currentPlanId?: string
  onUpgrade: (planId: string) => void
  isUpgrading: boolean
}) {
  const isCurrent = plan.id === currentPlanId

  return (
    <Card
      className={`relative ${plan.popular ? 'border-primary shadow-md' : ''} ${
        isCurrent ? 'bg-primary/5' : ''
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
          推荐
        </div>
      )}

      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>
          {plan.price > 0 ? (
            <>
              <span className="text-2xl font-bold text-foreground">
                {formatAmount(plan.price)}
              </span>
              <span>/{plan.period === 'month' ? '月' : '年'}</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-foreground">免费</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2 mb-6">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500" />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isCurrent ? 'secondary' : plan.popular ? 'default' : 'outline'}
          disabled={isCurrent || isUpgrading}
          onClick={() => onUpgrade(plan.id)}
        >
          {isUpgrading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              处理中...
            </>
          ) : isCurrent ? (
            '当前计划'
          ) : (
            '升级'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * 使用量进度条
 */
function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number | 'unlimited'
}) {
  const percentage = limit === 'unlimited' ? 0 : Math.min((used / limit) * 100, 100)
  const isUnlimited = limit === 'unlimited'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {used.toLocaleString()} / {isUnlimited ? '无限' : limit.toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-primary'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * 订阅管理页面
 */
export default function SubscriptionPage() {
  const { toast } = useToast()

  // 获取订阅计划
  const { data: plans, isLoading: plansLoading } = usePlans()

  // 获取当前订阅
  const { data: subscription, isLoading: subLoading } = useCurrentSubscription()

  // 获取订阅概览（含使用量）
  const { data: overview } = useSubscriptionOverview()

  // 更新订阅
  const upgradeMutation = useUpdateSubscription()

  // 取消订阅
  const cancelMutation = useCancelSubscription()

  const isLoading = plansLoading || subLoading

  /**
   * 升级订阅
   */
  const handleUpgrade = async (planId: string) => {
    try {
      const result = await upgradeMutation.mutateAsync(planId)
      if (result.success) {
        if (result.paymentUrl) {
          // 跳转支付页面
          window.open(result.paymentUrl, '_blank')
          toast({
            title: '请完成支付',
            description: '已打开支付页面，请完成支付后刷新',
          })
        } else {
          toast({
            title: '升级成功',
            description: '订阅已更新',
          })
        }
      } else {
        toast({
          title: '升级失败',
          description: result.error || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '升级失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  /**
   * 取消订阅
   */
  const handleCancel = async () => {
    if (!confirm('确定要取消订阅吗？取消后将在当前周期结束后失效。')) {
      return
    }

    try {
      const result = await cancelMutation.mutateAsync()
      if (result.success) {
        toast({
          title: '取消成功',
          description: '订阅将在当前周期结束后失效',
        })
      } else {
        toast({
          title: '取消失败',
          description: result.error || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '取消失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  // 获取当前计划信息
  const currentPlan = plans?.find((p) => p.id === subscription?.planId)

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">订阅管理</h1>
        <p className="text-muted-foreground">管理您的订阅计划和账单</p>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 当前订阅状态 */}
      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              当前订阅
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">
                    {currentPlan?.name || subscription.planId}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {subscription.status === 'active' ? (
                      <>下次续费：{formatDate(subscription.endAt)}</>
                    ) : subscription.status === 'cancelled' ? (
                      <>已取消，有效期至：{formatDate(subscription.endAt)}</>
                    ) : (
                      <>状态：{subscription.status}</>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {subscription.status === 'active' && (
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '取消订阅'
                      )}
                    </Button>
                  )}
                  <Button>升级计划</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">暂无订阅，请选择一个计划</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 使用量概览 */}
      {overview?.usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              使用量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <UsageBar
                label="设备数"
                used={overview.usage.devices.used}
                limit={overview.usage.devices.limit}
              />
              <UsageBar
                label="技能数"
                used={overview.usage.skills.used}
                limit={overview.usage.skills.limit}
              />
              <UsageBar
                label="今日调用"
                used={overview.usage.dailyCalls.used}
                limit={overview.usage.dailyCalls.limit}
              />
              <UsageBar
                label="存储空间 (MB)"
                used={Math.round(overview.usage.storage.used / 1024 / 1024)}
                limit={Math.round(overview.usage.storage.limit / 1024 / 1024)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 订阅计划 */}
      {!isLoading && plans && plans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">选择计划</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanId={subscription?.planId}
                onUpgrade={handleUpgrade}
                isUpgrading={upgradeMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* 无计划时显示提示 */}
      {!isLoading && (!plans || plans.length === 0) && (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无可用的订阅计划</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
