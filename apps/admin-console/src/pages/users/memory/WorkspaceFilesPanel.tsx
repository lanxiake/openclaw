/**
 * Workspace 文件管理面板
 *
 * 展示用户的 Workspace 文件列表，支持查看、编辑和重置为默认模板。
 */

import { useState } from 'react'
import { FileText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { formatDateTime } from '@/lib/utils'
import { useWorkspaceFiles, useUpdateWorkspaceFile, useResetWorkspaceFile } from '@/hooks/useMemory'

interface WorkspaceFileData {
  id: string
  fileName: string
  content: string
  isCustomized: boolean
  createdAt?: string
  updatedAt?: string
}

interface WorkspaceFilesPanelProps {
  userId: string
}

/**
 * Workspace 文件管理面板组件
 */
export default function WorkspaceFilesPanel({ userId }: WorkspaceFilesPanelProps) {
  const { data, isLoading } = useWorkspaceFiles(userId)
  const updateMutation = useUpdateWorkspaceFile(userId)
  const resetMutation = useResetWorkspaceFile(userId)

  /** 编辑状态 */
  const [editingFile, setEditingFile] = useState<WorkspaceFileData | null>(null)
  const [editContent, setEditContent] = useState('')

  /**
   * 打开编辑对话框
   */
  const handleEdit = (file: WorkspaceFileData) => {
    setEditingFile(file)
    setEditContent(file.content)
  }

  /**
   * 保存编辑
   */
  const handleSave = async () => {
    if (!editingFile) return

    try {
      await updateMutation.mutateAsync({
        fileName: editingFile.fileName,
        content: editContent,
      })
      setEditingFile(null)
    } catch (err) {
      console.error('更新文件失败:', err)
    }
  }

  /**
   * 重置文件为默认模板
   */
  const handleReset = async (fileName: string) => {
    try {
      await resetMutation.mutateAsync(fileName)
    } catch (err) {
      console.error('重置文件失败:', err)
    }
  }

  const files: WorkspaceFileData[] = data ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        该用户暂无 Workspace 文件
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div key={file.id} className="rounded-lg border overflow-hidden">
          {/* 文件头 */}
          <div className="flex items-center justify-between p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{file.fileName}</span>
              {file.isCustomized && (
                <Badge variant="outline" className="text-xs">已自定义</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(file)}>
                编辑
              </Button>
              {file.isCustomized && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" title="重置为默认模板">
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      重置
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>重置文件</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要将 "{file.fileName}" 重置为默认模板吗？用户的自定义内容将被覆盖。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleReset(file.fileName)}>
                        重置
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* 文件内容预览 */}
          <div className="p-3">
            <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-words">
              {file.content.length > 500 ? `${file.content.slice(0, 500)}...` : file.content}
            </pre>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{file.content.length} 字符</span>
              {file.updatedAt && <span>更新: {formatDateTime(file.updatedAt)}</span>}
            </div>
          </div>
        </div>
      ))}

      {/* 编辑对话框 */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑 {editingFile?.fileName}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>取消</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
