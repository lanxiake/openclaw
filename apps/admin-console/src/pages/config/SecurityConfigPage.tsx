import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, RefreshCw, Plus, X, Shield } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSecurityConfig, useUpdateSecurityConfig } from '@/hooks/useConfig'
import type { SecurityConfig } from '@/types/config'

/**
 * 安全配置页面
 */
export default function SecurityConfigPage() {
  // 获取安全配置
  const { data: config, isLoading, isFetching, refetch } = useSecurityConfig()

  // 更新配置
  const updateConfig = useUpdateSecurityConfig()

  // 表单状态
  const [formData, setFormData] = useState<Partial<SecurityConfig>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [newIpWhitelist, setNewIpWhitelist] = useState('')
  const [newIpBlacklist, setNewIpBlacklist] = useState('')

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setFormData(config)
      setHasChanges(false)
    }
  }, [config])

  /**
   * 处理数字字段变更
   */
  const handleNumberChange = (field: keyof SecurityConfig, value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData((prev) => ({ ...prev, [field]: numValue }))
      setHasChanges(true)
    }
  }

  /**
   * 处理开关变更
   */
  const handleToggle = (field: keyof SecurityConfig, value: boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 添加 IP 到白名单
   */
  const handleAddWhitelist = useCallback(() => {
    if (!newIpWhitelist.trim()) return
    const currentList = formData.ipWhitelist || []
    if (!currentList.includes(newIpWhitelist.trim())) {
      setFormData((prev) => ({
        ...prev,
        ipWhitelist: [...currentList, newIpWhitelist.trim()],
      }))
      setHasChanges(true)
    }
    setNewIpWhitelist('')
  }, [newIpWhitelist, formData.ipWhitelist])

  /**
   * 从白名单移除 IP
   */
  const handleRemoveWhitelist = useCallback((ip: string) => {
    setFormData((prev) => ({
      ...prev,
      ipWhitelist: (prev.ipWhitelist || []).filter((i) => i !== ip),
    }))
    setHasChanges(true)
  }, [])

  /**
   * 添加 IP 到黑名单
   */
  const handleAddBlacklist = useCallback(() => {
    if (!newIpBlacklist.trim()) return
    const currentList = formData.ipBlacklist || []
    if (!currentList.includes(newIpBlacklist.trim())) {
      setFormData((prev) => ({
        ...prev,
        ipBlacklist: [...currentList, newIpBlacklist.trim()],
      }))
      setHasChanges(true)
    }
    setNewIpBlacklist('')
  }, [newIpBlacklist, formData.ipBlacklist])

  /**
   * 从黑名单移除 IP
   */
  const handleRemoveBlacklist = useCallback((ip: string) => {
    setFormData((prev) => ({
      ...prev,
      ipBlacklist: (prev.ipBlacklist || []).filter((i) => i !== ip),
    }))
    setHasChanges(true)
  }, [])

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(formData)
      setHasChanges(false)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  /**
   * 重置表单
   */
  const handleReset = () => {
    if (config) {
      setFormData(config)
      setHasChanges(false)
    }
  }

  /**
   * 计算密码强度
   */
  const getPasswordStrength = () => {
    let score = 0
    if ((formData.passwordMinLength ?? 0) >= 8) score++
    if ((formData.passwordMinLength ?? 0) >= 12) score++
    if (formData.passwordRequireUppercase) score++
    if (formData.passwordRequireLowercase) score++
    if (formData.passwordRequireNumber) score++
    if (formData.passwordRequireSpecial) score++

    if (score <= 2) return { label: '弱', color: 'text-red-500' }
    if (score <= 4) return { label: '中', color: 'text-yellow-500' }
    return { label: '强', color: 'text-green-500' }
  }

  const passwordStrength = getPasswordStrength()

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/config">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">安全配置</h1>
            <p className="text-muted-foreground">配置系统安全策略</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            重置
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfig.isPending}
          >
            {updateConfig.isPending && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            )}
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* 密码策略 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  密码策略
                </span>
                <Badge variant="outline" className={passwordStrength.color}>
                  强度：{passwordStrength.label}
                </Badge>
              </CardTitle>
              <CardDescription>设置用户密码的复杂度要求</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">最小密码长度</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  min="6"
                  max="32"
                  value={formData.passwordMinLength ?? 8}
                  onChange={(e) => handleNumberChange('passwordMinLength', e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">建议设置为 8 位以上</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="passwordRequireUppercase" className="cursor-pointer">
                    需要大写字母
                  </Label>
                  <Switch
                    id="passwordRequireUppercase"
                    checked={formData.passwordRequireUppercase ?? false}
                    onCheckedChange={(checked) => handleToggle('passwordRequireUppercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="passwordRequireLowercase" className="cursor-pointer">
                    需要小写字母
                  </Label>
                  <Switch
                    id="passwordRequireLowercase"
                    checked={formData.passwordRequireLowercase ?? false}
                    onCheckedChange={(checked) => handleToggle('passwordRequireLowercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="passwordRequireNumber" className="cursor-pointer">
                    需要数字
                  </Label>
                  <Switch
                    id="passwordRequireNumber"
                    checked={formData.passwordRequireNumber ?? false}
                    onCheckedChange={(checked) => handleToggle('passwordRequireNumber', checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="passwordRequireSpecial" className="cursor-pointer">
                    需要特殊字符
                  </Label>
                  <Switch
                    id="passwordRequireSpecial"
                    checked={formData.passwordRequireSpecial ?? false}
                    onCheckedChange={(checked) => handleToggle('passwordRequireSpecial', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 登录安全 */}
          <Card>
            <CardHeader>
              <CardTitle>登录安全</CardTitle>
              <CardDescription>登录失败锁定和会话管理</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loginLockoutAttempts">登录失败锁定次数</Label>
                  <Input
                    id="loginLockoutAttempts"
                    type="number"
                    min="3"
                    max="10"
                    value={formData.loginLockoutAttempts ?? 5}
                    onChange={(e) => handleNumberChange('loginLockoutAttempts', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">连续失败次数</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginLockoutDuration">锁定时间（分钟）</Label>
                  <Input
                    id="loginLockoutDuration"
                    type="number"
                    min="5"
                    max="1440"
                    value={formData.loginLockoutDuration ?? 30}
                    onChange={(e) => handleNumberChange('loginLockoutDuration', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">账号锁定持续时间</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">会话超时（分钟）</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="15"
                    max="1440"
                    value={formData.sessionTimeout ?? 120}
                    onChange={(e) => handleNumberChange('sessionTimeout', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">无操作自动登出</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 双因素认证 */}
          <Card>
            <CardHeader>
              <CardTitle>双因素认证 (2FA)</CardTitle>
              <CardDescription>增强账号安全性</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="twoFactorEnabled" className="cursor-pointer">
                    启用双因素认证
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    允许用户开启双因素认证
                  </p>
                </div>
                <Switch
                  id="twoFactorEnabled"
                  checked={formData.twoFactorEnabled ?? false}
                  onCheckedChange={(checked) => handleToggle('twoFactorEnabled', checked)}
                />
              </div>
              {formData.twoFactorEnabled && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="twoFactorRequired" className="cursor-pointer">
                      强制双因素认证
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      所有用户必须开启双因素认证
                    </p>
                  </div>
                  <Switch
                    id="twoFactorRequired"
                    checked={formData.twoFactorRequired ?? false}
                    onCheckedChange={(checked) => handleToggle('twoFactorRequired', checked)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* IP 访问控制 */}
          <Card>
            <CardHeader>
              <CardTitle>IP 访问控制</CardTitle>
              <CardDescription>基于 IP 地址的访问限制</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IP 白名单 */}
              <div className="space-y-3">
                <Label>IP 白名单</Label>
                <p className="text-sm text-muted-foreground">
                  仅允许以下 IP 地址访问管理后台（留空表示不限制）
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入 IP 地址，如 192.168.1.1"
                    value={newIpWhitelist}
                    onChange={(e) => setNewIpWhitelist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddWhitelist()
                      }
                    }}
                  />
                  <Button variant="outline" onClick={handleAddWhitelist}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(formData.ipWhitelist?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.ipWhitelist?.map((ip) => (
                      <Badge key={ip} variant="secondary" className="gap-1">
                        {ip}
                        <button
                          onClick={() => handleRemoveWhitelist(ip)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* IP 黑名单 */}
              <div className="space-y-3">
                <Label>IP 黑名单</Label>
                <p className="text-sm text-muted-foreground">
                  禁止以下 IP 地址访问系统
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入 IP 地址，如 192.168.1.1"
                    value={newIpBlacklist}
                    onChange={(e) => setNewIpBlacklist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddBlacklist()
                      }
                    }}
                  />
                  <Button variant="outline" onClick={handleAddBlacklist}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(formData.ipBlacklist?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.ipBlacklist?.map((ip) => (
                      <Badge key={ip} variant="destructive" className="gap-1">
                        {ip}
                        <button
                          onClick={() => handleRemoveBlacklist(ip)}
                          className="ml-1 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
