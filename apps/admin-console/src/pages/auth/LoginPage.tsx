import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SlidingCaptcha } from '@/components/ui/sliding-captcha'
import { useSlidingCaptcha } from '@/hooks/useSlidingCaptcha'
import { encryptPassword } from '@/lib/rsa-encrypt'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores'
import { ROUTES } from '@/lib/constants'

/**
 * 登录表单数据类型
 */
interface LoginFormData {
  username: string
  password: string
  mfaCode?: string
}

/**
 * 管理员登录页面
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuthStore()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requireMfa, setRequireMfa] = useState(false)

  // 滑动验证码
  const captcha = useSlidingCaptcha()

  // RSA 公钥缓存
  const [publicKey, setPublicKey] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      username: '',
      password: '',
      mfaCode: '',
    },
  })

  // 页面加载时获取验证码和公钥
  useEffect(() => {
    captcha.fetchChallenge()
    apiClient.instance.getPublicKey().then((res) => {
      setPublicKey(res.publicKey)
    }).catch(() => {
      // 公钥获取失败，降级为明文传输
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 获取重定向目标
   */
  const getRedirectPath = () => {
    const from = location.state?.from?.pathname
    return from || ROUTES.DASHBOARD
  }

  /**
   * 处理登录提交
   */
  const onSubmit = async (data: LoginFormData) => {
    // 校验验证码
    if (!captcha.captchaToken) {
      setError('请先完成滑动验证')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // RSA 加密密码
      let encryptedPassword = data.password
      if (publicKey) {
        encryptedPassword = await encryptPassword(data.password, publicKey)
      }

      await login(data.username, encryptedPassword, data.mfaCode, captcha.captchaToken)
      navigate(getRedirectPath(), { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'

      if (message === 'REQUIRE_MFA') {
        setRequireMfa(true)
        setError('请输入 MFA 验证码')
      } else {
        setError(message)
      }

      // 登录失败，刷新验证码
      captcha.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">管理员登录</CardTitle>
          <CardDescription>OpenClaw Admin Console</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* 用户名 */}
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={isLoading}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* MFA 验证码 */}
            {requireMfa && (
              <div className="space-y-2">
                <Label htmlFor="mfaCode">MFA 验证码</Label>
                <Input
                  id="mfaCode"
                  type="text"
                  placeholder="请输入 6 位验证码"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={isLoading}
                  {...register('mfaCode')}
                />
              </div>
            )}

            {/* 滑动验证码 */}
            <div className="flex justify-center">
              <SlidingCaptcha
                backgroundImage={captcha.challenge?.backgroundImage ?? null}
                sliderImage={captcha.challenge?.sliderImage ?? null}
                sliderY={captcha.challenge?.sliderY ?? 0}
                isVerified={captcha.isVerified}
                isLoading={captcha.isLoading}
                error={captcha.error}
                onVerify={captcha.verify}
                onRefresh={captcha.refresh}
              />
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !captcha.isVerified}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>仅限授权管理员访问</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
