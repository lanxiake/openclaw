import { useState } from 'react'
import { User, Camera, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/useToast'
import { gateway } from '@/lib/gateway-client'

/**
 * 个人资料页面
 *
 * 使用 admin.updateProfile 真实接口保存管理员资料
 */
export default function ProfilePage() {
  const { admin, setAdmin } = useAuthStore()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    displayName: admin?.displayName || '',
    email: admin?.email || '',
  })

  /**
   * 保存更改 — 调用 admin.updateProfile 真实接口
   */
  const handleSave = async () => {
    if (!form.displayName.trim()) {
      toast({
        title: '请输入显示名称',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      console.log('[ProfilePage] 提交资料更新请求')
      const response = await gateway.call<{
        success: boolean
        admin?: {
          id: string
          username: string
          displayName: string
          email?: string | null
          role: string
          avatarUrl?: string | null
        }
        error?: { code: string; message: string }
      }>('admin.updateProfile', {
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
      })

      if (response.success && response.admin) {
        console.log('[ProfilePage] 资料更新成功')
        // 更新 authStore 中的管理员信息
        if (admin) {
          setAdmin({
            ...admin,
            displayName: response.admin.displayName,
            email: response.admin.email ?? admin.email,
          })
        }
        toast({
          title: '保存成功',
          description: '个人资料已更新',
        })
      } else {
        const errorMsg = response.error?.message || '保存失败'
        console.warn('[ProfilePage] 资料更新失败:', errorMsg)
        toast({
          title: '保存失败',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '保存失败，请稍后重试'
      console.error('[ProfilePage] 资料更新异常:', error)
      toast({
        title: '保存失败',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">个人资料</h1>
        <p className="text-muted-foreground">管理您的账户信息</p>
      </div>

      {/* 头像 */}
      <Card>
        <CardHeader>
          <CardTitle>头像</CardTitle>
          <CardDescription>点击更换头像</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {admin?.avatar ? (
                  <img
                    src={admin.avatar}
                    alt={admin.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-primary" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                支持 JPG、PNG 格式，最大 2MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">用户名</label>
            <Input value={admin?.username || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">用户名不可修改</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">显示名称</label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="请输入显示名称"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">邮箱</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="请输入邮箱"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">角色</label>
            <Input
              value={
                admin?.role === 'super_admin'
                  ? '超级管理员'
                  : admin?.role === 'admin'
                    ? '管理员'
                    : '运营'
              }
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              保存更改
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
