/**
 * AI 模型配置统一页面
 *
 * 合并 Model Providers 和 Auth Profiles 为一个简洁的页面。
 * 每个 Provider 卡片同时包含连接信息（baseUrl, models）和凭据（apiKey）。
 * 底部单独的 Embedding 配置区域。
 */

import { useState, useCallback, useEffect } from 'react'
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
  Cpu,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
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
  useTestModelProvider,
} from '@/hooks/useModelProviders'
import {
  useAuthProfiles,
  useCreateAuthProfile,
  useDeleteAuthProfile,
} from '@/hooks/useAuthProfiles'
import { useAllConfig } from '@/hooks/useConfig'
import { apiClient } from '@/lib/api-client'
import type { ModelProvider, ModelProviderTestResult, AuthProfile } from '@openclaw/api-client/admin'

// ---------------------------------------------------------------------------
// 类型 & 常量
// ---------------------------------------------------------------------------

/** 统一的 Provider 表单数据 */
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

/** Embedding 配置数据 */
interface EmbeddingConfig {
  provider: string
  baseUrl: string
  model: string
  dimensions: number
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

/** 默认 Embedding 配置 */
const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: 'openai',
  baseUrl: '',
  model: '',
  dimensions: 1024,
}

/** API 类型选项 */
const API_TYPE_OPTIONS = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'anthropic', label: 'Anthropic Messages' },
  { value: 'google-gemini', label: 'Google Gemini' },
]

/** 根据 API Type 推断 provider key 的映射 */
const API_TYPE_TO_PROVIDER: Record<string, string> = {
  anthropic: 'anthropic',
  'openai-completions': 'openai',
  'google-gemini': 'google',
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 根据 provider 查找对应的 auth profile
 */
function findAuthProfileForProvider(
  authProfiles: AuthProfile[] | undefined,
  providerKey: string
): AuthProfile | undefined {
  if (!authProfiles) return undefined
  return authProfiles.find(
    (p) => p.profileId === `${providerKey}-default` || p.provider === providerKey
  )
}

/**
 * 脱敏 API Key 展示
 */
function maskApiKey(key: string | undefined): string {
  if (!key) return '-'
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export default function AIConfigPage() {
  // 数据获取
  const { data: providers, isLoading: providersLoading, isFetching, refetch: refetchProviders } = useModelProviders()
  const { data: authProfiles, refetch: refetchAuthProfiles } = useAuthProfiles()
  const { data: allConfig } = useAllConfig()

  // Mutations
  const createProviderMutation = useCreateModelProvider()
  const updateProviderMutation = useUpdateModelProvider()
  const deleteProviderMutation = useDeleteModelProvider()
  const testProviderMutation = useTestModelProvider()
  const createAuthProfileMutation = useCreateAuthProfile()
  const deleteAuthProfileMutation = useDeleteAuthProfile()

  // Provider 弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>(defaultFormData)
  const [deleteTarget, setDeleteTarget] = useState<ModelProvider | null>(null)
  const [newModel, setNewModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)

  // 是否处于编辑模式（而非新建）
  const isEditing = !!editingProvider

  // 测试结果状态：key 为 providerKey
  const [testResults, setTestResults] = useState<Record<string, ModelProviderTestResult>>({})

  // Embedding 配置状态
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>(defaultEmbeddingConfig)
  const [embeddingEditing, setEmbeddingEditing] = useState(false)
  const [savingEmbedding, setSavingEmbedding] = useState(false)

  /**
   * 加载 Embedding 配置
   */
  const loadEmbeddingConfig = useCallback(async () => {
    try {
      const configs = await apiClient.instance.getConfigs('memory')
      const embeddingEntry = configs.find((c) => c.key === 'memory_embedding')
      if (embeddingEntry?.value && typeof embeddingEntry.value === 'object') {
        const val = embeddingEntry.value as Record<string, unknown>
        setEmbeddingConfig({
          provider: String(val.provider ?? 'openai'),
          baseUrl: String(val.baseUrl ?? ''),
          model: String(val.model ?? ''),
          dimensions: Number(val.dimensions ?? 1024),
        })
      }
    } catch (error) {
      console.error('[AIConfig] 加载 Embedding 配置失败:', error)
    }
  }, [])

  /**
   * 从系统配置加载 Embedding 配置
   */
  useEffect(() => {
    if (allConfig) {
      void loadEmbeddingConfig()
    }
  }, [allConfig, loadEmbeddingConfig])

  /**
   * 刷新所有数据
   */
  const handleRefreshAll = useCallback(() => {
    refetchProviders()
    refetchAuthProfiles()
    void loadEmbeddingConfig()
  }, [refetchProviders, refetchAuthProfiles, loadEmbeddingConfig])

  // ---------------------------------------------------------------------------
  // Provider 表单操作
  // ---------------------------------------------------------------------------

  /**
   * 更新表单字段（不可变模式）
   */
  const updateField = useCallback(<K extends keyof ProviderFormData>(
    key: K,
    value: ProviderFormData[K]
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
  const handleOpenEdit = useCallback(
    (provider: ModelProvider) => {
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
    },
    []
  )

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
        formData.models.filter((m) => m !== model)
      )
    },
    [formData.models, updateField]
  )

  /**
   * 保存 Provider（同时保存 model_providers + auth_profiles）
   *
   * 创建时使用 POST（apiKey 必填），编辑时使用 PUT（apiKey 可选）
   */
  const handleSave = useCallback(async () => {
    if (!formData.providerKey.trim() || !formData.baseUrl.trim()) {
      return
    }

    const apiKeyValue = formData.apiKey.trim() || undefined

    setSavingProvider(true)
    try {
      // 1. 保存 Model Provider — 编辑用 PUT，创建用 POST
      if (isEditing) {
        await updateProviderMutation.mutateAsync({
          providerKey: formData.providerKey.trim(),
          request: {
            providerName: formData.providerName.trim() || undefined,
            baseUrl: formData.baseUrl.trim(),
            apiKey: apiKeyValue,
            apiType: formData.apiType || undefined,
            models: formData.models,
            enabled: formData.enabled,
            priority: formData.priority,
          },
        })
      } else {
        await createProviderMutation.mutateAsync({
          providerKey: formData.providerKey.trim(),
          providerName: formData.providerName.trim() || undefined,
          baseUrl: formData.baseUrl.trim(),
          apiKey: apiKeyValue ?? '',
          apiType: formData.apiType || undefined,
          models: formData.models,
          enabled: formData.enabled,
          priority: formData.priority,
        })
      }

      // 2. 同时保存 Auth Profile（如果提供了 API Key）
      if (apiKeyValue) {
        const providerForAuth =
          API_TYPE_TO_PROVIDER[formData.apiType] ?? formData.providerKey.trim()
        await createAuthProfileMutation.mutateAsync({
          profileId: `${formData.providerKey.trim()}-default`,
          provider: providerForAuth,
          credentialMode: 'api_key',
          apiKey: apiKeyValue,
          enabled: formData.enabled,
          priority: formData.priority,
        })
      }

      handleCloseDialog()
    } catch (error) {
      console.error('[AIConfig] 保存 Provider 失败:', error)
    } finally {
      setSavingProvider(false)
    }
  }, [
    formData,
    isEditing,
    createProviderMutation,
    updateProviderMutation,
    createAuthProfileMutation,
    handleCloseDialog,
  ])

  /**
   * 确认删除 Provider（同时删除对应的 auth profile）
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      // 删除 Model Provider
      await deleteProviderMutation.mutateAsync(deleteTarget.providerKey)

      // 尝试删除对应的 Auth Profile
      const matchingProfile = findAuthProfileForProvider(authProfiles, deleteTarget.providerKey)
      if (matchingProfile) {
        await deleteAuthProfileMutation.mutateAsync(matchingProfile.profileId).catch(() => {
          // auth profile 删除失败不阻塞
        })
      }

      setDeleteTarget(null)
    } catch (error) {
      console.error('[AIConfig] 删除 Provider 失败:', error)
    }
  }, [deleteTarget, deleteProviderMutation, deleteAuthProfileMutation, authProfiles])

  // ---------------------------------------------------------------------------
  // Provider 测试操作
  // ---------------------------------------------------------------------------

  /**
   * 测试指定 Provider 的连通性和模型可用性
   */
  const handleTestProvider = useCallback(
    async (providerKey: string) => {
      try {
        const result = await testProviderMutation.mutateAsync(providerKey)
        setTestResults((prev) => ({ ...prev, [providerKey]: result }))
      } catch (error) {
        console.error('[AIConfig] 测试 Provider 失败:', error)
        setTestResults((prev) => ({
          ...prev,
          [providerKey]: {
            connected: false,
            latencyMs: 0,
            error: error instanceof Error ? error.message : '测试请求失败',
            models: [],
          },
        }))
      }
    },
    [testProviderMutation]
  )

  /**
   * 清除指定 Provider 的测试结果
   */
  const handleClearTestResult = useCallback((providerKey: string) => {
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[providerKey]
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Embedding 配置操作
  // ---------------------------------------------------------------------------

  /**
   * 更新 Embedding 配置字段
   */
  const updateEmbeddingField = useCallback(<K extends keyof EmbeddingConfig>(
    key: K,
    value: EmbeddingConfig[K]
  ) => {
    setEmbeddingConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  /**
   * 保存 Embedding 配置到 system_configs
   */
  const handleSaveEmbedding = useCallback(async () => {
    setSavingEmbedding(true)
    try {
      await apiClient.instance.updateConfig('memory_embedding', {
        provider: embeddingConfig.provider,
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model,
        dimensions: embeddingConfig.dimensions,
      })
      setEmbeddingEditing(false)
    } catch (error) {
      console.error('[AIConfig] 保存 Embedding 配置失败:', error)
    } finally {
      setSavingEmbedding(false)
    }
  }, [embeddingConfig])

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
            <h1 className="text-2xl font-bold">AI 模型配置</h1>
            <p className="text-muted-foreground">
              管理 AI 模型提供商的连接和认证，配置保存后自动生效
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            添加 Provider
          </Button>
        </div>
      </div>

      {/* Provider 卡片列表 */}
      {providersLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !providers || providers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无 AI 模型提供商配置</p>
              <p className="text-sm mt-1">点击"添加 Provider"开始配置你的第一个 AI 模型</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => {
            const authProfile = findAuthProfileForProvider(authProfiles, provider.providerKey)
            const hasCredentials = !!authProfile || !!provider.apiKey
            const displayApiKey = authProfile?.apiKey ?? provider.apiKey

            return (
              <Card key={provider.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{provider.providerName || provider.providerKey}</CardTitle>
                      <Badge variant={provider.enabled ? 'default' : 'secondary'} className="text-xs">
                        {provider.enabled ? '启用' : '禁用'}
                      </Badge>
                    </div>
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
                        <DropdownMenuItem
                          onClick={() => handleTestProvider(provider.providerKey)}
                          disabled={testProviderMutation.isPending}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          测试连接
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
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {provider.providerKey}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {/* Base URL */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-16 shrink-0">Base URL</span>
                    <span className="text-xs truncate" title={provider.baseUrl}>
                      {provider.baseUrl}
                    </span>
                  </div>

                  {/* API Key */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-16 shrink-0">API Key</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {maskApiKey(displayApiKey)}
                    </code>
                    {hasCredentials ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>

                  {/* Models */}
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-16 shrink-0 pt-0.5">Models</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(provider.models) ? provider.models : [])
                        .slice(0, 4)
                        .map((model) => (
                          <Badge key={model} variant="secondary" className="text-xs">
                            {typeof model === 'string' ? model : String(model)}
                          </Badge>
                        ))}
                      {Array.isArray(provider.models) && provider.models.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.models.length - 4}
                        </Badge>
                      )}
                      {(!provider.models || provider.models.length === 0) && (
                        <span className="text-xs text-muted-foreground">未配置</span>
                      )}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-16 shrink-0">优先级</span>
                    <span className="text-xs">{provider.priority}</span>
                  </div>

                  {/* 测试进行中指示器 */}
                  {testProviderMutation.isPending &&
                    testProviderMutation.variables === provider.providerKey && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在测试连接...
                      </div>
                    )}

                  {/* 测试结果 */}
                  {testResults[provider.providerKey] && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {/* 连通性状态 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          {testResults[provider.providerKey].connected ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span>
                            {testResults[provider.providerKey].connected ? '连接成功' : '连接失败'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {testResults[provider.providerKey].latencyMs}ms
                          </span>
                        </div>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleClearTestResult(provider.providerKey)}
                          title="关闭测试结果"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* 连接错误信息 */}
                      {testResults[provider.providerKey].error && (
                        <p className="text-xs text-destructive pl-6">
                          {testResults[provider.providerKey].error}
                        </p>
                      )}

                      {/* 模型可用性列表 */}
                      {testResults[provider.providerKey].models.length > 0 && (
                        <div className="pl-6 space-y-1">
                          {testResults[provider.providerKey].models.map((m) => (
                            <div key={m.model} className="flex items-center gap-2 text-xs">
                              {m.available ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                              )}
                              <span className="truncate" title={m.model}>
                                {m.model}
                              </span>
                              <span className="text-muted-foreground shrink-0">{m.latencyMs}ms</span>
                              {m.error && (
                                <span className="text-destructive truncate" title={m.error}>
                                  {m.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Embedding 配置区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Embedding 模型配置
              </CardTitle>
              <CardDescription>用于记忆系统的向量嵌入服务</CardDescription>
            </div>
            {!embeddingEditing && (
              <Button variant="outline" size="sm" onClick={() => setEmbeddingEditing(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                编辑
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {embeddingEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={embeddingConfig.provider}
                    onChange={(e) => updateEmbeddingField('provider', e.target.value)}
                    placeholder="openai"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={embeddingConfig.model}
                    onChange={(e) => updateEmbeddingField('model', e.target.value)}
                    placeholder="text-embedding-3-small"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={embeddingConfig.baseUrl}
                    onChange={(e) => updateEmbeddingField('baseUrl', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dimensions</Label>
                  <Input
                    type="number"
                    value={embeddingConfig.dimensions}
                    onChange={(e) => updateEmbeddingField('dimensions', parseInt(e.target.value, 10) || 0)}
                    placeholder="1024"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEmbeddingEditing(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveEmbedding} disabled={savingEmbedding}>
                  {savingEmbedding && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Provider</span>
                <span>{embeddingConfig.provider || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Model</span>
                <span>{embeddingConfig.model || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Base URL</span>
                <span className="text-xs truncate block" title={embeddingConfig.baseUrl}>
                  {embeddingConfig.baseUrl || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Dimensions</span>
                <span>{embeddingConfig.dimensions}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑 Provider Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑 Provider' : '添加 Provider'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? `修改 ${editingProvider?.providerKey} 的配置`
                : '添加新的 AI 模型提供商，填写连接信息和 API Key'}
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
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {isEditing && (
                <p className="text-xs text-muted-foreground">留空将保持已有的 API Key 不变</p>
              )}
            </div>

            {/* Models */}
            <div className="space-y-2">
              <Label>支持的模型</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入模型 ID，按 Enter 添加"
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
                savingProvider ||
                !formData.providerKey.trim() ||
                !formData.baseUrl.trim() ||
                (!isEditing && !formData.apiKey.trim())
              }
            >
              {savingProvider && (
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
              此操作将同时删除关联的认证凭据，且不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProviderMutation.isPending && (
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
