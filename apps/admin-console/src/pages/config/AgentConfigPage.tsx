/**
 * Agent 配置页面
 *
 * 管理 Agent 运行参数：模型选择、并发数、压缩模式、工作空间等
 * 参考 SiteConfigPage 的表单编辑模式
 */

import { useState, useEffect } from 'react'
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
import type { UpdateAgentConfigRequest } from '@openclaw/api-client/admin'

/** 压缩模式选项 */
const COMPACTION_MODES = [
  { value: 'safeguard', label: 'Safeguard（保守）' },
  { value: 'aggressive', label: 'Aggressive（激进）' },
  { value: 'none', label: 'None（不压缩）' },
] as const

/** 常用模型列表 */
const COMMON_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
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
 * Agent 配置页面组件
 */
export default function AgentConfigPage() {
  const { data: config, isLoading, isFetching, refetch } = useAgentConfig()
  const updateConfig = useUpdateAgentConfig()
  const resetConfig = useResetAgentConfig()

  const [formData, setFormData] = useState<AgentFormData>(DEFAULT_FORM)
  const [hasChanges, setHasChanges] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)

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

      // 判断当前模型是否在常用列表中
      const isCommon = COMMON_MODELS.some((m) => m.value === data.primaryModel)
      setUseCustomModel(data.primaryModel !== '' && !isCommon)
    }
  }, [config])

  /**
   * 更新表单字段
   */
  const handleChange = <K extends keyof AgentFormData>(field: K, value: AgentFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 处理模型选择
   */
  const handleModelSelect = (value: string) => {
    if (value === '__custom__') {
      setUseCustomModel(true)
      handleChange('primaryModel', '')
    } else {
      setUseCustomModel(false)
      handleChange('primaryModel', value)
    }
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
    } catch (error) {
      console.error('保存 Agent 配置失败:', error)
    }
  }

  /**
   * 重置为默认值
   */
  const handleReset = async () => {
    try {
      await resetConfig.mutateAsync()
      setHasChanges(false)
    } catch (error) {
      console.error('重置 Agent 配置失败:', error)
    }
  }

  /**
   * 撤销表单修改
   */
  const handleDiscard = () => {
    if (config) {
      setFormData({
        primaryModel: config.primaryModel ?? '',
        compactionMode: config.compactionMode ?? 'safeguard',
        maxConcurrent: config.maxConcurrent ?? 1,
        subagentsMaxConcurrent: config.subagentsMaxConcurrent ?? 1,
        workspacePath: config.workspacePath ?? '',
      })
      setHasChanges(false)

      const isCommon = COMMON_MODELS.some((m) => m.value === config.primaryModel)
      setUseCustomModel(config.primaryModel !== '' && config.primaryModel != null && !isCommon)
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
              <CardDescription>设置 Agent 使用的默认 AI 模型</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryModel">主模型</Label>
                {!useCustomModel ? (
                  <Select
                    value={formData.primaryModel || undefined}
                    onValueChange={handleModelSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">自定义模型...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="primaryModel"
                      value={formData.primaryModel}
                      onChange={(e) => handleChange('primaryModel', e.target.value)}
                      placeholder="输入自定义模型名称，如 claude-opus-4-20250514"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUseCustomModel(false)
                        handleChange('primaryModel', '')
                      }}
                    >
                      切换选择
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Agent 默认使用的 AI 模型，可从常用列表选择或输入自定义模型名称
                </p>
              </div>
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
