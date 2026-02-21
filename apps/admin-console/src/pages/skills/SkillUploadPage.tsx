/**
 * 技能上传页面
 *
 * 独立的全屏页面，参考 ClawHub 截图布局设计。
 * 左侧表单 + 右侧文件上传，下方验证和更新日志。
 * 支持文件夹选择和拖拽上传，前端打包 zip 后上传。
 */

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FolderOpen,
  File,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useFileUpload, formatFileSize } from '@/hooks/useFileUpload'
import { useCreateSkill, useUploadSkillPackage } from '@/hooks/useSkills'

/** 发布流程步骤 */
type PublishStep = 'idle' | 'creating' | 'packaging' | 'uploading' | 'done' | 'error'

/**
 * 技能上传页面组件
 */
export default function SkillUploadPage() {
  const navigate = useNavigate()
  const folderInputRef = useRef<HTMLInputElement>(null)

  // 表单状态
  const [slug, setSlug] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [tags, setTags] = useState('latest')
  const [changelog, setChangelog] = useState('')

  // 发布状态
  const [publishStep, setPublishStep] = useState<PublishStep>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)

  // 拖拽高亮状态
  const [isDragOver, setIsDragOver] = useState(false)

  // 文件上传 hook
  const {
    files,
    totalCount,
    totalSize,
    validation,
    isPackaging: _isPackaging,
    addFolder,
    addDroppedItems,
    removeFile,
    clearFiles,
    createZipBlob,
  } = useFileUpload({ slug, displayName, version })

  // API mutations
  const createSkillMutation = useCreateSkill()
  const uploadPackageMutation = useUploadSkillPackage()

  /**
   * 处理文件夹选择
   */
  const handleFolderSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFolder(e.target.files)
      }
    },
    [addFolder]
  )

  /**
   * 处理拖拽放入
   */
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        await addDroppedItems(e.dataTransfer.items)
      }
    },
    [addDroppedItems]
  )

  /**
   * 处理拖拽进入
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  /**
   * 执行发布流程
   *
   * 1. 创建技能记录
   * 2. 打包文件为 zip
   * 3. 上传 zip 包
   * 4. 跳转回列表页
   */
  const handlePublish = useCallback(async () => {
    if (!validation.valid) {
      return
    }

    setPublishError(null)

    try {
      // Step 1: 创建技能记录
      setPublishStep('creating')
      const skill = await createSkillMutation.mutateAsync({
        name: slug.trim(),
        description: displayName.trim(),
        version: version.trim() || '1.0.0',
        tags: tags
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : ['latest'],
        readme: changelog.trim() || undefined,
      })

      const skillId = (skill as { id: string }).id

      // Step 2: 打包文件为 zip
      setPublishStep('packaging')
      const zipBlob = await createZipBlob()

      // Step 3: 上传 zip 包
      setPublishStep('uploading')
      const zipFile = new globalThis.File([zipBlob], `${slug}.zip`, { type: 'application/zip' })
      await uploadPackageMutation.mutateAsync({ skillId, file: zipFile })

      setPublishStep('done')

      // 成功后跳转回列表
      setTimeout(() => {
        navigate('/skills')
      }, 1500)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '发布技能失败'
      setPublishError(errorMsg)
      setPublishStep('error')
    }
  }, [
    slug,
    displayName,
    version,
    tags,
    changelog,
    validation,
    createSkillMutation,
    uploadPackageMutation,
    createZipBlob,
    navigate,
  ])

  /** 是否正在发布中 */
  const isPublishing =
    publishStep === 'creating' || publishStep === 'packaging' || publishStep === 'uploading'

  /** 获取发布按钮文本 */
  const getPublishButtonText = () => {
    switch (publishStep) {
      case 'creating':
        return '创建技能中...'
      case 'packaging':
        return '打包文件中...'
      case 'uploading':
        return '上传中...'
      case 'done':
        return '发布成功！'
      default:
        return '发布技能'
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/skills">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回技能管理
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold">发布一项技能</h1>
        <p className="text-muted-foreground">
          放一个文件夹，里面有 SKILL.md 和文本文件。剩下的我们会处理。
        </p>
      </div>

      {/* 主体区域：左侧表单 + 右侧文件上传 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：表单 */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* 技能标识 */}
            <div className="space-y-2">
              <Label htmlFor="upload-slug">技能标识（Slug）</Label>
              <Input
                id="upload-slug"
                placeholder="my-awesome-skill"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isPublishing}
              />
              <p className="text-xs text-muted-foreground">
                仅允许小写字母、数字和连字符
              </p>
            </div>

            {/* 显示名称 */}
            <div className="space-y-2">
              <Label htmlFor="upload-display-name">显示名称</Label>
              <Input
                id="upload-display-name"
                placeholder="我的技能"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isPublishing}
              />
            </div>

            {/* 版本 */}
            <div className="space-y-2">
              <Label htmlFor="upload-version">版本</Label>
              <Input
                id="upload-version"
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={isPublishing}
              />
            </div>

            {/* 标签 */}
            <div className="space-y-2">
              <Label htmlFor="upload-tags">标签</Label>
              <Input
                id="upload-tags"
                placeholder="latest"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={isPublishing}
              />
            </div>
          </CardContent>
        </Card>

        {/* 右侧：文件上传区域 */}
        <Card>
          <CardContent className="pt-6">
            {/* 文件上传区域标题 */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">放一个文件夹</h3>
              <span className="text-sm text-muted-foreground">
                {totalCount} 个文件 · {formatFileSize(totalSize)}
              </span>
            </div>

            {/* 拖拽区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <p className="text-sm text-muted-foreground mb-3">
                我们保留文件夹路径，并自动将外层封装器压平。
              </p>

              {/* 隐藏的 input，支持 webkitdirectory */}
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                onChange={handleFolderSelect}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                multiple
                disabled={isPublishing}
              />

              <Button
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={isPublishing}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                选择文件夹
              </Button>
            </div>

            {/* 文件列表 */}
            <div className="mt-4">
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">没有选择任何文件。</p>
              ) : (
                <div className="max-h-[240px] overflow-y-auto space-y-1">
                  {files.map((entry) => (
                    <div
                      key={entry.relativePath}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 group text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={entry.relativePath}>
                          {entry.relativePath}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(entry.size)}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => removeFile(entry.relativePath)}
                          disabled={isPublishing}
                          title="移除文件"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 清空按钮 */}
            {files.length > 0 && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFiles}
                  disabled={isPublishing}
                >
                  清空所有文件
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 下方区域：验证 + 更新日志 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 验证 */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">验证</h3>
            <div className="space-y-2">
              {validation.items.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-sm">
                  {item.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className={item.passed ? 'text-muted-foreground' : ''}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 更新日志 */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">更新日志</h3>
            <Textarea
              placeholder="描述一下这项技能发生了哪些变化......"
              rows={5}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              disabled={isPublishing}
            />
          </CardContent>
        </Card>
      </div>

      {/* 发布按钮区域 */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            {publishError && <p className="text-sm text-destructive">{publishError}</p>}
            {publishStep === 'done' && (
              <p className="text-sm text-green-600">技能发布成功！正在跳转...</p>
            )}
          </div>
          <Button
            size="lg"
            onClick={handlePublish}
            disabled={!validation.valid || isPublishing || publishStep === 'done'}
          >
            {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isPublishing && <Upload className="mr-2 h-4 w-4" />}
            {getPublishButtonText()}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
