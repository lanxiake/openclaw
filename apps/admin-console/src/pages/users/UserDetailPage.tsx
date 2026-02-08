import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  Smartphone,
  CreditCard,
  Activity,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import { USER_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/lib/constants'
import { useUserDetail, useUnlinkDevice } from '@/hooks/useUsers'

/**
 * 用户详情页面
 */
export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()

  // 获取用户详情
  const { data: user, isLoading, isFetching, refetch, error } = useUserDetail(userId ?? '')

  // 解绑设备 mutation
  const unlinkDeviceMutation = useUnlinkDevice()

  /**
   * 处理解绑设备
   */
  const handleUnlinkDevice = async (deviceId: string) => {
    if (!userId) return

    try {
      await unlinkDeviceMutation.mutateAsync({ userId, deviceId })
    } catch (err) {
      console.error('解绑设备失败:', err)
      alert(err instanceof Error ? err.message : '解绑设备失败')
    }
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 错误状态
  if (error || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">用户详情</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error instanceof Error ? error.message : '用户不存在或加载失败'}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">用户详情</h1>
            <p className="text-muted-foreground">ID: {userId}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 基本信息 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {(user.displayName || '?').charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user.displayName || '未设置'}</h3>
                <Badge variant={user.status === 'active' ? 'success' : 'destructive'}>
                  {USER_STATUS_LABELS[user.status] || user.status}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{user.phone || '-'}</span>
                {user.isPhoneVerified && (
                  <Badge variant="secondary" className="text-xs">
                    已验证
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email || '-'}</span>
                {user.isEmailVerified && (
                  <Badge variant="secondary" className="text-xs">
                    已验证
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>注册时间: {user.createdAt ? formatDateTime(user.createdAt) : '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span>最后登录: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 订阅信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              订阅信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.subscription ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">当前计划</p>
                  <p className="font-medium">{user.subscription.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <Badge variant={user.subscription.status === 'active' ? 'success' : 'secondary'}>
                    {SUBSCRIPTION_STATUS_LABELS[user.subscription.status] || user.subscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">到期时间</p>
                  <p className="font-medium">{formatDateTime(user.subscription.endDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">自动续费</p>
                  <p className="font-medium">{user.subscription.autoRenew ? '是' : '否'}</p>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">暂无订阅</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 设备列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            已绑定设备 ({user.devices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.devices.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">暂无绑定设备</div>
          ) : (
            <div className="space-y-3">
              {user.devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-muted-foreground'}`}
                    />
                    <div>
                      <p className="font-medium">{device.deviceName}</p>
                      <p className="text-sm text-muted-foreground">{device.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {device.isOnline ? '在线' : `最后活跃: ${formatDateTime(device.lastActiveAt)}`}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="解绑设备">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认解绑设备</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要解绑设备 "{device.deviceName}" 吗？解绑后该设备需要重新配对才能使用。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleUnlinkDevice(device.deviceId)}>
                            解绑
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用统计 */}
      <Card>
        <CardHeader>
          <CardTitle>使用统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatNumber(user.usageStats.totalMessages)}</p>
              <p className="text-sm text-muted-foreground">累计消息</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatNumber(user.usageStats.totalTokens)}</p>
              <p className="text-sm text-muted-foreground">累计 Tokens</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatNumber(user.usageStats.totalSkillExecutions)}</p>
              <p className="text-sm text-muted-foreground">技能调用</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatNumber(user.usageStats.monthlyMessages)}</p>
              <p className="text-sm text-muted-foreground">本月消息</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatNumber(user.usageStats.monthlyTokens)}</p>
              <p className="text-sm text-muted-foreground">本月 Tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
