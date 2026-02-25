/**
 * 模型定价管理页
 *
 * 提供定价列表、新建/编辑/删除定价功能
 * 新建时支持从模型提供商列表选择模型，自动填充 modelId 和 modelName
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ROUTES } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import {
  useModelPricingList,
  useUpsertModelPricing,
  useDeleteModelPricing,
} from '@/hooks/useCredits'
import { useModelProviders } from '@/hooks/useModelProviders'
import type { ModelPricing } from '@/types/credits'

/** 手动输入的占位 key */
const MANUAL_INPUT_KEY = '__manual__'

/**
 * 编辑弹窗状态
 */
interface EditDialogState {
  open: boolean
  mode: 'create' | 'edit'
  pricing: ModelPricing | null
}

/**
 * 定价表单数据
 */
interface PricingFormData {
  providerKey: string
  modelId: string
  modelName: string
  inputPrice: string
  outputPrice: string
  multiplier: string
}

/**
 * 空表单初始值
 */
const EMPTY_FORM: PricingFormData = {
  providerKey: '',
  modelId: '',
  modelName: '',
  inputPrice: '0',
  outputPrice: '0',
  multiplier: '1.00',
}

/**
 * 模型定价管理页组件
 */
export default function PricingPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    mode: 'create',
    pricing: null,
  })
  const [formData, setFormData] = useState<PricingFormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<ModelPricing | null>(null)

  const { data: pricings, isLoading } = useModelPricingList(showInactive ? false : undefined)
  const upsertMutation = useUpsertModelPricing()
  const deleteMutation = useDeleteModelPricing()
  const { data: providers } = useModelProviders()

  /** 当前选中提供商的 models 列表 */
  const selectedProviderModels = useMemo(() => {
    if (!formData.providerKey || formData.providerKey === MANUAL_INPUT_KEY || !providers) {
      return []
    }
    const provider = providers.find((p) => p.providerKey === formData.providerKey)
    return provider?.models ?? []
  }, [formData.providerKey, providers])

  /** 是否为手动输入模式 */
  const isManualMode = formData.providerKey === MANUAL_INPUT_KEY

  /**
   * 打开新建弹窗
   */
  const handleCreate = () => {
    setFormData(EMPTY_FORM)
    setEditDialog({ open: true, mode: 'create', pricing: null })
  }

  /**
   * 打开编辑弹窗
   */
  const handleEdit = (pricing: ModelPricing) => {
    setFormData({
      providerKey: '',
      modelId: pricing.modelId,
      modelName: pricing.modelName,
      inputPrice: String(pricing.inputPrice),
      outputPrice: String(pricing.outputPrice),
      multiplier: pricing.multiplier,
    })
    setEditDialog({ open: true, mode: 'edit', pricing })
  }

  /**
   * 提交表单（新建/编辑）
   */
  const handleSubmit = async () => {
    const inputPrice = parseFloat(formData.inputPrice)
    const outputPrice = parseFloat(formData.outputPrice)

    if (!formData.modelId.trim() || !formData.modelName.trim()) {
      alert('模型 ID 和名称不能为空')
      return
    }
    if (isNaN(inputPrice) || isNaN(outputPrice)) {
      alert('价格必须为有效数字')
      return
    }

    try {
      await upsertMutation.mutateAsync({
        modelId: formData.modelId.trim(),
        request: {
          modelName: formData.modelName.trim(),
          inputPrice,
          outputPrice,
          multiplier: formData.multiplier.trim() || '1.00',
        },
      })
      setEditDialog({ open: false, mode: 'create', pricing: null })
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  /**
   * 确认删除
   */
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.modelId)
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  /**
   * 更新表单字段
   */
  const updateField = (field: keyof PricingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  /**
   * 选择提供商时重置模型相关字段
   */
  const handleProviderChange = (providerKey: string) => {
    setFormData((prev) => ({
      ...prev,
      providerKey,
      modelId: '',
      modelName: '',
    }))
  }

  /**
   * 选择模型时自动填充 modelId 和 modelName
   */
  const handleModelSelect = (model: string) => {
    const provider = providers?.find((p) => p.providerKey === formData.providerKey)
    const providerKey = provider?.providerKey ?? formData.providerKey
    setFormData((prev) => ({
      ...prev,
      modelId: `${providerKey}/${model}`,
      modelName: model,
    }))
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={ROUTES.CREDITS}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">模型定价管理</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增定价
        </Button>
      </div>

      {/* 过滤选项 */}
      <div className="flex items-center gap-3">
        <Switch
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
        <Label htmlFor="show-inactive" className="text-sm">
          显示已停用
        </Label>
      </div>

      {/* 定价列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !pricings || pricings.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              暂无定价配置
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                    <th className="p-3 font-medium">模型 ID</th>
                    <th className="p-3 font-medium">模型名称</th>
                    <th className="p-3 font-medium">输入价格</th>
                    <th className="p-3 font-medium">输出价格</th>
                    <th className="p-3 font-medium">倍率</th>
                    <th className="p-3 font-medium">状态</th>
                    <th className="p-3 font-medium">更新时间</th>
                    <th className="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pricings.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.modelId}</td>
                      <td className="p-3 font-medium">{p.modelName}</td>
                      <td className="p-3 font-mono text-xs">{p.inputPrice}</td>
                      <td className="p-3 font-mono text-xs">{p.outputPrice}</td>
                      <td className="p-3 font-mono text-xs">{p.multiplier}</td>
                      <td className="p-3">
                        <Badge variant={p.isActive ? 'default' : 'secondary'}>
                          {p.isActive ? '启用' : '停用'}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {formatDateTime(p.updatedAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑 Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog({ open: false, mode: 'create', pricing: null })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog.mode === 'create' ? '新增模型定价' : '编辑模型定价'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 模型提供商选择（仅创建模式） */}
            {editDialog.mode === 'create' && (
              <div className="space-y-2">
                <Label>模型提供商</Label>
                <Select
                  value={formData.providerKey}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.filter((p) => p.enabled).map((p) => (
                      <SelectItem key={p.providerKey} value={p.providerKey}>
                        {p.providerName || p.providerKey}
                      </SelectItem>
                    ))}
                    <SelectItem value={MANUAL_INPUT_KEY}>手动输入</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 模型选择/输入 */}
            {editDialog.mode === 'create' ? (
              isManualMode ? (
                <div className="space-y-2">
                  <Label htmlFor="modelId">模型 ID</Label>
                  <Input
                    id="modelId"
                    placeholder="例如: anthropic/claude-sonnet-4-20250514"
                    value={formData.modelId}
                    onChange={(e) => updateField('modelId', e.target.value)}
                  />
                </div>
              ) : formData.providerKey ? (
                <div className="space-y-2">
                  <Label>模型</Label>
                  <Select
                    value={formData.modelName}
                    onValueChange={handleModelSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProviderModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.modelId && (
                    <p className="text-xs text-muted-foreground">
                      模型 ID: <code className="font-mono">{formData.modelId}</code>
                    </p>
                  )}
                </div>
              ) : null
            ) : (
              <div className="space-y-2">
                <Label htmlFor="modelId">模型 ID</Label>
                <Input
                  id="modelId"
                  value={formData.modelId}
                  disabled
                />
              </div>
            )}

            {/* 模型显示名称 */}
            <div className="space-y-2">
              <Label htmlFor="modelName">模型显示名称</Label>
              <Input
                id="modelName"
                placeholder="例如: Claude Sonnet 4"
                value={formData.modelName}
                onChange={(e) => updateField('modelName', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inputPrice">输入价格（积分/1M tokens）</Label>
                <Input
                  id="inputPrice"
                  type="number"
                  step="0.01"
                  value={formData.inputPrice}
                  onChange={(e) => updateField('inputPrice', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputPrice">输出价格（积分/1M tokens）</Label>
                <Input
                  id="outputPrice"
                  type="number"
                  step="0.01"
                  value={formData.outputPrice}
                  onChange={(e) => updateField('outputPrice', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="multiplier">倍率</Label>
              <Input
                id="multiplier"
                placeholder="1.00"
                value={formData.multiplier}
                onChange={(e) => updateField('multiplier', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                倍率用于高峰期调价，默认 1.00
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, mode: 'create', pricing: null })}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模型 <strong>{deleteTarget?.modelName}</strong>（{deleteTarget?.modelId}）的定价配置吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
