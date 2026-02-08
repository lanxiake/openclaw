import { useState } from 'react'
import { User, Camera, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/useToast'

/**
 * 个人资料页面
 */
export default function ProfilePage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    timezone: user?.timezone || 'Asia/Shanghai',
  })

  /**
   * 保存更改
   */
  const handleSave = async () => {
    setSaving(true)
    try {
      // 模拟保存
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: '保存成功',
        description: '个人资料已更新',
      })
    } catch {
      toast({
        title: '保存失败',
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
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
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
            <label className="text-sm font-medium">显示名称</label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="请输入显示名称"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">手机号</label>
            <Input value={user?.phone || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">手机号不可修改</p>
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
            <label className="text-sm font-medium">时区</label>
            <select
              className="w-full h-10 px-3 border rounded-md bg-background"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
              <option value="Asia/Tokyo">日本标准时间 (UTC+9)</option>
              <option value="America/New_York">美国东部时间 (UTC-5)</option>
              <option value="Europe/London">格林威治时间 (UTC+0)</option>
            </select>
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
