import { useState, useCallback } from 'react'
import {
  Search,
  MoreHorizontal,
  UserX,
  UserCheck,
  Key,
  Eye,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { formatDateTime, cn } from '@/lib/utils'
import { USER_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/lib/constants'
import {
  useUserList,
  useSuspendUser,
  useActivateUser,
  useResetPassword,
  useForceLogout,
} from '@/hooks/useUsers'
import type { User, UserListQuery } from '@/types/user'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 获取用户状态徽章变体
 */
function getUserStatusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'success'
    case 'suspended':
      return 'destructive'
    case 'deleted':
      return 'secondary'
    default:
      return 'secondary'
  }
}

/**
 * 获取订阅状态徽章变体
 */
function getSubscriptionStatusVariant(status: string | undefined) {
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
 * 用户管理页面
 */
export default function UsersPage() {
  // 搜索和过滤状态
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'suspend' | 'activate' | 'reset' | 'logout'
    user: User | null
  }>({ open: false, type: 'suspend', user: null })

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300)

  // 构建查询参数
  const query: UserListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    subscriptionStatus: subscriptionFilter !== 'all' ? subscriptionFilter : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  // 获取用户列表
  const { data, isLoading, isFetching, refetch } = useUserList(query)

  // 用户操作 mutations
  const suspendMutation = useSuspendUser()
  const activateMutation = useActivateUser()
  const resetPasswordMutation = useResetPassword()
  const forceLogoutMutation = useForceLogout()

  // 计算分页信息
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  /**
   * 打开确认对话框
   */
  const openConfirmDialog = useCallback(
    (type: 'suspend' | 'activate' | 'reset' | 'logout', user: User) => {
      setConfirmDialog({ open: true, type, user })
    },
    []
  )

  /**
   * 关闭确认对话框
   */
  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, type: 'suspend', user: null })
  }, [])

  /**
   * 执行确认操作
   */
  const handleConfirm = useCallback(async () => {
    const { type, user } = confirmDialog
    if (!user) return

    try {
      switch (type) {
        case 'suspend':
          await suspendMutation.mutateAsync({ userId: user.id })
          break
        case 'activate':
          await activateMutation.mutateAsync(user.id)
          break
        case 'reset':
          const result = await resetPasswordMutation.mutateAsync(user.id)
          if (result.tempPassword) {
            alert(`临时密码: ${result.tempPassword}\n请告知用户及时修改密码。`)
          }
          break
        case 'logout':
          await forceLogoutMutation.mutateAsync(user.id)
          break
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert(error instanceof Error ? error.message : '操作失败')
    }

    closeConfirmDialog()
  }, [
    confirmDialog,
    suspendMutation,
    activateMutation,
    resetPasswordMutation,
    forceLogoutMutation,
    closeConfirmDialog,
  ])

  /**
   * 获取确认对话框配置
   */
  const getDialogConfig = () => {
    const { type, user } = confirmDialog
    const userName = user?.displayName || user?.phone || '该用户'

    switch (type) {
      case 'suspend':
        return {
          title: '确认暂停用户',
          description: `确定要暂停 ${userName} 吗？暂停后用户将无法登录系统。`,
          action: '暂停',
        }
      case 'activate':
        return {
          title: '确认激活用户',
          description: `确定要激活 ${userName} 吗？激活后用户可以正常使用系统。`,
          action: '激活',
        }
      case 'reset':
        return {
          title: '确认重置密码',
          description: `确定要重置 ${userName} 的密码吗？将生成临时密码，用户需使用临时密码登录并修改密码。`,
          action: '重置',
        }
      case 'logout':
        return {
          title: '确认强制登出',
          description: `确定要强制登出 ${userName} 吗？用户所有设备上的会话将被终止。`,
          action: '登出',
        }
      default:
        return { title: '', description: '', action: '' }
    }
  }

  const dialogConfig = getDialogConfig()

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理系统注册用户</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名、手机号、邮箱..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1) // 重置页码
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value: string) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="用户状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="inactive">已暂停</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={subscriptionFilter}
                onValueChange={(value: string) => {
                  setSubscriptionFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="订阅状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部订阅</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="trial">试用</SelectItem>
                  <SelectItem value="expired">过期</SelectItem>
                  <SelectItem value="canceled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            用户列表
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total})</span>}
          </CardTitle>
          <CardDescription>管理平台所有注册用户</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有找到匹配的用户</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>状态</th>
                      <th>订阅</th>
                      <th>设备数</th>
                      <th>注册时间</th>
                      <th>最后登录</th>
                      <th className="text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div>
                            <p className="font-medium">{user.displayName || '未设置'}</p>
                            <p className="text-sm text-muted-foreground">{user.phone || user.email || '-'}</p>
                          </div>
                        </td>
                        <td>
                          <Badge
                            variant={
                              getUserStatusVariant(user.status) as 'success' | 'destructive' | 'secondary'
                            }
                          >
                            {USER_STATUS_LABELS[user.status] || user.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <Badge
                              variant={
                                getSubscriptionStatusVariant(user.subscriptionStatus) as
                                  | 'success'
                                  | 'default'
                                  | 'secondary'
                                  | 'destructive'
                              }
                            >
                              {user.subscriptionStatus
                                ? SUBSCRIPTION_STATUS_LABELS[user.subscriptionStatus] || user.subscriptionStatus
                                : '无订阅'}
                            </Badge>
                            {user.subscriptionPlan && (
                              <p className="text-xs text-muted-foreground">{user.subscriptionPlan}</p>
                            )}
                          </div>
                        </td>
                        <td>{user.deviceCount}</td>
                        <td className="text-sm">{user.createdAt ? formatDateTime(user.createdAt) : '-'}</td>
                        <td className="text-sm">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '-'}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild title="查看详情">
                              <Link to={`/users/${user.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openConfirmDialog('reset', user)}>
                                  <Key className="mr-2 h-4 w-4" />
                                  重置密码
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openConfirmDialog('logout', user)}>
                                  <LogOut className="mr-2 h-4 w-4" />
                                  强制登出
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.status === 'active' ? (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openConfirmDialog('suspend', user)}
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    暂停用户
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-green-500"
                                    onClick={() => openConfirmDialog('activate', user)}
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    激活用户
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
