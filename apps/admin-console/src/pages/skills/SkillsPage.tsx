import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Star,
  StarOff,
  Eye,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  Clock,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from '@/components/ui/dialog'
import { formatDateTime, cn } from '@/lib/utils'
import {
  SKILL_STATUS_LABELS,
  SKILL_SUBSCRIPTION_LABELS,
} from '@/lib/constants'
import {
  useSkillStats,
  useSkillList,
  useSkillDetail,
  useReviewSkill,
  usePublishSkill,
  useSetFeatured,
  useSkillCategories,
} from '@/hooks/useSkills'
import type { Skill, SkillListQuery, SkillStatus } from '@/types/skill'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 获取技能状态徽章变体
 */
function getStatusVariant(status: SkillStatus) {
  switch (status) {
    case 'published':
      return 'success'
    case 'pending':
      return 'default'
    case 'unpublished':
      return 'secondary'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * 获取订阅级别徽章变体
 */
function getSubscriptionVariant(subscription: string) {
  switch (subscription) {
    case 'free':
      return 'secondary'
    case 'pro':
      return 'default'
    case 'team':
      return 'success'
    case 'enterprise':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * 技能商店管理页面
 */
export default function SkillsPage() {
  // 搜索和过滤状态
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 详情弹窗状态
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'review' | 'publish' | 'featured'
    skill: Skill | null
    action?: string
  }>({ open: false, type: 'review', skill: null })

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300)

  // 构建查询参数
  const query: SkillListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? (statusFilter as SkillStatus) : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useSkillStats()

  // 获取技能列表
  const { data, isLoading, isFetching, refetch } = useSkillList(query)

  // 获取分类列表
  const { data: categories } = useSkillCategories()

  // 获取选中技能详情
  const { data: skillDetail } = useSkillDetail(selectedSkill?.id || '')

  // 操作 mutations
  const reviewMutation = useReviewSkill()
  const publishMutation = usePublishSkill()
  const featuredMutation = useSetFeatured()

  // 计算分页信息
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  /**
   * 打开确认对话框
   */
  const openConfirmDialog = useCallback(
    (type: 'review' | 'publish' | 'featured', skill: Skill, action?: string) => {
      setConfirmDialog({ open: true, type, skill, action })
    },
    []
  )

  /**
   * 关闭确认对话框
   */
  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, type: 'review', skill: null })
  }, [])

  /**
   * 执行确认操作
   */
  const handleConfirm = useCallback(async () => {
    const { type, skill, action } = confirmDialog
    if (!skill) return

    try {
      if (type === 'review') {
        await reviewMutation.mutateAsync({
          skillId: skill.id,
          action: action as 'approve' | 'reject',
        })
      } else if (type === 'publish') {
        await publishMutation.mutateAsync({
          skillId: skill.id,
          action: action as 'publish' | 'unpublish',
        })
      } else if (type === 'featured') {
        await featuredMutation.mutateAsync({
          skillId: skill.id,
          featured: action === 'set',
        })
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert(error instanceof Error ? error.message : '操作失败')
    }

    closeConfirmDialog()
  }, [confirmDialog, reviewMutation, publishMutation, featuredMutation, closeConfirmDialog])

  /**
   * 获取确认对话框配置
   */
  const getDialogConfig = () => {
    const { type, skill, action } = confirmDialog
    const skillName = skill?.name || '该技能'

    if (type === 'review') {
      return action === 'approve'
        ? {
            title: '确认通过审核',
            description: `确定要通过 "${skillName}" 的审核吗？通过后技能将自动上架。`,
            actionLabel: '通过',
          }
        : {
            title: '确认拒绝审核',
            description: `确定要拒绝 "${skillName}" 吗？`,
            actionLabel: '拒绝',
          }
    } else if (type === 'publish') {
      return action === 'publish'
        ? {
            title: '确认上架技能',
            description: `确定要上架 "${skillName}" 吗？`,
            actionLabel: '上架',
          }
        : {
            title: '确认下架技能',
            description: `确定要下架 "${skillName}" 吗？下架后用户将无法看到该技能。`,
            actionLabel: '下架',
          }
    } else {
      return action === 'set'
        ? {
            title: '确认设为推荐',
            description: `确定要将 "${skillName}" 设为推荐技能吗？`,
            actionLabel: '设为推荐',
          }
        : {
            title: '确认取消推荐',
            description: `确定要取消 "${skillName}" 的推荐吗？`,
            actionLabel: '取消推荐',
          }
    }
  }

  const dialogConfig = getDialogConfig()

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">技能商店管理</h1>
          <p className="text-muted-foreground">管理技能上架、审核和推荐</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/skills/categories">分类管理</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/skills/featured">推荐管理</Link>
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats?.totalSkills ?? 0}</div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">总技能数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="text-2xl font-bold text-green-500">{stats?.publishedSkills ?? 0}</div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">已上架</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div className="text-2xl font-bold text-blue-500">{stats?.pendingSkills ?? 0}</div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">待审核</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats?.totalInstalls?.toLocaleString() ?? 0}</div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">总安装量</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索技能名称、描述..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value: string) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="published">已上架</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                  <SelectItem value="unpublished">已下架</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(value: string) => {
                  setCategoryFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.code}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技能列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            技能列表
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total})</span>}
          </CardTitle>
          <CardDescription>平台所有技能及其状态</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.skills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有找到匹配的技能</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>技能</th>
                      <th>分类</th>
                      <th>状态</th>
                      <th>订阅级别</th>
                      <th>安装量</th>
                      <th>评分</th>
                      <th>推荐</th>
                      <th className="text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.skills.map((skill) => (
                      <tr key={skill.id}>
                        <td>
                          <div>
                            <p className="font-medium">{skill.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {skill.description}
                            </p>
                          </div>
                        </td>
                        <td>{skill.categoryName || skill.category}</td>
                        <td>
                          <Badge
                            variant={
                              getStatusVariant(skill.status) as
                                | 'success'
                                | 'default'
                                | 'secondary'
                                | 'destructive'
                            }
                          >
                            {SKILL_STATUS_LABELS[skill.status] || skill.status}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              getSubscriptionVariant(skill.subscription) as
                                | 'success'
                                | 'default'
                                | 'secondary'
                                | 'destructive'
                            }
                          >
                            {SKILL_SUBSCRIPTION_LABELS[skill.subscription] || skill.subscription}
                          </Badge>
                        </td>
                        <td className="text-sm">{skill.installCount.toLocaleString()}</td>
                        <td className="text-sm">
                          {skill.rating ? (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {skill.rating.toFixed(1)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {skill.featured ? (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <StarOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedSkill(skill)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {skill.status === 'pending' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => openConfirmDialog('review', skill, 'approve')}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                      通过审核
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openConfirmDialog('review', skill, 'reject')}
                                    >
                                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                      拒绝
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {skill.status === 'published' && (
                                  <DropdownMenuItem
                                    onClick={() => openConfirmDialog('publish', skill, 'unpublish')}
                                  >
                                    <ArrowDownCircle className="mr-2 h-4 w-4" />
                                    下架
                                  </DropdownMenuItem>
                                )}
                                {skill.status === 'unpublished' && (
                                  <DropdownMenuItem
                                    onClick={() => openConfirmDialog('publish', skill, 'publish')}
                                  >
                                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                                    重新上架
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {skill.featured ? (
                                  <DropdownMenuItem
                                    onClick={() => openConfirmDialog('featured', skill, 'unset')}
                                  >
                                    <StarOff className="mr-2 h-4 w-4" />
                                    取消推荐
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => openConfirmDialog('featured', skill, 'set')}
                                    disabled={skill.status !== 'published'}
                                  >
                                    <Star className="mr-2 h-4 w-4" />
                                    设为推荐
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    共 {data.total} 条，第 {page}/{totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 技能详情对话框 */}
      <Dialog open={!!selectedSkill} onOpenChange={() => setSelectedSkill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedSkill?.name}</DialogTitle>
            <DialogDescription>v{selectedSkill?.version}</DialogDescription>
          </DialogHeader>
          {skillDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">分类</p>
                  <p className="font-medium">{skillDetail.categoryName || skillDetail.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">作者</p>
                  <p className="font-medium">{skillDetail.author || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">状态</p>
                  <Badge variant={getStatusVariant(skillDetail.status) as 'success' | 'default' | 'secondary' | 'destructive'}>
                    {SKILL_STATUS_LABELS[skillDetail.status] || skillDetail.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">订阅级别</p>
                  <Badge variant={getSubscriptionVariant(skillDetail.subscription) as 'success' | 'default' | 'secondary' | 'destructive'}>
                    {SKILL_SUBSCRIPTION_LABELS[skillDetail.subscription] || skillDetail.subscription}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">安装量</p>
                  <p className="font-medium">{skillDetail.installCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">评分</p>
                  <p className="font-medium">
                    {skillDetail.rating ? `${skillDetail.rating.toFixed(1)} (${skillDetail.ratingCount} 评价)` : '暂无评分'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="font-medium">{formatDateTime(skillDetail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">发布时间</p>
                  <p className="font-medium">{skillDetail.publishedAt ? formatDateTime(skillDetail.publishedAt) : '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">描述</p>
                <p className="text-sm bg-muted p-3 rounded">{skillDetail.description}</p>
              </div>
              {skillDetail.tags && skillDetail.tags.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">标签</p>
                  <div className="flex flex-wrap gap-2">
                    {skillDetail.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {skillDetail.triggers && skillDetail.triggers.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">触发命令</p>
                  <div className="flex flex-wrap gap-2">
                    {skillDetail.triggers.map((trigger) => (
                      <code key={trigger} className="px-2 py-1 bg-muted rounded text-sm">
                        {trigger}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{dialogConfig.actionLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
