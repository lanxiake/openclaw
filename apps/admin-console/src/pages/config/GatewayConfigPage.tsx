/**
 * Gateway 配置页面
 *
 * 管理 Gateway 基础配置、认证模式、Control UI、Tailscale 等。
 * 按风险等级分组显示：高风险（认证）、中风险（网络）、低风险（UI/功能）。
 * 参考 SecurityConfigPage 的分组表单模式。
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Network,
  Shield,
  Monitor,
  Globe,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useGatewayConfig, useUpdateGatewayConfig } from '@/hooks/useGatewayConfig'
import type { UpdateGatewayConfigRequest } from '@mtbot/api-client/admin'

/** 认证模式选项 */
const AUTH_MODE_OPTIONS = [
  { value: 'none', label: '无认证' },
  { value: 'token', label: 'Token 认证' },
  { value: 'password', label: '密码认证' },
  { value: 'tailscale', label: 'Tailscale 认证' },
] as const

/** 网关模式选项 */
const GATEWAY_MODE_OPTIONS = [
  { value: 'standard', label: '标准模式' },
  { value: 'bridge', label: '桥接模式' },
] as const

/** Tailscale 模式选项 */
const TAILSCALE_MODE_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'client', label: '客户端' },
  { value: 'server', label: '服务端' },
] as const

/** 绑定地址选项 */
const BIND_OPTIONS = [
  { value: '127.0.0.1', label: '仅本机 (127.0.0.1)' },
  { value: '0.0.0.0', label: '所有网络 (0.0.0.0)' },
] as const

/** 表单数据类型 */
interface GatewayFormData {
  gatewayMode: string
  gatewayPort: number
  gatewayBind: string
  authMode: string
  authToken: string
  authPassword: string
  authAllowTailscale: boolean
  controlUiEnabled: boolean
  controlUiAllowInsecureAuth: boolean
  tailscaleMode: string
  tailscaleResetOnExit: boolean
}

/** 默认值 */
const DEFAULT_FORM: GatewayFormData = {
  gatewayMode: 'standard',
  gatewayPort: 18789,
  gatewayBind: '127.0.0.1',
  authMode: 'none',
  authToken: '',
  authPassword: '',
  authAllowTailscale: false,
  controlUiEnabled: true,
  controlUiAllowInsecureAuth: false,
  tailscaleMode: 'off',
  tailscaleResetOnExit: false,
}

/**
 * Gateway 配置页面组件
 */
export default function GatewayConfigPage() {
  const { data: config, isLoading, isFetching, refetch } = useGatewayConfig()
  const updateConfig = useUpdateGatewayConfig()

  const [formData, setFormData] = useState<GatewayFormData>(DEFAULT_FORM)
  const [hasChanges, setHasChanges] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  /** 从 API 数据初始化表单 */
  useEffect(() => {
    if (config) {
      setFormData({
        gatewayMode: config.gatewayMode ?? 'standard',
        gatewayPort: config.gatewayPort ?? 18789,
        gatewayBind: config.gatewayBind ?? '127.0.0.1',
        authMode: config.authMode ?? 'none',
        authToken: '', // 不回填脱敏值
        authPassword: '',
        authAllowTailscale: config.authAllowTailscale ?? false,
        controlUiEnabled: config.controlUiEnabled ?? true,
        controlUiAllowInsecureAuth: config.controlUiAllowInsecureAuth ?? false,
        tailscaleMode: config.tailscaleMode ?? 'off',
        tailscaleResetOnExit: config.tailscaleResetOnExit ?? false,
      })
      setHasChanges(false)
    }
  }, [config])

  /**
   * 更新表单字段
   */
  const handleChange = <K extends keyof GatewayFormData>(field: K, value: GatewayFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 保存配置
   */
  const handleSave = async () => {
    const request: UpdateGatewayConfigRequest = {
      gatewayMode: formData.gatewayMode,
      gatewayPort: formData.gatewayPort,
      gatewayBind: formData.gatewayBind,
      authMode: formData.authMode,
      authAllowTailscale: formData.authAllowTailscale,
      controlUiEnabled: formData.controlUiEnabled,
      controlUiAllowInsecureAuth: formData.controlUiAllowInsecureAuth,
      tailscaleMode: formData.tailscaleMode,
      tailscaleResetOnExit: formData.tailscaleResetOnExit,
    }
    // 仅在有输入时发送敏感字段
    if (formData.authToken.trim()) request.authToken = formData.authToken.trim()
    if (formData.authPassword.trim()) request.authPassword = formData.authPassword.trim()

    try {
      await updateConfig.mutateAsync(request)
      setHasChanges(false)
    } catch (error) {
      console.error('保存 Gateway 配置失败:', error)
    }
  }

  /**
   * 撤销修改
   */
  const handleDiscard = () => {
    if (config) {
      setFormData({
        gatewayMode: config.gatewayMode ?? 'standard',
        gatewayPort: config.gatewayPort ?? 18789,
        gatewayBind: config.gatewayBind ?? '127.0.0.1',
        authMode: config.authMode ?? 'none',
        authToken: '',
        authPassword: '',
        authAllowTailscale: config.authAllowTailscale ?? false,
        controlUiEnabled: config.controlUiEnabled ?? true,
        controlUiAllowInsecureAuth: config.controlUiAllowInsecureAuth ?? false,
        tailscaleMode: config.tailscaleMode ?? 'off',
        tailscaleResetOnExit: config.tailscaleResetOnExit ?? false,
      })
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
            <h1 className="text-2xl font-bold">Gateway 配置</h1>
            <p className="text-muted-foreground">管理网关基础配置和认证模式</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleDiscard} disabled={!hasChanges}>
            撤销修改
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateConfig.isPending}>
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
          {/* 基础配置（中风险） */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                基础配置
              </CardTitle>
              <CardDescription>网关模式、端口和绑定地址</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>网关模式</Label>
                <Select
                  value={formData.gatewayMode}
                  onValueChange={(v) => handleChange('gatewayMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gatewayPort">端口号</Label>
                  <Input
                    id="gatewayPort"
                    type="number"
                    min={1}
                    max={65535}
                    value={formData.gatewayPort}
                    onChange={(e) => handleChange('gatewayPort', parseInt(e.target.value, 10) || 18789)}
                  />
                  <p className="text-xs text-muted-foreground">WebSocket 服务监听端口（1-65535）</p>
                </div>
                <div className="space-y-2">
                  <Label>绑定地址</Label>
                  <Select
                    value={formData.gatewayBind}
                    onValueChange={(v) => handleChange('gatewayBind', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BIND_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    选择 0.0.0.0 将允许外部网络连接
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 认证配置（高风险） */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                认证配置
                <Badge variant="outline" className="text-red-600 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  高风险
                </Badge>
              </CardTitle>
              <CardDescription>Gateway 连接的认证方式，修改后可能导致现有连接断开</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>认证模式</Label>
                <Select
                  value={formData.authMode}
                  onValueChange={(v) => handleChange('authMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.authMode === 'none' && (
                  <p className="text-xs text-orange-600">
                    无认证模式下任何人都可以连接 Gateway，仅建议在本地开发环境使用
                  </p>
                )}
              </div>

              {/* 条件渲染：Token 输入 */}
              {formData.authMode === 'token' && (
                <div className="space-y-2">
                  <Label htmlFor="authToken">认证 Token</Label>
                  <div className="relative">
                    <Input
                      id="authToken"
                      type={showToken ? 'text' : 'password'}
                      placeholder="留空保持原值"
                      value={formData.authToken}
                      onChange={(e) => handleChange('authToken', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => setShowToken((prev) => !prev)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {config?.authToken && (
                    <p className="text-xs text-muted-foreground">
                      当前值: {config.authToken}
                    </p>
                  )}
                </div>
              )}

              {/* 条件渲染：密码输入 */}
              {formData.authMode === 'password' && (
                <div className="space-y-2">
                  <Label htmlFor="authPassword">认证密码</Label>
                  <div className="relative">
                    <Input
                      id="authPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="留空保持原值"
                      value={formData.authPassword}
                      onChange={(e) => handleChange('authPassword', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {config?.authPassword && (
                    <p className="text-xs text-muted-foreground">
                      当前值: {config.authPassword}
                    </p>
                  )}
                </div>
              )}

              {/* Tailscale 认证回退 */}
              <div className="flex items-center justify-between py-2 border-t">
                <div>
                  <Label>允许 Tailscale 认证回退</Label>
                  <p className="text-sm text-muted-foreground">
                    当主认证模式不可用时，允许通过 Tailscale 身份认证
                  </p>
                </div>
                <Switch
                  checked={formData.authAllowTailscale}
                  onCheckedChange={(checked) => handleChange('authAllowTailscale', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Control UI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Control UI
              </CardTitle>
              <CardDescription>Gateway 内置的 Web 控制面板</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>启用 Control UI</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后可通过浏览器访问 Gateway 控制面板
                  </p>
                </div>
                <Switch
                  checked={formData.controlUiEnabled}
                  onCheckedChange={(checked) => handleChange('controlUiEnabled', checked)}
                />
              </div>

              {formData.controlUiEnabled && (
                <div className="flex items-center justify-between py-2 border-t">
                  <div>
                    <Label>允许不安全认证</Label>
                    <p className="text-sm text-muted-foreground">
                      允许通过 HTTP（非 HTTPS）访问控制面板
                    </p>
                  </div>
                  <Switch
                    checked={formData.controlUiAllowInsecureAuth}
                    onCheckedChange={(checked) => handleChange('controlUiAllowInsecureAuth', checked)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tailscale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Tailscale
              </CardTitle>
              <CardDescription>Tailscale VPN 集成配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tailscale 模式</Label>
                <Select
                  value={formData.tailscaleMode}
                  onValueChange={(v) => handleChange('tailscaleMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAILSCALE_MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.tailscaleMode !== 'off' && (
                <div className="flex items-center justify-between py-2 border-t">
                  <div>
                    <Label>退出时重置 Tailscale</Label>
                    <p className="text-sm text-muted-foreground">
                      Gateway 关闭时自动断开 Tailscale 连接
                    </p>
                  </div>
                  <Switch
                    checked={formData.tailscaleResetOnExit}
                    onCheckedChange={(checked) => handleChange('tailscaleResetOnExit', checked)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
