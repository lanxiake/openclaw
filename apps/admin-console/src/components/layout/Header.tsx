import { useState } from 'react'
import { Bell, KeyRound, LogOut, Moon, Sun, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore, useUIStore } from '@/stores'
import { gateway } from '@/lib/gateway-client'
import { ROUTES } from '@/lib/constants'

/**
 * 密码修改表单数据
 */
interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * 密码修改表单初始状态
 */
const INITIAL_PASSWORD_FORM: PasswordFormData = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

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
 * 顶部导航栏组件
 *
 * 包含主题切换、通知、用户下拉菜单（密码修改、退出登录）
 */
export function Header() {
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const { theme, setTheme } = useUIStore()

  /** 密码修改弹窗是否打开 */
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  /** 密码表单数据 */
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(INITIAL_PASSWORD_FORM)
  /** 表单错误提示 */
  const [passwordError, setPasswordError] = useState<string | null>(null)
  /** 提交中状态 */
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** 密码可见性 */
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * 处理登出
   */
  const handleLogout = async () => {
    console.log('[Header] 执行登出操作')
    await logout()
    navigate(ROUTES.LOGIN)
  }

  /**
   * 切换主题
   */
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  /**
   * 打开密码修改弹窗
   */
  const handleOpenPasswordDialog = () => {
    setPasswordForm(INITIAL_PASSWORD_FORM)
    setPasswordError(null)
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setPasswordDialogOpen(true)
  }

  /**
   * 提交密码修改
   */
  const handleChangePassword = async () => {
    setPasswordError(null)

    // 前端校验：必填
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('请填写所有密码字段')
      return
    }

    // 前端校验：新密码一致性
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }

    // 前端校验：新密码强度
    const strengthError = validatePassword(passwordForm.newPassword)
    if (strengthError) {
      setPasswordError(strengthError)
      return
    }

    // 前端校验：新旧密码不能相同
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('新密码不能与当前密码相同')
      return
    }

    setIsSubmitting(true)
    try {
      console.log('[Header] 提交密码修改请求')
      const response = await gateway.call<{
        success: boolean
        message?: string
        error?: { code: string; message: string }
      }>('admin.changePassword', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      if (response.success) {
        console.log('[Header] 密码修改成功，准备登出')
        setPasswordDialogOpen(false)
        // 密码修改成功后服务端已吊销所有会话，自动登出
        alert('密码修改成功，请重新登录')
        await logout()
        navigate(ROUTES.LOGIN)
      } else {
        const errorMsg = response.error?.message || '密码修改失败'
        console.warn('[Header] 密码修改失败:', errorMsg)
        setPasswordError(errorMsg)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '密码修改失败，请稍后重试'
      console.error('[Header] 密码修改异常:', error)
      setPasswordError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* 左侧：页面标题区域 */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">OpenClaw Admin Console</h1>
      </div>

      {/* 右侧：操作区域 */}
      <div className="flex items-center gap-4">
        {/* 主题切换 */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* 通知 */}
        <Button variant="ghost" size="icon" title="通知">
          <Bell className="h-5 w-5" />
        </Button>

        {/* 用户下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 border-l pl-4 outline-none cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar className="h-8 w-8">
                <AvatarImage src={admin?.avatar} alt={admin?.displayName} />
                <AvatarFallback>
                  {admin?.displayName?.charAt(0).toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{admin?.displayName || '管理员'}</p>
                <p className="text-xs text-muted-foreground">{admin?.role || 'admin'}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleOpenPasswordDialog} className="cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4" />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 密码修改弹窗 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              修改密码后将自动登出所有设备，需要重新登录。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 当前密码 */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="请输入当前密码"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  disabled={isSubmitting}
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

            {/* 新密码 */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="至少8位，含大小写字母和数字"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  disabled={isSubmitting}
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

            {/* 确认新密码 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="请再次输入新密码"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  disabled={isSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSubmitting) {
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

            {/* 错误提示 */}
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
