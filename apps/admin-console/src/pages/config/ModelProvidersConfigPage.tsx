/**
 * 模型提供商管理页面
 *
 * 管理 AI 模型提供商配置（Anthropic、OpenAI、Google 等），
 * 支持 CRUD 操作、连接测试、API Key 脱敏展示。
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
  X,
  Save,
  Database,
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
  useModelProviders,
  useCreateModelProvider,
  useUpdateModelProvider,
  useDeleteModelProvider,
} from '@/hooks/useModelProviders'
import type { ModelProvider } from '@openclaw/api-client/admin'

/** 表单数据结构 */
interface ProviderFormData {
  providerKey: string
  providerName: string
  baseUrl: string
  apiKey: string
  apiType: string
  models: string[]
  enabled: boolean
  priority: number
}

/** 表单初始值 */
const defaultFormData: ProviderFormData = {
  providerKey: '',
  providerName: '',
  baseUrl: '',
  apiKey: '',
  apiType: 'openai-completions',
  models: [],
  enabled: true,
  priority: 100,
}

/** API 类型选项 */
const API_TYPE_OPTIONS = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'anthropic', label: 'Anthropic Messages' },
  { value: 'google-gemini', label: 'Google Gemini' },
]

/**
 * 模型提供商管理页面
 */
export default function ModelProvidersConfigPage() {
  const { data: providers, isLoading, isFetching, refetch } = useModelProviders()
  const createMutation = useCreateModelProvider()
  const updateMutation = useUpdateModelProvider()
  const deleteMutation = useDeleteModelProvider()

  /** Dialog 状态 */
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>(defaultFormData)

  /** 删除确认状态 */
  const [deleteTarget, setDeleteTarget] = useState<ModelProvider | null>(null)

  /** 模型输入框 */
  const [newModel, setNewModel] = useState('')

  /** API Key 显示状态 */
  const [showApiKey, setShowApiKey] = useState(false)

  /**
   * 更新表单字段（不可变模式）
   */
  const updateField = useCallback(<K extends keyof ProviderFormData>(
    key: K,
    value: ProviderFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  /**
   * 打开创建弹窗
   */
  const handleOpenCreate = useCallback(() => {
    setEditingProvider(null)
    setFormData(defaultFormData)
    setShowApiKey(false)
    setNewModel('')
    setEditDialogOpen(true)
  }, [])

  /**
   * 打开编辑弹窗
   */
  const handleOpenEdit = useCallback((provider: ModelProvider) => {
    setEditingProvider(provider)
    setFormData({
      providerKey: provider.providerKey,
      providerName: provider.providerName ?? '',
      baseUrl: provider.baseUrl,
      apiKey: '',
      apiType: provider.apiType ?? 'openai-completions',
      models: Array.isArray(provider.models) ? provider.models : [],
      enabled: provider.enabled,
      priority: provider.priority,
    })
    setShowApiKey(false)
    setNewModel('')
    setEditDialogOpen(true)
  }, [])

  /**
   * 关闭编辑弹窗
   */
  const handleCloseDialog = useCallback(() => {
    setEditDialogOpen(false)
    setEditingProvider(null)
    setFormData(defaultFormData)
  }, [])

  /**
   * 添加模型到列表
   */
  const handleAddModel = useCallback(() => {
    const trimmed = newModel.trim()
    if (trimmed && !formData.models.includes(trimmed)) {
      updateField('models', [...formData.models, trimmed])
      setNewModel('')
    }
  }, [newModel, formData.models, updateField])

  /**
   * 从列表移除模型
   */
  const handleRemoveModel = useCallback(
    (model: string) => {
      updateField(
        'models',
        formData.models.filter((m) => m !== model),
      )
    },
    [formData.models, updateField],
  )

  /**
   * 保存提供商（创建用 POST，编辑用 PUT）
   */
  const handleSave = useCallback(async () => {
    if (!formData.providerKey.trim() || !formData.baseUrl.trim()) {
      return
    }
    const isEditing = !!editingProvider

    try {
      if (isEditing) {
        // 编辑模式：使用 PUT，apiKey 为空时不传（保持原值）
        const apiKeyValue = formData.apiKey.trim() || undefined
        await updateMutation.mutateAsync({
          providerKey: formData.providerKey.trim(),
          request: {
            providerName: formData.providerName.trim() || undefined,
            baseUrl: formData.baseUrl.trim(),
            ...(apiKeyValue ? { apiKey: apiKeyValue } : {}),
            apiType: formData.apiType || undefined,
            models: formData.models,
            enabled: formData.enabled,
            priority: formData.priority,
          },
        })
      } else {
        // 创建模式：使用 POST，apiKey 必填
        await createMutation.mutateAsync({
          providerKey: formData.providerKey.trim(),
          providerName: formData.providerName.trim() || undefined,
          baseUrl: formData.baseUrl.trim(),
          apiKey: formData.apiKey.trim(),
          apiType: formData.apiType || undefined,
          models: formData.models,
          enabled: formData.enabled,
          priority: formData.priority,
        })
      }
      handleCloseDialog()
    } catch (error) {
      console.error('[ModelProviders] 保存失败:', error)
    }
  }, [formData, editingProvider, createMutation, updateMutation, handleCloseDialog])

  /**
   * 确认删除
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.providerKey)
      setDeleteTarget(null)
    } catch (error) {
      console.error('[ModelProviders] 删除失败:', error)
    }
  }, [deleteTarget, deleteMutation])

  const isEditing = !!editingProvider

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
            <h1 className="text-2xl font-bold">模型提供商</h1>
            <p className="text-muted-foreground">管理 AI 模型提供商的 API 连接配置</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增提供商
          </Button>
        </div>
      </div>

      {/* 提供商列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !providers || providers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无模型提供商配置</p>
              <p className="text-sm mt-1">点击"新增提供商"添加第一个 AI 模型提供商</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>提供商列表</CardTitle>
            <CardDescription>共 {providers.length} 个提供商配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">标识</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      名称
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Base URL
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      API Key
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">模型</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">状态</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      优先级
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-mono text-xs">{provider.providerKey}</td>
                      <td className="py-3 px-2">{provider.providerName || '-'}</td>
                      <td className="py-3 px-2">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                          {provider.baseUrl}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {provider.apiKey}
                        </code>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(provider.models) ? provider.models : [])
                            .slice(0, 3)
                            .map((model) => (
                              <Badge key={model} variant="secondary" className="text-xs">
                                {typeof model === 'string' ? model : String(model)}
                              </Badge>
                            ))}
                          {Array.isArray(provider.models) && provider.models.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{provider.models.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={provider.enabled ? 'default' : 'secondary'}>
                          {provider.enabled ? '启用' : '禁用'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{provider.priority}</td>
                      <td className="py-3 px-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(provider)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(provider)}
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
            <DialogTitle>{isEditing ? '编辑提供商' : '新增提供商'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? `修改 ${editingProvider?.providerKey} 的配置`
                : '添加新的 AI 模型提供商'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Provider Key */}
            <div className="space-y-2">
              <Label htmlFor="providerKey">
                提供商标识 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="providerKey"
                placeholder="如: anthropic, openai, deepseek"
                value={formData.providerKey}
                onChange={(e) => updateField('providerKey', e.target.value)}
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">标识创建后不可修改</p>
              )}
            </div>

            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="providerName">显示名称</Label>
              <Input
                id="providerName"
                placeholder="如: Anthropic Claude"
                value={formData.providerName}
                onChange={(e) => updateField('providerName', e.target.value)}
              />
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                API Base URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="baseUrl"
                placeholder="https://api.anthropic.com"
                value={formData.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key {!isEditing && <span className="text-destructive">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={isEditing ? '留空保持原值' : 'sk-...'}
                  value={formData.apiKey}
                  onChange={(e) => updateField('apiKey', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setShowApiKey((prev) => !prev)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* API Type */}
            <div className="space-y-2">
              <Label>API 类型</Label>
              <Select
                value={formData.apiType}
                onValueChange={(value) => updateField('apiType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Models */}
            <div className="space-y-2">
              <Label>支持的模型</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入模型 ID，如 claude-sonnet-4-20250514"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddModel()
                    }
                  }}
                />
                <Button variant="outline" onClick={handleAddModel} type="button">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.models.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.models.map((model) => (
                    <Badge key={model} variant="secondary" className="gap-1">
                      {model}
                      <button
                        onClick={() => handleRemoveModel(model)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.providerKey.trim() ||
                !formData.baseUrl.trim() ||
                (!isEditing && !formData.apiKey.trim())
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
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
              确定要删除提供商 <strong>{deleteTarget?.providerKey}</strong> 吗？
              此操作不可撤销，删除后使用该提供商的服务将不可用。
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
