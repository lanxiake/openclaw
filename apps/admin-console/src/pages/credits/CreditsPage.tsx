/**
 * 积分管理概览页
 *
 * 提供用户积分查询入口、模型定价预览和过期清理操作
 */

import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Coins, Search, ArrowRight, Trash2, Plus, Edit, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ROUTES } from '@/lib/constants'
import { useModelPricingList, useCleanupExpiredCredits } from '@/hooks/useCredits'
import { useCreditPacks, useUpdateCreditPacks, type CreditPack } from '@/hooks/useConfig'

/**
 * 积分管理概览页组件
 */
export default function CreditsPage() {
  const [userIdInput, setUserIdInput] = useState('')
  const navigate = useNavigate()

  const { data: pricings, isLoading: pricingsLoading } = useModelPricingList(true)
  const cleanupMutation = useCleanupExpiredCredits()

  /** 积分包数据 */
  const { data: creditPacks, isLoading: packsLoading } = useCreditPacks()
  const updatePacksMutation = useUpdateCreditPacks()

  /** 积分包编辑弹窗 */
  const [packDialog, setPackDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    index: number
  }>({ open: false, mode: 'create', index: -1 })

  /** 积分包表单数据 */
  const [packForm, setPackForm] = useState<CreditPack>({
    id: '',
    name: '',
    credits: 0,
    price: 0,
    expiryMonths: 3,
    recommended: false,
    sortOrder: 0,
    isActive: true,
  })

  /**
   * 更新积分包表单字段
   */
  const updatePackField = useCallback(<K extends keyof CreditPack>(key: K, value: CreditPack[K]) => {
    setPackForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  /**
   * 打开新建积分包弹窗
   */
  const openCreatePack = useCallback(() => {
    setPackForm({ id: '', name: '', credits: 0, price: 0, expiryMonths: 3, recommended: false, sortOrder: 0, isActive: true })
    setPackDialog({ open: true, mode: 'create', index: -1 })
  }, [])

  /**
   * 打开编辑积分包弹窗
   */
  const openEditPack = useCallback(
    (pack: CreditPack, index: number) => {
      setPackForm({ ...pack })
      setPackDialog({ open: true, mode: 'edit', index })
    },
    [],
  )

  /**
   * 关闭积分包弹窗
   */
  const closePackDialog = useCallback(() => {
    setPackDialog({ open: false, mode: 'create', index: -1 })
  }, [])

  /**
   * 保存积分包
   */
  const handleSavePack = useCallback(async () => {
    const currentPacks = creditPacks ?? []
    let updatedPacks: CreditPack[]

    if (packDialog.mode === 'create') {
      const newPack: CreditPack = {
        ...packForm,
        id: packForm.id || `pack_${packForm.credits}`,
        code: packForm.code || packForm.id || `pack_${packForm.credits}`,
        isActive: packForm.isActive ?? true,
      }
      updatedPacks = [...currentPacks, newPack]
    } else {
      updatedPacks = currentPacks.map((p, i) => (i === packDialog.index ? { ...packForm } : p))
    }

    try {
      await updatePacksMutation.mutateAsync(updatedPacks)
      closePackDialog()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    }
  }, [creditPacks, packDialog, packForm, updatePacksMutation, closePackDialog])

  /**
   * 删除积分包
   */
  const handleDeletePack = useCallback(
    async (index: number) => {
      const currentPacks = creditPacks ?? []
      const updatedPacks = currentPacks.filter((_, i) => i !== index)
      try {
        await updatePacksMutation.mutateAsync(updatedPacks)
      } catch (err) {
        alert(err instanceof Error ? err.message : '删除失败')
      }
    },
    [creditPacks, updatePacksMutation],
  )

  const canSavePack = packForm.name.trim() !== '' && packForm.credits > 0 && packForm.price > 0

  /**
   * 跳转到用户积分详情页
   */
  const handleQueryUser = () => {
    const trimmed = userIdInput.trim()
    if (trimmed) {
      navigate(`/credits/users/${trimmed}`)
    }
  }

  /**
   * 触发过期批次清理
   */
  const handleCleanup = async () => {
    try {
      const result = await cleanupMutation.mutateAsync()
      alert(`清理完成：${result.batchesCleaned} 个批次过期，${result.creditsExpired} 积分回收`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '清理失败')
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">积分管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.CREDITS_PRICING}>
              管理定价
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {cleanupMutation.isPending ? '清理中...' : '清理过期批次'}
          </Button>
        </div>
      </div>

      {/* 用户积分查询 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">查询用户积分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="输入用户 ID"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQueryUser()
                }
              }}
              className="max-w-md"
            />
            <Button onClick={handleQueryUser} disabled={!userIdInput.trim()}>
              <Search className="mr-1 h-4 w-4" />
              查询
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            输入用户 ID 查看其积分余额和消费记录
          </p>
        </CardContent>
      </Card>

      {/* 模型定价预览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">模型定价一览</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.CREDITS_PRICING}>
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pricingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !pricings || pricings.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无模型定价配置</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">模型</th>
                    <th className="pb-2 pr-4 font-medium">输入价格</th>
                    <th className="pb-2 pr-4 font-medium">输出价格</th>
                    <th className="pb-2 pr-4 font-medium">倍率</th>
                    <th className="pb-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {pricings.slice(0, 5).map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div>
                          <span className="font-medium">{p.modelName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.modelId}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.inputPrice}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.outputPrice}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{p.multiplier}</td>
                      <td className="py-2">
                        <Badge variant={p.isActive ? 'default' : 'secondary'}>
                          {p.isActive ? '启用' : '停用'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pricings.length > 5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  还有 {pricings.length - 5} 条定价，
                  <Link to={ROUTES.CREDITS_PRICING} className="text-primary hover:underline">
                    查看全部
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 积分包管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">积分包管理</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={openCreatePack}>
              <Plus className="mr-1 h-4 w-4" />
              新增积分包
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {packsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !creditPacks || creditPacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无积分包配置</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">名称</th>
                    <th className="pb-2 pr-4 font-medium">积分</th>
                    <th className="pb-2 pr-4 font-medium">价格 (分)</th>
                    <th className="pb-2 pr-4 font-medium">有效期</th>
                    <th className="pb-2 pr-4 font-medium">排序</th>
                    <th className="pb-2 pr-4 font-medium">推荐</th>
                    <th className="pb-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {creditPacks.map((pack, index) => (
                    <tr key={pack.id || pack.code} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{pack.code || pack.id}</td>
                      <td className="py-2 pr-4 font-medium">{pack.name}</td>
                      <td className="py-2 pr-4">{pack.credits.toLocaleString()}</td>
                      <td className="py-2 pr-4 font-mono">
                        {(pack.price / 100).toFixed(2)} 元
                      </td>
                      <td className="py-2 pr-4">{pack.expiryMonths} 个月</td>
                      <td className="py-2 pr-4">{pack.sortOrder ?? '-'}</td>
                      <td className="py-2 pr-4">
                        {pack.recommended ? (
                          <Badge variant="default">推荐</Badge>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditPack(pack, index)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePack(index)}
                          >
                            <Trash2 className="h-3 w-3" />
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

      {/* 积分包编辑弹窗 */}
      <Dialog open={packDialog.open} onOpenChange={(open) => !open && closePackDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {packDialog.mode === 'create' ? '新增积分包' : '编辑积分包'}
            </DialogTitle>
            <DialogDescription>
              {packDialog.mode === 'create'
                ? '配置新的积分包供用户购买'
                : '修改积分包配置'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pack-id">积分包 ID</Label>
              <Input
                id="pack-id"
                value={packForm.id}
                onChange={(e) => updatePackField('id', e.target.value)}
                placeholder="例如: pack_600"
                disabled={packDialog.mode === 'edit'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-name">名称</Label>
              <Input
                id="pack-name"
                value={packForm.name}
                onChange={(e) => updatePackField('name', e.target.value)}
                placeholder="例如: 600积分包"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pack-credits">积分数量</Label>
                <Input
                  id="pack-credits"
                  type="number"
                  value={packForm.credits}
                  onChange={(e) => updatePackField('credits', Number(e.target.value))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pack-price">价格 (分)</Label>
                <Input
                  id="pack-price"
                  type="number"
                  value={packForm.price}
                  onChange={(e) => updatePackField('price', Number(e.target.value))}
                  min={1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-expiry">有效期 (月)</Label>
              <Input
                id="pack-expiry"
                type="number"
                value={packForm.expiryMonths}
                onChange={(e) => updatePackField('expiryMonths', Number(e.target.value))}
                min={1}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pack-sort-order">排序</Label>
                <Input
                  id="pack-sort-order"
                  type="number"
                  value={packForm.sortOrder ?? 0}
                  onChange={(e) => updatePackField('sortOrder', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="pack-recommended"
                  type="checkbox"
                  checked={packForm.recommended ?? false}
                  onChange={(e) => updatePackField('recommended', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="pack-recommended">推荐标记</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePackDialog}>
              取消
            </Button>
            <Button
              onClick={handleSavePack}
              disabled={!canSavePack || updatePacksMutation.isPending}
            >
              {updatePacksMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
