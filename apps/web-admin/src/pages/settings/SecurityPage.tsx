import { useState } from 'react'
import { Shield, Key, Smartphone, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { gateway } from '@/lib/gateway-client'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'

/**
 * 校验密码强度
 * 要求：长度>=8, 包含大小写字母和数字
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return '密码长度不能少于8位'
  }
  if (!/[A-Z]/.test(password)) {
    return '密码需要包含大写字母'
  }
  if (!/[a-z]/.test(password)) {
    return '密码需要包含小写字母'
  }
  if (!/\d/.test(password)) {
    return '密码需要包含数字'
  }
  return null
}

/**
 * 安全设置页面
 *
 * 包含密码修改（对接真实接口）、两步验证、登录设备管理
 */
export default function SecurityPage() {
  const { toast } = useToast()
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  /**
   * 修改密码 — 调用 admin.changePassword 真实接口
   */
  const handleChangePassword = async () => {
    // 前端校验：一致性
    if (passwordForm.new !== passwordForm.confirm) {
      toast({
        title: '密码不一致',
        description: '两次输入的新密码不一致',
        variant: 'destructive',
      })
      return
    }

    // 前端校验：强度
    const strengthError = validatePassword(passwordForm.new)
    if (strengthError) {
      toast({
        title: '密码强度不足',
        description: strengthError,
        variant: 'destructive',
      })
      return
    }

    // 前端校验：新旧不能相同
    if (passwordForm.current === passwordForm.new) {
      toast({
        title: '密码相同',
        description: '新密码不能与当前密码相同',
        variant: 'destructive',
      })
      return
    }

    setChangingPassword(true)
    try {
      console.log('[SecurityPage] 提交密码修改请求')
      const response = await gateway.call<{
        success: boolean
        message?: string
        error?: { code: string; message: string }
      }>('admin.changePassword', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new,
      })

      if (response.success) {
        console.log('[SecurityPage] 密码修改成功，准备登出')
        toast({
          title: '密码已更新',
          description: '密码修改成功，请重新登录',
        })
        setPasswordForm({ current: '', new: '', confirm: '' })
        // 服务端已吊销所有会话，自动登出
        await logout()
        navigate(ROUTES.LOGIN)
      } else {
        const errorMsg = response.error?.message || '密码修改失败'
        console.warn('[SecurityPage] 密码修改失败:', errorMsg)
        toast({
          title: '修改失败',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '密码修改失败，请稍后重试'
      console.error('[SecurityPage] 密码修改异常:', error)
      toast({
        title: '修改失败',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">安全设置</h1>
        <p className="text-muted-foreground">管理您的账户安全</p>
      </div>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            修改密码
          </CardTitle>
          <CardDescription>定期更换密码可以提高账户安全性。修改后需要重新登录。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">当前密码</label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current: e.target.value })
                }
                placeholder="请输入当前密码"
                disabled={changingPassword}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">新密码</label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.new}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new: e.target.value })
                }
                placeholder="至少8位，含大小写字母和数字"
                disabled={changingPassword}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">确认新密码</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm: e.target.value })
                }
                placeholder="请再次输入新密码"
                disabled={changingPassword}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !changingPassword) {
                    handleChangePassword()
                  }
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={
              changingPassword ||
              !passwordForm.current ||
              !passwordForm.new ||
              !passwordForm.confirm
            }
          >
            {changingPassword ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                更新中...
              </>
            ) : (
              '更新密码'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 两步验证 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            两步验证
          </CardTitle>
          <CardDescription>
            启用两步验证可以大幅提高账户安全性
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">短信验证</p>
              <p className="text-sm text-muted-foreground">
                登录时发送验证码到手机
              </p>
            </div>
            <Button variant="outline">启用</Button>
          </div>
        </CardContent>
      </Card>

      {/* 登录设备 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            登录设备
          </CardTitle>
          <CardDescription>查看最近登录的设备</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5" />
                <div>
                  <p className="font-medium">Windows Chrome</p>
                  <p className="text-sm text-muted-foreground">
                    当前设备
                  </p>
                </div>
              </div>
              <span className="text-xs text-green-600">在线</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 危险区域 */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            危险区域
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">删除账户</p>
              <p className="text-sm text-muted-foreground">
                删除后数据无法恢复
              </p>
            </div>
            <Button variant="destructive">删除账户</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
