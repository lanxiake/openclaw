/**
 * 事实管理面板
 *
 * 展示用户事实列表，支持筛选、搜索、编辑和删除。
 */

import { useState } from 'react'
import { Pencil, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/utils'
import { useMemoryFacts, useUpdateMemoryFact, useDeleteMemoryFact } from '@/hooks/useMemory'

/** 事实分类选项 */
const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部分类' },
  { value: 'personal', label: '个人信息' },
  { value: 'work', label: '工作' },
  { value: 'hobby', label: '兴趣爱好' },
  { value: 'skill', label: '技能' },
  { value: 'relationship', label: '人际关系' },
  { value: 'health', label: '健康' },
  { value: 'finance', label: '财务' },
  { value: 'other', label: '其他' },
]

/** 分类标签颜色映射 */
const CATEGORY_COLORS: Record<string, string> = {
  personal: 'bg-blue-100 text-blue-800',
  work: 'bg-purple-100 text-purple-800',
  hobby: 'bg-green-100 text-green-800',
  skill: 'bg-yellow-100 text-yellow-800',
  relationship: 'bg-pink-100 text-pink-800',
  health: 'bg-red-100 text-red-800',
  finance: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
}

interface FactsData {
  id: string
  category: string
  key: string
  value: string
  confidence: number
  source: string
  sensitive: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

interface FactsPanelProps {
  userId: string
}

/**
 * 事实管理面板组件
 */
export default function FactsPanel({ userId }: FactsPanelProps) {
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const { data, isLoading } = useMemoryFacts(userId, {
    category: category !== 'all' ? category : undefined,
    activeOnly: true,
    limit: pageSize,
    offset: page * pageSize,
  })

  const updateMutation = useUpdateMemoryFact(userId)
  const deleteMutation = useDeleteMemoryFact(userId)

  /** 编辑对话框状态 */
  const [editingFact, setEditingFact] = useState<FactsData | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editConfidence, setEditConfidence] = useState(0)

  /**
   * 打开编辑对话框
   */
  const handleEdit = (fact: FactsData) => {
    setEditingFact(fact)
    setEditValue(fact.value)
    setEditConfidence(fact.confidence)
  }

  /**
   * 提交编辑
   */
  const handleSaveEdit = async () => {
    if (!editingFact) return

    try {
      await updateMutation.mutateAsync({
        factId: editingFact.id,
        value: editValue,
        confidence: editConfidence,
      })
      setEditingFact(null)
    } catch (err) {
      console.error('更新事实失败:', err)
    }
  }

  /**
   * 删除事实
   */
  const handleDelete = async (factId: string) => {
    try {
      await deleteMutation.mutateAsync(factId)
    } catch (err) {
      console.error('删除事实失败:', err)
    }
  }

  const facts = data?.facts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          共 {total} 条记录
        </div>
      </div>

      {/* 事实列表 */}
      {facts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          暂无事实数据
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((fact: FactsData) => (
            <div
              key={fact.id}
              className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[fact.category] ?? CATEGORY_COLORS.other}`}>
                    {CATEGORY_OPTIONS.find((o) => o.value === fact.category)?.label ?? fact.category}
                  </span>
                  <span className="font-medium text-sm">{fact.key}</span>
                  {fact.sensitive && <Badge variant="destructive" className="text-xs">敏感</Badge>}
                </div>
                <p className="text-sm text-foreground truncate">{fact.value}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>置信度: {Math.round(fact.confidence * 100)}%</span>
                  <span>来源: {fact.source}</span>
                  {fact.updatedAt && <span>更新: {formatDateTime(fact.updatedAt)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(fact)} title="编辑">
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="删除">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除事实 "{fact.key}" 吗？此操作将停用该记录。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(fact.id)}>删除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 编辑对话框 */}
      <Dialog open={!!editingFact} onOpenChange={(open) => !open && setEditingFact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑事实</DialogTitle>
          </DialogHeader>
          {editingFact && (
            <div className="space-y-4">
              <div>
                <Label>分类</Label>
                <p className="text-sm text-muted-foreground">{editingFact.category}</p>
              </div>
              <div>
                <Label>键</Label>
                <p className="text-sm text-muted-foreground">{editingFact.key}</p>
              </div>
              <div>
                <Label htmlFor="edit-value">值</Label>
                <Textarea
                  id="edit-value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-confidence">置信度 ({Math.round(editConfidence * 100)}%)</Label>
                <Input
                  id="edit-confidence"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={editConfidence}
                  onChange={(e) => setEditConfidence(Number.parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFact(null)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
