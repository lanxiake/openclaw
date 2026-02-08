import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  useSkillCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useSkills'
import type { SkillCategory, CategoryCreateInput, CategoryUpdateInput } from '@/types/skill'

/**
 * 分类管理页面
 */
export default function CategoriesPage() {
  // 获取分类列表
  const { data: categories, isLoading, isFetching, refetch } = useSkillCategories()

  // 操作 mutations
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  // 编辑对话框状态
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    category: SkillCategory | null
  }>({ open: false, mode: 'create', category: null })

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    category: SkillCategory | null
  }>({ open: false, category: null })

  // 表单状态
  const [formData, setFormData] = useState<{
    name: string
    code: string
    description: string
    icon: string
    sortOrder: number
    isActive: boolean
  }>({
    name: '',
    code: '',
    description: '',
    icon: 'folder',
    sortOrder: 1,
    isActive: true,
  })

  /**
   * 打开创建对话框
   */
  const openCreateDialog = useCallback(() => {
    setFormData({
      name: '',
      code: '',
      description: '',
      icon: 'folder',
      sortOrder: (categories?.length ?? 0) + 1,
      isActive: true,
    })
    setEditDialog({ open: true, mode: 'create', category: null })
  }, [categories])

  /**
   * 打开编辑对话框
   */
  const openEditDialog = useCallback((category: SkillCategory) => {
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || '',
      icon: category.icon || 'folder',
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    })
    setEditDialog({ open: true, mode: 'edit', category })
  }, [])

  /**
   * 关闭编辑对话框
   */
  const closeEditDialog = useCallback(() => {
    setEditDialog({ open: false, mode: 'create', category: null })
  }, [])

  /**
   * 保存分类
   */
  const handleSave = useCallback(async () => {
    try {
      if (editDialog.mode === 'create') {
        const input: CategoryCreateInput = {
          name: formData.name,
          code: formData.code,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          sortOrder: formData.sortOrder,
        }
        await createMutation.mutateAsync(input)
      } else if (editDialog.category) {
        const input: CategoryUpdateInput = {
          categoryId: editDialog.category.id,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          sortOrder: formData.sortOrder,
          isActive: formData.isActive,
        }
        await updateMutation.mutateAsync(input)
      }
      closeEditDialog()
    } catch (error) {
      console.error('保存失败:', error)
      alert(error instanceof Error ? error.message : '保存失败')
    }
  }, [editDialog, formData, createMutation, updateMutation, closeEditDialog])

  /**
   * 删除分类
   */
  const handleDelete = useCallback(async () => {
    if (!deleteDialog.category) return

    try {
      await deleteMutation.mutateAsync(deleteDialog.category.id)
      setDeleteDialog({ open: false, category: null })
    } catch (error) {
      console.error('删除失败:', error)
      alert(error instanceof Error ? error.message : '删除失败')
    }
  }, [deleteDialog, deleteMutation])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/skills">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">分类管理</h1>
            <p className="text-muted-foreground">管理技能分类</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新建分类
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 分类列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            分类列表
            {categories && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({categories.length})
              </span>
            )}
          </CardTitle>
          <CardDescription>拖拽排序分类显示顺序</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无分类，点击"新建分类"添加
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="outline">{category.code}</Badge>
                      {!category.isActive && (
                        <Badge variant="secondary">已禁用</Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {category.skillCount} 个技能
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(category)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteDialog({ open: true, category })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog.mode === 'create' ? '新建分类' : '编辑分类'}
            </DialogTitle>
            <DialogDescription>
              {editDialog.mode === 'create' ? '添加新的技能分类' : '修改分类信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">分类名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：系统工具"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">分类代码</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例如：system"
                disabled={editDialog.mode === 'edit'}
              />
              {editDialog.mode === 'edit' && (
                <p className="text-xs text-muted-foreground">分类代码创建后不可修改</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="分类描述..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">图标</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="例如：folder"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">排序</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
              />
            </div>
            {editDialog.mode === 'edit' && (
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">启用状态</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.code || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, category: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分类 "{deleteDialog.category?.name}" 吗？此操作不可撤销。
              {deleteDialog.category?.skillCount && deleteDialog.category.skillCount > 0 && (
                <span className="block mt-2 text-destructive">
                  注意：该分类下还有 {deleteDialog.category.skillCount} 个技能，请先移除或迁移这些技能。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
