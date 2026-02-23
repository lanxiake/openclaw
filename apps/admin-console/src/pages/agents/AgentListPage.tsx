/**
 * Agent 管理页面
 *
 * 提供自定义 Agent 的列表查看、创建、编辑、删除和启用/禁用功能
 * 支持搜索过滤、分页、卡片布局和详细配置（Tab 分组）
 */

import { useState } from 'react'
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Bot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { formatDateTime, cn } from '@/lib/utils'
import {
  AGENT_SANDBOX_MODE_LABELS,
  AGENT_WORKSPACE_ACCESS_LABELS,
  AGENT_THEME_OPTIONS,
} from '@/lib/constants'
import {
  useAgentList,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useToggleAgent,
} from '@/hooks/useAgents'
import type {
  CustomAgent,
  AgentListQuery,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentIdentity,
  AgentModelConfig,
  AgentToolsConfig,
  AgentSandboxConfig,
} from '@/types/agent'
import { useDebounce } from '@/hooks/useDebounce'
import { useModelProviders } from '@/hooks/useModelProviders'

/**
 * 主题色与 Tailwind 颜色映射
 */
const THEME_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  pink: 'bg-pink-100 text-pink-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  yellow: 'bg-yellow-100 text-yellow-800',
}

/**
 * Agent 编辑表单数据结构
 */
interface AgentFormData {
  name: string
  description: string
  systemPrompt: string
  identity: AgentIdentity
  model: AgentModelConfig
  tools: AgentToolsConfig
  sandbox: AgentSandboxConfig
  isEnabled: boolean
}

/**
 * 默认表单数据
 */
const DEFAULT_FORM: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  identity: { name: '', emoji: '🤖', theme: 'blue' },
  model: { primary: '' },
  tools: { allowedTools: [], deniedTools: [], autoApprove: [] },
  sandbox: { mode: 'off', workspaceAccess: 'rw' },
  isEnabled: true,
}

/**
 * 从 CustomAgent 实体生成表单数据
 */
function agentToForm(agent: CustomAgent): AgentFormData {
  return {
    name: agent.name,
    description: agent.description ?? '',
    systemPrompt: agent.systemPrompt ?? '',
    identity: { ...agent.identity },
    model: agent.model ? { ...agent.model } : { primary: '' },
    tools: agent.tools
      ? {
          allowedTools: [...(agent.tools.allowedTools ?? [])],
          deniedTools: [...(agent.tools.deniedTools ?? [])],
          autoApprove: [...(agent.tools.autoApprove ?? [])],
        }
      : { allowedTools: [], deniedTools: [], autoApprove: [] },
    sandbox: agent.sandbox ? { ...agent.sandbox } : { mode: 'off', workspaceAccess: 'rw' },
    isEnabled: agent.isEnabled,
  }
}

/**
 * Agent 管理页面组件
 */
export default function AgentListPage() {
  /** 搜索和过滤状态 */
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const debouncedSearch = useDebounce(searchInput, 300)

  /** Dialog 状态 */
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null)
  const [formData, setFormData] = useState<AgentFormData>({ ...DEFAULT_FORM })
  const [activeTab, setActiveTab] = useState('basic')

  /** 确认删除 Dialog */
  const [deleteTarget, setDeleteTarget] = useState<CustomAgent | null>(null)

  /** 构建查询参数 */
  const query: AgentListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? (statusFilter as 'enabled' | 'disabled') : undefined,
  }

  /** 数据查询 */
  const { data, isLoading, isFetching, refetch } = useAgentList(query)
  const createMutation = useCreateAgent()
  const updateMutation = useUpdateAgent()
  const deleteMutation = useDeleteAgent()
  const toggleMutation = useToggleAgent()
  const { data: providers } = useModelProviders()

  /** 打开创建 Dialog */
  const handleOpenCreate = () => {
    setEditingAgent(null)
    setFormData({ ...DEFAULT_FORM })
    setActiveTab('basic')
    setDialogOpen(true)
  }

  /** 打开编辑 Dialog */
  const handleOpenEdit = (agent: CustomAgent) => {
    setEditingAgent(agent)
    setFormData(agentToForm(agent))
    setActiveTab('basic')
    setDialogOpen(true)
  }

  /** 提交表单（创建或更新） */
  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    if (editingAgent) {
      const updateData: UpdateAgentRequest = {
        name: formData.name,
        description: formData.description || undefined,
        systemPrompt: formData.systemPrompt || undefined,
        identity: formData.identity,
        model: formData.model.primary ? formData.model : undefined,
        tools: formData.tools,
        sandbox: formData.sandbox,
        isEnabled: formData.isEnabled,
      }
      await updateMutation.mutateAsync({ agentId: editingAgent.id, data: updateData })
    } else {
      const createData: CreateAgentRequest = {
        name: formData.name,
        description: formData.description || undefined,
        systemPrompt: formData.systemPrompt || undefined,
        identity: formData.identity,
        model: formData.model.primary ? formData.model : undefined,
        tools: formData.tools,
        sandbox: formData.sandbox,
        isEnabled: formData.isEnabled,
      }
      await createMutation.mutateAsync(createData)
    }
    setDialogOpen(false)
  }

  /** 确认删除 */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  /** 切换启用/禁用 */
  const handleToggle = async (agent: CustomAgent) => {
    await toggleMutation.mutateAsync({ agentId: agent.id, isEnabled: !agent.isEnabled })
  }

  /** 更新表单字段的便捷方法 */
  const updateForm = <K extends keyof AgentFormData>(field: K, value: AgentFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  /** 更新 identity 子字段 */
  const updateIdentity = (field: keyof AgentIdentity, value: string) => {
    setFormData((prev) => ({
      ...prev,
      identity: { ...prev.identity, [field]: value },
    }))
  }

  /** 更新 model 子字段 */
  const updateModel = (field: keyof AgentModelConfig, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      model: { ...prev.model, [field]: value },
    }))
  }

  /** 更新 tools 子字段 */
  const updateTools = (field: keyof AgentToolsConfig, value: string[]) => {
    setFormData((prev) => ({
      ...prev,
      tools: { ...prev.tools, [field]: value },
    }))
  }

  /** 更新 sandbox 子字段 */
  const updateSandbox = (field: keyof AgentSandboxConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      sandbox: { ...prev.sandbox, [field]: value },
    }))
  }

  const agents = data?.agents ?? []
  const totalPages = data?.totalPages ?? 1
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Agent 管理
          </h1>
          <p className="text-muted-foreground">管理自定义 AI Agent，配置身份、模型、工具和沙箱</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            创建 Agent
          </Button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索 Agent 名称或描述..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="enabled">已启用</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agent 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {debouncedSearch || statusFilter !== 'all'
              ? '没有找到匹配的 Agent'
              : '还没有创建任何 Agent，点击上方按钮创建'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {data?.total ?? 0} 个 Agent
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? '编辑 Agent' : '创建 Agent'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="basic">基础信息</TabsTrigger>
              <TabsTrigger value="identity">身份配置</TabsTrigger>
              <TabsTrigger value="prompt">系统提示词</TabsTrigger>
              <TabsTrigger value="model">模型配置</TabsTrigger>
              <TabsTrigger value="tools">工具配置</TabsTrigger>
              <TabsTrigger value="sandbox">沙箱配置</TabsTrigger>
            </TabsList>

            {/* 基础信息 Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">
                  Agent 名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="agent-name"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="例如：编程助手"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-description">描述</Label>
                <Textarea
                  id="agent-description"
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Agent 的功能描述..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => updateForm('isEnabled', checked)}
                />
                <Label>启用此 Agent</Label>
              </div>
            </TabsContent>

            {/* 身份配置 Tab */}
            <TabsContent value="identity" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="identity-name">显示名称</Label>
                <Input
                  id="identity-name"
                  value={formData.identity.name ?? ''}
                  onChange={(e) => updateIdentity('name', e.target.value)}
                  placeholder="用户看到的 Agent 名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="identity-emoji">Emoji</Label>
                <Input
                  id="identity-emoji"
                  value={formData.identity.emoji ?? ''}
                  onChange={(e) => updateIdentity('emoji', e.target.value)}
                  placeholder="🤖"
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">Agent 头像旁显示的表情符号</p>
              </div>
              <div className="space-y-2">
                <Label>主题色</Label>
                <div className="flex flex-wrap gap-2">
                  {AGENT_THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        'px-3 py-1.5 rounded-md text-sm border-2 transition-colors',
                        THEME_COLOR_MAP[opt.value] ?? 'bg-gray-100 text-gray-800',
                        formData.identity.theme === opt.value
                          ? 'border-primary ring-1 ring-primary'
                          : 'border-transparent',
                      )}
                      onClick={() => updateIdentity('theme', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="identity-avatar">头像 URL</Label>
                <Input
                  id="identity-avatar"
                  value={formData.identity.avatar ?? ''}
                  onChange={(e) => updateIdentity('avatar', e.target.value)}
                  placeholder="https://example.com/avatar.png 或 data:image/..."
                />
                <p className="text-xs text-muted-foreground">
                  支持 HTTP URL 或 data URI 格式
                </p>
              </div>
            </TabsContent>

            {/* 系统提示词 Tab */}
            <TabsContent value="prompt" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">系统提示词 (System Prompt)</Label>
                <Textarea
                  id="system-prompt"
                  value={formData.systemPrompt}
                  onChange={(e) => updateForm('systemPrompt', e.target.value)}
                  placeholder="定义 Agent 的行为、角色和约束..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.systemPrompt.length} 字符
                </p>
              </div>
            </TabsContent>

            {/* 模型配置 Tab */}
            <TabsContent value="model" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>主模型</Label>
                {providers && providers.length > 0 ? (
                  <Select
                    value={formData.model.primary || undefined}
                    onValueChange={(v) => updateModel('primary', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers
                        .filter((p) => p.enabled)
                        .flatMap((provider) => {
                          const models = Array.isArray(provider.models)
                            ? provider.models.filter((m): m is string => typeof m === 'string')
                            : []
                          return models.map((modelId) => (
                            <SelectItem
                              key={`${provider.providerKey}/${modelId}`}
                              value={`${provider.providerKey}/${modelId}`}
                            >
                              {provider.providerName ?? provider.providerKey} / {modelId}
                            </SelectItem>
                          ))
                        })}
                      <SelectItem value="__custom__">自定义输入...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.model.primary ?? ''}
                    onChange={(e) => updateModel('primary', e.target.value)}
                    placeholder="provider/model-id"
                  />
                )}
                {formData.model.primary === '__custom__' && (
                  <Input
                    value=""
                    onChange={(e) => updateModel('primary', e.target.value)}
                    placeholder="输入 provider/model-id 格式"
                    className="mt-2"
                  />
                )}
                {formData.model.primary && formData.model.primary !== '__custom__' && (
                  <p className="text-xs text-muted-foreground">
                    当前: <code className="bg-muted px-1 rounded">{formData.model.primary}</code>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-fallbacks">备用模型链</Label>
                <Input
                  id="model-fallbacks"
                  value={(formData.model.fallbacks ?? []).join(', ')}
                  onChange={(e) =>
                    updateModel(
                      'fallbacks',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="逗号分隔，如: anthropic/claude-sonnet-4-20250514, openai/gpt-4o"
                />
                <p className="text-xs text-muted-foreground">
                  主模型不可用时依次尝试的备用模型
                </p>
              </div>
            </TabsContent>

            {/* 工具配置 Tab */}
            <TabsContent value="tools" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="tools-allowed">允许的工具</Label>
                <Input
                  id="tools-allowed"
                  value={(formData.tools.allowedTools ?? []).join(', ')}
                  onChange={(e) =>
                    updateTools(
                      'allowedTools',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="逗号分隔，留空表示允许所有工具"
                />
                <p className="text-xs text-muted-foreground">
                  限定 Agent 可使用的工具列表，留空表示不限制
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tools-denied">禁止的工具</Label>
                <Input
                  id="tools-denied"
                  value={(formData.tools.deniedTools ?? []).join(', ')}
                  onChange={(e) =>
                    updateTools(
                      'deniedTools',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="逗号分隔，如: bash, file_delete"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tools-auto-approve">自动批准的工具</Label>
                <Input
                  id="tools-auto-approve"
                  value={(formData.tools.autoApprove ?? []).join(', ')}
                  onChange={(e) =>
                    updateTools(
                      'autoApprove',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="逗号分隔，如: search, calculator"
                />
                <p className="text-xs text-muted-foreground">
                  这些工具执行时无需用户确认
                </p>
              </div>
            </TabsContent>

            {/* 沙箱配置 Tab */}
            <TabsContent value="sandbox" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>沙箱模式</Label>
                <Select
                  value={formData.sandbox.mode ?? 'off'}
                  onValueChange={(v) => updateSandbox('mode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AGENT_SANDBOX_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  控制 Agent 执行环境的隔离级别
                </p>
              </div>
              <div className="space-y-2">
                <Label>工作空间访问权限</Label>
                <Select
                  value={formData.sandbox.workspaceAccess ?? 'rw'}
                  onValueChange={(v) => updateSandbox('workspaceAccess', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AGENT_WORKSPACE_ACCESS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Agent 对工作空间文件的读写权限
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || isSubmitting}
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              {editingAgent ? '保存修改' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认删除 AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 Agent？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 Agent「{deleteTarget?.name}」吗？此操作不可撤销，
              与该 Agent 相关的会话数据可能受到影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
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

/**
 * Agent 卡片组件
 *
 * 在网格布局中展示单个 Agent 的概要信息和操作菜单
 */
function AgentCard({
  agent,
  onEdit,
  onDelete,
  onToggle,
}: {
  agent: CustomAgent
  onEdit: (agent: CustomAgent) => void
  onDelete: (agent: CustomAgent) => void
  onToggle: (agent: CustomAgent) => void
}) {
  const themeClass = THEME_COLOR_MAP[agent.identity.theme ?? 'blue'] ?? 'bg-gray-100 text-gray-800'

  return (
    <Card className={cn('transition-opacity', !agent.isEnabled && 'opacity-60')}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Emoji 头像 */}
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                themeClass,
              )}
            >
              {agent.identity.emoji ?? '🤖'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{agent.name}</h3>
                {agent.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    默认
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {agent.identity.name ?? agent.name}
              </p>
            </div>
          </div>

          {/* 操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(agent)}>
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(agent)}>
                {agent.isEnabled ? (
                  <>
                    <PowerOff className="mr-2 h-4 w-4" />
                    禁用
                  </>
                ) : (
                  <>
                    <Power className="mr-2 h-4 w-4" />
                    启用
                  </>
                )}
              </DropdownMenuItem>
              {!agent.isDefault && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(agent)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 描述 */}
        {agent.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
        )}

        {/* 元信息标签 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant={agent.isEnabled ? 'default' : 'secondary'}>
            {agent.isEnabled ? '已启用' : '已禁用'}
          </Badge>
          {agent.model?.primary && (
            <Badge variant="outline" className="text-xs font-mono">
              {agent.model.primary}
            </Badge>
          )}
          {agent.sandbox?.mode && agent.sandbox.mode !== 'off' && (
            <Badge variant="outline" className="text-xs">
              沙箱: {AGENT_SANDBOX_MODE_LABELS[agent.sandbox.mode] ?? agent.sandbox.mode}
            </Badge>
          )}
        </div>

        {/* 时间信息 */}
        <div className="mt-3 text-xs text-muted-foreground">
          创建: {formatDateTime(agent.createdAt)} · 更新: {formatDateTime(agent.updatedAt)}
        </div>
      </CardContent>
    </Card>
  )
}
