import { useState } from 'react'
import { Shield, Key, Smartphone, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'

/**
 * 安全设置页面
 */
export default function SecurityPage() {
  const { toast } = useToast()
  const [changingPassword, setChangingPassword] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  /**
   * 修改密码
   */
  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast({
        title: '密码不一致',
        description: '两次输入的新密码不一致',
        variant: 'destructive',
      })
      return
    }

    setChangingPassword(true)
    try {
      // 模拟修改密码
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: '密码已更新',
      })
      setPasswordForm({ current: '', new: '', confirm: '' })
    } catch {
      toast({
        title: '修改失败',
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
          <CardDescription>定期更换密码可以提高账户安全性</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">当前密码</label>
            <Input
              type="password"
              value={passwordForm.current}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, current: e.target.value })
              }
              placeholder="请输入当前密码"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">新密码</label>
            <Input
              type="password"
              value={passwordForm.new}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, new: e.target.value })
              }
              placeholder="请输入新密码"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">确认新密码</label>
            <Input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirm: e.target.value })
              }
              placeholder="请再次输入新密码"
            />
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
                    北京 · 当前设备
                  </p>
                </div>
              </div>
              <span className="text-xs text-green-600">在线</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5" />
                <div>
                  <p className="font-medium">iPhone Safari</p>
                  <p className="text-sm text-muted-foreground">
                    上海 · 2 天前
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-red-600">
                移除
              </Button>
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
