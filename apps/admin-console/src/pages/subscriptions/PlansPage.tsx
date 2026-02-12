import { useState, useCallback } from 'react'
import { Plus, Edit, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import {
  usePlanList,
  useCreatePlan,
  useUpdatePlan,
  type CreatePlanInput,
  type UpdatePlanInput,
} from '@/hooks/useSubscriptions'
import type { SubscriptionPlan } from '@/types/subscription'

/**
 * 计划表单数据
 */
interface PlanFormData {
  code: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  tokensPerMonth: number
  storageMb: number
  maxDevices: number
  sortOrder: number
  isActive: boolean
}

/**
 * 默认表单数据
 */
const defaultFormData: PlanFormData = {
  code: '',
  name: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  tokensPerMonth: 0,
  storageMb: 0,
  maxDevices: 1,
  sortOrder: 0,
  isActive: true,
}

/**
 * 订阅计划管理页面
 *
 * 支持查看、新建、编辑订阅计划，对接后端真实接口
 */
export default function PlansPage() {
  /** 计划列表数据 */
  const { data: plans, isLoading, refetch } = usePlanList()
  const createMutation = useCreatePlan()
  const updateMutation = useUpdatePlan()

  /** 编辑弹窗状态 */
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    plan: SubscriptionPlan | null
  }>({ open: false, mode: 'create', plan: null })

  /** 表单数据 */
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData)

  /**
   * 打开新建弹窗
   */
  const openCreateDialog = useCallback(() => {
    setFormData(defaultFormData)
    setEditDialog({ open: true, mode: 'create', plan: null })
  }, [])

  /**
   * 打开编辑弹窗
   */
  const openEditDialog = useCallback((plan: SubscriptionPlan) => {
    setFormData({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      priceMonthly: plan.price ?? plan.priceMonthly ?? 0,
      priceYearly: plan.priceYearly ?? 0,
      tokensPerMonth: plan.quotas?.maxTokensPerMonth ?? plan.tokensPerMonth ?? 0,
      storageMb: plan.storageMb ?? 0,
      maxDevices: plan.quotas?.maxDevices ?? plan.maxDevices ?? 1,
      sortOrder: plan.displayOrder ?? plan.sortOrder ?? 0,
      isActive: plan.isActive,
    })
    setEditDialog({ open: true, mode: 'edit', plan })
  }, [])

  /**
   * 关闭弹窗
   */
  const closeDialog = useCallback(() => {
    setEditDialog({ open: false, mode: 'create', plan: null })
  }, [])

  /**
   * 更新表单字段（不可变模式）
   */
  const updateField = useCallback(<K extends keyof PlanFormData>(key: K, value: PlanFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  /**
   * 保存计划（新建或编辑）
   */
  const handleSave = useCallback(async () => {
    try {
      if (editDialog.mode === 'create') {
        const input: CreatePlanInput = {
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          priceMonthly: formData.priceMonthly,
          priceYearly: formData.priceYearly,
          tokensPerMonth: formData.tokensPerMonth,
          storageMb: formData.storageMb,
          maxDevices: formData.maxDevices,
          sortOrder: formData.sortOrder,
        }
        await createMutation.mutateAsync(input)
      } else if (editDialog.plan) {
        const input: UpdatePlanInput = {
          planId: editDialog.plan.id,
          name: formData.name,
          description: formData.description || undefined,
          priceMonthly: formData.priceMonthly,
          priceYearly: formData.priceYearly,
          tokensPerMonth: formData.tokensPerMonth,
          storageMb: formData.storageMb,
          maxDevices: formData.maxDevices,
          sortOrder: formData.sortOrder,
          isActive: formData.isActive,
        }
        await updateMutation.mutateAsync(input)
      }
      closeDialog()
    } catch (error) {
      console.error('[PlansPage] 保存计划失败:', error)
      alert(error instanceof Error ? error.message : '保存失败')
    }
  }, [editDialog, formData, createMutation, updateMutation, closeDialog])

  const isSaving = createMutation.isPending || updateMutation.isPending
  const canSave = formData.name.trim() !== '' && formData.code.trim() !== ''

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订阅计划</h1>
          <p className="text-muted-foreground">管理系统订阅计划</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新建计划
          </Button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      )}

      {/* 计划列表 */}
      {!isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {(plans ?? []).map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                    {plan.isActive ? '启用' : '禁用'}
                  </Badge>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 价格 */}
                <div>
                  <span className="text-3xl font-bold">
                    {(plan.price ?? plan.priceMonthly ?? 0) === 0
                      ? '免费'
                      : formatCurrency(plan.price ?? plan.priceMonthly ?? 0)}
                  </span>
                  {(plan.price ?? plan.priceMonthly ?? 0) > 0 && (
                    <span className="text-muted-foreground">/月</span>
                  )}
                </div>

                {/* 配额 */}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    设备上限:{' '}
                    {(plan.quotas?.maxDevices ?? plan.maxDevices ?? 0) === -1
                      ? '无限'
                      : (plan.quotas?.maxDevices ?? plan.maxDevices ?? 0)}
                  </p>
                  <p>
                    月 Token 额度:{' '}
                    {(plan.quotas?.maxTokensPerMonth ?? plan.tokensPerMonth ?? 0) === -1
                      ? '无限'
                      : (plan.quotas?.maxTokensPerMonth ?? plan.tokensPerMonth ?? 0).toLocaleString()}
                  </p>
                  <p>
                    存储空间:{' '}
                    {(plan.storageMb ?? 0) === -1
                      ? '无限'
                      : `${plan.storageMb ?? 0} MB`}
                  </p>
                </div>

                {/* 功能列表（如果有） */}
                {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="space-y-1 text-sm border-t pt-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {typeof feature === 'string' ? feature : feature.name}
                      </li>
                    ))}
                  </ul>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(plan)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    编辑
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && (!plans || plans.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <p>暂无订阅计划</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            创建第一个计划
          </Button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editDialog.mode === 'create' ? '新建订阅计划' : '编辑订阅计划'}
            </DialogTitle>
            <DialogDescription>
              {editDialog.mode === 'create'
                ? '创建新的订阅计划，设置价格和配额'
                : '修改订阅计划信息'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 计划代码 */}
            <div className="space-y-2">
              <Label htmlFor="plan-code">计划代码</Label>
              <Input
                id="plan-code"
                value={formData.code}
                onChange={(e) => updateField('code', e.target.value)}
                placeholder="例如：free, basic, pro"
                disabled={editDialog.mode === 'edit'}
              />
            </div>

            {/* 计划名称 */}
            <div className="space-y-2">
              <Label htmlFor="plan-name">计划名称</Label>
              <Input
                id="plan-name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="例如：免费版、基础版"
              />
            </div>

            {/* 描述 */}
            <div className="space-y-2">
              <Label htmlFor="plan-desc">描述</Label>
              <Textarea
                id="plan-desc"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="计划说明"
                rows={2}
              />
            </div>

            {/* 价格 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-price-monthly">月价格 (分)</Label>
                <Input
                  id="plan-price-monthly"
                  type="number"
                  value={formData.priceMonthly}
                  onChange={(e) => updateField('priceMonthly', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-price-yearly">年价格 (分)</Label>
                <Input
                  id="plan-price-yearly"
                  type="number"
                  value={formData.priceYearly}
                  onChange={(e) => updateField('priceYearly', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            {/* 配额 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-tokens">月 Token 额度</Label>
                <Input
                  id="plan-tokens"
                  type="number"
                  value={formData.tokensPerMonth}
                  onChange={(e) => updateField('tokensPerMonth', Number(e.target.value))}
                  min={-1}
                  placeholder="-1 表示无限"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-storage">存储空间 (MB)</Label>
                <Input
                  id="plan-storage"
                  type="number"
                  value={formData.storageMb}
                  onChange={(e) => updateField('storageMb', Number(e.target.value))}
                  min={-1}
                  placeholder="-1 表示无限"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-devices">最大设备数</Label>
                <Input
                  id="plan-devices"
                  type="number"
                  value={formData.maxDevices}
                  onChange={(e) => updateField('maxDevices', Number(e.target.value))}
                  min={-1}
                  placeholder="-1 表示无限"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-sort">排序</Label>
                <Input
                  id="plan-sort"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => updateField('sortOrder', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            {/* 启用状态（仅编辑模式） */}
            {editDialog.mode === 'edit' && (
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-active">启用状态</Label>
                <Switch
                  id="plan-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => updateField('isActive', checked)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
