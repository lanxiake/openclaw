/**
 * 记忆默认模板管理页面
 *
 * 管理新用户初始化时使用的 Workspace 文件默认模板。
 * 支持查看、编辑和重置所有模板。
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, RotateCcw, Save, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  useMemoryDefaults,
  useUpdateMemoryDefault,
  useResetMemoryDefaults,
} from '@/hooks/useMemory'

interface TemplateData {
  key: string
  content: string
  fileName?: string
  updatedAt?: string
}

/**
 * 记忆默认模板管理页面
 */
export default function MemoryDefaultsPage() {
  const { data, isLoading, refetch, isFetching } = useMemoryDefaults()
  const updateMutation = useUpdateMemoryDefault()
  const resetMutation = useResetMemoryDefaults()

  /** 当前编辑的模板 */
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const templates: TemplateData[] = data ?? []

  /**
   * 开始编辑模板
   */
  const handleStartEdit = (template: TemplateData) => {
    setEditingKey(template.key)
    setEditContent(template.content)
  }

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingKey(null)
    setEditContent('')
  }

  /**
   * 保存编辑
   */
  const handleSave = async () => {
    if (!editingKey) return

    try {
      await updateMutation.mutateAsync({ key: editingKey, content: editContent })
      setEditingKey(null)
      setEditContent('')
    } catch (err) {
      console.error('更新模板失败:', err)
    }
  }

  /**
   * 重置所有模板
   */
  const handleResetAll = async () => {
    try {
      await resetMutation.mutateAsync()
    } catch (err) {
      console.error('重置模板失败:', err)
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
            <h1 className="text-2xl font-bold">记忆默认模板</h1>
            <p className="text-muted-foreground">
              管理新用户初始化时使用的 Workspace 文件模板
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                重置全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>重置所有模板</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要将所有默认模板重置为系统原始模板吗？此操作不会影响已有用户的个性化内容。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAll}>重置</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 模板列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无默认模板，请运行 seed 脚本初始化
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const isEditing = editingKey === template.key
            const fileName = template.fileName ?? extractFileName(template.key)

            return (
              <Card key={template.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      {fileName}
                      <Badge variant="outline" className="text-xs font-normal">
                        {template.key}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                            取消
                          </Button>
                          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {updateMutation.isPending ? '保存中...' : '保存'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(template)}
                        >
                          编辑
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={16}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <pre className="text-sm bg-muted/30 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap break-words">
                      {template.content}
                    </pre>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{template.content.length} 字符</span>
                    {template.updatedAt && <span>更新时间: {template.updatedAt}</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 说明 */}
      <Card>
        <CardContent className="pt-6">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>默认模板用于新用户注册时初始化 Workspace 文件内容</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>修改默认模板不会影响已有用户的个性化内容</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>"重置全部" 会将所有模板恢复为系统原始文件中的内容</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 从配置键提取文件名
 *
 * @param key - 配置键 (如 "memory.default.soul")
 * @returns 文件名 (如 "SOUL.md")
 */
function extractFileName(key: string): string {
  const parts = key.split('.')
  const name = parts[parts.length - 1]
  return `${name.toUpperCase()}.md`
}
