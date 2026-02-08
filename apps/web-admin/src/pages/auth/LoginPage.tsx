import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Lock, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/lib/constants'

/**
 * 管理员登录页面
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuthStore()
  const { toast } = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [logging, setLogging] = useState(false)

  // 获取登录前的页面
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.DASHBOARD

  /**
   * 登录
   */
  const handleLogin = async () => {
    if (!username.trim()) {
      toast({
        title: '请输入用户名',
        variant: 'destructive',
      })
      return
    }

    if (!password) {
      toast({
        title: '请输入密码',
        variant: 'destructive',
      })
      return
    }

    setLogging(true)
    try {
      await login(username.trim(), password)

      toast({
        title: '登录成功',
      })

      navigate(from, { replace: true })
    } catch (error) {
      toast({
        title: '登录失败',
        description: error instanceof Error ? error.message : '请检查用户名和密码',
        variant: 'destructive',
      })
    } finally {
      setLogging(false)
    }
  }

  /**
   * 处理回车键
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <CardTitle className="text-2xl">OpenClaw 管理后台</CardTitle>
          <CardDescription>
            请输入管理员账号登录
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              autoComplete="current-password"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={logging || !username || !password}
          >
            {logging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            默认账号: admin / Admin@123456
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
