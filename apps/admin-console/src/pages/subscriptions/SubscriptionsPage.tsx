import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  XCircle,
  CalendarPlus,
  ArrowRightLeft,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDateTime, formatCurrency, cn } from '@/lib/utils'
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/constants'
import {
  useSubscriptionStats,
  useSubscriptionList,
  useCancelSubscription,
  useExtendSubscription,
} from '@/hooks/useSubscriptions'
import type { Subscription, SubscriptionListQuery } from '@/types/subscription'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 获取订阅状态徽章变体
 */
function getStatusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'success'
    case 'trial':
      return 'default'
    case 'canceled':
      return 'secondary'
    case 'expired':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * 订阅管理页面
 */
export default function SubscriptionsPage() {
  // 搜索和过滤状态
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'cancel' | 'extend'
    subscription: Subscription | null
    extendDays?: number
  }>({ open: false, type: 'cancel', subscription: null })

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300)

  // 构建查询参数
  const query: SubscriptionListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useSubscriptionStats()

  // 获取订阅列表
  const { data, isLoading, isFetching, refetch } = useSubscriptionList(query)

  // 订阅操作 mutations
  const cancelMutation = useCancelSubscription()
  const extendMutation = useExtendSubscription()

  // 计算分页信息
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  /**
   * 打开确认对话框
   */
  const openConfirmDialog = useCallback(
    (type: 'cancel' | 'extend', subscription: Subscription, extendDays?: number) => {
      setConfirmDialog({ open: true, type, subscription, extendDays })
    },
    []
  )

  /**
   * 关闭确认对话框
   */
  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, type: 'cancel', subscription: null })
  }, [])

  /**
   * 执行确认操作
   */
  const handleConfirm = useCallback(async () => {
    const { type, subscription, extendDays } = confirmDialog
    if (!subscription) return

    try {
      if (type === 'cancel') {
        await cancelMutation.mutateAsync({ subscriptionId: subscription.id })
      } else if (type === 'extend' && extendDays) {
        await extendMutation.mutateAsync({
          subscriptionId: subscription.id,
          days: extendDays,
        })
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert(error instanceof Error ? error.message : '操作失败')
    }

    closeConfirmDialog()
  }, [confirmDialog, cancelMutation, extendMutation, closeConfirmDialog])

  /**
   * 获取确认对话框配置
   */
  const getDialogConfig = () => {
    const { type, subscription, extendDays } = confirmDialog
    const userName = subscription?.userName || '该用户'

    if (type === 'cancel') {
      return {
        title: '确认取消订阅',
        description: `确定要取消 ${userName} 的订阅吗？取消后用户将在当前周期结束后失去订阅权益。`,
        action: '取消订阅',
      }
    } else {
      return {
        title: '确认延长订阅',
        description: `确定要将 ${userName} 的订阅延长 ${extendDays} 天吗？`,
        action: '延长',
      }
    }
  }

  const dialogConfig = getDialogConfig()

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订阅管理</h1>
          <p className="text-muted-foreground">管理用户订阅和订单</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/subscriptions/plans">管理计划</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/subscriptions/orders">查看订单</Link>
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalSubscriptions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">总订阅数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-green-500">{stats?.activeSubscriptions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">活跃订阅</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-blue-500">{stats?.trialSubscriptions ?? 0}</div>
            )}
            <p className="text-sm text-muted-foreground">试用中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.monthlyRevenue ?? 0)}</div>
            )}
            <p className="text-sm text-muted-foreground">本月收入</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名、手机号..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: string) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="订阅状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="trial">试用</SelectItem>
                <SelectItem value="canceled">已取消</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 订阅列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            订阅列表
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total})</span>}
          </CardTitle>
          <CardDescription>管理平台所有用户订阅</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有找到匹配的订阅</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>计划</th>
                      <th>状态</th>
                      <th>开始时间</th>
                      <th>到期时间</th>
                      <th>自动续费</th>
                      <th className="text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <div>
                            <p className="font-medium">{sub.userName}</p>
                            <p className="text-sm text-muted-foreground">{sub.userPhone || '-'}</p>
                          </div>
                        </td>
                        <td>{sub.planName}</td>
                        <td>
                          <Badge
                            variant={
                              getStatusVariant(sub.status) as
                                | 'success'
                                | 'default'
                                | 'secondary'
                                | 'destructive'
                            }
                          >
                            {SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status}
                          </Badge>
                        </td>
                        <td className="text-sm">{sub.startDate ? formatDateTime(sub.startDate) : '-'}</td>
                        <td className="text-sm">{sub.endDate ? formatDateTime(sub.endDate) : '-'}</td>
                        <td>
                          <Badge variant={sub.autoRenew ? 'success' : 'secondary'}>
                            {sub.autoRenew ? '是' : '否'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openConfirmDialog('extend', sub, 7)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" />
                                  延长 7 天
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openConfirmDialog('extend', sub, 30)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" />
                                  延长 30 天
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link to={`/users/${sub.userId}`}>
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    查看用户
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {sub.status === 'active' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openConfirmDialog('cancel', sub)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    取消订阅
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    共 {data.total} 条，第 {page}/{totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 确认对话框 */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{dialogConfig.action}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
