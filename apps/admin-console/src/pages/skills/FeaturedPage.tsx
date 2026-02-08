import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  GripVertical,
  Star,
  Trash2,
  Package,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { SKILL_SUBSCRIPTION_LABELS } from '@/lib/constants'
import { useFeaturedSkills, useSetFeatured, useReorderFeatured } from '@/hooks/useSkills'
import type { Skill } from '@/types/skill'

/**
 * 推荐管理页面
 */
export default function FeaturedPage() {
  // 获取推荐技能列表
  const { data: featuredSkills, isLoading, isFetching, refetch } = useFeaturedSkills()

  // 操作 mutations
  const setFeaturedMutation = useSetFeatured()
  const reorderMutation = useReorderFeatured()

  // 删除确认对话框状态
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean
    skill: Skill | null
  }>({ open: false, skill: null })

  /**
   * 移除推荐
   */
  const handleRemove = useCallback(async () => {
    if (!removeDialog.skill) return

    try {
      await setFeaturedMutation.mutateAsync({
        skillId: removeDialog.skill.id,
        featured: false,
      })
      setRemoveDialog({ open: false, skill: null })
    } catch (error) {
      console.error('移除推荐失败:', error)
      alert(error instanceof Error ? error.message : '移除推荐失败')
    }
  }, [removeDialog, setFeaturedMutation])

  /**
   * 上移
   */
  const handleMoveUp = useCallback(async (index: number) => {
    if (!featuredSkills || index <= 0) return

    const newOrder = [...featuredSkills]
    const [removed] = newOrder.splice(index, 1)
    newOrder.splice(index - 1, 0, removed)

    try {
      await reorderMutation.mutateAsync(newOrder.map((s) => s.id))
    } catch (error) {
      console.error('排序失败:', error)
      alert(error instanceof Error ? error.message : '排序失败')
    }
  }, [featuredSkills, reorderMutation])

  /**
   * 下移
   */
  const handleMoveDown = useCallback(async (index: number) => {
    if (!featuredSkills || index >= featuredSkills.length - 1) return

    const newOrder = [...featuredSkills]
    const [removed] = newOrder.splice(index, 1)
    newOrder.splice(index + 1, 0, removed)

    try {
      await reorderMutation.mutateAsync(newOrder.map((s) => s.id))
    } catch (error) {
      console.error('排序失败:', error)
      alert(error instanceof Error ? error.message : '排序失败')
    }
  }, [featuredSkills, reorderMutation])

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
            <h1 className="text-2xl font-bold">推荐管理</h1>
            <p className="text-muted-foreground">管理首页推荐技能</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* 说明卡片 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <Star className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">推荐技能</p>
              <p className="text-muted-foreground">
                推荐技能将在技能商店首页展示。拖拽或使用上下箭头调整显示顺序。
                最多可设置 10 个推荐技能。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 推荐技能列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            推荐列表
            {featuredSkills && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({featuredSkills.length}/10)
              </span>
            )}
          </CardTitle>
          <CardDescription>拖拽排序调整推荐顺序</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !featuredSkills || featuredSkills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无推荐技能</p>
              <p className="text-sm mt-2">
                在<Link to="/skills" className="text-primary hover:underline">技能列表</Link>中将技能设为推荐
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {featuredSkills.map((skill, index) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{skill.name}</span>
                      <Badge variant="outline">{skill.categoryName || skill.category}</Badge>
                      <Badge variant="secondary">
                        {SKILL_SUBSCRIPTION_LABELS[skill.subscription] || skill.subscription}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-md">
                      {skill.description}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {skill.installCount.toLocaleString()} 次安装
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || reorderMutation.isPending}
                    >
                      <span className="text-lg">↑</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === featuredSkills.length - 1 || reorderMutation.isPending}
                    >
                      <span className="text-lg">↓</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveDialog({ open: true, skill })}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 移除确认对话框 */}
      <AlertDialog
        open={removeDialog.open}
        onOpenChange={(open) => !open && setRemoveDialog({ open: false, skill: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除推荐</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将 "{removeDialog.skill?.name}" 从推荐列表中移除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
