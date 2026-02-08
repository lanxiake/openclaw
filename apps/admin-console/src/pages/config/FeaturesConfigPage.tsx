import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useFeatureFlags, useUpdateFeatureFlags } from '@/hooks/useConfig'
import type { FeatureFlags } from '@/types/config'

/**
 * 功能开关项组件
 */
interface FeatureToggleProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  warning?: boolean
}

function FeatureToggle({ id, label, description, checked, onChange, warning }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
          {label}
          {warning && checked && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}

/**
 * 功能开关页面
 */
export default function FeaturesConfigPage() {
  // 获取功能开关配置
  const { data: config, isLoading, isFetching, refetch } = useFeatureFlags()

  // 更新配置
  const updateConfig = useUpdateFeatureFlags()

  // 表单状态
  const [formData, setFormData] = useState<Partial<FeatureFlags>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setFormData(config)
      setHasChanges(false)
    }
  }, [config])

  /**
   * 处理开关变更
   */
  const handleToggle = (field: keyof FeatureFlags, value: boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 处理文本变更
   */
  const handleTextChange = (field: keyof FeatureFlags, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

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
            <h1 className="text-2xl font-bold">功能开关</h1>
            <p className="text-muted-foreground">控制系统功能的开启与关闭</p>
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
          {/* 维护模式 */}
          <Card className={formData.maintenanceMode ? 'border-yellow-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                维护模式
                {formData.maintenanceMode && (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
              </CardTitle>
              <CardDescription>
                开启后，普通用户将无法访问系统，仅管理员可登录
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeatureToggle
                id="maintenanceMode"
                label="启用维护模式"
                description="开启后系统将进入维护状态"
                checked={formData.maintenanceMode ?? false}
                onChange={(checked) => handleToggle('maintenanceMode', checked)}
                warning
              />
              {formData.maintenanceMode && (
                <div className="space-y-2">
                  <Label htmlFor="maintenanceMessage">维护提示信息</Label>
                  <Textarea
                    id="maintenanceMessage"
                    value={formData.maintenanceMessage || ''}
                    onChange={(e) => handleTextChange('maintenanceMessage', e.target.value)}
                    placeholder="输入向用户展示的维护提示信息"
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 用户注册 */}
          <Card>
            <CardHeader>
              <CardTitle>用户注册</CardTitle>
              <CardDescription>控制用户注册相关功能</CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureToggle
                id="registrationEnabled"
                label="允许新用户注册"
                description="关闭后新用户将无法注册账号"
                checked={formData.registrationEnabled ?? true}
                onChange={(checked) => handleToggle('registrationEnabled', checked)}
              />
              <FeatureToggle
                id="emailVerificationRequired"
                label="邮箱验证"
                description="要求用户验证邮箱后才能使用完整功能"
                checked={formData.emailVerificationRequired ?? false}
                onChange={(checked) => handleToggle('emailVerificationRequired', checked)}
              />
              <FeatureToggle
                id="phoneVerificationRequired"
                label="手机验证"
                description="要求用户验证手机号后才能使用完整功能"
                checked={formData.phoneVerificationRequired ?? false}
                onChange={(checked) => handleToggle('phoneVerificationRequired', checked)}
              />
            </CardContent>
          </Card>

          {/* 支付功能 */}
          <Card>
            <CardHeader>
              <CardTitle>支付功能</CardTitle>
              <CardDescription>控制支付相关功能</CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureToggle
                id="paymentEnabled"
                label="启用支付功能"
                description="关闭后用户将无法进行任何支付操作"
                checked={formData.paymentEnabled ?? true}
                onChange={(checked) => handleToggle('paymentEnabled', checked)}
              />
              {formData.paymentEnabled && (
                <>
                  <FeatureToggle
                    id="wechatPayEnabled"
                    label="微信支付"
                    description="启用微信支付渠道"
                    checked={formData.wechatPayEnabled ?? true}
                    onChange={(checked) => handleToggle('wechatPayEnabled', checked)}
                  />
                  <FeatureToggle
                    id="alipayEnabled"
                    label="支付宝"
                    description="启用支付宝支付渠道"
                    checked={formData.alipayEnabled ?? true}
                    onChange={(checked) => handleToggle('alipayEnabled', checked)}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* 技能商店 */}
          <Card>
            <CardHeader>
              <CardTitle>技能商店</CardTitle>
              <CardDescription>控制技能商店相关功能</CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureToggle
                id="skillStoreEnabled"
                label="启用技能商店"
                description="关闭后用户将无法访问技能商店"
                checked={formData.skillStoreEnabled ?? true}
                onChange={(checked) => handleToggle('skillStoreEnabled', checked)}
              />
              {formData.skillStoreEnabled && (
                <FeatureToggle
                  id="skillUploadEnabled"
                  label="允许技能上传"
                  description="允许开发者上传新技能到商店"
                  checked={formData.skillUploadEnabled ?? true}
                  onChange={(checked) => handleToggle('skillUploadEnabled', checked)}
                />
              )}
            </CardContent>
          </Card>

          {/* 其他功能 */}
          <Card>
            <CardHeader>
              <CardTitle>其他功能</CardTitle>
              <CardDescription>其他系统功能开关</CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureToggle
                id="liveChatEnabled"
                label="实时聊天"
                description="启用实时客服聊天功能"
                checked={formData.liveChatEnabled ?? true}
                onChange={(checked) => handleToggle('liveChatEnabled', checked)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
