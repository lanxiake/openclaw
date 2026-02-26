/**
 * Auth Profile 管理页面
 *
 * 管理 AI 提供商的认证凭据（API Key / Token / OAuth），
 * 支持 CRUD 操作、凭据类型切换、敏感字段脱敏展示。
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Save,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useAuthProfiles,
  useCreateAuthProfile,
  useUpdateAuthProfile,
  useDeleteAuthProfile,
} from '@/hooks/useAuthProfiles'
import type { AuthProfile } from '@mtbot/api-client/admin'

/** 凭据模式选项 */
const CREDENTIAL_MODE_OPTIONS = [
  { value: 'api_key', label: 'API Key' },
  { value: 'token', label: 'Token' },
  { value: 'oauth', label: 'OAuth' },
] as const

/** 提供商选项 */
const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
]

/** 凭据模式显示标签 */
const CREDENTIAL_MODE_LABELS: Record<string, string> = {
  api_key: 'API Key',
  token: 'Token',
  oauth: 'OAuth',
}

/** 表单数据结构 */
interface ProfileFormData {
  profileId: string
  provider: string
  credentialMode: 'api_key' | 'token' | 'oauth'
  apiKey: string
  token: string
  tokenExpires: string
  email: string
  enabled: boolean
  priority: number
}

/** 表单初始值 */
const defaultFormData: ProfileFormData = {
  profileId: '',
  provider: 'anthropic',
  credentialMode: 'api_key',
  apiKey: '',
  token: '',
  tokenExpires: '',
  email: '',
  enabled: true,
  priority: 100,
}

/**
 * Auth Profile 管理页面
 */
export default function AuthProfilesConfigPage() {
  const { data: profiles, isLoading, isFetching, refetch } = useAuthProfiles()
  const createMutation = useCreateAuthProfile()
  const updateMutation = useUpdateAuthProfile()
  const deleteMutation = useDeleteAuthProfile()

  /** Dialog 状态 */
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AuthProfile | null>(null)
  const [formData, setFormData] = useState<ProfileFormData>(defaultFormData)

  /** 删除确认状态 */
  const [deleteTarget, setDeleteTarget] = useState<AuthProfile | null>(null)

  /** 敏感字段显示状态 */
  const [showSecret, setShowSecret] = useState(false)

  /**
   * 更新表单字段（不可变模式）
   */
  const updateField = useCallback(<K extends keyof ProfileFormData>(
    key: K,
    value: ProfileFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  /**
   * 打开创建弹窗
   */
  const handleOpenCreate = useCallback(() => {
    setEditingProfile(null)
    setFormData(defaultFormData)
    setShowSecret(false)
    setEditDialogOpen(true)
  }, [])

  /**
   * 打开编辑弹窗
   */
  const handleOpenEdit = useCallback((profile: AuthProfile) => {
    setEditingProfile(profile)
    setFormData({
      profileId: profile.profileId,
      provider: profile.provider,
      credentialMode: profile.credentialMode,
      apiKey: '',
      token: '',
      tokenExpires: profile.tokenExpires ?? '',
      email: profile.email ?? '',
      enabled: profile.enabled,
      priority: profile.priority,
    })
    setShowSecret(false)
    setEditDialogOpen(true)
  }, [])

  /**
   * 关闭编辑弹窗
   */
  const handleCloseDialog = useCallback(() => {
    setEditDialogOpen(false)
    setEditingProfile(null)
    setFormData(defaultFormData)
  }, [])

  /**
   * 保存 Profile
   */
  const handleSave = useCallback(async () => {
    if (!formData.profileId.trim() || !formData.provider) {
      return
    }

    const isEditing = !!editingProfile

    try {
      if (isEditing) {
        /** 更新：只发送有值的字段 */
        const request: Record<string, unknown> = {
          enabled: formData.enabled,
          priority: formData.priority,
        }
        if (formData.email.trim()) request.email = formData.email.trim()
        if (formData.credentialMode === 'api_key' && formData.apiKey.trim()) {
          request.apiKey = formData.apiKey.trim()
        }
        if (formData.credentialMode === 'token' && formData.token.trim()) {
          request.token = formData.token.trim()
          if (formData.tokenExpires) request.tokenExpires = formData.tokenExpires
        }
        await updateMutation.mutateAsync({
          profileId: editingProfile.profileId,
          request,
        })
      } else {
        /** 创建 */
        await createMutation.mutateAsync({
          profileId: formData.profileId.trim(),
          provider: formData.provider,
          credentialMode: formData.credentialMode,
          apiKey:
            formData.credentialMode === 'api_key' ? formData.apiKey.trim() : undefined,
          token:
            formData.credentialMode === 'token' ? formData.token.trim() : undefined,
          tokenExpires:
            formData.credentialMode === 'token' && formData.tokenExpires
              ? formData.tokenExpires
              : undefined,
          email: formData.email.trim() || undefined,
          enabled: formData.enabled,
          priority: formData.priority,
        })
      }
      handleCloseDialog()
    } catch (error) {
      console.error('[AuthProfiles] 保存失败:', error)
    }
  }, [formData, editingProfile, createMutation, updateMutation, handleCloseDialog])

  /**
   * 确认删除
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.profileId)
      setDeleteTarget(null)
    } catch (error) {
      console.error('[AuthProfiles] 删除失败:', error)
    }
  }, [deleteTarget, deleteMutation])

  const isEditing = !!editingProfile
  const isSaving = createMutation.isPending || updateMutation.isPending

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
            <h1 className="text-2xl font-bold">Auth Profile</h1>
            <p className="text-muted-foreground">管理 AI 提供商的认证凭据配置</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增 Profile
          </Button>
        </div>
      </div>

      {/* Profile 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !profiles || profiles.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无 Auth Profile 配置</p>
              <p className="text-sm mt-1">点击"新增 Profile"添加认证凭据</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Profile 列表</CardTitle>
            <CardDescription>共 {profiles.length} 个认证配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Profile ID
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      提供商
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      凭据类型
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      凭据
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      状态
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      优先级
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-3 px-2 font-mono text-xs">{profile.profileId}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{profile.provider}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        {CREDENTIAL_MODE_LABELS[profile.credentialMode] ??
                          profile.credentialMode}
                      </td>
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {profile.credentialMode === 'api_key' && (profile.apiKey ?? '-')}
                          {profile.credentialMode === 'token' && (profile.token ?? '-')}
                          {profile.credentialMode === 'oauth' && '***redacted'}
                        </code>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={profile.enabled ? 'default' : 'secondary'}>
                          {profile.enabled ? '启用' : '禁用'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{profile.priority}</td>
                      <td className="py-3 px-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(profile)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(profile)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 创建/编辑 Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑 Profile' : '新增 Profile'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? `修改 ${editingProfile?.profileId} 的凭据配置`
                : '添加新的认证凭据配置'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Profile ID */}
            <div className="space-y-2">
              <Label htmlFor="profileId">
                Profile ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profileId"
                placeholder="如: anthropic-main, openai-backup"
                value={formData.profileId}
                onChange={(e) => updateField('profileId', e.target.value)}
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">ID 创建后不可修改</p>
              )}
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label>
                提供商 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.provider}
                onValueChange={(value) => updateField('provider', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credential Mode */}
            <div className="space-y-2">
              <Label>
                凭据类型 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.credentialMode}
                onValueChange={(value) =>
                  updateField('credentialMode', value as ProfileFormData['credentialMode'])
                }
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 条件渲染：API Key */}
            {formData.credentialMode === 'api_key' && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key {!isEditing && <span className="text-destructive">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showSecret ? 'text' : 'password'}
                    placeholder={isEditing ? '留空保持原值' : 'sk-...'}
                    value={formData.apiKey}
                    onChange={(e) => updateField('apiKey', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => setShowSecret((prev) => !prev)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* 条件渲染：Token */}
            {formData.credentialMode === 'token' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="token">
                    Token {!isEditing && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="token"
                      type={showSecret ? 'text' : 'password'}
                      placeholder={isEditing ? '留空保持原值' : '输入 Token'}
                      value={formData.token}
                      onChange={(e) => updateField('token', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => setShowSecret((prev) => !prev)}
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokenExpires">Token 过期时间</Label>
                  <Input
                    id="tokenExpires"
                    type="datetime-local"
                    value={formData.tokenExpires}
                    onChange={(e) => updateField('tokenExpires', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 条件渲染：OAuth 提示 */}
            {formData.credentialMode === 'oauth' && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                OAuth 凭据需要通过 OAuth 授权流程获取，此处暂不支持直接编辑。
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">关联邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            {/* Enabled + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enabled">启用状态</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => updateField('enabled', checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">优先级</Label>
                <Input
                  id="priority"
                  type="number"
                  min={0}
                  value={formData.priority}
                  onChange={(e) => updateField('priority', parseInt(e.target.value, 10) || 0)}
                />
                <p className="text-xs text-muted-foreground">数值越小优先级越高</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.profileId.trim() || !formData.provider}
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? '保存修改' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 Auth Profile <strong>{deleteTarget?.profileId}</strong> 吗？
              删除后使用该凭据的 Agent 会话将无法正常工作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
