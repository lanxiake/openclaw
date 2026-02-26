/**
 * Agent 配置页面
 *
 * 管理 Agent 运行参数：模型选择（两级联动：提供商→模型）、并发数、压缩模式、工作空间等
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, RefreshCw, RotateCcw, Bot, Cpu, FolderOpen } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useAgentConfig, useUpdateAgentConfig, useResetAgentConfig } from '@/hooks/useAgentConfig'
import { useModelProviders } from '@/hooks/useModelProviders'
import type { ModelProvider, UpdateAgentConfigRequest } from '@mtbot/api-client/admin'

/** 压缩模式选项 */
const COMPACTION_MODES = [
  { value: 'safeguard', label: 'Safeguard（保守）' },
  { value: 'aggressive', label: 'Aggressive（激进）' },
  { value: 'none', label: 'None（不压缩）' },
] as const

/** 表单数据类型 */
interface AgentFormData {
  primaryModel: string
  compactionMode: string
  maxConcurrent: number
  subagentsMaxConcurrent: number
  workspacePath: string
}

/** 默认表单值 */
const DEFAULT_FORM: AgentFormData = {
  primaryModel: '',
  compactionMode: 'safeguard',
  maxConcurrent: 1,
  subagentsMaxConcurrent: 1,
  workspacePath: '',
}

/**
 * 从 primaryModel 字符串解析出 providerKey 和 modelId
 *
 * 格式："{providerKey}/{modelId}" 或裸模型 ID（兼容旧数据）
 */
function parsePrimaryModel(primaryModel: string): { providerKey: string; modelId: string } {
  const slashIndex = primaryModel.indexOf('/')
  if (slashIndex > 0) {
    return {
      providerKey: primaryModel.slice(0, slashIndex),
      modelId: primaryModel.slice(slashIndex + 1),
    }
  }
  return { providerKey: '', modelId: primaryModel }
}

/**
 * 根据 primaryModel 和已配置提供商列表，推断模型选择状态
 *
 * 返回两级联动的选中状态，用于 useEffect 初始化和撤销操作
 */
function resolveModelSelectionState(
  primaryModel: string,
  providers: ModelProvider[] | undefined,
): { selectedProvider: string; selectedModel: string; useCustomModel: boolean } {
  const { providerKey, modelId } = parsePrimaryModel(primaryModel)
  const hasMatchingProvider =
    providerKey !== '' && providers?.some((p) => p.providerKey === providerKey)

  if (hasMatchingProvider) {
    return { selectedProvider: providerKey, selectedModel: modelId, useCustomModel: false }
  }
  if (primaryModel !== '') {
    return { selectedProvider: '', selectedModel: '', useCustomModel: true }
  }
  return { selectedProvider: '', selectedModel: '', useCustomModel: false }
}

/**
 * Agent 配置页面组件
 */
export default function AgentConfigPage() {
  const { data: config, isLoading, isFetching, refetch } = useAgentConfig()
  const updateConfig = useUpdateAgentConfig()
  const resetConfig = useResetAgentConfig()
  const { data: providers } = useModelProviders()

  const [formData, setFormData] = useState<AgentFormData>(DEFAULT_FORM)
  const [hasChanges, setHasChanges] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)

  /** 两级联动的选中状态 */
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')

  /** 当前选中提供商下的模型列表（过滤非字符串值保证类型安全） */
  const availableModels = useMemo((): string[] => {
    if (!selectedProvider || !providers) return []
    const provider = providers.find((p) => p.providerKey === selectedProvider)
    const raw = provider?.models
    if (!Array.isArray(raw)) return []
    return raw.filter((m): m is string => typeof m === 'string')
  }, [selectedProvider, providers])

  /** 从 API 数据初始化表单 */
  useEffect(() => {
    if (config) {
      const data: AgentFormData = {
        primaryModel: config.primaryModel ?? '',
        compactionMode: config.compactionMode ?? 'safeguard',
        maxConcurrent: config.maxConcurrent ?? 1,
        subagentsMaxConcurrent: config.subagentsMaxConcurrent ?? 1,
        workspacePath: config.workspacePath ?? '',
      }
      setFormData(data)
      setHasChanges(false)

      const state = resolveModelSelectionState(data.primaryModel, providers)
      setSelectedProvider(state.selectedProvider)
      setSelectedModel(state.selectedModel)
      setUseCustomModel(state.useCustomModel)
    }
  }, [config, providers])

  /**
   * 更新表单字段
   */
  const handleChange = <K extends keyof AgentFormData>(field: K, value: AgentFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 处理提供商选择变化
   */
  const handleProviderChange = (providerKey: string) => {
    if (providerKey === '__custom__') {
      setUseCustomModel(true)
      setSelectedProvider('')
      setSelectedModel('')
      handleChange('primaryModel', '')
      return
    }
    setSelectedProvider(providerKey)
    setSelectedModel('')
    // 清空 primaryModel，等用户选择具体模型后再拼接
    handleChange('primaryModel', '')
  }

  /**
   * 处理模型选择变化
   */
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId)
    // 拼接为 provider/model 格式存入 formData
    const fullModelRef = `${selectedProvider}/${modelId}`
    handleChange('primaryModel', fullModelRef)
  }

  /**
   * 保存配置
   */
  const handleSave = async () => {
    const request: UpdateAgentConfigRequest = {
      primaryModel: formData.primaryModel || undefined,
      compactionMode: formData.compactionMode || undefined,
      maxConcurrent: formData.maxConcurrent,
      subagentsMaxConcurrent: formData.subagentsMaxConcurrent,
      workspacePath: formData.workspacePath || undefined,
    }

    try {
      await updateConfig.mutateAsync(request)
      setHasChanges(false)
    } catch {
      // 错误由 React Query 的 error state 处理
    }
  }

  /**
   * 重置为默认值
   */
  const handleReset = async () => {
    try {
      await resetConfig.mutateAsync()
      setHasChanges(false)
    } catch {
      // 错误由 React Query 的 error state 处理
    }
  }

  /**
   * 撤销表单修改
   */
  const handleDiscard = () => {
    if (config) {
      const pm = config.primaryModel ?? ''
      setFormData({
        primaryModel: pm,
        compactionMode: config.compactionMode ?? 'safeguard',
        maxConcurrent: config.maxConcurrent ?? 1,
        subagentsMaxConcurrent: config.subagentsMaxConcurrent ?? 1,
        workspacePath: config.workspacePath ?? '',
      })
      setHasChanges(false)

      const state = resolveModelSelectionState(pm, providers)
      setSelectedProvider(state.selectedProvider)
      setSelectedModel(state.selectedModel)
      setUseCustomModel(state.useCustomModel)
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
            <h1 className="text-2xl font-bold">Agent 配置</h1>
            <p className="text-muted-foreground">管理 Agent 运行参数和默认设置</p>
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

          {/* 重置为默认值（需要确认） */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-orange-600 hover:text-orange-700">
                <RotateCcw className="mr-2 h-4 w-4" />
                恢复默认
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认恢复默认配置？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将把所有 Agent 配置重置为系统默认值，当前自定义配置将丢失。此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  确认恢复
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
          {/* 模型选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                模型选择
              </CardTitle>
              <CardDescription>
                从已配置的模型提供商中选择模型，或手动输入 provider/model 格式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!useCustomModel ? (
                <>
                  {/* 第一级：选择提供商 */}
                  <div className="space-y-2">
                    <Label>模型提供商</Label>
                    {providers && providers.length > 0 ? (
                      <Select
                        value={selectedProvider || undefined}
                        onValueChange={handleProviderChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择模型提供商" />
                        </SelectTrigger>
                        <SelectContent>
                          {providers
                            .filter((p) => p.enabled)
                            .map((provider) => (
                              <SelectItem key={provider.providerKey} value={provider.providerKey}>
                                {provider.providerName || provider.providerKey}
                              </SelectItem>
                            ))}
                          <SelectItem value="__custom__">自定义输入...</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          尚未配置模型提供商，请先在
                          <Link to="/config/model-providers" className="text-primary underline mx-1">
                            模型提供商管理
                          </Link>
                          中添加
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUseCustomModel(true)}
                        >
                          手动输入
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 第二级：选择模型 */}
                  {selectedProvider && (
                    <div className="space-y-2">
                      <Label>模型</Label>
                      {availableModels.length > 0 ? (
                        <Select
                          value={selectedModel || undefined}
                          onValueChange={handleModelChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map((modelId) => (
                              <SelectItem key={modelId} value={modelId}>
                                {modelId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          该提供商未配置模型列表，请在模型提供商管理中添加模型
                        </p>
                      )}
                    </div>
                  )}

                  {/* 显示当前值 */}
                  {formData.primaryModel && (
                    <p className="text-xs text-muted-foreground">
                      当前值: <code className="bg-muted px-1 rounded">{formData.primaryModel}</code>
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="primaryModel">自定义模型</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryModel"
                      value={formData.primaryModel}
                      onChange={(e) => handleChange('primaryModel', e.target.value)}
                      placeholder="provider/model-id，如 new-api/claude-opus-4-5-20251101"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUseCustomModel(false)
                        setSelectedProvider('')
                        setSelectedModel('')
                        handleChange('primaryModel', '')
                      }}
                    >
                      切换选择
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    格式: provider-key/model-id（如 anthropic/claude-opus-4-5-20251101）
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 运行参数 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                运行参数
              </CardTitle>
              <CardDescription>控制 Agent 的并发和上下文压缩行为</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="compactionMode">上下文压缩模式</Label>
                <Select
                  value={formData.compactionMode}
                  onValueChange={(v) => handleChange('compactionMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPACTION_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  控制对话上下文达到限制时的压缩策略。Safeguard
                  保留更多信息但消耗更多 Token，Aggressive 压缩更积极
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxConcurrent">最大并发数</Label>
                  <Input
                    id="maxConcurrent"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.maxConcurrent}
                    onChange={(e) => handleChange('maxConcurrent', parseInt(e.target.value, 10) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    主 Agent 的最大并发会话数（1-20）
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subagentsMaxConcurrent">子 Agent 最大并发数</Label>
                  <Input
                    id="subagentsMaxConcurrent"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.subagentsMaxConcurrent}
                    onChange={(e) =>
                      handleChange('subagentsMaxConcurrent', parseInt(e.target.value, 10) || 1)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    每个会话中子 Agent 的最大并发数（1-20）
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 系统配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                系统配置
              </CardTitle>
              <CardDescription>Agent 运行时的系统级设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspacePath">工作空间路径</Label>
                <Input
                  id="workspacePath"
                  value={formData.workspacePath}
                  onChange={(e) => handleChange('workspacePath', e.target.value)}
                  placeholder="/home/user/workspace"
                />
                <p className="text-xs text-muted-foreground">
                  Agent 执行文件操作时的默认工作目录，留空使用系统默认路径
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
